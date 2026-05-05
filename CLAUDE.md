# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Dev server on port 4701
npm run build-bundle   # Production webpack build → dist/
npm run lint           # ESLint on src/
npm run lint:fix       # ESLint with auto-fix
npx tsc                # Type-check without emitting
npm test               # Jest (all test files)
npm run test:watch     # Jest in watch mode
```

## Architecture

This is a **BigBlueButton HTML Plugin** built with React + TypeScript. Its sole purpose is to detect specially-formatted JSON embedded in presentation slide text and surface those links as toolbar buttons.

### Data flow

```
Slide text (textUri) → use-current-slide-text → raw text string
raw text string → use-smart-slide-links → SmartSlideLink[]
SmartSlideLink[] → component.tsx → PresentationToolbarButton[]
```

1. [src/hooks/use-current-slide-text.ts](src/hooks/use-current-slide-text.ts) — uses `PluginApi` from the BBB SDK to get the current slide's `textUri`, fetches it, and returns the raw text content.
2. [src/hooks/use-smart-slide-links.ts](src/hooks/use-smart-slide-links.ts) — searches for a `BBB` marker in the slide text, parses the JSON that follows it, validates each entry has `url` and `label`, and returns a `SmartSlideLink[]`.
3. [src/main/component.tsx](src/main/component.tsx) — initializes `BbbPluginSdk`, calls both hooks, and registers `PresentationToolbarButton` items (one per link) that open URLs in a new tab.
4. [src/index.tsx](src/index.tsx) — bootstraps React, reading `uuid` and plugin name from the script element's `data-*` attributes.

### SDK integration

The plugin depends on `bigbluebutton-html-plugin-sdk`. Plugin registration and toolbar button APIs come from this package. The SDK instance is created once in `MainComponent` via `BbbPluginSdk.initialize(pluginName)`.

### Build output

Webpack produces a single UMD bundle at `dist/BbbPluginSmartSlideLink.js` plus a copied `manifest.json`. The dev server serves both at `localhost:4701`. In production the bundle is deployed to `/var/www/bigbluebutton-default/assets/plugins/bbb-plugin-smart-slide-link/`.

### Linting

ESLint uses the Airbnb TypeScript config. CI runs `npm run lint` and `npx tsc` on every PR — both must pass.
