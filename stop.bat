@echo off
echo Stopping Database Management System...
echo.

:: Stop Node.js processes
echo Stopping Node.js processes...
taskkill /F /IM node.exe >nul 2>&1

:: Stop npm processes  
echo Stopping npm processes...
taskkill /F /IM npm.exe >nul 2>&1

echo.
echo Services stopped successfully!
echo.
echo Press any key to exit...
pause >nul