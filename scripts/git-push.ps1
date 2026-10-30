# Automated Git Add, Commit & Push Helper for NCAMart
# Usage: .\scripts\git-push.ps1 "Added new feature"
param(
    [string]$Message = "chore: update application"
)

$gitPath = "C:\Program Files\Git\cmd\git.exe"
if (-not (Test-Path $gitPath)) {
    $gitPath = "git"
}

Write-Host "1. Syncing latest remote state..." -ForegroundColor Cyan
& $gitPath pull --rebase -X ours origin main

Write-Host "2. Staging & committing changes..." -ForegroundColor Cyan
& $gitPath add -A
& $gitPath commit -m $Message

Write-Host "3. Pushing to GitHub (GitHub Actions will now auto-build .next)..." -ForegroundColor Green
& $gitPath push origin main
Write-Host "Done! Wait ~1 minute for GitHub Actions to finish building, then pull & restart in cPanel." -ForegroundColor Yellow
