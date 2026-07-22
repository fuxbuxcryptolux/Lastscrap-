import { Platform, AppState, type AppStateStatus } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { storage } from "./storage";

const DEVICE_ID_KEY = "lastscrap_device_id";

export async function getDeviceId(): Promise<string> {
  const existing = await storage.getItem<string>(DEVICE_ID_KEY, "");
  if (existing && typeof existing === "string" && existing.length > 0) {
    return existing;
  }
  const id =
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36);
  await storage.setItem(DEVICE_ID_KEY, id);
  return id;
}

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (domain) return `https://${domain}`;
  return "";
}

export async function purchaseUniform(uniformId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const deviceId = await getDeviceId();
    const base = getApiBase();
    const successUrl = Linking.createURL("scrapyard?purchase=success");
    const cancelUrl = Linking.createURL("scrapyard?purchase=cancelled");

    const resp = await fetch(`${base}/api/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uniformId, deviceId, successUrl, cancelUrl }),
    });

    if (!resp.ok) {
      const data = await resp.json() as { error?: string };
      return { ok: false, error: data.error ?? "Server error" };
    }

    const { url } = await resp.json() as { url: string };

    if (Platform.OS === "web") {
      await Linking.openURL(url);
    } else {
      await WebBrowser.openBrowserAsync(url, {
        dismissButtonStyle: "close",
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
      });
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getEntitlements(): Promise<string[]> {
  try {
    const deviceId = await getDeviceId();
    const base = getApiBase();
    const resp = await fetch(`${base}/api/stripe/entitlements?deviceId=${encodeURIComponent(deviceId)}`);
    if (!resp.ok) return [];
    const data = await resp.json() as { uniforms?: string[] };
    return data.uniforms ?? [];
  } catch {
    return [];
  }
}

export function watchForPurchaseReturn(onReturn: () => void): () => void {
  let lastState: AppStateStatus = AppState.currentState;
  const sub = AppState.addEventListener("change", (nextState) => {
    if (lastState.match(/inactive|background/) && nextState === "active") {
      onReturn();
    }
    lastState = nextState;
  });
  return () => sub.remove();
}
