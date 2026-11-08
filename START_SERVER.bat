@echo off
REM Winter Bumper - Server Startup Script for Windows

echo.
echo ================================================
echo     WINTER BUMPER - Premium Lottery Game
echo ================================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo Node.js version: %NODE_VERSION%
echo.

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo Error: npm is not installed!
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo npm version: %NPM_VERSION%
echo.

REM Get the directory where this script is located
cd /d "%~dp0"
echo Working Directory: %cd%
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo.
echo ================================================
echo     Starting server on http://localhost:3000
echo ================================================
echo.
echo Press Ctrl+C to stop the server
echo.

call npm start
pause
