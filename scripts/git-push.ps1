# Automated Git Push Helper for NCAMart
$gitPath = "C:\Program Files\Git\cmd\git.exe"
if (-not (Test-Path $gitPath)) {
    $gitPath = "git"
}
& $gitPath push origin main
