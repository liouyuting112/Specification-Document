// 圖片檢測工具：找出網站使用但GitHub上缺失的圖片，並下載到本地
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置
const CONFIG = {
    websitePath: 'C:\\Users\\yyutingliu\\Downloads\\AI生成網站測試\\cursor\\一個主題多個站(雲端)',
    outputPath: 'C:\\Users\\yyutingliu\\Downloads\\AI生成網站測試\\cursor\\一個主題多個站(雲端)\\圖片偵測測試',
    githubRepo: 'liouyuting112/static-sites-monorepo-1',
    githubBranch: 'main',
    githubPath: 'shared-assets',
    githubBaseUrl: 'https://raw.githubusercontent.com'
};

// 從GitHub URL提取文件名
function extractImageName(url) {
    const match = url.match(/shared-assets\/([^?]+)/);
    if (match) {
        return match[1];
    }
    return null;
}

// 遞歸掃描HTML文件
function scanHtmlFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // 跳過node_modules和其他不需要的文件夾
            if (file === 'node_modules' || file === '.git' || file === '圖片偵測測試') {
                continue;
            }
            scanHtmlFiles(filePath, fileList);
        } else if (file.endsWith('.html')) {
            fileList.push(filePath);
        }
    }
    
    return fileList;
}

// 從HTML文件中提取圖片URL和描述
function extractImageUrls(htmlContent) {
    const imageData = [];
    
    // 匹配 img 標籤（更靈活的正則，可以匹配src和alt的任意順序）
    const imgRegex = /<img[^>]*>/gi;
    let match;
    while ((match = imgRegex.exec(htmlContent)) !== null) {
        const imgTag = match[0];
        
        // 提取src
        const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
        if (!srcMatch) continue;
        const url = srcMatch[1];
        
        // 提取alt（可能在src之前或之後）
        const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
        const alt = altMatch ? altMatch[1] : '';
        
        imageData.push({ url, alt, type: 'img' });
    }
    
    // 匹配 background-image: url()
    const bgRegex = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
    while ((match = bgRegex.exec(htmlContent)) !== null) {
        imageData.push({ url: match[1], alt: '', type: 'background' });
    }
    
    // 匹配 CSS中的 url()
    const urlRegex = /url\(["']?([^"')]+)["']?\)/gi;
    while ((match = urlRegex.exec(htmlContent)) !== null) {
        if (match[1].match(/\.(webp|jpg|jpeg|png|gif)/i)) {
            imageData.push({ url: match[1], alt: '', type: 'css' });
        }
    }
    
    return imageData;
}

