// =========================================================
// Strapi CMS 靜態頁面載入腳本（About, Contact, Privacy）
// =========================================================

// 根據環境自動選擇 Strapi URL
function getStrapiUrl() {
    const hostname = window.location.hostname;
    
    console.log('🔍 檢測環境，hostname:', hostname);
    
    // 正式環境：只有完全匹配標準網址才使用正式環境
    if (hostname === 'multi-site-static-strapi-front.vercel.app') {
        console.log('✅ 使用正式環境 Strapi');
        return 'https://effortless-whisper-83765d99df.strapiapp.com'; // 正式環境
    }
    
    // 開發環境：所有其他情況（預覽網址、本地開發等）
    console.log('✅ 使用開發環境 Strapi');
    return 'https://ethical-dance-ee33e4e924.strapiapp.com'; // 開發環境
}

const STRAPI_URL = getStrapiUrl();
const STRAPI_API_TOKEN = ''; // 如果 Public 角色有權限，可以留空；否則填入 API Token

// =========================================================
// 工具函數：從 URL 判斷站點和頁面類型
// =========================================================

function getSiteFromPath() {
    // 先從 script 標籤的 data-site 屬性獲取
    const scriptTag = document.querySelector('script[data-site]');
    if (scriptTag) {
        const site = scriptTag.getAttribute('data-site');
        if (site) {
            console.log('✅ 從 data-site 屬性獲取網站名稱:', site);
            return site;
        }
    }
    
    const path = window.location.pathname;
    // 檢查五個星座網站
    const zodiacMatch = path.match(/\/(cds006|so007|awh008|zfh009|sce010)\//);
    if (zodiacMatch) {
        console.log('✅ 從路徑提取到網站名稱:', zodiacMatch[1]);
        return zodiacMatch[1];
    }
    
    const match = path.match(/\/(site\d+)\//);
    if (match) {
        return match[1];
    }
    
    // 嘗試從路徑部分判斷
    const pathParts = path.split('/');
    for (const part of pathParts) {
        if ((part.startsWith('site') && /^site\d+$/.test(part)) ||
            /^(cds006|so007|awh008|zfh009|sce010)$/.test(part)) {
            return part;
        }
    }
    
    // 如果還是找不到，嘗試從當前目錄名稱提取
    const currentDir = pathParts[pathParts.length - 2];
    if (/^(cds006|so007|awh008|zfh009|sce010)$/.test(currentDir)) {
        console.log('✅ 從當前目錄提取到網站名稱:', currentDir);
        return currentDir;
    }
    
    return 'site1'; // 預設
}

function getPageTypeFromUrl() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || '';
    
    if (filename.includes('about')) {
        return 'about';
    } else if (filename.includes('contact')) {
        return 'contact';
    } else if (filename.includes('privacy')) {
        return 'privacy';
    }
    
    return null;
}

// =========================================================
// 工具函數：從 Strapi 抓取 Page 內容
// =========================================================

async function fetchPageFromStrapi(site, type) {
    try {
        const url = `${STRAPI_URL}/api/pages?filters[site][$eq]=${site}&filters[type][$eq]=${type}&pagination[limit]=1`;
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (STRAPI_API_TOKEN) {
            headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
        }
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            console.error(`❌ Strapi Page API 錯誤 (${response.status}):`, await response.text());
            return null;
        }
        
        const data = await response.json();
        
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            const page = data.data[0];
            const attrs = page.attributes || page;
            console.log(`✅ 成功從 Strapi 抓取 Page: ${site} - ${type}`, attrs);
            return attrs;
        }
        
        console.warn(`⚠️ 找不到 Page: ${site} - ${type}`);
        return null;
    } catch (error) {
        console.error(`❌ 抓取 Strapi Page 失敗 (${site} - ${type}):`, error);
        return null;
    }
}

// =========================================================
// 載入頁面內容
// =========================================================

