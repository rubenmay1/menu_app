# Meal Planner App — Claude Code Project Brief

## Project Goal
Angular + TypeScript + Ionic mobile app for Android. No server required. SQLite stored on-device.
Dropbox used for DB backup and restore only. Coded in VS Code, tested in browser and emulator, deployed as APK.

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
- `@capacitor/browser` — opens external browser for Dropbox OAuth flow
- `@capacitor-community/sqlite` — on-device SQLite via native Android SQLite engine
- `jeep-sqlite` — browser mock of SQLite using IndexedDB, for local dev and testing
- `dropbox` — official Dropbox SDK for backup and restore

---

## Dropbox OAuth

- Register a free app at the Dropbox developer portal to obtain an **App Key**
- Use **PKCE OAuth flow** — App Secret is not required in client code, only the App Key
- The App Key is safe to ship in client code — it identifies the app, not the user
- Register `mealplanner://dropbox-callback` as an allowed redirect URI in the Dropbox developer portal
- On first launch, check local storage for an existing access token:
  - **Token absent** — show Connect to Dropbox screen
  - **Token present** — skip straight to main app
- After the user approves access, store the returned access token in local storage for all future launches

---

## SQLite Backup Strategy

- Export DB to JSON using `sqlite.exportToJson('full')`
- Upload the JSON string as a text file to Dropbox
- On restore, download the file and call `sqlite.importFromJson(jsonString)`
- This avoids handling raw binary `.db` file bytes

---

## Dev and Test Workflow

| Stage | Script | Notes |
|---|---|---|
| UI + logic dev | `serve.ps1` | Fast iteration, instant reload in Chrome |
| DB dev and testing | `serve-db.ps1` | Enables jeep-sqlite mock in browser |
| Full integration | `emulator-live.ps1` | Live reload on emulator, real SQLite |
| Deploy to device | `device.ps1` | Physical Android device |
| Release APK | `package.ps1` | Opens Android Studio for signing |

---

## PowerShell Scripts

All scripts live in a `scripts/` folder in the project root.

### `scripts/serve.ps1`
Browser dev with live reload.

### `scripts/serve-db.ps1`
Browser dev with jeep-sqlite DB mock enabled.

### `scripts/build.ps1`
Production build and sync to Android project.

### `scripts/emulator.ps1`
Build, sync, and launch on Android emulator.

### `scripts/emulator-live.ps1`
Live reload directly on the emulator. Best for integration dev.

### `scripts/device.ps1`
Build, sync, and deploy to a physical Android device.

### `scripts/package.ps1`
Open Android Studio to build and sign a release APK.

### `scripts/sync.ps1`
Sync to Android project without rebuilding. Use when only native config has changed.

---

## Current App State

### Tab Structure
Five tabs (in order): **Plan**, **Shopping**, **Meals**, **Tags**, **Settings**.
All pages share an identical `<ion-header>` with `<span class="app-title">Menu</span>` inside `ion-title`. Never use a page-specific title — the tab bar selection is the navigation indicator.

### Plan Page
- **Week view**: Mon–Sun as vertical cards, ISO 8601 week numbering, swipe left/right to change week.
- **Day cards**: header row (day name + date) + sub-item list. No add button on card.
- **Long-press (500 ms) on header row** → opens day editor bottom panel (add/delete/reorder items for that day).
- **Tap a sub-item** → opens a stub popup (centered modal, `z-index: 2000`). To be built out.
- **No day-level tag** — tags are on sub-menu items only, not on the day itself.

### Tags Page
- Tags are global (not per-week): `id`, `name`, `color`.
- Tag list shows pills. **press a pill** → edit panel (name + color picker + Save + Delete).
- FAB `+` button hides when any panel is open.
- **No swipe-to-delete** — editing and deletion happen inside the long-press editor panel.

### Data / Storage (localStorage keys)
| Key | Value | Notes |
|---|---|---|
| `tags` | JSON `Tag[]` | Global tag list |
| `day-submenus-{dayIndex}` | JSON `SubMenu[]` | Sub-menu structure per day-of-week (shared across all weeks) |
| `week-meals-{year}-{week}-{dayIndex}` | JSON `WeekMealEntry[]` | Meal selections per week per day |

### Shared Utilities
- `src/app/shared/week-utils.ts` — pure ISO week helpers (`getISOWeek`, `getISOWeekYear`, `getMondayOfISOWeek`, `formatShortDate`).
- `src/app/shared/tag-pill.component.ts` — `<app-tag-pill name color size>`. Sizes: `'sm'` (default, inline) and `'md'` (tags list). Exported from `SharedModule`.
- `SharedModule` must be imported by any feature module that uses `app-tag-pill`.

---

## Design System

### Typography
| Use | Font | Weight | Notes |
|---|---|---|---|
| App title ("MENU") | Barrio | — | `.app-title` class in global.scss |
| Section/panel titles, day names, week label | Inter | 600 | |
| Body text, notes, dates, labels, inputs | Inter | 400–600 | |

Google Fonts loaded in `src/index.html`: `Barrio`, `Inter:wght@400;500;600`.

