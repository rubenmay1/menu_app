Write-Host "Building Angular/Ionic app..." -ForegroundColor Cyan
ionic build --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}

Write-Host "Syncing to Android project..." -ForegroundColor Cyan
npx cap sync android

Write-Host "Build and sync complete." -ForegroundColor Green
