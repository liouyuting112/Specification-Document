@echo off
chcp 65001 >nul
title HTML 轉換到 Strapi CMS
color 0B

cd /d "%~dp0"

if not exist "HTML轉換到Strapi.cjs" (
    echo.
    echo ❌ 錯誤：找不到「HTML轉換到Strapi.cjs」檔案
    echo 請確認檔案存在於同一資料夾中
    echo.
    pause
    exit /b 1
)

echo ╔════════════════════════════════════════════╗
echo ║  HTML 轉換到 Strapi CMS                   ║
echo ║  根據星座解密站 cds006 欄位邏輯            ║
echo ╚════════════════════════════════════════════╝
echo.

REM 檢查是否有提供資料夾路徑參數
if "%1"=="" (
    echo 正在啟動資料夾選擇對話框...
    echo.
    node HTML轉換到Strapi.cjs
) else (
    echo 使用指定的資料夾: %1
    echo.
    node HTML轉換到Strapi.cjs "%1"
)

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ╔════════════════════════════════════════════╗
    echo ║  轉換完成！                                ║
    echo ╚════════════════════════════════════════════╝
) else (
    echo.
    echo ╔════════════════════════════════════════════╗
    echo ║  轉換過程中發生錯誤！                        ║
    echo ╚════════════════════════════════════════════╝
)

echo.
pause

