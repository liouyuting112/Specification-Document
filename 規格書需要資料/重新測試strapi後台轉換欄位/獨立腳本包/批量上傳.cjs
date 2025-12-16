// 批量上傳 - 上傳整個網站資料夾
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

async function uploadSite(siteFolderPath, strapiUrl, token) {
    if (!fs.existsSync(siteFolderPath)) {
        throw new Error(`找不到網站資料夾: ${siteFolderPath}`);
    }

    const siteName = extractSiteName(siteFolderPath);
    console.log(`\n🏷️  網站名稱: ${siteName}`);
    console.log(`📁 資料夾: ${siteFolderPath}\n`);

    // 步驟 0: 自動注入 CMS 腳本到 HTML 檔案
    console.log('🔧 [步驟 0] 自動注入 CMS 腳本...\n');
    let injectedCount = 0;
    
    // 先讀取根目錄的 HTML 檔案
    const rootFiles = fs.readdirSync(siteFolderPath).filter(f => f.endsWith('.html'));
    
    // 處理根目錄的 HTML 檔案，注入 CMS 腳本
    for (const file of rootFiles) {
        const filePath = path.join(siteFolderPath, file);
        if (processHtmlFile(filePath, siteName)) {
            console.log(`  ✅ 已注入腳本: ${file}`);
            injectedCount++;
        }
    }
    
    if (injectedCount > 0) {
        console.log(`\n✅ 已為 ${injectedCount} 個檔案注入 CMS 腳本\n`);
    } else {
        console.log(`\n✅ CMS 腳本檢查完成（無需更新）\n`);
    }

    let pagesCreated = 0;
    let pagesUpdated = 0;
    let pagesFailed = 0;
    let postsCreated = 0;
    let postsUpdated = 0;
    let postsFailed = 0;

    // 收集所有 HTML 檔案
    const htmlFiles = [];
    
    // 處理根目錄的 HTML 檔案
    for (const file of rootFiles) {
        htmlFiles.push({
            path: path.join(siteFolderPath, file),
            relativePath: file
        });
    }

    // 處理 articles 資料夾
    const articlesDir = path.join(siteFolderPath, 'articles');
    if (fs.existsSync(articlesDir)) {
        const articleFiles = fs.readdirSync(articlesDir).filter(f => f.endsWith('.html'));
        for (const file of articleFiles) {
            htmlFiles.push({
                path: path.join(articlesDir, file),
                relativePath: `articles/${file}`
            });
        }
    }

    // 處理 fixed-articles 資料夾
    const fixedArticlesDir = path.join(siteFolderPath, 'fixed-articles');
    if (fs.existsSync(fixedArticlesDir)) {
        const fixedFiles = fs.readdirSync(fixedArticlesDir).filter(f => f.endsWith('.html'));
        for (const file of fixedFiles) {
            htmlFiles.push({
                path: path.join(fixedArticlesDir, file),
                relativePath: `fixed-articles/${file}`
            });
        }
    }

    console.log(`📋 找到 ${htmlFiles.length} 個 HTML 檔案\n`);

    // 處理每個檔案
    for (const fileInfo of htmlFiles) {
        const filePath = fileInfo.path;
        const relativePath = fileInfo.relativePath;
        const raw = readHtmlFile(filePath);
        
        if (!raw) {
            console.log(`  ⏭️  跳過 ${relativePath}（無法讀取）`);
            continue;
        }

        const fileType = detectFileType(filePath, raw);
        
        // 如果 detectFileType 返回 null，跳過此檔案
        if (!fileType) {
            console.log(`  ⏭️  跳過 ${relativePath}（不需要上傳）`);
            continue;
        }
        
        const title = extractTitle(raw, fileType.slug);
        const imageUrl = extractImageUrl(raw);

        if (fileType.type === 'page') {
            // 處理 Page
            const htmlContent = extractPageHtml(raw);
            if (!htmlContent) {
                console.log(`  ⚠️  無法提取 ${relativePath} 內容`);
                continue;
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
                    console.log(`  📢 ${relativePath}: 找到廣告資訊`);
                }
            }

            try {
                const existing = await findExistingPage(strapiUrl, token, siteName, fileType.pageType);
                await savePage(strapiUrl, token, existing, payload);
                
                if (existing) {
                    console.log(`  ✅ 更新 Page: ${relativePath} (${fileType.pageType})`);
                    pagesUpdated++;
                } else {
                    console.log(`  ✅ 建立 Page: ${relativePath} (${fileType.pageType})`);
                    pagesCreated++;
                }
            } catch (e) {
                console.error(`  ❌ 失敗 Page: ${relativePath} - ${e.message}`);
                pagesFailed++;
            }

        } else if (fileType.type === 'post') {
            // 處理 Post
            const htmlContent = extractArticleHtml(raw);
            if (!htmlContent) {
                console.log(`  ⚠️  無法提取 ${relativePath} 內容`);
                continue;
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

            try {
                const existing = await findExistingPost(strapiUrl, token, siteName, fileType.slug);
                await savePost(strapiUrl, token, existing, payload);
                
                if (existing) {
                    console.log(`  ✅ 更新 Post: ${relativePath} (${fileType.category})`);
                    postsUpdated++;
                } else {
                    console.log(`  ✅ 建立 Post: ${relativePath} (${fileType.category})`);
                    postsCreated++;
                }
            } catch (e) {
                console.error(`  ❌ 失敗 Post: ${relativePath} - ${e.message}`);
                postsFailed++;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 200));
    }

    return {
        pages: { created: pagesCreated, updated: pagesUpdated, failed: pagesFailed },
        posts: { created: postsCreated, updated: postsUpdated, failed: postsFailed }
    };
}

async function main() {
    console.log('🚀 批量上傳網站到 Strapi\n');
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

    // 讀取網站資料夾路徑
    const siteFolderPath = process.argv[3];
    if (!siteFolderPath) {
        console.error('❌ 錯誤：請提供網站資料夾路徑');
        console.log('\n使用方法：');
        console.log('  node 批量上傳.cjs [環境] [網站資料夾路徑]');
        console.log('  環境: 1=開發環境, 2=正式環境（預設：1）');
        console.log('\n範例：');
        console.log('  node 批量上傳.cjs 1 "C:\\Users\\...\\site1"');
        process.exit(1);
    }

    try {
        const results = await uploadSite(siteFolderPath, strapiUrl, token);

        console.log('\n========================================');
        console.log('📊 完成統計');
        console.log('========================================');
        console.log(`\n📄 Pages:`);
        console.log(`   建立：${results.pages.created}`);
        console.log(`   更新：${results.pages.updated}`);
        console.log(`   失敗：${results.pages.failed}`);
        console.log(`\n📝 Posts:`);
        console.log(`   建立：${results.posts.created}`);
        console.log(`   更新：${results.posts.updated}`);
        console.log(`   失敗：${results.posts.failed}`);
        console.log(`\n✅ 上傳完成！`);
    } catch (error) {
        console.error('\n❌ 錯誤：', error.message);
        process.exit(1);
    }
}

main();

