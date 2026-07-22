---
name: Metro web global vs window
description: In Metro's web bundle, globalThis and global are the React Native shim object, not the browser window. DOM APIs must be accessed via window/document directly.
---

## Rule
Never use `globalThis.AudioContext`, `globalThis.Audio`, or any other DOM/browser API via `globalThis` or `global` in Expo/Metro web code. They will be `undefined`.

## Why
Metro's bundler sets `global` to a React Native shim object so RN code works cross-platform. In the browser bundle, `global !== window`. `globalThis` in that context resolves to the RN global, not the browser `window`. So `globalThis.AudioContext`, `globalThis.Audio`, `globalThis.document` etc. are all `undefined`.

## How to apply
- For HTMLAudioElement: `document.createElement("audio")` — `document` is the real DOM document, not shimmed.
- For AudioContext: `(window as any).AudioContext ?? (window as any).webkitAudioContext` — `window` is the real browser window.
- For any web-only API: use `window.X` or `document.X`, never `globalThis.X` or `(global as any).X`.
- Guard with `typeof document !== "undefined"` / `typeof window !== "undefined"` before use.
- Music in Last Scrap was working because it used `document.createElement("audio")` correctly. SFX was broken because it used `(globalThis as any).Audio` and later `(globalThis as any).AudioContext` — both undefined.
