// =========================================================
// Strapi CMS 文章載入腳本
// =========================================================

console.log('✅ article-cms.js 已載入');

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
// 工具函數：統一處理 Strapi 資料結構
// =========================================================

function getPostAttributes(item) {
    // 支援兩種可能的資料結構
    // 1. 標準 Strapi v4: {id, attributes: {title, slug, ...}}
    // 2. 扁平結構: {id, title, slug, ...}
    if (item.attributes) {
        return item.attributes;
    }
    // 如果是扁平結構，直接返回該item（除了id）
    const { id, documentId, ...attrs } = item;
    return attrs;
}

// =========================================================
// 從URL路徑判斷網站名稱
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
    // 檢查五個星座網站和科學探索館
    const siteMatch = path.match(/\/(cds006|so007|awh008|zfh009|sce010|seh001|kfd003|sgo004|kst005|kel002)\//);
    if (siteMatch) {
        console.log('✅ 從路徑提取到網站名稱:', siteMatch[1]);
        return siteMatch[1];
    }
    
    // 檢查 siteX 格式
    const match = path.match(/\/(site\d+)\//);
    if (match) {
        return match[1];
    }
    
    // 嘗試從路徑部分判斷
    const pathParts = path.split('/');
    const siteIndex = pathParts.findIndex(part => 
        (part.startsWith('site') && /^site\d+$/.test(part)) ||
        /^(cds006|so007|awh008|zfh009|sce010|seh001|kfd003|sgo004|kst005|kel002)$/.test(part)
    );
    if (siteIndex !== -1) {
        return pathParts[siteIndex];
    }
    
    // 如果還是找不到，嘗試從當前目錄名稱提取
    const currentDir = pathParts[pathParts.length - 2]; // 倒數第二個可能是目錄名
    if (/^(cds006|so007|awh008|zfh009|sce010|seh001|kfd003|sgo004|kst005|kel002)$/.test(currentDir)) {
        console.log('✅ 從當前目錄提取到網站名稱:', currentDir);
        return currentDir;
    }
    
    console.warn('⚠️ 無法從路徑判斷站點，預設使用 site1');
    return 'site1';
}

// =========================================================
// 從URL提取文章 slug
// =========================================================

function getSlugFromUrl() {
    const path = window.location.pathname;
    // 例如：site1/articles/2025-12-01.html 或 /articles/2025-12-01.html
    const match = path.match(/\/([^\/]+)\.html$/);
    if (match) {
        return match[1]; // 返回 2025-12-01 等
    }
    return null;
}

// =========================================================
// 從Strapi獲取文章資料
// =========================================================

async function fetchArticleFromStrapi(site, slug) {
    try {
        // 構建 API URL，使用Strapi的篩選功能
        const url = `${STRAPI_URL}/api/posts?filters[site][$eq]=${site}&filters[slug][$eq]=${slug}`;
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // 如果有API Token，加入Authorization header
        if (STRAPI_API_TOKEN) {
            headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
        }
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            console.error(`❌ Strapi API 錯誤 (${response.status}):`, await response.text());
            return null;
        }
        
        const data = await response.json();
        console.log(`✅ 成功從Strapi獲取文章 (${site} - ${slug}):`, data);
        
        // Strapi v4的資料結構：data是陣列
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            return data.data[0]; // 返回第一篇文章（應該只有一篇）
        }
        
        console.warn(`⚠️ 找不到文章資料(${site} - ${slug})`);
        return null;
    } catch (error) {
        console.error(`❌ 獲取 Strapi 資料失敗 (${site} - ${slug}):`, error);
        return null;
    }
}

// =========================================================
// 提取 HTML 內容（從 <article> 標籤中提取，或直接使用）
// =========================================================

function extractArticleContent(htmlString) {
    if (!htmlString) {
        return null;
    }
    
    // 建立一個 DOM 來解析HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    
    // 嘗試找到 <article> 標籤
    const article = tempDiv.querySelector('article.article-content') || tempDiv.querySelector('article');
    
    if (article) {
        // 返回 <article> 內部的HTML（不包括 <article> 標籤本身）
        let content = article.innerHTML;
        // 移除 <h1> 標題（因為title欄位會載入）
        content = content.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '').trim();
        return content;
    }
    
    // 如果沒有 <article>，嘗試找 <body> 內容
    const body = tempDiv.querySelector('body');
    if (body) {
        let content = body.innerHTML;
        // 移除 <h1> 標題
        content = content.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '').trim();
        return content;
    }
    
    // 如果都沒有，直接返回該HTML（可能是純內容）
    // 但要移除<h1>
    let content = htmlString;
    content = content.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '').trim();
    return content;
}

// =========================================================
// 載入文章內容功能
// =========================================================