### Colour Palette
16 preset hex values defined as `PRESET_COLORS` in `src/app/plan/plan.models.ts`. This is the single source of truth — import from there whenever a colour picker is needed.

### Interaction Patterns
**Long-press**: `pointerdown` starts a 500 ms `setTimeout`; `pointerup` / `pointerleave` cancel it via `clearTimeout`. Store timers in a `Map<key, timer>` when multiple elements can be pressed simultaneously; a single `ReturnType<typeof setTimeout> | null` field when only one element can be pressed at a time.

**Bottom panel (bottom sheet)**: `position: fixed; inset: 0; z-index: 1000` backdrop + slide-up panel with `border-radius: 16px 16px 0 0`. Clicking the backdrop closes it.

**Centered modal (popup)**: `position: fixed; inset: 0; z-index: 2000; align-items: center; justify-content: center`. Higher z-index than bottom panels so it sits above them.

**Week swipe gesture**: `touchstart`/`touchend` listeners on the `IonContent` element. 60 px horizontal threshold, 0.5 max vertical ratio guard. Registered as `{ passive: true }`.

**Drag reorder**: Use `<ion-reorder-group>` + `<ion-reorder>` (available via `IonicModule`, no extra package). In the `(ionItemReorder)` handler call `event.detail.complete(myArray)` — it returns the reordered array and reverts the DOM animation so Angular can re-render.

### Standard Delete Button
Apply `class="btn-delete"` and `fill="outline"` to any `ion-button` for a destructive action style. Defined in `src/global.scss`:
- Outlined style: `rgb(255, 180, 171)` border and text, transparent background.
- Always include `<ion-icon slot="start" name="trash-outline"></ion-icon>` for consistency.

### FAB Visibility
Hide FABs when panels are open: `*ngIf="!panelAVisible && !panelBVisible"`.

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
- All SQLite access goes through a dedicated **`DbService`** — components never call SQLite directly
- All Dropbox access goes through a dedicated **`DropboxService`** — never call the Dropbox SDK directly from components
- Use **Angular dependency injection** for all services
- Group related files by **feature folder**, not by type (e.g. `meals/` contains component, service, and model together)
- Use **`readonly`** on class properties that should not be reassigned
- Always handle `Promise` rejections — no unhandled async errors
- Environment-specific behaviour (e.g. jeep-sqlite vs real SQLite) must be isolated in the relevant service, not scattered across components

---

## UI Design Guidelines: Material Dark Theme

### 1. Background & Surface Hierarchy
This system uses a tiered elevation model based on Material Design 3 principles for dark themes. Surfaces "closer" to the user are rendered in lighter shades of grey.

| Layer | Component | RGB Color | Hex Code |
| :--- | :--- | :--- | :--- |
| **Level 0** | Main App Background | `rgb(0, 0, 0)` | `#000000` |
| **Level 1** | Base Cards / Content Blocks | `rgb(30, 30, 30)` | `#1E1E1E` |
| **Level 2** | Bottom Slide-out (Popup) | `rgb(45, 45, 45)` | `#2D2D2D` |
| **Level 3** | Cards within Popup | `rgb(60, 60, 60)` | `#3C3C3C` |

---

### 2. Interactive Components

#### Buttons
To avoid visual conflict between brand colors (Pink/Red) and destructive actions, we use **High-Emphasis** for primary actions and **Medium-Emphasis** for destructive ones.

* **Save / Confirm (Primary Action):**
    * **Style:** Filled Button.
    * **Color:** Primary Brand Color (Deep Pink/Red).
    * **Text:** High-contrast (White or Black depending on luminance).
* **Delete (Destructive Action):**
    * **Style:** Outlined Button.
    * **Color:** Error State Red (`rgb(255, 180, 171)` for border/text).
    * **Logic:** The outline reduces visual weight so it does not compete with the Primary "Save" button.

#### Pills / Chips (Selection State)
Selection must be indicated by more than just color to ensure accessibility.

* **Unselected State:** Outlined or desaturated background.
* **Selected State:** * **Leading Icon:** A checkmark (tick) icon must appear to the left of the label.
    * **Background:** Filled with a lighter tonal version of the primary color or a high-contrast grey.

---

### 3. Elevation Rules
1. **Never Revert to Black:** When nesting elements (like a card inside a slide-out), the inner element must always be **lighter** than its container.
2. **Contrast:** Maintain a minimum 3:1 contrast ratio between a card and the surface it sits upon.
3. **Corner Radius:**
    * Slide-out: `28dp` (top only).
    * Internal Cards: `12dp` (all corners).

---

## Key Constraints

- **No backend server** — the app is fully offline-first
- **SQLite is the only data store** — no Firebase, no REST API, no cloud DB
- **Dropbox is backup and restore only** — not a live sync target
- **Android Studio is a background tool only** — never used as an editor, only for SDK and emulator
- **`npx cap sync`** must be run after every `ng build` before testing on emulator or device — `build.ps1` handles this automatically
- **`USE_JEEP_SQLITE=true`** environment flag must be checked in `DbService` at runtime to swap between jeep-sqlite (browser) and the real Capacitor SQLite plugin (device)
