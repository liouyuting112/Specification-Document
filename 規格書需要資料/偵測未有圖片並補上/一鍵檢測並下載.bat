@echo off
chcp 65001 >nul
echo ========================================
echo 圖片檢測與下載工具
echo ========================================
echo.
echo 步驟1: 檢測缺失的圖片...
echo.

REM 執行檢測
node "檢測缺失圖片並下載.cjs"

if errorlevel 1 (
    echo.
    echo 錯誤: 檢測過程失敗
    pause
    exit /b 1
)

echo.
echo ========================================
echo 步驟2: 準備下載缺失的圖片
echo ========================================
echo.

REM 檢查Python是否安裝
python --version >nul 2>&1
if errorlevel 1 (
    echo 錯誤: 未找到Python，請先安裝Python
    echo.
    echo 請手動執行Python程序來下載圖片
    pause
    exit /b 1
)

REM 檢查Markdown文件是否存在
if not exist "缺失圖片清單.md" (
    echo 錯誤: 未找到缺失圖片清單.md
    pause
    exit /b 1
)

echo 正在調用Python程序下載圖片...
echo.

REM 切換到Python程序目錄
cd "AI抓取無版權圖"

REM 設置UTF-8編碼並執行Python程序
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
python download_images_from_markdown.py "..\缺失圖片清單.md" "..\downloaded_images"

if errorlevel 1 (
    echo.
    echo 警告: Python程序執行時出現錯誤
    echo 請檢查錯誤訊息
) else (
    echo.
    echo ========================================
    echo 完成！
    echo ========================================
    echo.
    echo 圖片已下載到: downloaded_images 資料夾
)

cd ..
pause

