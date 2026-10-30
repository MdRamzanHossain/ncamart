# Automated Git Add, Commit & Push Helper for NCAMart
# Usage: .\scripts\git-push.ps1 "Added new feature"
param(
    [string]$Message = "chore: update application"
)

$gitPath = "C:\Program Files\Git\cmd\git.exe"
if (-not (Test-Path $gitPath)) {
    $gitPath = "git"
}

Write-Host "1. Staging & committing local source changes..." -ForegroundColor Cyan
Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
& $gitPath add -A
& $gitPath commit -m $Message

Write-Host "2. Pushing to GitHub (GitHub Actions will now auto-build .next)..." -ForegroundColor Green
& $gitPath push --force origin main
Write-Host "Done! Wait ~1 minute for GitHub Actions to finish building .next, then run git:pull & Restart in cPanel." -ForegroundColor Yellow
