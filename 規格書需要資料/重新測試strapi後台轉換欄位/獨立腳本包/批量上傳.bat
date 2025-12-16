@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo 批量上傳網站到 Strapi
echo ========================================
echo.

echo 📍 請選擇環境：
echo    1 - 開發環境
echo    2 - 正式環境
echo.
set /p ENV_CHOICE="請選擇 (1/2，預設 1): "
if "!ENV_CHOICE!"=="" set ENV_CHOICE=1

echo.
echo 📁 請選擇要上傳的網站資料夾：
echo.
set /p SITE_FOLDER="請輸入網站資料夾路徑: "

if "!SITE_FOLDER!"=="" (
    echo ❌ 錯誤：請提供網站資料夾路徑
    pause
    exit /b 1
)

echo.
echo 🔄 正在上傳...
echo.

node "%~dp0批量上傳.cjs" !ENV_CHOICE! "!SITE_FOLDER!"

echo.
pause



