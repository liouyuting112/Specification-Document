// 確保 HTML 檔案包含正確的 CMS 腳本引用
import fs from 'fs';
import path from 'path';

/**
 * 確保 index.html 包含 home-cms.js 腳本引用
 */
export function ensureHomePageScripts(htmlFilePath, siteName) {
    if (!fs.existsSync(htmlFilePath)) {
        console.log(`  ⚠️  檔案不存在: ${htmlFilePath}`);
        return false;
    }

    let content = fs.readFileSync(htmlFilePath, 'utf-8');
    const originalContent = content;

    // 檢查是否已經有 home-cms.js 引用
    const hasHomeCms = /<script[^>]*src=["']\.\.\/home-cms\.js["'][^>]*>/i.test(content);
    
    if (hasHomeCms) {
        // 更新 data-site 屬性
        content = content.replace(
            /<script[^>]*src=["']\.\.\/home-cms\.js["'][^>]*(data-site=["'][^"']*["'])?[^>]*>/i,
            `<script src="../home-cms.js" data-site="${siteName}"></script>`
        );
    } else {
        // 檢查是否已經有 js/main.js
        const hasMainJs = /<script[^>]*src=["']js\/main\.js["'][^>]*>/i.test(content);
        
        // 在 </body> 標籤前添加腳本
        const bodyEndMatch = content.match(/(<\/body>)/i);
        if (bodyEndMatch) {
            if (hasMainJs) {
                // 如果已經有 main.js，在它後面添加
                content = content.replace(
                    /(<script[^>]*src=["']js\/main\.js["'][^>]*><\/script>)/i,
                    `$1\n    <script src="../home-cms.js" data-site="${siteName}"></script>`
                );
            } else {
                // 如果沒有 main.js，一起添加
                const scriptTag = `\n    <script src="js/main.js"></script>\n    <script src="../home-cms.js" data-site="${siteName}"></script>\n`;
                content = content.replace(/(<\/body>)/i, scriptTag + '$1');
            }
        } else {
            // 如果沒有 </body>，在 </html> 前添加
            content = content.replace(/(<\/html>)/i, `\n    <script src="js/main.js"></script>\n    <script src="../home-cms.js" data-site="${siteName}"></script>\n$1`);
        }
    }

    // 確保每日精選和固定文章區塊有正確的標記
    // 每日精選應該被 <!-- <auto-update> --> 和 <!-- </auto-update> --> 包圍
    // 固定文章應該被 <!-- <manual-update> --> 和 <!-- </manual-update> --> 包圍
    
    // 檢查並標記每日精選區塊
    const dailySelectors = [
        /(<section[^>]*class="[^"]*daily[^"]*"[^>]*>[\s\S]*?<\/section>)/i,
        /(<aside[^>]*class="[^"]*daily[^"]*"[^>]*>[\s\S]*?<\/aside>)/i,
        /(<div[^>]*class="[^"]*daily[^"]*"[^>]*>[\s\S]*?<\/div>)/i
    ];

    for (const selector of dailySelectors) {
        if (selector.test(content) && !content.includes('<!-- <auto-update> -->')) {
            content = content.replace(
                selector,
                '<!-- <auto-update> -->\n            $1\n            <!-- </auto-update> -->'
            );
            break;
        }
    }

    // 檢查並標記固定文章區塊
    const fixedSelectors = [
        /(<section[^>]*class="[^"]*fixed[^"]*"[^>]*>[\s\S]*?<\/section>)/i,
        /(<section[^>]*class="[^"]*featured[^"]*"[^>]*>[\s\S]*?<\/section>)/i,
        /(<div[^>]*class="[^"]*fixed[^"]*"[^>]*>[\s\S]*?<\/div>)/i
    ];

    for (const selector of fixedSelectors) {
        if (selector.test(content) && !content.includes('<!-- <manual-update> -->')) {
            content = content.replace(
                selector,
                '<!-- <manual-update> -->\n            $1\n            <!-- </manual-update> -->'
            );
            break;
        }
    }

    if (content !== originalContent) {
        fs.writeFileSync(htmlFilePath, content, 'utf-8');
        return true;
    }

    return false;
}

/**
 * 確保 all-daily-articles.html 包含 all-daily-articles-cms.js 腳本引用
 */
export function ensureAllDailyArticlesScripts(htmlFilePath) {
    if (!fs.existsSync(htmlFilePath)) {
        return false;
    }

    let content = fs.readFileSync(htmlFilePath, 'utf-8');
    const originalContent = content;

    // 檢查是否已經有 all-daily-articles-cms.js 引用
    const hasAllDailyCms = /<script[^>]*src=["']\.\.\/all-daily-articles-cms\.js["'][^>]*>/i.test(content);
    
    if (!hasAllDailyCms) {
        // 檢查是否已經有 js/main.js
        const hasMainJs = /<script[^>]*src=["']js\/main\.js["'][^>]*>/i.test(content);
        
        // 在 </body> 標籤前添加腳本
        const bodyEndMatch = content.match(/(<\/body>)/i);
        if (bodyEndMatch) {
            if (hasMainJs) {
                // 如果已經有 main.js，在它後面添加
                content = content.replace(
                    /(<script[^>]*src=["']js\/main\.js["'][^>]*><\/script>)/i,
                    `$1\n    <script src="../all-daily-articles-cms.js"></script>`
                );
            } else {
                // 如果沒有 main.js，一起添加
                const scriptTag = `\n    <script src="js/main.js"></script>\n    <script src="../all-daily-articles-cms.js"></script>\n`;
                content = content.replace(/(<\/body>)/i, scriptTag + '$1');
            }
        } else {
            content = content.replace(/(<\/html>)/i, `\n    <script src="js/main.js"></script>\n    <script src="../all-daily-articles-cms.js"></script>\n$1`);
        }
    }

    if (content !== originalContent) {
        fs.writeFileSync(htmlFilePath, content, 'utf-8');
        return true;
    }

    return false;
}

/**
 * 確保文章頁面包含 article-cms.js 腳本引用
 */
export function ensureArticlePageScripts(htmlFilePath) {
    if (!fs.existsSync(htmlFilePath)) {
        return false;
    }

    let content = fs.readFileSync(htmlFilePath, 'utf-8');
    const originalContent = content;

    // 檢查是否已經有 article-cms.js 引用
    const hasArticleCms = /<script[^>]*src=["']\.\.\/\.\.\/article-cms\.js["'][^>]*>/i.test(content);
    
    if (!hasArticleCms) {
        // 檢查是否已經有 ../js/main.js
        const hasMainJs = /<script[^>]*src=["']\.\.\/js\/main\.js["'][^>]*>/i.test(content);
        
        // 在 </body> 標籤前添加腳本
        const bodyEndMatch = content.match(/(<\/body>)/i);
        if (bodyEndMatch) {
            if (hasMainJs) {
                // 如果已經有 main.js，在它後面添加
                content = content.replace(
                    /(<script[^>]*src=["']\.\.\/js\/main\.js["'][^>]*><\/script>)/i,
                    `$1\n    <script src="../../article-cms.js"></script>`
                );
            } else {
                // 如果沒有 main.js，一起添加
                const scriptTag = `\n    <script src="../js/main.js"></script>\n    <script src="../../article-cms.js"></script>\n`;
                content = content.replace(/(<\/body>)/i, scriptTag + '$1');
            }
        } else {
            content = content.replace(/(<\/html>)/i, `\n    <script src="../js/main.js"></script>\n    <script src="../../article-cms.js"></script>\n$1`);
        }
    }

    if (content !== originalContent) {
        fs.writeFileSync(htmlFilePath, content, 'utf-8');
        return true;
    }

    return false;
}

/**
 * 確保整個網站資料夾的 HTML 檔案都有正確的腳本引用
 * 自動檢測不同的資料夾結構
 */
export function ensureSiteScripts(siteFolderPath, siteName) {
    const results = {
        indexUpdated: false,
        allDailyUpdated: false,
        articlesUpdated: 0
    };

    // 處理 index.html
    const indexPath = path.join(siteFolderPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        results.indexUpdated = ensureHomePageScripts(indexPath, siteName);
        if (results.indexUpdated) {
            console.log(`  ✅ 已更新 index.html 的腳本引用`);
        }
    }

    // 處理 all-daily-articles.html（可能有多種命名）
    const possibleAllDailyFiles = [
        'all-daily-articles.html',
        'daily-articles.html',
        'all-articles.html',
        'articles-list.html'
    ];
    
    for (const fileName of possibleAllDailyFiles) {
        const allDailyPath = path.join(siteFolderPath, fileName);
        if (fs.existsSync(allDailyPath)) {
            results.allDailyUpdated = ensureAllDailyArticlesScripts(allDailyPath);
            if (results.allDailyUpdated) {
                console.log(`  ✅ 已更新 ${fileName} 的腳本引用`);
            }
            break; // 只處理第一個找到的檔案
        }
    }

    // 自動檢測文章資料夾（支援多種命名）
    const possibleArticleDirs = [
        'articles',
        'posts',
        'blog',
        'content',
        'pages'
    ];

    for (const dirName of possibleArticleDirs) {
        const articlesDir = path.join(siteFolderPath, dirName);
        if (fs.existsSync(articlesDir) && fs.statSync(articlesDir).isDirectory()) {
            const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.html'));
            for (const file of files) {
                const articlePath = path.join(articlesDir, file);
                if (ensureArticlePageScripts(articlePath)) {
                    results.articlesUpdated++;
                }
            }
            if (results.articlesUpdated > 0) {
                console.log(`  ✅ 已更新 ${results.articlesUpdated} 個文章頁面的腳本引用（資料夾：${dirName}）`);
            }
            break; // 只處理第一個找到的資料夾
        }
    }

    return results;
}
