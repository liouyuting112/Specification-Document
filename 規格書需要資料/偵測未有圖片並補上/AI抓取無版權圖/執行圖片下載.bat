@echo off
chcp 65001 >nul
echo ========================================
echo 圖片爬蟲工具 - 無需API設定，直接搜尋下載
echo ========================================
echo.

REM 檢查Python是否安裝
python --version >nul 2>&1
if errorlevel 1 (
    echo 錯誤: 未找到Python，請先安裝Python
    pause
    exit /b 1
)

REM 檢查必要的套件
echo 檢查必要的套件...
python -c "import requests, PIL" >nul 2>&1
if errorlevel 1 (
    echo 正在安裝必要的套件...
    pip install requests Pillow
    if errorlevel 1 (
        echo 錯誤: 套件安裝失敗
        pause
        exit /b 1
    )
)

REM 執行程式
echo.
echo 啟動圖片爬蟲工具...
echo.
python download_images_from_markdown.py

pause