async function loadPageContent() {
    const site = getSiteFromPath();
    const pageType = getPageTypeFromUrl();
    
    if (!pageType) {
        console.warn('⚠️ 無法從 URL 判斷頁面類型，跳過載入');
        return;
    }
    
    console.log(`🚀 開始載入頁面內容 (${site} - ${pageType})...`);
    
    // 從 Strapi 抓取頁面內容
    const pageData = await fetchPageFromStrapi(site, pageType);
    
    if (!pageData || !pageData.html) {
        console.warn(`⚠️ 無法載入 ${site} 的 ${pageType} 內容，使用預設內容`);
        return;
    }
    
    // 找到 main 容器
    const mainContainer = document.querySelector('main');
    if (!mainContainer) {
        console.warn('⚠️ 找不到 <main> 容器');
        return;
    }
    
    // 解析 Strapi 的 HTML 內容
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pageData.html;
    
    // 嘗試從 Strapi 的 HTML 中提取 main 內容
    let contentToInsert = null;
    
    // 方法 1: 如果 Strapi 的 HTML 中有 <main> 標籤，提取其內容
    const mainFromStrapi = tempDiv.querySelector('main');
    if (mainFromStrapi) {
        contentToInsert = mainFromStrapi.innerHTML;
    } else {
        // 方法 2: 如果沒有 <main>，嘗試提取 <body> 內的內容（排除 header, nav, footer）
        const bodyFromStrapi = tempDiv.querySelector('body');
        if (bodyFromStrapi) {
            // 複製 body 內容，但排除 header, nav, footer
            const bodyClone = bodyFromStrapi.cloneNode(true);
            const header = bodyClone.querySelector('header, .header, nav, .nav');
            const footer = bodyClone.querySelector('footer, .footer');
            if (header) header.remove();
            if (footer) footer.remove();
            contentToInsert = bodyClone.innerHTML;
        } else {
            // 方法 3: 如果都沒有，只提取非 header/nav/footer 的內容
            // 移除可能的 header, nav, footer 標籤
            const cleanHtml = pageData.html
                .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
                .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
                .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
            contentToInsert = cleanHtml;
        }
    }
    
    if (!contentToInsert) {
        console.warn('⚠️ 無法提取頁面內容');
        return;
    }
    
    // 更新頁面標題（如果 Strapi 有提供）
    if (pageData.title) {
        document.title = `${pageData.title} | ${document.title.split(' | ')[1] || ''}`;
    }
    
    // 替換 main 內容
    mainContainer.innerHTML = contentToInsert;
    
    // 如果 Strapi 有提供 imageUrl，更新頁面上的所有圖片
    if (pageData.imageUrl) {
        const images = mainContainer.querySelectorAll('img');
        if (images.length > 0) {
            // 更新第一張圖片（通常是主要圖片）
            images[0].src = pageData.imageUrl;
            console.log(`✅ 已更新 ${site} 的 ${pageType} 頁面主圖片: ${pageData.imageUrl}`);
        }
    }
    
    console.log(`✅ 已更新 ${site} 的 ${pageType} 頁面內容`);
    
    // 更新導覽列中的「每日精選文章」連結（延遲執行，確保 DOM 已更新）
    setTimeout(() => {
        updateNavDailyLink(site);
    }, 100);
}

// =========================================================
// 更新導覽列中的「每日精選文章」連結為最新文章
// =========================================================

