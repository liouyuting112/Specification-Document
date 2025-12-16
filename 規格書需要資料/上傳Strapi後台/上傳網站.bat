@echo off
chcp 65001 >nul
echo ========================================
echo 通用網站上傳工具
echo ========================================
echo.

if "%1"=="" (
    echo 使用方法：
    echo   上傳網站.bat [網站資料夾名稱]
    echo.
    echo 範例：
    echo   上傳網站.bat 科學探索館seh001
    echo   上傳網站.bat 星座解密站cds006
    echo   上傳網站.bat seh001
    echo.
    pause
    exit /b
)

echo 正在上傳: %1
echo.

node 通用上傳腳本.cjs %1

echo.
echo 按任意鍵結束...
pause >nul

