import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Asset } from "expo-asset";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./global.css";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const GAME_IMAGES = [
  require("../assets/images/game/arena.png"),
  require("../assets/images/game/rig.png"),
  require("../assets/images/game/hero.png"),
  require("../assets/images/game/turret.png"),
  require("../assets/images/game/zombie_walker_b1.png"),
  require("../assets/images/game/zombie_walker_b2.png"),
  require("../assets/images/game/zombie_walker_b3.png"),
  require("../assets/images/game/zombie_runner_b4.png"),
  require("../assets/images/game/zombie_runner_b5.png"),
  require("../assets/images/game/zombie_brute.png"),
];

export default function RootLayout() {
  const [assetsReady, setAssetsReady] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
    ...FontAwesome5.font,
  });

  useEffect(() => {
    Asset.loadAsync(GAME_IMAGES)
      .then(() => setAssetsReady(true))
      .catch(() => setAssetsReady(true)); // don't block on failure
  }, []);

  const ready = (fontsLoaded || !!fontError) && assetsReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#080808" }}>
            <KeyboardProvider>
              <StatusBar style="light" backgroundColor="#080808" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: "#080808" },
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false, animation: "fade" }} />
                <Stack.Screen name="game" options={{ headerShown: false, animation: "none" }} />
              </Stack>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
