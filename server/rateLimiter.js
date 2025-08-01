// server/rateLimiter.js
class RateLimiter {
    constructor() {
        this.requests = new Map();
        this.cleanup();
    }

    isAllowed(socketId, action, limit = 10, windowMs = 60000) {
        const now = Date.now();
        const key = `${socketId}:${action}`;
        
        if (!this.requests.has(key)) {
            this.requests.set(key, []);
        }
        
        const requests = this.requests.get(key);
        
        // 古いリクエストを削除
        const validRequests = requests.filter(time => now - time < windowMs);
        this.requests.set(key, validRequests);
        
        if (validRequests.length >= limit) {
            return false;
        }
        
        validRequests.push(now);
        return true;
    }

    cleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, requests] of this.requests.entries()) {
                const validRequests = requests.filter(time => now - time < 300000); // 5分
                if (validRequests.length === 0) {
                    this.requests.delete(key);
                } else {
                    this.requests.set(key, validRequests);
                }
            }
        }, 60000); // 1分毎にクリーンアップ
    }
}

// server/socketHandlers.js で使用
const rateLimiter = new RateLimiter();

function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        // チャット送信のレート制限
        socket.on('sendChat', (message) => {
            if (!rateLimiter.isAllowed(socket.id, 'chat', 5, 10000)) { // 10秒で5回まで
                socket.emit('error', { 
                    message: 'チャット送信が制限されています。少し待ってから再試行してください。',
                    code: 'RATE_LIMITED'
                });
                return;
            }
            
            // チャット処理...
        });

        // ルーム作成のレート制限
        socket.on('createRoom', (data) => {
            if (!rateLimiter.isAllowed(socket.id, 'createRoom', 3, 60000)) { // 1分で3回まで
                socket.emit('error', { 
                    message: 'ルーム作成が制限されています。しばらく待ってから再試行してください。',
                    code: 'RATE_LIMITED'
                });
                return;
            }
            
            // ルーム作成処理...
        });
    });
}

module.exports = { RateLimiter };