// 顯示用的slug（網站中的 2025-12-01 等）與Strapi內部的slug對應
// 目前 Strapi 仍使用2025-12-01~03 作為 slug，而網站希望顯示2025-12-01~03
function mapDisplaySlugToStrapiSlug(slug) {
    // 直接返回 slug，因為 Strapi 中的 slug 已經是正確的格式
    // 不需要映射，直接使用 URL 中的 slug 查詢 Strapi
    return slug;
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
        const attrs = getPostAttributes(post);
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

async function loadArticleContent() {
    const site = getSiteFromPath();
    const displaySlug = getSlugFromUrl();
    
    if (!displaySlug) {
        console.warn('⚠️ 無法從URL提取文章 slug');
        return;
    }
    
    const slug = mapDisplaySlugToStrapiSlug(displaySlug);
    
    console.log(`🔍 開始載入文章內容 (${site} - 顯示 slug: ${displaySlug}, Strapi slug: ${slug})...`);
    
    // 找到文章容器（支援多種結構）
    let articleContainer = document.querySelector('article.article-content');
    
    // 如果找不到，嘗試其他結構
    if (!articleContainer) {
        articleContainer = document.querySelector('article');
    }
    
    // 如果還是找不到，嘗試 main > article
    if (!articleContainer) {
        const main = document.querySelector('main');
        if (main) {
            articleContainer = main.querySelector('article');
        }
    }
    
    // 如果還是找不到，嘗試 .post 或 .post-content
    if (!articleContainer) {
        articleContainer = document.querySelector('.post') || document.querySelector('.post-content');
    }
    
    if (!articleContainer) {
        console.warn('⚠️  找不到文章容器，無法載入文章內容');
        return;
    }
    
    // 從Strapi獲取文章
    const articleData = await fetchArticleFromStrapi(site, slug);
    
    if (!articleData) {
        console.log('⚠️ 無法從Strapi載入文章，保留原本內容');
        return;
    }
    
    const attrs = getPostAttributes(articleData);
    let htmlContent = attrs.html;
    
    // 如果有 imageUrl，在內容開頭插入圖片
    if (attrs.imageUrl && htmlContent) {
        // 檢查內容開頭是否已經有圖片
        if (!htmlContent.includes('<img') && !htmlContent.includes('hero-image')) {
            // 在內容開頭插入 hero image
            htmlContent = `<div class="hero-image" style="margin-bottom: 2rem;">
                <img src="${attrs.imageUrl}" alt="${attrs.title || ''}" style="width: 100%; height: auto;" loading="lazy">
            </div>\n\n${htmlContent}`;
        }
    }
    
    if (!htmlContent) {
        console.warn('⚠️  找不到 html 內容');
        return;
    }
    
    // 提取文章內容
    let extractedContent = extractArticleContent(htmlContent);
    
    if (!extractedContent) {
        console.warn('⚠️  無法提取文章內容');
        return;
    }
    
    // 移除可能重複的<h1>標題（從 Strapi 載入的內容中）
    extractedContent = extractedContent.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '').trim();
    
    // 移除可能包含「發布於」「發佈於」等日期資訊的區塊，避免與頁面上原本日期重複
    // 為了避免正則亂碼問題，改用 DOM 方式處理，而不是複雜的正則
    try {
        const tempWrapper = document.createElement('div');
        tempWrapper.innerHTML = extractedContent;

        // 移除 class 為 meta / post-meta 的元素
        tempWrapper.querySelectorAll('.meta, .post-meta').forEach(el => el.remove());

        // 移除內文中直接包含「發布於」文字的段落 / span / div
        const textSelectors = ['p', 'span', 'div'];
        textSelectors.forEach(sel => {
            tempWrapper.querySelectorAll(sel).forEach(el => {
                const text = el.textContent || '';
                if (text.includes('發布於') || text.includes('發佈於')) {
                    el.remove();
                }
            });
        });

        extractedContent = tempWrapper.innerHTML.trim();
    } catch (e) {
        console.warn('⚠️  清理發布日期區塊時發生錯誤，略過處理', e);
    }
    
    // 更新頁面 <title>（如果有提供標題）
    if (attrs.title) {
        const siteTitle = document.title.split(' | ')[1] || '每日精選';
        document.title = `${attrs.title} | ${siteTitle}`;
    }
    
    // 保留原有結構（如果有.post-header, .post-meta 等）
    const existingHeader = articleContainer.querySelector('.post-header');
    const existingMeta = articleContainer.querySelector('.post-meta, .meta');
    const existingContent = articleContainer.querySelector('.post-content');
    
    // 清空原本內容
    articleContainer.innerHTML = '';
    
    // 如果有原有結構，恢復它
    if (existingHeader) {
        articleContainer.appendChild(existingHeader);
        const h1InHeader = existingHeader.querySelector('h1');
        if (h1InHeader) {
            h1InHeader.textContent = attrs.title || '未命名文章';
        } else {
            const h1 = document.createElement('h1');
            h1.textContent = attrs.title || '未命名文章';
            existingHeader.insertBefore(h1, existingHeader.firstChild);
        }
    } else {
        // 插入標題（使用 title 欄位，只插入一次）
        const h1 = document.createElement('h1');
        h1.textContent = attrs.title || '未命名文章';
        articleContainer.appendChild(h1);
    }
    
    // 如果有原有meta，恢復它
    if (existingMeta) {
        articleContainer.appendChild(existingMeta);
    }
    
    // 如果有原有content容器，使用它
    if (existingContent) {
        existingContent.innerHTML = extractedContent;
        articleContainer.appendChild(existingContent);
    } else {
        // 插入從Strapi載入的內容（已經移除<h1>）
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = extractedContent;
        articleContainer.appendChild(contentDiv);
    }
    
    console.log(`✅ 已成功載入文章內容(${site} - ${slug})`);
}

