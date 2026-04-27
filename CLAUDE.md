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

## Project Setup

```bash
ionic start meal-planner blank --type=angular --capacitor
cd meal-planner
npm install @capacitor/browser
npm install @capacitor-community/sqlite jeep-sqlite
npm install dropbox
npx cap add android
npx cap sync
```

---

## Capacitor Config

Register a custom URL scheme in `capacitor.config.ts` for the Dropbox OAuth redirect:

```typescript
const config: CapacitorConfig = {
  appId: 'com.yourname.mealplanner',
  appName: 'Meal Planner',
  plugins: {
    Browser: {
      androidScheme: 'mealplanner' // enables mealplanner://dropbox-callback
    }
  }
};
```

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

### Dropbox Auth Service Pattern

```typescript
import { Dropbox, DropboxAuth } from 'dropbox';
import { Browser } from '@capacitor/browser';

@Injectable({ providedIn: 'root' })
export class DropboxAuthService {

  private readonly APP_KEY = 'your_app_key_here';
  private readonly REDIRECT_URI = 'mealplanner://dropbox-callback';
  private dbxAuth = new DropboxAuth({ clientId: this.APP_KEY });

  async connectToDropbox(): Promise<void> {
    const authUrl = await this.dbxAuth.getAuthenticationUrl(
      this.REDIRECT_URI,
      undefined,
      'code',
      'offline',
      undefined,
      undefined,
      true // PKCE — no secret needed
    );
    await Browser.open({ url: authUrl.toString() });
  }

  async handleCallback(callbackUrl: string): Promise<void> {
    const code = new URL(callbackUrl).searchParams.get('code');
    const token = await this.dbxAuth.getAccessTokenFromCode(this.REDIRECT_URI, code);
    localStorage.setItem('dropbox_token', JSON.stringify(token));
  }
}
```

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

### Running Scripts
Run once to allow local PowerShell scripts:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Then from the project root:
```powershell
.\scripts\serve.ps1
.\scripts\serve-db.ps1
.\scripts\build.ps1
.\scripts\emulator.ps1
.\scripts\emulator-live.ps1
.\scripts\device.ps1
.\scripts\package.ps1
.\scripts\sync.ps1
```

---

## PowerShell Scripts

All scripts live in a `scripts/` folder in the project root.

### `scripts/serve.ps1`
Browser dev with live reload.
```powershell
ionic serve
```

### `scripts/serve-db.ps1`
Browser dev with jeep-sqlite DB mock enabled.
```powershell
$env:USE_JEEP_SQLITE = "true"
ionic serve
```

### `scripts/build.ps1`
Production build and sync to Android project.
```powershell
Write-Host "Building Angular/Ionic app..." -ForegroundColor Cyan
ionic build --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}

Write-Host "Syncing to Android project..." -ForegroundColor Cyan
npx cap sync android

Write-Host "Build and sync complete." -ForegroundColor Green
```

### `scripts/emulator.ps1`
Build, sync, and launch on Android emulator.
```powershell
Write-Host "Building and syncing..." -ForegroundColor Cyan
ionic build --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}

npx cap sync android

Write-Host "Launching on emulator..." -ForegroundColor Cyan
npx cap run android

Write-Host "Done." -ForegroundColor Green
```

### `scripts/emulator-live.ps1`
Live reload directly on the emulator. Best for integration dev.
```powershell
Write-Host "Starting live reload on emulator..." -ForegroundColor Cyan
ionic cap run android --livereload --external
```

### `scripts/device.ps1`
Build, sync, and deploy to a physical Android device.
```powershell
Write-Host "Building and syncing..." -ForegroundColor Cyan
ionic build --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}

npx cap sync android

Write-Host "Deploying to device..." -ForegroundColor Cyan
npx cap run android --target device

Write-Host "Done." -ForegroundColor Green
```

### `scripts/package.ps1`
Open Android Studio to build and sign a release APK.
```powershell
Write-Host "Building and syncing for release..." -ForegroundColor Cyan
ionic build --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}

npx cap sync android

Write-Host "Opening Android Studio for APK packaging..." -ForegroundColor Cyan
npx cap open android

Write-Host "In Android Studio: Build > Generate Signed Bundle/APK" -ForegroundColor Yellow
```

### `scripts/sync.ps1`
Sync to Android project without rebuilding. Use when only native config has changed.
```powershell
Write-Host "Syncing to Android project..." -ForegroundColor Cyan
npx cap sync android
Write-Host "Sync complete." -ForegroundColor Green
```

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

## Key Constraints

- **No backend server** — the app is fully offline-first
- **SQLite is the only data store** — no Firebase, no REST API, no cloud DB
- **Dropbox is backup and restore only** — not a live sync target
- **Multi-device simultaneous writes are not supported** — Dropbox restore is a deliberate manual action, not automatic sync
- **Android Studio is a background tool only** — never used as an editor, only for SDK and emulator
- **`npx cap sync`** must be run after every `ng build` before testing on emulator or device — `build.ps1` handles this automatically
- **`USE_JEEP_SQLITE=true`** environment flag must be checked in `DbService` at runtime to swap between jeep-sqlite (browser) and the real Capacitor SQLite plugin (device)
