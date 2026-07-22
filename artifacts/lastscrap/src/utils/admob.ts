import { Platform } from "react-native";

// Lazy-loaded AdMob module — prevents crash when native bindings are missing.
let AdMobModule: typeof import("react-native-google-mobile-ads") | null = null;
async function getAdMob(): Promise<typeof import("react-native-google-mobile-ads")> {
  if (AdMobModule) return AdMobModule;
  try {
    AdMobModule = await import("react-native-google-mobile-ads");
    return AdMobModule;
  } catch {
    throw new Error("AdMob not available");
  }
}

// Use test IDs in development / simulator; swap to production IDs before release.
const REWARDED_UNIT = Platform.OS === "android"
  ? "ca-app-pub-7612157133930737/9671096657"  // Android rewarded
  : "ca-app-pub-7612157133930737/3459927657"; // iOS rewarded
const INTERSTITIAL_UNIT = Platform.OS === "android"
  ? "ca-app-pub-7612157133930737/6342850301"  // Android interstitial
  : "ca-app-pub-7612157133930737/1234567890"; // iOS interstitial placeholder

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rewardedInstance: any | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let interstitialInstance: any | null = null;
let rewardedReady = false;
let interstitialReady = false;
let initPromise: Promise<void> | null = null;

function getUnitId(unit: string, TestIds: any): string {
  // Expo dev / simulator should use test IDs so real ads don't fail.
  if (typeof __DEV__ !== "undefined" && __DEV__) return TestIds.REWARDED;
  return unit;
}

export async function initAdMob(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const mod = await getAdMob();
      await mod.MobileAds().initialize();
    } catch {
      // Initialization may fail on web or unsupported platforms — harmless.
    }
  })();
  return initPromise;
}

export async function preloadRewardedAd(): Promise<boolean> {
  await initAdMob();
  if (rewardedReady && rewardedInstance?.loaded) return true;
  try {
    const mod = await getAdMob();
    const ad = mod.RewardedAd.createForAdRequest(getUnitId(REWARDED_UNIT, mod.TestIds), {
      requestNonPersonalizedAdsOnly: true,
    });
    rewardedInstance = ad;
    rewardedReady = false;
    ad.addAdEventListener(mod.AdEventType.LOADED, () => {
      rewardedReady = true;
    });
    ad.addAdEventListener(mod.AdEventType.ERROR, () => {
      rewardedReady = false;
    });
    ad.addAdEventListener(mod.AdEventType.CLOSED, () => {
      rewardedReady = false;
      rewardedInstance = null;
    });
    await ad.load();
    return ad.loaded;
  } catch {
    rewardedReady = false;
    return false;
  }
}

export function showRewardedAd(onRewarded: () => void, onClosed: () => void): void {
  const ad = rewardedInstance;
  if (!ad || !ad.loaded) {
    onClosed();
    return;
  }
  getAdMob().then((mod) => {
    let earned = false;
    ad.addAdEventListener(mod.RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
      onRewarded();
    });
    ad.addAdEventListener(mod.AdEventType.CLOSED, () => {
      rewardedReady = false;
      rewardedInstance = null;
      onClosed();
    });
    ad.show().catch(() => {
      rewardedReady = false;
      rewardedInstance = null;
      onClosed();
    });
  }).catch(() => {
    onClosed();
  });
}

export async function preloadInterstitialAd(): Promise<boolean> {
  await initAdMob();
  if (interstitialReady && interstitialInstance?.loaded) return true;
  try {
    const mod = await getAdMob();
    const ad = mod.InterstitialAd.createForAdRequest(getUnitId(INTERSTITIAL_UNIT, mod.TestIds), {
      requestNonPersonalizedAdsOnly: true,
    });
    interstitialInstance = ad;
    interstitialReady = false;
    ad.addAdEventListener(mod.AdEventType.LOADED, () => {
      interstitialReady = true;
    });
    ad.addAdEventListener(mod.AdEventType.ERROR, () => {
      interstitialReady = false;
    });
    ad.addAdEventListener(mod.AdEventType.CLOSED, () => {
      interstitialReady = false;
      interstitialInstance = null;
    });
    await ad.load();
    return ad.loaded;
  } catch {
    interstitialReady = false;
    return false;
  }
}

export function maybeShowInterstitial(wavesCleared: number): void {
  // Show an interstitial every 3 waves (3, 6, 9, ...) as a natural break.
  if (wavesCleared > 0 && wavesCleared % 3 === 0) {
    const ad = interstitialInstance;
    if (ad && ad.loaded) {
      ad.show().catch(() => {
        interstitialReady = false;
        interstitialInstance = null;
      });
    } else {
      // Preload for next opportunity
      preloadInterstitialAd().catch(() => {});
    }
  }
}
