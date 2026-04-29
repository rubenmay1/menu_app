Set-Location "$PSScriptRoot\.."

Write-Host "Building and syncing for release..." -ForegroundColor Cyan
ionic build --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}

npx cap sync android

if ($LASTEXITCODE -ne 0) {
    Write-Host "Sync failed." -ForegroundColor Red
    exit 1
}

Write-Host "Opening Android Studio for APK packaging..." -ForegroundColor Cyan
npx cap open android

Write-Host "In Android Studio: Build > Generate Signed Bundle/APK" -ForegroundColor Yellow
