// 星座解密站 - 導覽列與下拉選單邏輯
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const dropdowns = document.querySelectorAll('.dropdown');

    // 漢堡選單切換
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navMenu.classList.toggle('active');
        });

        // 點擊外部關閉選單
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                    navMenu.classList.remove('active');
                    dropdowns.forEach(d => d.classList.remove('active'));
                }
            }
        });
    }

    // 下拉選單邏輯
    dropdowns.forEach(dropdown => {
        const link = dropdown.querySelector('a');
        const menu = dropdown.querySelector('.dropdown-menu');
        
        if (menu) {
            menu.style.display = 'none';
        }

        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isActive = dropdown.classList.contains('active');
            
            // 先關閉所有下拉選單
            dropdowns.forEach(d => {
                d.classList.remove('active');
                const m = d.querySelector('.dropdown-menu');
                if (m) m.style.display = 'none';
            });
            
            // 如果原本沒開啟，現在開啟
            if (!isActive) {
                dropdown.classList.add('active');
                if (menu) menu.style.display = 'block';
            }
        });
    });

    // 點擊外部關閉下拉選單
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) {
            dropdowns.forEach(d => {
                d.classList.remove('active');
                const m = d.querySelector('.dropdown-menu');
                if (m) m.style.display = 'none';
            });
        }
    });

    // 桌面版滑鼠離開關閉
    dropdowns.forEach(dropdown => {
        dropdown.addEventListener('mouseleave', () => {
            if (window.innerWidth > 768) {
                dropdown.classList.remove('active');
                const menu = dropdown.querySelector('.dropdown-menu');
                if (menu) menu.style.display = 'none';
            }
        });
    });
});

