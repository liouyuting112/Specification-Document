// 上傳核心模組 - 通用 HTML 提取和上傳邏輯
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');

// 讀取 HTML 檔案
function readHtmlFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        return null;
    }
}

// 提取標題
function extractTitle(html, fallback) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
        return titleMatch[1].trim().replace(/\s*\|\s*.*$/, '').trim();
    }
    return fallback || 'Untitled';
}

// 提取頁面 HTML 內容（移除 header, footer, script 等）
function extractPageHtml(html) {
    // 移除 script 和 style 標籤
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // 提取 main 內容
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) {
        return mainMatch[1].trim();
    }
    
    // 如果沒有 main，提取 body 內容（排除 header 和 footer）
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
        let bodyContent = bodyMatch[1];
        // 移除 header
        bodyContent = bodyContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
        // 移除 footer
        bodyContent = bodyContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
        // 移除 nav
        bodyContent = bodyContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
        return bodyContent.trim();
    }
    
    return html;
}

// 提取文章 HTML 內容
function extractArticleHtml(html) {
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) {
        return mainMatch[1].trim();
    }
    
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
        return articleMatch[1].trim();
    }
    
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
        let bodyContent = bodyMatch[1];
        bodyContent = bodyContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
        bodyContent = bodyContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
        bodyContent = bodyContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
        return bodyContent.trim();
    }
    
    return html;
}

// 提取圖片 URL
function extractImageUrl(html) {
    // 優先找第一個 img 的 src
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) {
        return imgMatch[1];
    }
    return null;
}

// 提取摘要
function extractExcerpt(html) {
    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if (metaMatch) {
        return metaMatch[1].trim();
    }
    
    const pMatch = html.match(/<p[^>]*>([^<]{50,200})<\/p>/i);
    if (pMatch) {
        return pMatch[1].trim().substring(0, 200);
    }
    
    return null;
}

// 從 slug 提取日期
function extractDateFromSlug(slug) {
    const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})/);
    return dateMatch ? dateMatch[1] : null;
}

// 提取廣告資訊（從 index.html）
function extractAdInfo(html) {
    // 尋找廣告區域（支援 section 或 aside 標籤）
    let adSectionMatch = html.match(/<section[^>]*class=["'][^"']*ad[^"']*["'][^>]*>([\s\S]*?)<\/section>/i);
    if (!adSectionMatch) {
        // 如果沒有找到 section，嘗試找 aside
        adSectionMatch = html.match(/<aside[^>]*class=["'][^"']*ad[^"']*["'][^>]*>([\s\S]*?)<\/aside>/i);
    }
    
    if (!adSectionMatch) {
        return null;
    }
    
    const adSection = adSectionMatch[1];
    
    // 提取廣告連結
    const linkMatch = adSection.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/i);
    const linkUrl = linkMatch ? linkMatch[1] : null;
    
    // 提取廣告圖片
    const imgMatch = adSection.match(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["']/i);
    const imageUrl = imgMatch ? imgMatch[1] : null;
    const altText = imgMatch ? imgMatch[2] : null;
    
    if (linkUrl || imageUrl) {
        return {
            linkUrl: linkUrl || null,
            imageUrl: imageUrl || null,
            altText: altText || null
        };
    }
    
    return null;
}

// 判斷檔案類型（Page 或 Post）
function detectFileType(filePath, html) {
    const fileName = path.basename(filePath, '.html');
    const dirName = path.dirname(filePath);
    const parentDir = path.basename(dirName);
    
    // 已知的 Page 檔案
    const knownPages = ['index', 'about', 'contact', 'privacy'];
    if (knownPages.includes(fileName)) {
        return {
            type: 'page',
            pageType: fileName === 'index' ? 'home' : fileName,
            slug: fileName === 'index' ? 'index' : fileName
        };
    }
    
    // all-daily-articles.html 不作為 Page 上傳（這是前端頁面，不需要上傳到後台）
    if (fileName === 'all-daily-articles') {
        return null; // 返回 null 表示跳過
    }
    
    // 如果在 articles 資料夾中，是 Post
    if (parentDir === 'articles' || parentDir.includes('article')) {
        const isDaily = /^\d{4}-\d{2}-\d{2}/.test(fileName);
        return {
            type: 'post',
            category: isDaily ? 'daily' : 'fixed',
            slug: fileName
        };
    }
    
    // 如果在 fixed-articles 資料夾中，是 fixed Post
    if (parentDir === 'fixed-articles') {
        return {
            type: 'post',
            category: 'fixed',
            slug: fileName
        };
    }
    
    // 預設為 Page
    return {
        type: 'page',
        pageType: fileName,
        slug: fileName
    };
}

// 從資料夾路徑提取網站名稱
function extractSiteName(folderPath) {
    const folderName = path.basename(folderPath);
    // 如果已經是簡短名稱（如 site1, cds006, seh001），直接返回
    if (/^(site\d+|cds\d+|dlh\d+|awh\d+|sce\d+|zfh\d+|so\d+|seh\d+|kfd\d+|sgo\d+|kst\d+|kel\d+)$/i.test(folderName)) {
        return folderName.toLowerCase();
    }
    // 嘗試從完整名稱中提取簡短代碼（如：科學探索館seh001 -> seh001）
    const codeMatch = folderName.match(/(seh\d+|kfd\d+|sgo\d+|kst\d+|kel\d+|cds\d+|dlh\d+|awh\d+|sce\d+|zfh\d+|so\d+|site\d+)/i);
    if (codeMatch) {
        return codeMatch[1].toLowerCase();
    }
    // 找不到代碼時，直接使用資料夾原名（保留大小寫與中文）
    return folderName;
}

module.exports = {
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
};

