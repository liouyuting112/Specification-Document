// =========================================================
// HTML 轉換到 Strapi CMS - 根據 cds006 欄位邏輯
// 自動偵測選擇資料夾內的 HTML 並轉換上傳
// =========================================================
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 引入核心模組
const coreModulePath = path.join(__dirname, '獨立腳本包', '上傳核心模組.cjs');
const apiModulePath = path.join(__dirname, '獨立腳本包', '上傳API模組.cjs');
const cmsScriptPath = path.join(__dirname, '獨立腳本包', '自動注入CMS腳本.cjs');

const { 
    readHtmlFile, 
    extractTitle, 
    extractPageHtml, 
    extractArticleHtml, 
    extractImageUrl, 
    extractExcerpt, 
    extractDateFromSlug, 
    extractAdInfo, 
    detectFileType, 
    extractSiteName 
} = require(coreModulePath);

const { findExistingPage, findExistingPost, savePage, savePost } = require(apiModulePath);
const { processHtmlFile } = require(cmsScriptPath);

// =========================================================
// Strapi 設定
// =========================================================
const STRAPI_URL = 'https://ethical-dance-ee33e4e924.strapiapp.com';
const STRAPI_TOKEN = '8b1ca6059a8492dcf5e51b08180fdf8a7aadf68f58192841fcb82b0a9ab0fd8ef586b97f260a5833ae8b2b542262a66085d26e78ff11d5e0beac73658019a5efe68e023623f4499c876b04be9764cf2e5e04a6c164812171dea1f87bbc239fd71a0edde419c88eb365318aa4c6ac8a152facc36cb8bfc211c8cf635f3ebd90a9';

// =========================================================
// 使用 PowerShell 選擇資料夾
// =========================================================
function selectFolder() {
    try {
        const psScriptPath = path.join(__dirname, '選擇資料夾.ps1');
        
        if (!fs.existsSync(psScriptPath)) {
            console.error('找不到 PowerShell 腳本檔案');
            return null;
        }
        
        const result = execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, { 
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        
        return result || null;
    } catch (error) {
        console.error('選擇資料夾時發生錯誤:', error.message);
        return null;
    }
}

// =========================================================
// 遞迴收集所有 HTML 檔案
// =========================================================
function collectHtmlFiles(folderPath) {
    const htmlFiles = [];
    
    function scanDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                // 遞迴掃描子資料夾
                scanDir(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.html')) {
                htmlFiles.push({
                    path: fullPath,
                    relativePath: path.relative(folderPath, fullPath)
                });
            }
        }
    }
    
    scanDir(folderPath);
    return htmlFiles;
}

// =========================================================
// 處理單個檔案（根據 cds006 邏輯）
// =========================================================
async function processFile(fileInfo, siteFolder, siteName) {
    const { path: filePath, relativePath } = fileInfo;
    
    // 自動注入 CMS 腳本
    processHtmlFile(filePath, siteName);

    const raw = readHtmlFile(filePath);
    if (!raw) {
        return { success: false, error: '無法讀取檔案', file: relativePath };
    }

    const fileType = detectFileType(filePath, raw);
    
    if (!fileType) {
        return { success: false, skipped: true, file: relativePath };
    }
    
    const title = extractTitle(raw, fileType.slug);
    const imageUrl = extractImageUrl(raw);

    if (fileType.type === 'page') {
        // 處理 Page（根據 cds006 邏輯）
        const htmlContent = extractPageHtml(raw);
        if (!htmlContent) {
            return { success: false, error: '無法提取頁面內容', file: relativePath };
        }

        // Page 也要帶 slug / title，與批量上傳、單檔上傳邏輯一致
        const payload = {
            site: siteName,                // 站點代碼（使用資料夾名稱或縮寫）
            type: fileType.pageType,       // home / about / contact / privacy ...
            slug: fileType.slug,           // 一般為檔名（index/about/contact...）
            title,                         // 從 <title> 解析，抓不到會用檔名
            html: htmlContent              // 主體 HTML
        };
        
        if (imageUrl) payload.imageUrl = imageUrl;
        
        // 如果是首頁，提取廣告資訊（cds006 邏輯）
        if (fileType.pageType === 'home') {
            const adInfo = extractAdInfo(raw);
            if (adInfo) {
                payload.ad = JSON.stringify(adInfo);
            }
        }

        try {
            const existing = await findExistingPage(STRAPI_URL, STRAPI_TOKEN, siteName, fileType.pageType);
            await savePage(STRAPI_URL, STRAPI_TOKEN, existing, payload);
            
            return { 
                success: true, 
                type: 'page', 
                action: existing ? 'updated' : 'created',
                file: relativePath
            };
        } catch (e) {
            return { success: false, type: 'page', error: e.message, file: relativePath };
        }

    } else if (fileType.type === 'post') {
        // 處理 Post（根據 cds006 邏輯）
        const htmlContent = extractArticleHtml(raw);
        if (!htmlContent) {
            return { success: false, error: '無法提取文章內容', file: relativePath };
        }

        const excerpt = extractExcerpt(raw);
        const isDaily = fileType.category === 'daily';
        const dateString = isDaily ? extractDateFromSlug(fileType.slug) : null;

        // 按照 cds006 的欄位結構
        const payload = {
            site: siteName,                // 站點代碼
            category: fileType.category,   // daily / fixed
            slug: fileType.slug,           // 文章 slug（檔名）
            title,                         // 文章標題
            html: htmlContent              // 文章 HTML 內容
        };
        
        if (dateString) {
            payload.publishedAt = `${dateString}T09:00:00.000Z`;
            payload.date = dateString;
            payload.isFeatured = true;
        } else {
            payload.publishedAt = new Date().toISOString();
        }
        
        if (imageUrl) payload.imageUrl = imageUrl;
        if (excerpt) payload.excerpt = excerpt;

        try {
            const existing = await findExistingPost(STRAPI_URL, STRAPI_TOKEN, siteName, fileType.slug);
            await savePost(STRAPI_URL, STRAPI_TOKEN, existing, payload);
            
            return { 
                success: true, 
                type: 'post', 
                action: existing ? 'updated' : 'created',
                file: relativePath
            };
        } catch (e) {
            return { success: false, type: 'post', error: e.message, file: relativePath };
        }
    }

    return { success: false, file: relativePath };
}

