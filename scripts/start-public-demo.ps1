$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$env:NEXT_PUBLIC_API_URL = "/api"
$env:API_PROXY_TARGET = "http://127.0.0.1:4000"

Write-Host "Starting OpsPilot public-demo mode..." -ForegroundColor Cyan
Write-Host "Browser API URL: /api" -ForegroundColor DarkGray
Write-Host "Next.js proxy target: http://127.0.0.1:4000" -ForegroundColor DarkGray
Write-Host "Keep this terminal open while the demo is available." -ForegroundColor Yellow
Write-Host ""

npm run dev:run
