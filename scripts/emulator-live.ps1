Set-Location "$PSScriptRoot\.."

Write-Host "Starting live reload on emulator..." -ForegroundColor Cyan
ionic cap run android --livereload --external
