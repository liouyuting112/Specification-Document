#!/bin/bash

echo "========================================"
echo "圖片爬蟲工具 - 無需API設定，直接搜尋下載"
echo "========================================"
echo ""

# 檢查Python是否安裝
if ! command -v python3 &> /dev/null; then
    echo "錯誤: 未找到Python3，請先安裝Python"
    exit 1
fi

# 檢查必要的套件
echo "檢查必要的套件..."
python3 -c "import requests, PIL" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "正在安裝必要的套件..."
    pip3 install requests Pillow
    if [ $? -ne 0 ]; then
        echo "錯誤: 套件安裝失敗"
        exit 1
    fi
fi

# 執行程式
echo ""
echo "啟動圖片爬蟲工具..."
echo ""
python3 download_images_from_markdown.py

