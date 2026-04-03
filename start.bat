@echo off
chcp 65001 >nul
echo ==============================================
echo        Database Management System
echo ==============================================
echo.
echo Frontend Server: http://localhost:3002/ (or 3003 if 3002 is occupied)
echo Backend Server: http://localhost:3001
echo.
echo Login Credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo ==============================================
echo Starting services...
echo ==============================================
echo.

npm start