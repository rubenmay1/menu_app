# Menu - Weekly Meal Planner App — Claude Code Project Brief

@ARCHITECTURE.md
@STYLE_GUIDE.md

## Project Goal
Angular + TypeScript + Ionic mobile app for Android. No server required. All data stored in localStorage on-device.
Dropbox used for DB backup and restore only. Coded in VS Code, tested in browser, deployed as APK.

See `ARCHITECTURE.md` for the system design (persistence keys, sharing, Dropbox, notifications, web-vs-Android). This file holds the dev-environment and UI/UX brief that an agent needs at the start of every session.

---

## Dev Environment

### Required Tools
- **Node.js** + **npm**
- **Angular CLI** — `npm install -g @angular/cli`
- **Ionic CLI** — `npm install -g @ionic/cli`
- **VS Code** — primary editor, all coding happens here
- **Android Studio** — not used for coding; required for Android SDK, Gradle, and emulator only
- **Java JDK** — required by Android build toolchain
- **`ANDROID_HOME`** environment variable must point to Android SDK path

### Required Libraries
- `@ionic/angular` — mobile UI component library
- `@capacitor/core` — bridges Angular web app to native Android
- `@capacitor/cli` — Capacitor CLI tooling
- `@capacitor/android` — Android platform target
- `@capacitor/app` — Capacitor app lifecycle events (used for `appUrlOpen` deep-link handling)
- `@capacitor/browser` — opens external browser for Dropbox OAuth flow
- `@capacitor/filesystem` — file system access (used for Dropbox backup file handling)
- `@capacitor/share` — native share sheet for sharing meals and week plans
- `dropbox` — official Dropbox SDK for backup and restore
- `lz-string` — LZString compression for shareable URL payloads

---

## Dropbox Backup Strategy

- `DbService.exportAll()` serialises all app localStorage keys to a single JSON string
- Upload that JSON string as a text file to Dropbox via `DropboxService`
- On restore, download the file and call `DbService.importAll(json)` — clears existing data then writes all keys back
- All data is localStorage; no SQLite or binary file handling involved

---

## PowerShell Scripts

All scripts live in a `scripts/` folder in the project root.

### `scripts/run-web.ps1`
Browser dev with live reload.

### `scripts/emulator.ps1`
Build, sync, and launch on Android emulator.

### `scripts/publish-apk-major.ps1`
Bump major version (x.0.0). Delegates to `publish-base.ps1` which bumps `versionCode` + `versionName` in `android/app/build.gradle`, runs `sync-version.ps1`, builds with `ionic build --prod`, runs `npx cap sync`, then opens Android Studio for signed APK packaging.

### `scripts/publish-apk-minor.ps1`
Bump minor version (1.x.0). Same pipeline as major.

### `scripts/publish-apk-patch.ps1`
Bump patch version (1.1.x). Same pipeline as major.

### `scripts/publish-base.ps1`
Shared publish pipeline. Not called directly - the three `publish-apk-*` scripts pass it the new versionName.

### `scripts/sync-version.ps1`
Reads `versionName` from `android/app/build.gradle` and writes it into both `environment.ts` and `environment.prod.ts`. Run this after manually editing the Gradle version.

---

## Current App State

### Tab Structure
Six tabs (in order): **Plan**, **List**, **Shared**, **Meals**, **Tags**, **Settings**.
All tabs except Settings are individually toggleable by the user via Settings → Tabs. Settings is always visible.
All pages share an identical `<ion-header>` with `<span class="app-title">Menu</span>` inside `ion-title`. Never use a page-specific title — the tab bar selection is the navigation indicator.

When viewing a shared plan in read-only mode, a read-mode bar is displayed and the tab bar is hidden.

### Plan Page
- **Week view**: Mon–Sun as vertical cards, ISO 8601 week numbering, swipe left/right to change week.
- **Day cards**: header row (day name + date) + sub-item list. No add button on card.
- **Long-press (500 ms) on day header row** → opens day editor bottom panel (add/delete/reorder items for that day).
- **Tap a sub-item** → opens item picker popup (centered modal, `z-index: 2000`) to assign a meal from the meals list or type a custom name. Includes filter toggle and flame/snowflake indicators.
- **Extras card** below the day cards — add meals that don't belong to a specific day. Custom name entry with optional star. Remove button per entry.
- Week nav bar: previous/next week arrows, current week button, share button (generates shareable link), clear week button.
- **No day-level tag** — tags are on sub-menu items only, not on the day itself.

