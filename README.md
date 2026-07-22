# LAST SCRAP

_"SURVIVE. SCRAP. REPEAT."_

**Last Scrap** is a top-down, twin-stick survival game built with Expo/React Native. You play the Operator, a lone scavenger-soldier defending the RIG — a reactor core and your only source of power — against endless waves of the infected in a post-apocalyptic wasteland. Kill zombies to earn Scrap, spend it between waves on gear upgrades, and survive as long as you can.

See [`lastscrap-game-overview.md`](./lastscrap-game-overview.md) for the full design reference: core loop, player stats, weapons, zombie types, wave/economy systems, UI surfaces, and visual style guide.

## Repo layout

This is a pnpm workspace monorepo. The game itself lives at `artifacts/lastscrap`.

- `artifacts/lastscrap` — the Last Scrap Expo/React Native app (game engine in `src/game`, screens in `app/`, components in `components/` and `src/components`)
- `artifacts/api-server` — Express API server
- `artifacts/mockup-sandbox` — UI mockup sandbox
- `lib/` — shared packages (`api-zod`, `api-client-react`, `api-spec`, `db`)
- `scripts/` — workspace tooling scripts

## Run & operate

- `pnpm install` — install workspace dependencies
- `pnpm --filter @workspace/lastscrap run dev` — run the Last Scrap Expo dev server
- `pnpm --filter @workspace/lastscrap run test` — run unit tests (vitest)
- `pnpm --filter @workspace/lastscrap run test:e2e` — run e2e tests (Playwright)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- Expo (~54) + React Native (0.81) + React 19, TypeScript
- `expo-router` for navigation, React Query for data fetching
- pnpm workspaces, Node.js 24, TypeScript 5.9
