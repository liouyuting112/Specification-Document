@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo 單篇文章上傳到 Strapi
echo ========================================
echo.

echo 📍 請選擇環境：
echo    1 - 開發環境
echo    2 - 正式環境
echo.
set /p ENV_CHOICE="請選擇 (1/2，預設 1): "
if "!ENV_CHOICE!"=="" set ENV_CHOICE=1

echo.
echo 📄 請選擇要上傳的 HTML 檔案：
echo.
set /p HTML_FILE="請輸入 HTML 檔案路徑: "

if "!HTML_FILE!"=="" (
    echo ❌ 錯誤：請提供 HTML 檔案路徑
    pause
    exit /b 1
)

echo.
echo 🏷️  請輸入網站名稱（可選，會自動從路徑推測）：
echo.
set /p SITE_NAME="網站名稱（直接按 Enter 自動推測）: "

echo.
echo 🔄 正在上傳...
echo.

if "!SITE_NAME!"=="" (
    node "%~dp0單篇文章上傳.cjs" !ENV_CHOICE! "!HTML_FILE!"
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo ❌ 上傳失敗！
        pause
        exit /b 1
    )
) else (
    node "%~dp0單篇文章上傳.cjs" !ENV_CHOICE! "!HTML_FILE!" "!SITE_NAME!"
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo ❌ 上傳失敗！
        pause
        exit /b 1
    )
)

echo.
pause
