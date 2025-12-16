// 自動注入 CMS 腳本到 HTML 檔案
const fs = require('fs');
const path = require('path');

/**
 * 自動注入 CMS 腳本到 HTML 檔案
 * @param {string} htmlContent - HTML 內容
 * @param {string} filePath - 檔案路徑（用於判斷檔案類型）
 * @param {string} siteName - 網站名稱
 * @returns {string} 注入後的 HTML 內容
 */
function injectCMSScripts(htmlContent, filePath, siteName) {
    const fileName = path.basename(filePath, '.html');
    const dirName = path.dirname(filePath);
    const parentDir = path.basename(dirName);
    
    // 計算相對路徑到根目錄（假設 CMS 腳本在上一層）
    // 判斷檔案是否在子資料夾中（如 articles/）
    const isInSubFolder = parentDir !== path.basename(path.dirname(dirName));
    const relativePath = (parentDir === 'articles' || parentDir === 'fixed-articles') ? '../' : '';
    
    // 檢查是否已經有 CMS 腳本
    const hasHomeCMS = htmlContent.includes('home-cms.js');
    const hasAllDailyCMS = htmlContent.includes('all-daily-articles-cms.js');
    const hasArticleCMS = htmlContent.includes('article-cms.js');
    
    // 1. 處理 all-daily-articles.html - 注入 all-daily-articles-cms.js
    if (fileName === 'all-daily-articles' && !hasAllDailyCMS) {
        // 尋找 </body> 標籤前的位置
        const bodyEndMatch = htmlContent.match(/<\/body>/i);
        if (bodyEndMatch) {
            const insertPosition = bodyEndMatch.index;
            const scriptTag = `\n    <script src="${relativePath}all-daily-articles-cms.js" data-site="${siteName}"></script>`;
            htmlContent = htmlContent.slice(0, insertPosition) + scriptTag + htmlContent.slice(insertPosition);
        }
    }
    
    // 2. 處理 index.html - 注入 home-cms.js
    if (fileName === 'index' && !hasHomeCMS) {
        const bodyEndMatch = htmlContent.match(/<\/body>/i);
        if (bodyEndMatch) {
            const insertPosition = bodyEndMatch.index;
            const scriptTag = `\n    <script src="${relativePath}home-cms.js" data-site="${siteName}"></script>`;
            htmlContent = htmlContent.slice(0, insertPosition) + scriptTag + htmlContent.slice(insertPosition);
        }
    }
    
    // 3. 處理文章頁面（在 articles 或 fixed-articles 資料夾中）- 注入 article-cms.js
    if ((parentDir === 'articles' || parentDir === 'fixed-articles') && !hasArticleCMS) {
        const bodyEndMatch = htmlContent.match(/<\/body>/i);
        if (bodyEndMatch) {
            const insertPosition = bodyEndMatch.index;
            // 文章頁面需要回到上一層（../）或上兩層（../../）來找到 article-cms.js
            const articleRelativePath = parentDir === 'articles' ? '../' : '../../';
            const scriptTag = `\n    <script src="${articleRelativePath}article-cms.js" data-site="${siteName}"></script>\n`;
            htmlContent = htmlContent.slice(0, insertPosition) + scriptTag + htmlContent.slice(insertPosition);
        }
    }
    
    // 3. 處理 all-daily-articles.html - 移除靜態文章並統一容器結構
    if (fileName === 'all-daily-articles') {
        // 移除所有靜態的文章內容（article-item, article-card 等）
        // 保留標題和容器結構
        const mainMatch = htmlContent.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
        if (mainMatch) {
            let mainContent = mainMatch[1];
            const mainStart = mainMatch.index + mainMatch[0].indexOf('>') + 1;
            const mainEnd = mainMatch.index + mainMatch[0].lastIndexOf('<');
            
            // 提取標題區域（page-hero 或 h1）
            let titleSection = '';
            const heroMatch = mainContent.match(/<section[^>]*class=["'][^"']*page-hero[^"']*["'][^>]*>([\s\S]*?)<\/section>/i);
            const h1Match = mainContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            
            if (heroMatch) {
                titleSection = heroMatch[0];
            } else if (h1Match) {
                // 如果沒有 page-hero，創建一個
                const h1Content = h1Match[1];
                titleSection = `<section class="page-hero">
            <div class="container">
                <h1>${h1Content}</h1>
            </div>
        </section>`;
            }
            
            // 移除所有靜態文章（article-item, article-card, articles-grid 等）
            mainContent = mainContent.replace(/<section[^>]*class=["'][^"']*articles-list[^"']*["'][^>]*>[\s\S]*?<\/section>/gi, '');
            mainContent = mainContent.replace(/<div[^>]*class=["'][^"']*articles-grid[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
            mainContent = mainContent.replace(/<article[^>]*class=["'][^"']*article-item[^"']*["'][^>]*>[\s\S]*?<\/article>/gi, '');
            mainContent = mainContent.replace(/<article[^>]*class=["'][^"']*article-card[^"']*["'][^>]*>[\s\S]*?<\/article>/gi, '');
            
            // 移除所有現有的文章列表容器（因為我們要重新創建）
            mainContent = mainContent.replace(/<(ul|div|section)[^>]*class=["'][^"']*(?:all-daily|article-list|daily-list|widget-list)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi, '');
            
            // 對於 all-daily-articles.html，使用響應式垂直列表布局
            // 使用 articles-grid 響應式網格，每頁顯示10篇，超過10篇顯示分頁
            containerHTML = `
        <section class="articles-list">
            <div class="container">
                <div class="articles-grid">
                    <!-- 文章列表將由 all-daily-articles-cms.js 動態載入（每頁10篇，超過10篇顯示分頁） -->
                    <p style="text-align: center; padding: 2rem; color: #666;">載入中...</p>
                </div>
            </div>
        </section>`;
            
            // 重新組合 main 內容
            const newMainContent = titleSection + '\n\n' + containerHTML;
            htmlContent = htmlContent.slice(0, mainStart) + newMainContent + htmlContent.slice(mainEnd);
        }
    }
    
    // 4. 確保 index.html 有每日文章容器（如果有的話）
    if (fileName === 'index') {
        // 檢查是否有 auto-update 註解標記的區域
        const hasAutoUpdate = htmlContent.includes('auto-update') || htmlContent.includes('ai-auto-update');
        
        if (hasAutoUpdate) {
            // 檢查是否有每日文章容器
            const hasDailyContainer = htmlContent.match(/<(ul|div|section)[^>]*(?:id|class)=["'][^"']*(?:daily|article)[^"']*["'][^>]*>/i);
            
            if (!hasDailyContainer) {
                // 如果有 auto-update 標記但沒有容器，添加一個
                const autoUpdateMatch = htmlContent.match(/<!--\s*<auto-update>[\s\S]*?-->/i);
                if (autoUpdateMatch) {
                    const containerHTML = `
            <ul class="daily-article-list">
                <!-- 文章列表將由 home-cms.js 動態載入 -->
                <li><p style="text-align: center; padding: 2rem; color: #666;">載入中...</p></li>
            </ul>`;
                    
                    const insertPos = autoUpdateMatch.index + autoUpdateMatch[0].length;
                    htmlContent = htmlContent.slice(0, insertPos) + containerHTML + htmlContent.slice(insertPos);
                }
            }
        }
    }
    
    return htmlContent;
}

/**
 * 處理 HTML 檔案並注入腳本
 * @param {string} filePath - HTML 檔案路徑
 * @param {string} siteName - 網站名稱
 * @returns {boolean} 是否成功處理
 */
function processHtmlFile(filePath, siteName) {
    try {
        if (!fs.existsSync(filePath)) {
            return false;
        }
        
        let htmlContent = fs.readFileSync(filePath, 'utf8');
        const originalContent = htmlContent;
        
        // 注入 CMS 腳本
        htmlContent = injectCMSScripts(htmlContent, filePath, siteName);
        
        // 如果有變更，寫回檔案
        if (htmlContent !== originalContent) {
            fs.writeFileSync(filePath, htmlContent, 'utf8');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error(`處理檔案失敗 ${filePath}:`, error.message);
        return false;
    }
}

module.exports = {
    injectCMSScripts,
    processHtmlFile
};