### List Page (Shopping)
- Displays the shopping/ingredient list for the current week.
- Shows a plan-incomplete warning (`warning-outline` icon + grey text) above the list if the week has unfilled slots.

### Shared Page
- Displays history of shared plans the user has previously opened, grouped by recency (This week, Last week, This month, etc.).
- **Long-press a row** → delete confirmation dialog appears (bottom-anchored, not a centered popup).
- Tap a row → opens the shared plan in read-only mode.

### Meals Page
- Full meals list with search bar and tag filter pills.
- **Tap a meal row** → recipe tooltip popup with:
  - **Share this meal** button (outline) — shares a compressed URL via native share sheet
  - **Go to Recipe** button (outline, shown only if recipe URL set) — opens URL in browser
  - **Edit** button (outline) — opens meal editor bottom panel
- Meal editor bottom panel: name, recipe URL, tags, ingredients, star toggle, Save + Delete.
- FAB `+` adds a new meal.

### Tags Page
- Tags are global (not per-week): `id`, `name`, `color`.
- Tag list shows pills. **Tap a pill** → edit panel (name + color picker + Save + Delete).
- FAB `+` button hides when any panel is open.
- **No swipe-to-delete** — editing and deletion happen inside the edit panel.

### Settings Page
- **Dropbox**: connect/disconnect, back up now, restore from Dropbox.
- **Sharing**: export tags & meals as JSON file, import tags & meals from JSON file.
- **Tabs**: toggles to show/hide Plan, List, Shared, Meals, Tags tabs individually.
- **Meal Picker**: frozen threshold stepper (weeks before showing snowflake icon).
- **Data**: View Data popup (total DB size KB, meal count, tag count, weeks planned) + Reset App Data (2-step confirmation).
- App version number displayed at the bottom.

### Data / Storage
See `ARCHITECTURE.md` for the full list of localStorage keys, the sharing/Dropbox/notification design, and load-time migrations. The summary: every data key goes through `DbService`; feature services (`PlanService`, `MealService`, `TagService`, `SharedPlansService`) are thin typed wrappers; components never touch `localStorage` directly.

### Shared Utilities
- `src/app/shared/week-utils.ts` — pure ISO week helpers (`getISOWeek`, `getISOWeekYear`, `getMondayOfISOWeek`, `formatShortDate`).
- `src/app/shared/tag-pill.component.ts` — `<app-tag-pill name color size>`. Sizes: `'sm'` (default, inline) and `'md'` (tags list). Exported from `SharedModule`.
- `SharedModule` must be imported by any feature module that uses `app-tag-pill`.
- `src/app/shared/db.service.ts` — all localStorage access and `getDataStats()` for settings View Data popup.

---

## Design System

Full visual and component reference is in `STYLE_GUIDE.md` (imported above). Key quick-reference points:

- **Fonts**: Barrio (app title only), Inter (everything else). Loaded in `src/index.html`.
- **Tag colour palette**: `PRESET_COLORS` in `src/app/plan/plan.models.ts` — single source of truth for the colour picker.
- **Shared CSS classes**: defined in `global.scss` — never redefine `.backdrop`, `.bottom-panel`, `.panel-title`, `.text-input`, `.empty-state`, `.tag-overflow-badge`, `.tag-sel-pill`, etc. in component SCSS files.

### Interaction Patterns
**Long-press**: `pointerdown` starts a 500 ms `setTimeout`; `pointerup` / `pointerleave` cancel it via `clearTimeout`. Store timers in a `Map<key, timer>` when multiple elements can be pressed simultaneously; a single `ReturnType<typeof setTimeout> | null` field when only one element can be pressed at a time.

**Week swipe gesture**: `touchstart`/`touchend` listeners on the `IonContent` element. 60 px horizontal threshold, 0.5 max vertical ratio guard. Registered as `{ passive: true }`.

**Drag reorder**: Use `<ion-reorder-group>` + `<ion-reorder>` (available via `IonicModule`, no extra package). In the `(ionItemReorder)` handler call `event.detail.complete(myArray)` — it returns the reordered array and reverts the DOM animation so Angular can re-render.