// =========================================================
// 主程式
// =========================================================
async function main() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║  HTML 轉換到 Strapi CMS                   ║');
    console.log('║  根據星座解密站 cds006 欄位邏輯            ║');
    console.log('╚════════════════════════════════════════════╝\n');
    
    console.log('📍 Strapi URL:', STRAPI_URL);
    console.log('');

    // 方式1：從命令列參數讀取資料夾路徑
    let selectedFolder = process.argv[2];
    
    // 方式2：如果沒有參數，彈出資料夾選擇對話框
    if (!selectedFolder) {
        console.log('請選擇要轉換的網站資料夾...\n');
        selectedFolder = selectFolder();
    }
    
    if (!selectedFolder) {
        console.error('\n❌ 未選擇資料夾，程式結束');
        process.exit(1);
    }

    if (!fs.existsSync(selectedFolder)) {
        console.error(`\n❌ 錯誤：找不到資料夾: ${selectedFolder}`);
        process.exit(1);
    }

    // 檢查是否有 index.html（確認是網站資料夾）
    const indexPath = path.join(selectedFolder, 'index.html');
    if (!fs.existsSync(indexPath)) {
        console.warn(`\n⚠️  警告：資料夾中沒有 index.html，將繼續處理所有 HTML 檔案`);
    }

    // 提取網站名稱
    const siteName = extractSiteName(selectedFolder);
    
    console.log('\n' + '='.repeat(60));
    console.log('📁 選擇的資料夾:', selectedFolder);
    console.log('🏷️  網站代碼:', siteName);
    console.log('='.repeat(60) + '\n');

    // 收集所有 HTML 檔案
    console.log('🔍 正在掃描 HTML 檔案...');
    const htmlFiles = collectHtmlFiles(selectedFolder);
    
    if (htmlFiles.length === 0) {
        console.error('\n❌ 沒有找到任何 HTML 檔案');
        process.exit(1);
    }

    console.log(`✅ 找到 ${htmlFiles.length} 個 HTML 檔案\n`);

    // 統計
    let pagesCreated = 0, pagesUpdated = 0, pagesFailed = 0;
    let postsCreated = 0, postsUpdated = 0, postsFailed = 0;
    let skipped = 0;

    // 逐一處理檔案
    console.log('🚀 開始轉換並上傳到 Strapi CMS...\n');
    
    for (let i = 0; i < htmlFiles.length; i++) {
        const fileInfo = htmlFiles[i];
        const progress = `[${i + 1}/${htmlFiles.length}]`;
        
        process.stdout.write(`${progress} 處理: ${fileInfo.relativePath} ... `);
        
        const result = await processFile(fileInfo, selectedFolder, siteName);
        
        if (result.success) {
            if (result.type === 'page') {
                if (result.action === 'created') {
                    pagesCreated++;
                    console.log('✅ 建立 Page');
                } else {
                    pagesUpdated++;
                    console.log('✅ 更新 Page');
                }
            } else if (result.type === 'post') {
                if (result.action === 'created') {
                    postsCreated++;
                    console.log('✅ 建立 Post');
                } else {
                    postsUpdated++;
                    console.log('✅ 更新 Post');
                }
            }
        } else if (result.skipped) {
            skipped++;
            console.log('⏭️  跳過');
        } else {
            if (result.type === 'page') {
                pagesFailed++;
                console.log(`❌ 失敗: ${result.error || '未知錯誤'}`);
            } else if (result.type === 'post') {
                postsFailed++;
                console.log(`❌ 失敗: ${result.error || '未知錯誤'}`);
            } else {
                skipped++;
                console.log('⏭️  跳過');
            }
        }

        // 避免請求過快
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 顯示統計結果
    console.log('\n' + '='.repeat(60));
    console.log('📊 轉換結果統計');
    console.log('='.repeat(60));
    console.log(`處理檔案數: ${htmlFiles.length}`);
    console.log(`跳過檔案數: ${skipped}`);
    console.log(`\nPage:`);
    console.log(`  建立: ${pagesCreated}`);
    console.log(`  更新: ${pagesUpdated}`);
    console.log(`  失敗: ${pagesFailed}`);
    console.log(`\nPost:`);
    console.log(`  建立: ${postsCreated}`);
    console.log(`  更新: ${postsUpdated}`);
    console.log(`  失敗: ${postsFailed}`);
    console.log('='.repeat(60));

    if (pagesFailed === 0 && postsFailed === 0) {
        console.log('\n✅ 所有檔案已成功轉換並上傳到 Strapi CMS！');
    } else {
        console.log('\n⚠️  部分檔案轉換失敗，請檢查上面的錯誤訊息');
    }
}

// 執行
main().catch(error => {
    console.error('\n❌ 發生錯誤:', error);
    process.exit(1);
});

