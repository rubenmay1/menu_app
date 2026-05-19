# Menu

A weekly meal planner for Android. Plan meals day-by-day, build a shopping list from each meal's ingredients, and share a week's plan or a single meal as a link.

Built on Ionic Angular + Capacitor. Everything is stored in `localStorage` on the device - no accounts, no server, no live sync. Dropbox is an opt-in backup target.

## Why

Most meal-planning apps want you to sign in, pick a subscription, and sync recipes from their library. Menu doesn't. The whole app runs offline against a few dozen `localStorage` keys, and the only cloud surface is a single Dropbox backup file. Sharing is done by encoding the payload into the URL itself, so a "shared plan" link contains the plan - no server lookup, no expiry.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design.

## Features

- Weekly plan: Mon-Sun day cards with editable per-day slots (Lunch, Dinner, etc.). Slots are templated per day-of-week and shared across all weeks.
- Shopping list derived from the planned meals' ingredients, with an "incomplete plan" indicator if any slot is unfilled.
- Meal library with tags, recipe URLs, ingredient lists, and last-used / frozen-after-N-weeks indicators.
- Share a single meal or a whole week as a deep link (compressed with `lz-string`, no server hop).
- History of opened shared plans, grouped by recency.
- Optional Dropbox backup with a weekly nudge to back up if you haven't recently.
- Optional local notifications when a slot has a meal time set.
- Configurable tab visibility - hide tabs you don't use.

## Tech stack

- Ionic 8 / Angular 20
- Capacitor 8 (Android)
- `@capacitor/local-notifications` for meal-time reminders
- `@capacitor/browser` + `dropbox` SDK for backup
- `lz-string` for compact shareable URLs
- `localStorage` for persistence

## Development

```bash
npm install
npx ionic serve        # web preview
npx cap open android   # device / emulator
```

The web build doubles as the GitHub Pages host for shareable deep-link landing pages (see `docs/`). Local notifications are stubbed on web - the rest of the app works.

## Scripts (PowerShell)

| Script | What it does |
| --- | --- |
| `scripts/run-web.ps1` | `ionic serve` with live reload |
| `scripts/emulator.ps1` | Build, sync, and launch on the Android emulator |
| `scripts/publish-apk-patch.ps1` | Bump patch (1.2.5 -> 1.2.6), build, open Android Studio for signing |
| `scripts/publish-apk-minor.ps1` | Bump minor (1.2 -> 1.3) |
| `scripts/publish-apk-major.ps1` | Bump major (1.9.3 -> 2.0.0) |
| `scripts/sync-version.ps1` | Copy `versionName` from Gradle into the Angular environment files |

Publish pipeline (`scripts/publish-base.ps1`): bump `versionCode` + `versionName` in `android/app/build.gradle` -> sync into `environment.ts` -> `ionic build --prod` -> `cap sync` -> open Android Studio for signed APK.

## Docs

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - persistence keys, sharing, Dropbox, notifications, web-vs-Android
- [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) - UI conventions, tokens, component patterns
- [`CLAUDE.md`](./CLAUDE.md) - dev-environment + UI/UX brief used by Claude Code agents
