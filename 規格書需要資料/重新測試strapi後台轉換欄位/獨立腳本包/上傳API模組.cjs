// API 模組 - 處理 Strapi API 請求
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function findExistingPage(strapiUrl, token, site, type) {
    try {
        const url = `${strapiUrl}/api/pages?filters[site][$eq]=${site}&filters[type][$eq]=${type}&pagination[limit]=1`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        const response = await fetch(url, { headers });
        if (!response.ok) return null;
        const data = await response.json();
        return data.data?.[0] || null;
    } catch (e) {
        return null;
    }
}

async function findExistingPost(strapiUrl, token, site, slug) {
    try {
        const url = `${strapiUrl}/api/posts?filters[site][$eq]=${site}&filters[slug][$eq]=${slug}&pagination[limit]=1`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        const response = await fetch(url, { headers });
        if (!response.ok) return null;
        const data = await response.json();
        return data.data?.[0] || null;
    } catch (e) {
        return null;
    }
}

async function savePage(strapiUrl, token, existing, payload) {
    const url = existing
        ? `${strapiUrl}/api/pages/${existing.documentId || existing.id}`
        : `${strapiUrl}/api/pages`;
    
    const method = existing ? 'PUT' : 'POST';
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    const body = JSON.stringify({ data: payload });
    
    try {
        const response = await fetch(url, {
            method,
            headers,
            body
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
    } catch (error) {
        throw error;
    }
}

async function savePost(strapiUrl, token, existing, payload) {
    const url = existing
        ? `${strapiUrl}/api/posts/${existing.documentId || existing.id}`
        : `${strapiUrl}/api/posts`;
    
    const method = existing ? 'PUT' : 'POST';
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    const body = JSON.stringify({ data: payload });
    
    try {
        const response = await fetch(url, {
            method,
            headers,
            body
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
    } catch (error) {
        throw error;
    }
}

module.exports = {
    findExistingPage,
    findExistingPost,
    savePage,
    savePost
};



