// UI管理クラス

console.log('🎨 UI-Manager.js 読み込み開始');

class UIManager {
    static toastCount = 0;
    static activeToasts = new Set();

    // トースト通知
    static showToast(message, type = 'info', duration = 3000) {
        // 同じメッセージの重複を防ぐ
        const toastId = `toast-${Date.now()}-${++this.toastCount}`;
        
        // 既存のトーストを削除（最大3個まで）
        if (this.activeToasts.size >= 3) {
            const oldestToast = document.querySelector('.toast');
            if (oldestToast) {
                this.removeToast(oldestToast);
            }
        }
        
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        // 閉じるボタンを追加（長いメッセージの場合）
        if (message.length > 50) {
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: inherit;
                font-size: 18px;
                font-weight: bold;
                margin-left: 10px;
                cursor: pointer;
                padding: 0;
            `;
            closeBtn.onclick = () => this.removeToast(toast);
            toast.appendChild(closeBtn);
        }
        
        document.body.appendChild(toast);
        this.activeToasts.add(toast);
        
        // アニメーション
        setTimeout(() => toast.classList.add('show'), 100);
        
        // 自動削除
        const autoRemove = setTimeout(() => {
            this.removeToast(toast);
        }, duration);
        
        // クリックで削除
        toast.onclick = () => {
            clearTimeout(autoRemove);
            this.removeToast(toast);
        };
        
        return toast;
    }
    
    static removeToast(toast) {
        if (!toast || !toast.parentNode) return;
        
        toast.classList.remove('show');
        this.activeToasts.delete(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
