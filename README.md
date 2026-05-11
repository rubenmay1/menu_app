# Menu

Weekly meal planner for Android. Plan meals day-by-day, build a shopping list from ingredients, and back up data to Dropbox.

Built on Ionic Angular + Capacitor. All data stored in localStorage — no server required.

## Run

```bash
npm install
npx ionic serve        # web preview
npx cap open android   # device/emulator
```

## Scripts

- `scripts/run-web.ps1` — `ionic serve` with live reload
- `scripts/emulator.ps1` — build, sync, and launch on Android emulator
- `scripts/publish-apk-{minor,medium,major}-change.ps1` — version bump → sync → open Android Studio

## Docs

- [`CLAUDE.md`](./CLAUDE.md) — architecture + decisions
- [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) — UI conventions
