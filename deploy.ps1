# deploy.ps1 - Automated Version Bumping & Deployment Prep

# 1. Load Current Version
$versionJsonPath = "version.json"
$config = Get-Content $versionJsonPath -Raw | ConvertFrom-Json
$oldVersion = $config.version # e.g., "v2.0.0"

# 2. Increment Version (assuming vMajor.Minor.Patch)
$versionNumbers = $oldVersion.TrimStart('v').Split('.')
$major = [int]$versionNumbers[0]
$minor = [int]$versionNumbers[1]
$patch = [int]$versionNumbers[2] + 1
$newVersion = "v$major.$minor.$patch"
$newTimestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"

Write-Host "Bumping version: $oldVersion -> $newVersion" -ForegroundColor Cyan

# 3. Update version.json
$config.version = $newVersion
$config.lastUpdated = $newTimestamp
$config | ConvertTo-Json -Depth 10 | Set-Content $versionJsonPath

# 4. Update sw.js
$swPath = "sw.js"
$swContent = Get-Content $swPath -Raw
$swContent = $swContent -replace "const APP_VERSION = `".*`"", "const APP_VERSION = `"$newVersion`""
Set-Content $swPath $swContent

# 5. Update app.js
$appPath = "app.js"
$appContent = Get-Content $appPath -Raw
$appContent = $appContent -replace "const CURRENT_APP_VERSION = `".*`"", "const CURRENT_APP_VERSION = `"$newVersion`""
Set-Content $appPath $appContent

# 6. Update index.html
$indexPath = "index.html"
$indexContent = Get-Content $indexPath -Raw

# Update global variable
$indexContent = $indexContent -replace "window.APP_VERSION = `".*`"", "window.APP_VERSION = `"$newVersion`""
# Update build timestamp
$indexContent = $indexContent -replace "window.BUILD_TIMESTAMP = `".*`"", "window.BUILD_TIMESTAMP = `"$($newTimestamp.Split('T')[0])`""
# Update all query parameters (?v=...)
$indexContent = $indexContent -replace "\?v=[v0-9.]*", "?v=$newVersion"

Set-Content $indexPath $indexContent

Write-Host "Successfully updated all files to $newVersion" -ForegroundColor Green
Write-Host "You can now commit these changes and deploy to Netlify." -ForegroundColor Yellow

# Optional: Trigger Netlify CLI deploy
# netlify deploy --prod
