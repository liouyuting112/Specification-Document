#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量生成網站文件的輔助腳本
由於文件數量非常多，這個腳本可以幫助快速生成剩餘的文件
"""

import os
from pathlib import Path

# 網站配置
SITES_CONFIG = {
    "知識冷庫kcs003": {
        "name": "知識冷庫",
        "abbr": "kcs003",
        "nav_style": "雙層導航",
        "layout": "Z型佈局",
        "color_scheme": "深藍綠色"
    },
    "科學奇聞錄swr004": {
        "name": "科學奇聞錄",
        "abbr": "swr004",
        "nav_style": "全寬度粘性",
        "layout": "卡片網格佈局",
        "color_scheme": "藍紫色"
    },
    "冷知識實驗室tlb005": {
        "name": "冷知識實驗室",
        "abbr": "tlb005",
        "nav_style": "極簡全覆蓋",
        "layout": "非對稱佈局",
        "color_scheme": "深青色"
    }
}

def create_basic_pages(site_dir, site_name, abbr):
    """創建基本頁面模板"""
    pages = {
        "about.html": f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>關於我們 | {site_name}</title>
    <meta name="description" content="了解{site_name}的創立理念，我們致力於分享那些不為人知但充滿趣味的科學知識。">
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <!-- 這裡會根據每個網站的導覽列結構不同而不同 -->
    <main>
        <article class="article-page">
            <div class="container">
                <h1>關於我們</h1>
                <p>{site_name}成立於2025年，我們的目標是讓更多人發現科學的有趣之處。</p>
            </div>
        </article>
    </main>
    <script src="js/main.js"></script>
</body>
</html>""",
        "contact.html": f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>聯絡我們 | {site_name}</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <main>
        <article class="article-page">
            <div class="container">
                <h1>聯絡我們</h1>
                <p>歡迎透過各種方式與我們聯絡。</p>
            </div>
        </article>
    </main>
    <script src="js/main.js"></script>
</body>
</html>""",
        "privacy.html": f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>隱私政策 | {site_name}</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <main>
        <article class="article-page">
            <div class="container">
                <h1>隱私政策</h1>
                <p>我們重視您的隱私權，本政策說明我們如何處理您的個人資訊。</p>
            </div>
        </article>
    </main>
    <script src="js/main.js"></script>
</body>
</html>"""
    }
    
    for filename, content in pages.items():
        filepath = Path(site_dir) / filename
        filepath.write_text(content, encoding='utf-8')
        print(f"創建: {filepath}")

if __name__ == "__main__":
    print("這個腳本用於輔助生成網站文件")
    print("由於文件結構複雜，建議手動創建以確保品質")