// 檢查GitHub上是否存在圖片
async function checkImageExists(imageName) {
    return new Promise((resolve) => {
        const url = `${CONFIG.githubBaseUrl}/${CONFIG.githubRepo}/${CONFIG.githubBranch}/${CONFIG.githubPath}/${imageName}`;
        
        const protocol = url.startsWith('https') ? https : http;
        
        const req = protocol.get(url, { method: 'HEAD' }, (res) => {
            resolve(res.statusCode === 200);
        });
        
        req.on('error', () => {
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// 下載圖片
async function downloadImage(imageName, imageUrl) {
    return new Promise((resolve, reject) => {
        const outputDir = path.join(CONFIG.outputPath, 'downloaded_images');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputPath = path.join(outputDir, imageName);
        
        // 如果文件已存在，跳過
        if (fs.existsSync(outputPath)) {
            console.log(`  ⏭️  已存在: ${imageName}`);
            resolve(true);
            return;
        }
        
        const protocol = imageUrl.startsWith('https') ? https : http;
        
        const file = fs.createWriteStream(outputPath);
        
        const req = protocol.get(imageUrl, (res) => {
            if (res.statusCode === 200) {
                res.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`  ✅ 下載成功: ${imageName}`);
                    resolve(true);
                });
            } else {
                file.close();
                fs.unlinkSync(outputPath);
                console.log(`  ❌ 下載失敗: ${imageName} (狀態碼: ${res.statusCode})`);
                resolve(false);
            }
        });
        
        req.on('error', (err) => {
            file.close();
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            console.log(`  ❌ 下載錯誤: ${imageName} - ${err.message}`);
            resolve(false);
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            file.close();
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            console.log(`  ❌ 下載超時: ${imageName}`);
            resolve(false);
        });
    });
}

// 主函數
async function main() {
    console.log('🔍 開始掃描HTML文件...\n');
    
    // 掃描所有HTML文件
    const htmlFiles = scanHtmlFiles(CONFIG.websitePath);
    console.log(`📄 找到 ${htmlFiles.length} 個HTML文件\n`);
    
    // 提取所有圖片URL和描述
    const allImageData = new Map(); // key: imageName, value: {url, alt, files: []}
    const imageToFiles = new Map(); // 記錄每個圖片在哪個文件中使用
    
    for (const filePath of htmlFiles) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const imageData = extractImageUrls(content);
            
            for (const img of imageData) {
                // 只處理GitHub的圖片
                if (img.url.includes('github.com') && img.url.includes('shared-assets')) {
                    const imageName = extractImageName(img.url);
                    if (imageName) {
                        if (!allImageData.has(imageName)) {
                            allImageData.set(imageName, {
                                url: img.url,
                                alt: img.alt,
                                files: []
                            });
                        }
                        allImageData.get(imageName).files.push(filePath);
                        
                        if (!imageToFiles.has(imageName)) {
                            imageToFiles.set(imageName, []);
                        }
                        imageToFiles.get(imageName).push(filePath);
                    }
                }
            }
        } catch (err) {
            console.log(`⚠️  讀取文件失敗: ${filePath} - ${err.message}`);
        }
    }
    
    console.log(`🖼️  找到 ${allImageData.size} 個GitHub圖片引用\n`);
    console.log('🔍 檢查GitHub上是否存在這些圖片...\n');
    
    // 檢查每個圖片是否存在
    const missingImages = [];
    const existingImages = [];
    let checked = 0;
    
    for (const imageName of Array.from(allImageData.keys())) {
        const imgData = allImageData.get(imageName);
        const url = imgData.url;
        
        checked++;
        process.stdout.write(`[${checked}/${allImageData.size}] 檢查: ${imageName}... `);
        
        const exists = await checkImageExists(imageName);
        
        if (exists) {
            existingImages.push({ name: imageName, url });
            console.log('✅ 存在');
        } else {
            missingImages.push({ name: imageName, url, alt: imgData.alt });
            console.log('❌ 缺失');
        }
        
        // 避免請求過快
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 檢查結果:`);
    console.log(`  ✅ 存在的圖片: ${existingImages.length}`);
    console.log(`  ❌ 缺失的圖片: ${missingImages.length}\n`);
    
    if (missingImages.length === 0) {
        console.log('🎉 所有圖片都存在於GitHub上！');
        return;
    }
    
    // 生成報告
    const reportPath = path.join(CONFIG.outputPath, '缺失圖片報告.txt');
    let report = `缺失圖片報告\n生成時間: ${new Date().toLocaleString('zh-TW')}\n\n`;
    report += `總共缺失 ${missingImages.length} 張圖片:\n\n`;
    
    for (const img of missingImages) {
        const imgData = allImageData.get(img.name);
        report += `圖片名稱: ${img.name}\n`;
        report += `GitHub URL: ${img.url}\n`;
        report += `描述: ${imgData ? imgData.alt : '(無描述)'}\n`;
        report += `使用的文件:\n`;
        const files = imageToFiles.get(img.name) || [];
        files.forEach(file => {
            const relativePath = path.relative(CONFIG.websitePath, file);
            report += `  - ${relativePath}\n`;
        });
        report += `\n`;
    }
    
    fs.writeFileSync(reportPath, report, 'utf8');
    console.log(`📝 報告已保存到: ${reportPath}\n`);
    
    // 生成Markdown文件供Python程序使用
    const markdownPath = path.join(CONFIG.outputPath, '缺失圖片清單.md');
    let markdown = `# 缺失圖片清單與生成指令\n\n`;
    markdown += `生成時間: ${new Date().toLocaleString('zh-TW')}\n\n`;
    markdown += `總共需要生成 ${missingImages.length} 張圖片:\n\n`;
    
    for (const img of missingImages) {
        const imgData = allImageData.get(img.name);
        const chineseDesc = imgData && imgData.alt ? imgData.alt : `圖片: ${img.name}`;
        
        // 生成英文描述（簡單翻譯或基於文件名）
        let englishDesc = '';
        if (chineseDesc && chineseDesc !== `圖片: ${img.name}`) {
            // 嘗試從中文描述生成英文關鍵詞
            // 這裡可以根據圖片類型添加英文關鍵詞
            const imageName = img.name.toLowerCase();
            if (imageName.includes('hero')) {
                englishDesc = 'hero image, main banner';
            } else if (imageName.includes('about')) {
                englishDesc = 'about us, team, introduction';
            } else if (imageName.includes('contact')) {
                englishDesc = 'contact, communication, office';
            } else if (imageName.includes('daily') || imageName.includes('article')) {
                englishDesc = 'article image, content illustration';
            } else if (imageName.includes('fixed')) {
                englishDesc = 'featured content, main article';
            } else if (imageName.includes('privacy')) {
                englishDesc = 'privacy policy, security, document';
            } else {
                englishDesc = 'website image, content illustration';
            }
        } else {
            englishDesc = 'website image, content illustration';
        }
        
        // 組合中英文描述（合併到一個描述字段，符合Python程序格式）
        const combinedDesc = chineseDesc && chineseDesc !== `圖片: ${img.name}` 
            ? `${chineseDesc} | ${englishDesc}`
            : englishDesc;
        
        // 生成指令：使用中英文組合
        const prompt = `${combinedDesc}, professional photography, high quality, webp format --ar 16:9`;
        
        // 按照Python程序期望的格式生成（格式1：列表格式）
        markdown += `- **檔名**: ${img.name}\n`;
        markdown += `- **用途**: 網站圖片\n`;
        markdown += `- **描述**: ${combinedDesc}\n`;
        markdown += `- **生成指令**: ${prompt}\n\n`;
    }
    
    fs.writeFileSync(markdownPath, markdown, 'utf8');
    console.log(`📝 Markdown清單已保存到: ${markdownPath}\n`);
    
    // 調用Python程序下載圖片
    console.log('📥 準備調用Python程序下載圖片...\n');
    
    const pythonScriptPath = path.join(CONFIG.outputPath, 'AI抓取無版權圖', 'download_images_from_markdown.py');
    const downloadDir = path.join(CONFIG.outputPath, 'downloaded_images');
    
    if (!fs.existsSync(pythonScriptPath)) {
        console.log(`⚠️  Python程序不存在: ${pythonScriptPath}`);
        console.log(`請確認Python程序路徑正確\n`);
    } else {
        console.log(`📝 已生成Markdown清單: ${markdownPath}`);
        console.log(`🐍 請執行以下命令來下載圖片:\n`);
        console.log(`   python "${pythonScriptPath}" "${markdownPath}" "${downloadDir}"\n`);
        console.log(`或直接執行: 執行圖片下載.bat\n`);
    }
    
    console.log(`\n📁 圖片將保存到: ${downloadDir}`);
}

// 執行
main().catch(console.error);

