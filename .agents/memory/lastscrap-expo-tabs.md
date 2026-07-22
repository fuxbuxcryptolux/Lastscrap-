---
name: Last Scrap Expo scaffold issue
description: The Expo scaffold's (tabs) directory uses expo-router/unstable-native-tabs which crashes Metro bundler; must be removed when the app does not use tabs.
---

The Expo scaffold creates `app/(tabs)/_layout.tsx` which imports `expo-router/unstable-native-tabs`. This import causes Metro to crash silently (port 18491 fails to open) when the app doesn't use tabs.

**Why:** `unstable-native-tabs` is an experimental API that may not resolve cleanly in all expo-router versions. When the `(tabs)` route group is not referenced in the root `_layout.tsx`, it still gets bundled by Expo Router's file-based routing, causing the crash.

**How to apply:** Any time an Expo artifact is set up with a custom layout that removes `(tabs)`, also `rm -rf app/(tabs)` from the scaffold. The `+not-found.tsx` can stay — it does not cause issues.
