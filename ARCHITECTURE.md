# Menu - Architecture

Weekly meal planner for Android. Built on Ionic Angular + Capacitor. Targets Android first; web is supported as a development shim and a landing host for shareable links.

## Concept

The app is organised around a single ISO 8601 week. For each day of the week the user keeps a list of slots (e.g. Lunch, Dinner) and assigns a meal from a global meal library, or types a custom name. A separate Extras card collects week-level items that don't belong to a specific day. The shopping list is derived from the meals planned for the visible week.

There are no accounts, no server, and no live sync. All data lives in `localStorage` on the device. Dropbox is used as an opt-in backup target. Plan + meal sharing happens via deep links that encode their payload directly in the URL.

## Tab structure

Six tabs (in order): **Plan**, **List**, **Shared**, **Meals**, **Tags**, **Settings**. Settings is always visible; every other tab can be toggled on or off in Settings -> Tabs.

When the app is viewing a shared plan (read-only mode) the tab bar is hidden and a `.read-mode-bar` appears at the top of the screen. The mode is held in `ViewPlanService` and reset by tapping the bar.

## Persistence

Everything lives in `localStorage` as JSON strings. The key shapes are stable across versions; if a shape changes, `DbService` migrates the data at load time (see "Load-time migrations" below).

| Key | Type | Notes |
| --- | --- | --- |
| `tags` | `Tag[]` | Global tag list |
| `meals` | `Meal[]` | Global meal library |
| `day-submenus-{dayIndex}` | `SubMenu[]` | Slot template per day-of-week (0-6), shared across all weeks |
| `week-meals-{year}-{week}-{dayIndex}` | `WeekMealEntry[]` | Meals chosen for each slot in one day of one ISO week |
| `week-extras-{year}-{week}` | `ExtraEntry[]` | Week-level extras (not tied to a day) |
| `shared-plan-history` | `SharedPlanRecord[]` | History of opened shared plans, used by the Shared tab |
| `tab-visibility` | object | Per-tab show/hide preferences |
| `frozen-threshold-weeks` | string (number) | Weeks before a meal shows the snowflake icon |
| `tutorial-completed` | `"1"` | First-launch tutorial has run |
| `dropbox-access-token` / `dropbox-refresh-token` | string | Dropbox OAuth credentials |
| `dropbox-code-verifier` | string | Transient PKCE verifier during OAuth |
| `dropbox-last-sync` | ISO string | Heartbeat used to drive the weekly backup prompt |
| `dropbox-connect-dismissed` | `"true"` | User dismissed the "connect to Dropbox?" prompt |

`SubMenu` IDs are stable across weeks. `WeekMealEntry.itemId` points at a `SubMenu.id` and `WeekMealEntry.mealId` points at the global meal - both indirections keep the plan robust to renames (`DbService.propagateMealRename` updates `mealName` on existing entries when a meal is renamed).

`isDataKey()` defines what counts as user data for export, restore, and "Reset App Data" - Dropbox tokens and tutorial flags are intentionally not in that set.

## Data flow

All `localStorage` access goes through `DbService`. Feature services (`PlanService`, `MealService`, `TagService`, `SharedPlansService`) are thin wrappers that expose typed read/write methods over `DbService`. Components never touch `localStorage` directly.

`DbService.dataChanged$` is an RxJS subject that fires on mutations which affect multiple pages (import, restore, reset, clearWeek). Pages subscribe to it where useful, but freshness on tab switch is mostly handled by `ionViewWillEnter()`.

## Sharing: link payloads

Two share flows, both encoded as LZString-compressed JSON in a `?data=` query param:

- **Single meal** -> `menu-app://import-meal?data=...` (or `https://rubenmay1.github.io/menu_app/import-meal/?data=...` on web)
- **Tags + meals bundle** -> `menu-app://import?data=...`
- **Read-only plan view** -> `menu-app://view-plan?data=...`

The `docs/` folder is the GitHub Pages source. Each shareable path has its own `docs/<path>/index.html` that reads the `data` query param and immediately redirects to the matching `menu-app://` custom scheme. Capacitor intercepts that scheme as an `appUrlOpen` event and `AppComponent.dispatchUrl` routes it to the right handler.

The HTML fallback shows "Opening Menu app..." for users without the app installed. Cold launches use `App.getLaunchUrl()` to catch the URL that arrived before the listener registered.

### Adding a new routable URL

1. Create `docs/<path>/index.html` (copy an existing one and update the `menu-app://<path>` target).
2. Add `{ path: '<path>', redirectTo: 'tabs', pathMatch: 'full' }` to `app-routing.module.ts`.
3. Add a handler in `app.component.ts` - in both the web path check (`this.initialPath === '/<path>'`) and the `dispatchUrl` switch.
4. In `dispatchUrl`, place more-specific paths **before** less-specific ones (e.g. `import-meal` before `import`) - the switch is a `startsWith` chain and prefix collisions resolve to the first match.

## Dropbox backup

