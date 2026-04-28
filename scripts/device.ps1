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
