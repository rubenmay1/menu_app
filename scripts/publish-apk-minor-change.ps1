Set-Location "$PSScriptRoot\.."

# Bump versionName (e.g. 1.9 -> 1.10, 1.0 -> 1.1) and versionCode by 1
$gradlePath = "android\app\build.gradle"
$gradleContent = [System.IO.File]::ReadAllText((Resolve-Path $gradlePath), [System.Text.UTF8Encoding]::new($true))
$gradleContent = $gradleContent.TrimStart([char]0xFEFF)

if ($gradleContent -match 'versionCode\s+(\d+)') {
    $oldCode = [int]$Matches[1]
    $newCode = $oldCode + 1
    $gradleContent = $gradleContent -replace "versionCode\s+$oldCode", "versionCode $newCode"
}

if ($gradleContent -match 'versionName\s+"([^"]+)"') {
    $oldName = $Matches[1]
    $parts = $oldName -split '\.'

    if ($parts.Count -lt 3) {
        # Case: 1.2 -> 1.2.1
        $newName = "$oldName.1"
    } else {
        # Case: 1.2.5 -> 1.2.6
        $parts[-1] = [string]([int]$parts[-1] + 1)
        $newName = $parts -join '.'
    }

    $gradleContent = $gradleContent -replace "versionName\s+`"$oldName`"", "versionName `"$newName`""
}

[System.IO.File]::WriteAllText((Resolve-Path $gradlePath), $gradleContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "Version bumped: $oldName -> $newName (code $oldCode -> $newCode)" -ForegroundColor Green

& "$PSScriptRoot\sync-version.ps1"

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
