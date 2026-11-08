@echo off
echo.
echo 🎊 Diwali Tambola Setup 🎊
echo ==========================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js found: %NODE_VERSION%
echo.

echo 📦 Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo ❌ Installation failed!
    pause
    exit /b 1
)

echo.
echo ✅ Setup complete!
echo.
echo 🚀 To start the game server, run:
echo    npm start
echo.
echo Then open your browser to:
echo    http://localhost:3000
echo.
echo 🎉 Happy Diwali Tambola!
echo.
pause
