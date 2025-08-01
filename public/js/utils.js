// ユーティリティ関数集

console.log('📦 Utils.js 読み込み開始');

// 安全な要素取得
const safeGetElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`⚠️ 要素が見つかりません: #${id}`);
    }
    return element;
};

// 安全なテキスト設定
const safeSetText = (id, text) => {
    const el = safeGetElement(id);
    if (el) {
        el.textContent = text;
        return true;
    }
    return false;
};

// 安全なHTML設定
const safeSetHTML = (id, html) => {
    const el = safeGetElement(id);
    if (el) {
        el.innerHTML = html;
        return true;
    }
    return false;
};

// 安全なイベントリスナー追加
const safeAddEventListener = (id, event, handler) => {
    const element = safeGetElement(id);
    if (element) {
        element.addEventListener(event, handler);
        console.log(`✅ ${id} にイベント追加成功: ${event}`);
        return true;
    } else {
        console.warn(`⚠️ イベント追加失敗: #${id}`);
        return false;
    }
};

// デバウンス関数
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// スロットル関数
const throttle = (func, limit) => {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// ランダム文字列生成
const generateRandomString = (length = 6) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// ランダムプレイヤー名生成
const generateRandomPlayerName = () => {
    const adjectives = ['勇敢な', '賢い', '素早い', '強い', '優しい', '元気な', '楽しい', '真面目な'];
    const animals = ['豚', '犬', '猫', '鳥', '魚', '虎', '象', '猿'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const num = Math.floor(Math.random() * 1000);
    return `${adj}${animal}${num}`;
};

// 入力値検証
const validators = {
    playerName: (name) => {
        if (!name || typeof name !== 'string') {
            return { isValid: false, message: 'プレイヤー名を入力してください' };
        }
        if (name.length > 20) {
            return { isValid: false, message: 'プレイヤー名は20文字以内にしてください' };
        }
        if (name.length < 1) {
            return { isValid: false, message: 'プレイヤー名を入力してください' };
        }
        return { isValid: true };
    },
    
    roomId: (roomId) => {
        if (!roomId || typeof roomId !== 'string') {
            return { isValid: false, message: 'ルームIDを入力してください' };
        }
        if (roomId.length !== 6) {
            return { isValid: false, message: 'ルームIDは6文字で入力してください' };
        }
        if (!/^[A-Z0-9]+$/.test(roomId)) {
            return { isValid: false, message: 'ルームIDは英数字で入力してください' };
        }
        return { isValid: true };
    },
    
    password: (password, required = false) => {
        if (!required && !password) {
            return { isValid: true };
        }
        if (required && !password) {
            return { isValid: false, message: 'パスワードを入力してください' };
        }
        if (password && password.length < 4) {
            return { isValid: false, message: 'パスワードは4文字以上にしてください' };
        }
        if (password && password.length > 20) {
            return { isValid: false, message: 'パスワードは20文字以内にしてください' };
        }
        return { isValid: true };
    }
};

// ローカルストレージヘルパー
const storage = {
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('LocalStorage保存エラー:', error);
            return false;
        }
    },
    
    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('LocalStorage読み込みエラー:', error);
            return defaultValue;
        }
    },
    
    remove: (key) => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('LocalStorage削除エラー:', error);
            return false;
        }
    },
    
    clear: () => {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('LocalStorage全削除エラー:', error);
            return false;
        }
    }
};

// 時間フォーマット
const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
};

// 経過時間計算
const getTimeAgo = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) { // 1分未満
        return '今';
    } else if (diff < 3600000) { // 1時間未満
        return `${Math.floor(diff / 60000)}分前`;
    } else if (diff < 86400000) { // 1日未満
        return `${Math.floor(diff / 3600000)}時間前`;
    } else {
        return `${Math.floor(diff / 86400000)}日前`;
    }
};

// エラー情報収集
const collectErrorInfo = (error, context = {}) => {
    return {
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        context,
        performance: {
            memory: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
            } : null,
            timing: performance.timing ? {
                loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart
            } : null
        }
    };
};

// DOM要素の存在確認
const checkRequiredElements = (elementIds) => {
    const missing = [];
    const found = [];
    
    elementIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            found.push(id);
        } else {
            missing.push(id);
        }
    });
    
    return {
        allFound: missing.length === 0,
        missing,
        found,
        percentage: Math.round((found.length / elementIds.length) * 100)
    };
};

// デバイス情報取得
const getDeviceInfo = () => {
    return {
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        isTouch: 'ontouchstart' in window,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screen: {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth
        },
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        }
    };
};

// パフォーマンス測定
const performance_helper = {
    mark: (name) => {
        if (performance.mark) {
            performance.mark(name);
        }
    },
    
    measure: (name, startMark, endMark) => {
        if (performance.measure) {
            try {
                performance.measure(name, startMark, endMark);
                const measures = performance.getEntriesByName(name);
                return measures.length > 0 ? measures[measures.length - 1].duration : null;
            } catch (error) {
                console.warn('Performance measurement failed:', error);
                return null;
            }
        }
        return null;
    }
};

// グローバルに公開
window.Utils = {
    safeGetElement,
    safeSetText,
    safeSetHTML,
    safeAddEventListener,
    debounce,
    throttle,
    generateRandomString,
    generateRandomPlayerName,
    validators,
    storage,
    formatTime,
    getTimeAgo,
    collectErrorInfo,
    checkRequiredElements,
    getDeviceInfo,
    performance: performance_helper
};

console.log('✅ Utils.js 読み込み完了');