// =========================================================
// 初始化：頁面載入時執行
// =========================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOMContentLoaded 事件觸發');
    
    const site = getSiteFromPath();
    
    // 立即更新導覽列連結（無論是否有文章容器）
    updateNavDailyLink(site);
    
    // 查找文章容器（多種結構）
    let articleContainer = document.querySelector('article.article-content');
    
    // 如果找不到，嘗試其他結構
    if (!articleContainer) {
        articleContainer = document.querySelector('article');
    }
    
    // 如果還是找不到，嘗試 main > article
    if (!articleContainer) {
        const main = document.querySelector('main');
        if (main) {
            articleContainer = main.querySelector('article');
        }
    }
    
    // 如果還是找不到，嘗試 .post 或 .post-content
    if (!articleContainer) {
        articleContainer = document.querySelector('.post') || document.querySelector('.post-content');
    }
    
    if (articleContainer) {
        // 找到文章容器，開始載入文章內容
        console.log('✅ 找到文章容器，開始載入文章內容');
        // 載入文章內容
        loadArticleContent().then(() => {
            // 文章內容載入完成後，再次更新導覽列連結（確保是最新的）
            updateNavDailyLink(site);
        }).catch((error) => {
            console.error('❌ 載入文章內容失敗:', error);
            // 即使載入失敗，也再次嘗試更新導覽列連結
            setTimeout(() => {
                updateNavDailyLink(site);
            }, 100);
        });
        
        // 在文章下方的推薦區塊底部添加「查看所有文章」連結
        // 支援各站不同結構：.related-articles、.recommendations 或最後一個 <section>
        setTimeout(() => {
            let relatedSection =
                document.querySelector('.related-articles') ||
                document.querySelector('section.recommendations') ||
                document.querySelector('.recommendations');

            // 如果上述都沒找到，就退而求其次：抓 main 裡最後一個 section
            if (!relatedSection) {
                const main = document.querySelector('main');
                if (main) {
                    const sections = main.querySelectorAll('section');
                    if (sections.length > 0) {
                        relatedSection = sections[sections.length - 1];
                    }
                }
            }

            if (relatedSection) {
                let viewAllLink = relatedSection.querySelector('.view-all-articles');
                if (!viewAllLink) {
                    viewAllLink = document.createElement('a');
                    viewAllLink.className = 'view-all-articles';

                    // 根據所在站點決定 href（文章頁要回上一層）
                    const isInArticlesDir = window.location.pathname.includes('/articles/');
                    const href = isInArticlesDir ? '../all-daily-articles.html' : 'all-daily-articles.html';
                    viewAllLink.href = href;

                    // 根據 site 套不同風格（但統一靠右）
                    let styleText;
                    switch (site) {
                        case 'site1': // 懷舊時光機
                            styleText =
                                'display:block;text-align:right;margin-top:1rem;padding:0.5rem;' +
                                'color:#ff6b6b;text-decoration:none;font-size:0.9rem;font-family:var(--font-heading);';
                            break;
                        case 'site2': // 攻略圖書館
                            styleText =
                                'display:block;text-align:right;margin-top:1.2rem;padding:0.4rem 0;' +
                                'color:#1e6fd9;text-decoration:underline;font-size:0.95rem;font-weight:600;';
                            break;
                        case 'site3': // 獨立微光
                            styleText =
                                'display:block;text-align:right;margin-top:1.5rem;padding:0.5rem 0;border-top:1px dashed #ddd;' +
                                'color:#7b5cff;text-decoration:none;font-size:0.9rem;';
                            break;
                        case 'site4': // 攻略 / 電玩資訊
                            styleText =
                                'display:block;text-align:right;margin-top:1rem;padding:0.5rem 0;' +
                                'color:#00a870;text-decoration:none;font-size:0.85rem;letter-spacing:0.08em;text-transform:uppercase;';
                            break;
                        case 'site5': // 手遊速報
                            styleText =
                                'display:block;text-align:right;margin-top:1.2rem;' +
                                'color:#ff8a3d;text-decoration:none;font-size:0.85rem;';
                            break;
                        default:
                            styleText =
                                'display:block;text-align:right;margin-top:1rem;padding:0.5rem;' +
                                'color:var(--retro-accent,#ff6b6b);text-decoration:none;font-size:0.9rem;';
                    }

                    viewAllLink.style.cssText = styleText;
                    viewAllLink.textContent = '查看所有文章 →';
                    relatedSection.appendChild(viewAllLink);
                    console.log('✅ 已在文章推薦區塊添加「查看所有文章」連結', { site, href });
                }
            } else {
                console.log('ℹ️  找不到推薦區塊，略過添加「查看所有文章」連結');
            }
        }, 1000);
    } else {
        console.log('ℹ️  找不到文章容器，可能不是文章頁面');
    }
});