async function updateNavDailyLink(site) {
    try {
        console.log(`🔍 開始更新 ${site} 導覽列中的「每日精選文章」連結...`);
        
        // 依照自訂欄位 date（若沒有則用 updatedAt / publishedAt）取得最近的每日文章（只看 isFeatured=true）
        // 嘗試先用 date > updatedAt > publishedAt 排序，如果失敗再退回只用 publishedAt
        let url = `${STRAPI_URL}/api/posts?filters[site][$eq]=${site}&filters[category][$eq]=daily&filters[isFeatured][$eq]=true&sort=date:desc&sort=updatedAt:desc&sort=publishedAt:desc&pagination[limit]=1`;
        const headers = { 'Content-Type': 'application/json' };
        if (STRAPI_API_TOKEN) {
            headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
        }
        
        let response = await fetch(url, { headers });
        
        // 如果 date / updatedAt 排序失敗（可能字段不存在），嘗試僅用 publishedAt
        if (!response.ok || response.status === 400) {
            console.log(`⚠️  嘗試使用 date / updatedAt 排序失敗，改用 publishedAt`);
            url = `${STRAPI_URL}/api/posts?filters[site][$eq]=${site}&filters[category][$eq]=daily&filters[isFeatured][$eq]=true&sort=publishedAt:desc&pagination[limit]=1`;
            response = await fetch(url, { headers });
        }
        
        if (!response.ok) {
            console.warn(`⚠️  查詢 ${site} 最新文章失敗 (${response.status})，跳過更新導覽列連結`);
            return;
        }
        
        const data = await response.json();
        const posts = data.data || [];
        if (posts.length === 0) {
            console.warn(`⚠️  ${site} 沒有找到每日文章，跳過更新導覽列連結`);
            return;
        }
        
        const post = posts[0];
        const attrs = post.attributes || post;
        const latestSlug = attrs.slug;
        
        if (!latestSlug) {
            console.warn(`⚠️  最新文章沒有 slug，跳過更新導覽列連結`);
            return;
        }
        
        console.log(`✅ 找到最新文章: ${latestSlug}`);
        
        // 查找所有導覽列連結（更廣泛的選擇器）
        const navLinks = document.querySelectorAll('nav a, .nav-menu a, .nav-links a, header a, .header a');
        let updatedCount = 0;
        
        navLinks.forEach(link => {
            const linkText = link.textContent.trim();
            // 匹配「每日精選文章」或包含「每日精選」的文字
            if (linkText === '每日精選文章' || linkText.includes('每日精選')) {
                const currentHref = link.getAttribute('href');
                if (!currentHref) return;
                
                console.log(`🔍 找到「每日精選文章」連結: ${currentHref}`);
                
                // 判斷路徑格式並生成新連結
                let newHref;
                
                // 情況1: articles/2025-12-03.html 或 ../articles/2025-12-03.html
                if (currentHref.includes('articles/')) {
                    newHref = currentHref.replace(/articles\/\d{4}-\d{2}-\d{2}\.html/, `articles/${latestSlug}.html`);
                }
                // 情況2: 2025-12-03.html (在 articles 目錄內，相對路徑)
                else if (/\d{4}-\d{2}-\d{2}\.html$/.test(currentHref)) {
                    // 提取路徑前綴（如果有）
                    const pathPrefix = currentHref.replace(/\d{4}-\d{2}-\d{2}\.html$/, '');
                    newHref = pathPrefix + `${latestSlug}.html`;
                }
                // 情況3: 其他格式，使用預設
                else {
                    // 判斷當前頁面是否在 articles 目錄內
                    const isInArticlesDir = window.location.pathname.includes('/articles/');
                    if (isInArticlesDir) {
                        newHref = `${latestSlug}.html`;
                    } else {
                        newHref = `articles/${latestSlug}.html`;
                    }
                }
                
                if (currentHref !== newHref) {
                    link.setAttribute('href', newHref);
                    updatedCount++;
                    console.log(`  ✅ 已更新連結: ${currentHref} → ${newHref}`);
                } else {
                    console.log(`  ℹ️  連結已經是正確的: ${currentHref}`);
                }
            }
        });
        
        if (updatedCount > 0) {
            console.log(`✅ 已更新 ${site} 導覽列中的「每日精選文章」連結: ${latestSlug} (${updatedCount} 個連結)`);
        } else {
            console.log(`ℹ️  ${site} 導覽列中沒有找到需要更新的「每日精選文章」連結`);
        }
    } catch (error) {
        console.error(`❌ 更新 ${site} 導覽列連結失敗:`, error);
    }
}

// =========================================================
// 自動執行：頁面載入時執行
// =========================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 page-cms.js 已載入');
    
    const site = getSiteFromPath();
    
    // 立即更新導覽列連結（無論是否載入頁面內容）
    updateNavDailyLink(site);
    
    // 檢查是否為靜態頁面（about, contact, privacy）
    const pageType = getPageTypeFromUrl();
    if (pageType) {
        console.log(`🔍 檢測到 ${pageType} 頁面，開始載入 Strapi 內容...`);
        loadPageContent();
    } else {
        console.log('ℹ️ 不是靜態頁面，跳過 page-cms.js');
    }
});

