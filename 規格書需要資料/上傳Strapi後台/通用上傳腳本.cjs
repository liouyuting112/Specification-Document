// 通用上傳腳本 - 可以上傳任何網站的文章到Strapi CMS
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');
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
} = require('./獨立腳本包/上傳核心模組.cjs');
const { findExistingPage, findExistingPost, savePage, savePost } = require('./獨立腳本包/上傳API模組.cjs');
const { processHtmlFile } = require('./獨立腳本包/自動注入CMS腳本.cjs');

// 從命令列參數讀取
const siteFolderName = process.argv[2]; // 例如：科學探索館seh001 或 seh001

if (!siteFolderName) {
    console.error('❌ 錯誤：請提供網站資料夾名稱');
    console.log('\n使用方法：');
    console.log('  node 通用上傳腳本.cjs [網站資料夾名稱]');
    console.log('\n範例：');
    console.log('  node 通用上傳腳本.cjs 科學探索館seh001');
    console.log('  node 通用上傳腳本.cjs seh001');
    process.exit(1);
}

// Strapi 設定（開發環境）
const STRAPI_URL = 'https://ethical-dance-ee33e4e924.strapiapp.com';
const STRAPI_TOKEN = '8b1ca6059a8492dcf5e51b08180fdf8a7aadf68f58192841fcb82b0a9ab0fd8ef586b97f260a5833ae8b2b542262a66085d26e78ff11d5e0beac73658019a5efe68e023623f4499c876b04be9764cf2e5e04a6c164812171dea1f87bbc239fd71a0edde419c88eb365318aa4c6ac8a152facc36cb8bfc211c8cf635f3ebd90a9';

// 尋找網站資料夾
const SITE_FOLDER = path.join(__dirname, siteFolderName);
if (!fs.existsSync(SITE_FOLDER)) {
    console.error(`❌ 錯誤：找不到網站資料夾: ${SITE_FOLDER}`);
    process.exit(1);
}

// 提取網站名稱
const SITE_NAME = extractSiteName(SITE_FOLDER);

async function uploadFile(filePath) {
    const relativePath = path.relative(SITE_FOLDER, filePath);
    console.log(`\n📄 處理檔案: ${relativePath}`);

    // 自動注入 CMS 腳本
    if (processHtmlFile(filePath, SITE_NAME)) {
        console.log('  ✅ 已注入 CMS 腳本');
    }

    const raw = readHtmlFile(filePath);
    if (!raw) {
        console.log(`  ⚠️  無法讀取檔案`);
        return { success: false, type: null };
    }

    const fileType = detectFileType(filePath, raw);
    
    if (!fileType) {
        return { success: false, type: null };
    }
    
    const title = extractTitle(raw, fileType.slug);
    const imageUrl = extractImageUrl(raw);

    console.log(`   類型: ${fileType.type === 'page' ? 'Page' : 'Post'}`);
    console.log(`   標題: ${title}`);

    if (fileType.type === 'page') {
        const htmlContent = extractPageHtml(raw);
        if (!htmlContent) {
            return { success: false, type: 'page' };
        }

        const payload = {
            site: SITE_NAME,
            type: fileType.pageType,
            html: htmlContent
        };
        
        if (imageUrl) payload.imageUrl = imageUrl;
        
        // 如果是首頁，提取廣告資訊
        if (fileType.pageType === 'home') {
            const adInfo = extractAdInfo(raw);
            if (adInfo) {
                payload.ad = JSON.stringify(adInfo);
                console.log(`  📢 找到廣告資訊`);
            }
        }

        try {
            const existing = await findExistingPage(STRAPI_URL, STRAPI_TOKEN, SITE_NAME, fileType.pageType);
            await savePage(STRAPI_URL, STRAPI_TOKEN, existing, payload);
            
            if (existing) {
                console.log(`  ✅ 更新 Page: ${fileType.pageType}`);
                return { success: true, type: 'page', action: 'updated' };
            } else {
                console.log(`  ✅ 建立 Page: ${fileType.pageType}`);
                return { success: true, type: 'page', action: 'created' };
            }
        } catch (e) {
            console.error(`  ❌ 失敗 Page: ${e.message}`);
            return { success: false, type: 'page', error: e.message };
        }

    } else if (fileType.type === 'post') {
        const htmlContent = extractArticleHtml(raw);
        if (!htmlContent) {
            return { success: false, type: 'post' };
        }

        const excerpt = extractExcerpt(raw);
        const isDaily = fileType.category === 'daily';
        const dateString = isDaily ? extractDateFromSlug(fileType.slug) : null;

        const payload = {
            site: SITE_NAME,
            category: fileType.category,
            slug: fileType.slug,
            title,
            html: htmlContent
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
            const existing = await findExistingPost(STRAPI_URL, STRAPI_TOKEN, SITE_NAME, fileType.slug);
            await savePost(STRAPI_URL, STRAPI_TOKEN, existing, payload);
            
            if (existing) {
                console.log(`  ✅ 更新 Post: ${fileType.slug} (${fileType.category})`);
                return { success: true, type: 'post', action: 'updated' };
            } else {
                console.log(`  ✅ 建立 Post: ${fileType.slug} (${fileType.category})`);
                return { success: true, type: 'post', action: 'created' };
            }
        } catch (e) {
            console.error(`  ❌ 失敗 Post: ${e.message}`);
            return { success: false, type: 'post', error: e.message };
        }
    }

    return { success: false, type: null };
}