// =============== 首頁橫向文章slider - 響應式觸摸滑動 ================
function initHomeSlider() {
    console.log('🔄 [cds006] 開始初始化首頁slider...');
    
    const wrapper = document.querySelector('.daily-slider-wrapper');
    const track = document.querySelector('.daily-slider-track');
    
    if (!wrapper || !track) {
        console.log('⚠️ [cds006] 找不到slider元素，稍後重試...');
        return false;
    }
    
    const cards = track.querySelectorAll('.daily-card');
    if (cards.length === 0) {
        console.log('⚠️ [cds006] 沒有找到卡片，稍後重試...');
        return false;
    }
    
    console.log('✅ [cds006] 找到slider元素，卡片數量:', cards.length);
    
    const container = track.parentElement; // .daily-slider
    let currentIndex = 0;
    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    let translateX = 0;
    
    function isMobile() {
        return window.innerWidth <= 1024; // 平板和手機都視為移動設備
    }
    
    function updateSlider(smooth = true) {
        if (!isMobile()) {
            // 桌面版：不滑動，保持靜態排列
            track.style.transform = 'translateX(0)';
            track.style.transition = 'none';
            container.style.overflow = 'visible';
            return;
        }
        
        // 移動設備：啟用滑動
        const containerWidth = container.offsetWidth || wrapper.offsetWidth || 1;
        
        // 確保所有卡片寬度一致（使用容器寬度，確保每張卡片都完整顯示）
        // 響應式時，每張卡片應該佔滿整個容器寬度
        const gap = 32; // 2rem = 32px
        const cardWidth = containerWidth; // 每張卡片寬度 = 容器寬度（手機）或容器寬度的一半（平板）
        
        // 設置所有卡片的寬度，確保大小一致
        cards.forEach((card, index) => {
            card.style.width = `${containerWidth}px`;
            card.style.minWidth = `${containerWidth}px`;
            card.style.flexShrink = '0';
            card.style.marginRight = index < cards.length - 1 ? `${gap}px` : '0';
        });
        
        // 最大索引 = 卡片總數 - 1（每次顯示一張）
        const maxIndex = Math.max(0, cards.length - 1);
        currentIndex = Math.max(0, Math.min(currentIndex, maxIndex));
        
        // 計算移動距離（讓當前卡片對齊到容器左邊）
        // 每張卡片寬度 + gap（除了最後一張）
        translateX = -currentIndex * (cardWidth + gap);
        
        // 確保容器和track樣式正確
        container.style.overflow = 'hidden';
        container.style.position = 'relative';
        container.style.width = '100%';
        
        track.style.display = 'flex';
        track.style.flexWrap = 'nowrap';
        track.style.transition = smooth ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
        track.style.transform = `translateX(${translateX}px)`;
        
        console.log('📊 [cds006] Slider更新:', { 
            currentIndex, 
            maxIndex, 
            cardWidth: cardWidth.toFixed(2),
            translateX: translateX.toFixed(2),
            cardsLength: cards.length,
            containerWidth: containerWidth.toFixed(2),
            isMobile: isMobile()
        });
    }
    
    // 觸摸滑動事件（僅在移動設備上啟用）
    // 先移除舊的事件監聽器（如果存在）
    track._touchStartHandler = track._touchStartHandler || null;
    track._touchMoveHandler = track._touchMoveHandler || null;
    track._touchEndHandler = track._touchEndHandler || null;
    
    if (track._touchStartHandler) {
        track.removeEventListener('touchstart', track._touchStartHandler);
        track.removeEventListener('touchmove', track._touchMoveHandler);
        track.removeEventListener('touchend', track._touchEndHandler);
    }
    
    // 創建新的事件處理函數
    let touchStartX = 0;
    let touchCurrentX = 0;
    let touchTranslateX = 0;
    
    track._touchStartHandler = function(e) {
        if (!isMobile()) return;
        touchStartX = e.touches[0].clientX;
        isDragging = true;
        track.style.transition = 'none';
        console.log('👆 [cds006] 觸摸開始');
    };
    
    track._touchMoveHandler = function(e) {
        if (!isMobile() || !isDragging) return;
        e.preventDefault();
        touchCurrentX = e.touches[0].clientX;
        touchTranslateX = translateX + (touchCurrentX - touchStartX);
        
        // 限制滑動範圍
        const containerWidth = container.offsetWidth || wrapper.offsetWidth || 1;
        const gap = 32;
        const cardWidth = containerWidth;
        
        // 計算最小和最大移動距離
        // 最小：讓最後一張卡片對齊到容器左邊
        // 最大：第一張卡片對齊到容器左邊（0）
        const minTranslateX = -(cards.length - 1) * (cardWidth + gap);
        const maxTranslateX = 0;
        touchTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, touchTranslateX));
        
        track.style.transform = `translateX(${touchTranslateX}px)`;
    };
    
    track._touchEndHandler = function(e) {
        if (!isMobile() || !isDragging) return;
        isDragging = false;
        
        const diff = touchCurrentX - touchStartX;
        const threshold = 50; // 滑動閾值
        
        console.log('👆 [cds006] 觸摸結束，diff:', diff);
        
        if (Math.abs(diff) > threshold) {
            if (diff > 0 && currentIndex > 0) {
                // 向右滑動，顯示上一張
                currentIndex--;
                console.log('➡️ [cds006] 向右滑動，顯示上一張，currentIndex:', currentIndex);
            } else if (diff < 0 && currentIndex < cards.length - 1) {
                // 向左滑動，顯示下一張
                currentIndex++;
                console.log('⬅️ [cds006] 向左滑動，顯示下一張，currentIndex:', currentIndex);
            }
        }
        
        updateSlider(true);
    };
    
    // 綁定事件（不使用passive，以便preventDefault）
    track.addEventListener('touchstart', track._touchStartHandler, { passive: false });
    track.addEventListener('touchmove', track._touchMoveHandler, { passive: false });
    track.addEventListener('touchend', track._touchEndHandler, { passive: false });
    
    // 滑鼠拖動支持（平板）
    track.addEventListener('mousedown', (e) => {
        if (!isMobile()) return;
        startX = e.clientX;
        isDragging = true;
        track.style.transition = 'none';
        e.preventDefault();
    });
    
    track.addEventListener('mousemove', (e) => {
        if (!isMobile() || !isDragging) return;
        currentX = e.clientX;
        const diff = currentX - startX;
        const containerWidth = container.offsetWidth || wrapper.offsetWidth || 1;
        const gap = 32;
        const cardWidth = containerWidth;
        
        const minTranslateX = -(cards.length - 1) * (cardWidth + gap);
        const maxTranslateX = 0;
        const newTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, translateX + diff));
        track.style.transform = `translateX(${newTranslateX}px)`;
    });
    
    track.addEventListener('mouseup', () => {
        if (!isMobile() || !isDragging) return;
        isDragging = false;
        
        const diff = currentX - startX;
        const threshold = 50;
        
        if (Math.abs(diff) > threshold) {
            if (diff > 0 && currentIndex > 0) {
                currentIndex--;
            } else if (diff < 0 && currentIndex < cards.length - 1) {
                currentIndex++;
            }
        }
        
        updateSlider(true);
    });
    
    track.addEventListener('mouseleave', () => {
        if (isMobile() && isDragging) {
            isDragging = false;
            updateSlider(true);
        }
    });
    
    // resize時更新
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            currentIndex = 0;
            updateSlider(true);
        }, 100);
    });
    
    // 初始化
    updateSlider(true);
    
    console.log('✅ [cds006] Slider初始化完成！');
    return true;
}

// =============== 供CMS呼叫、重新初始化首頁橫向slider ================
window.reInitHomeSlider = function() {
    console.log('🔄 [cds006] CMS要求重新初始化slider...');
    // 延遲一點確保DOM完全更新
    setTimeout(() => {
        if (initHomeSlider()) {
            console.log('✅ [cds006] CMS重新初始化成功！');
        } else {
            console.log('⚠️ [cds006] CMS重新初始化失敗，500ms後重試...');
            setTimeout(() => initHomeSlider(), 500);
        }
    }, 300);
};

// 頁面載入時初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            initHomeSlider();
        }, 100);
    });
} else {
    setTimeout(() => {
        initHomeSlider();
    }, 100);
}

// 監聽CMS內容更新事件
document.addEventListener('cmsContentUpdated', () => {
    console.log('📢 [cds006] 收到CMS內容更新事件');
    setTimeout(() => {
        window.reInitHomeSlider();
    }, 500);
});