### FAB Visibility
Hide FABs when panels are open: `*ngIf="!panelAVisible && !panelBVisible"`.

---

## GitHub Pages Routing

The app is hosted at `https://rubenmay1.github.io/menu_app/`. The `docs/` folder is the GitHub Pages source (configured in repo settings).

### How deep-link routing works
Each URL path the app needs to handle has its own `docs/<path>/index.html`. On page load, the HTML reads the `?data=` query param and immediately redirects to the `menu-app://` custom scheme, which Capacitor intercepts as an `appUrlOpen` event. The page also shows a "Opening Menu app…" fallback in case the app is not installed.

### Adding a new routable URL
When adding a new shareable/importable link:
1. Create `docs/<path>/index.html` — copy an existing one and update the `menu-app://<path>` redirect target.
2. Add `{ path: '<path>', redirectTo: 'tabs', pathMatch: 'full' }` to `app-routing.module.ts`.
3. Add a handler in `app.component.ts` — in both the `ngOnInit` web path check (`this.initialPath === '/<path>'`) and the `dispatchUrl` switch (`url.startsWith('menu-app://<path>')`).
4. In `dispatchUrl`, place more-specific paths **before** less-specific ones (e.g. `import-meal` before `import`) to avoid prefix collisions on `startsWith` checks.

### Existing routes

| URL path | `docs/` file | Handler in `app.component.ts` | Purpose |
|---|---|---|---|
| `/dropbox-callback` | — | `handleCallback` | Dropbox OAuth return |
| `/import` | `docs/import/index.html` | `handleMealsAndTagsImportUrl` | Import tags & meals bundle |
| `/import-meal` | `docs/import-meal/index.html` | `handleMealImportUrl` | Import single meal |
| `/view-plan` | `docs/view-plan/index.html` | `handleViewPlanUrl` | View a shared week plan |

---

## Angular / Ionic Gotchas

### Angular 20 — `standalone: false` required
Angular 20 defaults to standalone components. All components in this project use **NgModule architecture** (`standalone: false`). Every `@Component` must explicitly declare `standalone: false`, otherwise NgModule declarations fail with `NG6008`.

### Ionic Shadow DOM — `ion-title`
Do **not** use `ion-title::part(native)` to style the title text — it is unreliable with Ionic's shadow DOM. Instead put a `<span class="app-title">` directly inside `<ion-title>` (light DOM) and style the span.

### Style Binding — clear with `''` not `null`
When conditionally clearing an inline style, use `[style.background-color]="condition ? value : ''"`. Using `null` has inconsistent cross-browser behaviour in Angular style bindings and may leave the stale style applied.

### Component Style Budget
`anyComponentStyle` budget raised to `6 kb` warning / `10 kb` error in `angular.json`. Do not lower it.

### `ionViewWillEnter` for cross-tab freshness
Use `ionViewWillEnter()` (not `ngOnInit`) to refresh data that may have changed on another tab. Example: Plan page re-resolves tag names/colours when returning from the Tags tab.

---

## Coding Conventions

- Always use **explicit TypeScript types** — avoid `any`
- Use `async`/`await` over raw Promises
- Use **`interface`** for data models, not `class` unless behaviour is needed
- Services must follow **single responsibility principle**
- All localStorage access goes through a dedicated **`DbService`** — components never call `localStorage` directly
- All Dropbox access goes through a dedicated **`DropboxService`** — never call the Dropbox SDK directly from components
- Use **Angular dependency injection** for all services
- Group related files by **feature folder**, not by type (e.g. `meals/` contains component, service, and model together)
- Use **`readonly`** on class properties that should not be reassigned
- Always handle `Promise` rejections — no unhandled async errors
- Environment-specific behaviour (web shim vs Android native) must be isolated in the relevant service, not scattered across components

---

## Key Constraints

- **No backend server** — the app is fully offline-first
- **`localStorage` is the only data store** — no SQLite, no Firebase, no REST API, no cloud DB
- **Dropbox is backup and restore only** — not a live sync target
- **Android Studio is a background tool only** — never used as an editor, only for SDK and emulator
- **`npx cap sync`** must be run after every `ng build` before testing on emulator or device — the publish pipeline handles this automatically
