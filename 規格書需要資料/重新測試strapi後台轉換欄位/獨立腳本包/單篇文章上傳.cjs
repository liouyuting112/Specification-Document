// 單篇文章上傳 - 上傳單個 HTML 檔案
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
} = require('./上傳核心模組.cjs');
const { findExistingPage, findExistingPost, savePage, savePost } = require('./上傳API模組.cjs');
const { processHtmlFile } = require('./自動注入CMS腳本.cjs');

// 從設定檔讀取
const CONFIG_FILE = path.join(__dirname, '上傳設定.txt');

function readConfig() {
    let devUrl = 'https://ethical-dance-ee33e4e924.strapiapp.com';
    let devToken = '8b1ca6059a8492dcf5e51b08180fdf8a7aadf68f58192841fcb82b0a9ab0fd8ef586b97f260a5833ae8b2b542262a66085d26e78ff11d5e0beac73658019a5efe68e023623f4499c876b04be9764cf2e5e04a6c164812171dea1f87bbc239fd71a0edde419c88eb365318aa4c6ac8a152facc36cb8bfc211c8cf635f3ebd90a9';
    let prodUrl = 'https://effortless-whisper-83765d99df.strapiapp.com';
    let prodToken = 'f157335b42cbb300b4890b04b264ff914b7ed3097a511912e41cdea7a6b8dac012ed3069f2fc0ba1d726c4c6b9112a4d6d8624feaa7d75619789e016fa294468e355ca61c92432545bb7700cc19ed4a7e2a616178283ca4bb0335762abdc250b65c9a1b5f0612cf6f13df2d641039acc2aa79e69daa4625181980d40d3bada1b';

    if (fs.existsSync(CONFIG_FILE)) {
        const configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
        const devUrlMatch = configContent.match(/DEV_STRAPI_URL=(.+)/);
        const devTokenMatch = configContent.match(/DEV_STRAPI_TOKEN=(.+)/);
        const prodUrlMatch = configContent.match(/PROD_STRAPI_URL=(.+)/);
        const prodTokenMatch = configContent.match(/PROD_STRAPI_TOKEN=(.+)/);
        
        if (devUrlMatch) devUrl = devUrlMatch[1].trim();
        if (devTokenMatch) devToken = devTokenMatch[1].trim();
        if (prodUrlMatch) prodUrl = prodUrlMatch[1].trim();
        if (prodTokenMatch) prodToken = prodTokenMatch[1].trim();
    }

    return { devUrl, devToken, prodUrl, prodToken };
}

async function uploadSingleFile(filePath, siteName, strapiUrl, token) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`找不到檔案: ${filePath}`);
    }

    // 自動注入 CMS 腳本
    console.log('🔧 檢查並注入 CMS 腳本...');
    if (processHtmlFile(filePath, siteName)) {
        console.log('  ✅ 已注入 CMS 腳本\n');
    } else {
        console.log('  ✅ CMS 腳本檢查完成（無需更新）\n');
    }

    const raw = readHtmlFile(filePath);
    if (!raw) {
        throw new Error(`無法讀取檔案: ${filePath}`);
    }

    const fileType = detectFileType(filePath, raw);
    
    if (!fileType) {
        throw new Error('此檔案類型不需要上傳到後台（例如：all-daily-articles.html）');
    }
    
    const title = extractTitle(raw, fileType.slug);
    const imageUrl = extractImageUrl(raw);
    const fileName = path.basename(filePath);

    console.log(`\n📄 檔案: ${fileName}`);
    console.log(`   類型: ${fileType.type === 'page' ? 'Page' : 'Post'}`);
    console.log(`   標題: ${title}\n`);

    if (fileType.type === 'page') {
        // 處理 Page
        const htmlContent = extractPageHtml(raw);
        if (!htmlContent) {
            throw new Error('無法提取頁面內容');
        }

        const payload = {
            site: siteName,
            type: fileType.pageType,
            slug: fileType.slug,
            title,
            html: htmlContent
        };
        
        if (imageUrl) payload.imageUrl = imageUrl;

        // 如果是首頁，提取廣告資訊
        if (fileType.pageType === 'home') {
            const adInfo = extractAdInfo(raw);
            if (adInfo) {
                payload.ad = JSON.stringify(adInfo);
                console.log(`  📢 找到廣告資訊：`);
                console.log(`     連結: ${adInfo.linkUrl || '無'}`);
                console.log(`     圖片: ${adInfo.imageUrl || '無'}\n`);
            }
        }

        const existing = await findExistingPage(strapiUrl, token, siteName, fileType.pageType);
        await savePage(strapiUrl, token, existing, payload);
        
        if (existing) {
            console.log(`✅ 更新 Page: ${fileType.pageType}`);
        } else {
            console.log(`✅ 建立 Page: ${fileType.pageType}`);
        }

    } else if (fileType.type === 'post') {
        // 處理 Post
        const htmlContent = extractArticleHtml(raw);
        if (!htmlContent) {
            throw new Error('無法提取文章內容');
        }

        const excerpt = extractExcerpt(raw);
        const isDaily = fileType.category === 'daily';
        const dateString = isDaily ? extractDateFromSlug(fileType.slug) : null;

        const payload = {
            site: siteName,
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

        const existing = await findExistingPost(strapiUrl, token, siteName, fileType.slug);
        await savePost(strapiUrl, token, existing, payload);
        
        if (existing) {
            console.log(`✅ 更新 Post: ${fileType.slug} (${fileType.category})`);
        } else {
            console.log(`✅ 建立 Post: ${fileType.slug} (${fileType.category})`);
        }
    }
}

async function main() {
    console.log('🚀 單篇文章上傳到 Strapi\n');
    console.log('========================================');

    // 讀取設定
    const config = readConfig();

    // 選擇環境
    console.log('\n📍 請選擇環境：');
    console.log('   1 - 開發環境');
    console.log('   2 - 正式環境');
    console.log();
    
    // 從命令列參數讀取環境選擇
    const envChoice = process.argv[2] || '1';
    const isDev = envChoice === '1';
    
    const strapiUrl = isDev ? config.devUrl : config.prodUrl;
    const token = isDev ? config.devToken : config.prodToken;
    const envName = isDev ? '開發環境' : '正式環境';

    console.log(`✅ 已選擇：${envName}`);
    console.log(`📍 Strapi URL: ${strapiUrl}\n`);

    // 讀取檔案路徑和網站名稱
    const filePath = process.argv[3];
    const siteName = process.argv[4];

    if (!filePath) {
        console.error('❌ 錯誤：請提供 HTML 檔案路徑');
        console.log('\n使用方法：');
        console.log('  node 單篇文章上傳.cjs [環境] [檔案路徑] [網站名稱]');
        console.log('  環境: 1=開發環境, 2=正式環境（預設：1）');
        console.log('  網站名稱: 例如 site1, cds006（會自動從路徑推測）');
        console.log('\n範例：');
        console.log('  node 單篇文章上傳.cjs 1 "C:\\Users\\...\\site1\\index.html" site1');
        process.exit(1);
    }

    // 如果沒有提供網站名稱，從路徑推測
    let finalSiteName = siteName;
    if (!finalSiteName) {
        const fileDir = path.dirname(filePath);
        finalSiteName = extractSiteName(fileDir);
    }

    try {
        await uploadSingleFile(filePath, finalSiteName, strapiUrl, token);
        console.log('\n✅ 上傳完成！');
    } catch (error) {
        console.error('\n❌ 錯誤：', error.message);
        process.exit(1);
    }
}

main();