async function uploadSite() {
    console.log(`🚀 開始上傳 ${siteFolderName} 的文章到Strapi CMS\n`);
    console.log('========================================');
    console.log(`📍 Strapi URL: ${STRAPI_URL}`);
    console.log(`📍 網站名稱: ${SITE_NAME}`);
    console.log(`📍 網站資料夾: ${SITE_FOLDER}`);
    console.log('========================================\n');

    // 收集所有需要上傳的檔案
    const filesToUpload = [];
    
    // 1. 上傳頁面
    const pages = ['index.html', 'about.html', 'contact.html', 'privacy.html'];
    pages.forEach(page => {
        const pagePath = path.join(SITE_FOLDER, page);
        if (fs.existsSync(pagePath)) {
            filesToUpload.push(pagePath);
        }
    });

    // 2. 上傳每日文章
    const articlesDir = path.join(SITE_FOLDER, 'articles');
    if (fs.existsSync(articlesDir)) {
        const articleFiles = fs.readdirSync(articlesDir)
            .filter(file => file.endsWith('.html'))
            .map(file => path.join(articlesDir, file));
        filesToUpload.push(...articleFiles);
    }

    // 3. 上傳固定文章
    const fixedArticlesDir = path.join(SITE_FOLDER, 'fixed-articles');
    if (fs.existsSync(fixedArticlesDir)) {
        const fixedArticleFiles = fs.readdirSync(fixedArticlesDir)
            .filter(file => file.endsWith('.html'))
            .map(file => path.join(fixedArticlesDir, file));
        filesToUpload.push(...fixedArticleFiles);
    }

    console.log(`📋 找到 ${filesToUpload.length} 個檔案需要處理\n`);

    // 統計
    let pagesCreated = 0, pagesUpdated = 0, pagesFailed = 0;
    let postsCreated = 0, postsUpdated = 0, postsFailed = 0;

    // 逐一上傳
    for (const filePath of filesToUpload) {
        const result = await uploadFile(filePath);
        
        if (result.success) {
            if (result.type === 'page') {
                if (result.action === 'created') pagesCreated++;
                else if (result.action === 'updated') pagesUpdated++;
            } else if (result.type === 'post') {
                if (result.action === 'created') postsCreated++;
                else if (result.action === 'updated') postsUpdated++;
            }
        } else {
            if (result.type === 'page') pagesFailed++;
            else if (result.type === 'post') postsFailed++;
        }

        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 顯示統計結果
    console.log('\n========================================');
    console.log('📊 上傳結果統計');
    console.log('========================================');
    console.log(`Page: 建立 ${pagesCreated} | 更新 ${pagesUpdated} | 失敗 ${pagesFailed}`);
    console.log(`Post: 建立 ${postsCreated} | 更新 ${postsUpdated} | 失敗 ${postsFailed}`);
    console.log('========================================\n');

    if (pagesFailed === 0 && postsFailed === 0) {
        console.log('✅ 所有檔案上傳成功！');
    } else {
        console.log('⚠️  部分檔案上傳失敗，請檢查上面的錯誤訊息');
    }
}

uploadSite().catch(error => {
    console.error('\n❌ 發生錯誤:', error);
    process.exit(1);
});