Backup is full-snapshot, single-file. `DbService.exportAll()` collects every data key into one JSON blob; `DbService.importAll()` clears the existing data keys and rewrites them. Both halves are deliberately stupid - no merge, no diff, no per-key sync.

OAuth uses PKCE with the public app key baked in (`DropboxService.APP_KEY`). The flow:
1. User taps "Connect" -> open `https://www.dropbox.com/oauth2/authorize?...` (Capacitor `Browser.open` on native, full-page redirect on web).
2. Dropbox redirects to `menu-app://dropbox-callback?code=...`. On web this is `<origin>/dropbox-callback`.
3. `handleCallback()` exchanges the code for `access_token` + `refresh_token` and stores both in `localStorage`.
4. `getValidToken()` prefers the refresh token (long-lived) and silently refreshes the access token on every sync.

Backup file: `/menu-backup.json` at the root of the app's Dropbox folder. Mode is `overwrite`, so the file is replaced on every sync.

Weekly backup prompt: if `dropbox-last-sync` is more than 7 days old, the user sees a centered sync prompt on app open. First-launch connect prompt is suppressed if the user dismissed it (`dropbox-connect-dismissed`).

## Notifications

Optional per-slot meal reminders. When a slot has a `mealTime` set on the underlying `SubMenu` (e.g. "12:30"), picking a meal for that slot schedules a local notification at the next occurrence of that time on the slot's date. The notification ID is stored on the `WeekMealEntry` (`notificationId` + `notificationTime`) so it can be cancelled when the meal is cleared or the slot is reassigned.

`NotificationService` is a thin wrapper around `@capacitor/local-notifications`:
- Channel `menu_reminders` (importance 4) is created on Android only.
- `schedule()` and `cancel()` are no-ops on web - the web shim is unreliable, so the plan UI gracefully degrades.
- Permission is requested lazily; web returns `false` without prompting.

Stale notifications are cleaned up at load time: when the Plan page resolves a week, any `WeekMealEntry`/`ExtraEntry` with `notificationTime <= now` has its `notificationId` and `notificationTime` cleared on disk. There is no background verifier - notifications are a soft feature, missing one is acceptable.

## Web vs Android

The web build is used both for development (`ionic serve`) and as the GitHub Pages host for shareable links. Two pieces of glue make that work:

- `NotificationService` early-returns on `Capacitor.getPlatform() === 'web'` - schedule and channel create are no-ops, permission check returns false.
- `DropboxService.redirectUri` returns `menu-app://dropbox-callback` on native and `<origin>/dropbox-callback` on web; the Angular router has `/dropbox-callback` mapped to redirect to `tabs`, and `AppComponent.ngOnInit` reads the URL synchronously on first load before that redirect fires.
- Link-import dispatch in `ngOnInit` runs on the original `window.location.pathname` (captured into `__initialPath` by `index.html` before Angular boots) so deep-link payloads survive the route redirect to `tabs`.

## Load-time migrations

`DbService.initialize()` runs two normalisations on every boot:

- `seedDefaultsIfNeeded()` - if no day submenus exist, seeds Lunch + Dinner for each day-of-week.
- `backfillMealIds()` - earlier versions stored only `mealName` on `WeekMealEntry`/`ExtraEntry`, so renaming a meal silently broke the link. This pass looks up the current meal id by name and writes it back. Safe to delete after 2027-05-14.

`getMeals()` also normalises any pre-tagIds meals (single `tagId` field) into the current `tagIds: string[]` shape at read time.

## App boot sequence

1. `index.html` captures `window.location.pathname` and `window.location.href` into globals before any script runs (used by the deep-link dispatch).
2. `AppComponent.ngOnInit()` initialises `DbService` (which runs migrations) and dispatches any web-side deep link.
3. A 1.6s splash + 0.4s fade is shown; the tutorial runs on first launch (`tutorial-completed` flag).
4. The connect / weekly-sync Dropbox prompts run after the splash.
5. `App.addListener('appUrlOpen', ...)` registers for native deep-link dispatch, and `App.getLaunchUrl()` picks up any URL that arrived during cold start.

## Reliability matrix

| Failure | Recovery |
| --- | --- |
| User clears app data | Intentional; all state gone, defaults reseed on next launch |
| Dropbox token revoked / expired refresh token | Surfaced as "session expired" alert; user reconnects from Settings |
| Notification missed (phone off, app killed) | Accepted; reminder is best-effort |
| Shared link truncated by sharing app | Import alert tells the user the link is corrupted, asks them to share again directly |
| Meal renamed after being added to a plan | `propagateMealRename()` updates all stored entries by `mealId`; `backfillMealIds()` repairs pre-migration entries |
| User imports a meal/tag that already exists by name | Existing record is overwritten (same id preserved); the import success dialog reports `N added, M overwritten` |

## Things deliberately not in this app

- **No SQLite, no backend, no live sync.** All data is `localStorage`; Dropbox is a backup target only.
- **No background runner.** Reminders are fire-and-forget local notifications; if one is missed the chain doesn't try to recover it.
- **No accounts.** Shared plans are stateless URLs; there is no "my account" anywhere.
