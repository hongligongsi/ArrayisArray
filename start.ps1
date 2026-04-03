# Database Management System - PowerShell Startup Script
# ==============================================

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "        Database Management System" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Frontend Server: http://localhost:3002/ (or 3003 if 3002 is occupied)" -ForegroundColor Green
Write-Host "Backend Server: http://localhost:3001" -ForegroundColor Green
Write-Host ""

Write-Host "Login Credentials:" -ForegroundColor Yellow
Write-Host "  Username: admin" -ForegroundColor Yellow
Write-Host "  Password: admin123" -ForegroundColor Yellow
Write-Host ""

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Starting services..." -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Start the services
npm start