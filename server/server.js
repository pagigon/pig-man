const express = require('express');
const app = express();
const http = require('http').createServer(app);


// server/server.js - Render.com Socket.io設定修正版（既存のSocket.io設定部分を置き換え）

const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["*"],
        credentials: false
    },
    
    // 🔧 【重要】Render.com環境専用設定
    transports: ['polling', 'websocket'],     // polling優先でwebsocketにアップグレード
    allowEIO3: true,
    
    // 🔧 【修正】Render.com安定性向上設定
    pingTimeout: 180000,                      // 3分に延長（Render.comの遅延対応）
    pingInterval: 90000,                      // 1.5分間隔
    connectTimeout: 60000,                    // 接続タイムアウト1分
    
    // 🔧 【重要】Render.com WebSocket対応
    allowUpgrades: true,                      // アップグレード許可
    upgradeTimeout: 30000,                    // アップグレードタイムアウト30秒
    maxHttpBufferSize: 1e5,                   // バッファサイズ制限
    httpCompression: true,                    // 圧縮有効化
    
    // 🔧 【追加】Render.com安定性設定
    serveClient: false,
    cookie: {
        name: 'io',
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'  // 本番環境でのみSSL
    },
    
    // 🔧 【重要】Render.com特有の設定
    allowRequest: (req, callback) => {
        // Render.comの内部通信とCORS設定
        const origin = req.headers.origin;
        const allowedOrigins = [
            'http://localhost:3000',
            'https://*.onrender.com',
            process.env.CLIENT_URL
        ].filter(Boolean);
        
        // 開発環境では全て許可、本番環境では制限
        if (process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            const allowed = !origin || allowedOrigins.some(allowed => 
                origin === allowed || origin.endsWith('.onrender.com')
            );
            callback(null, allowed);
        }
    }
});

// 🔧 【追加】Render.com環境での詳細ログ
io.engine.on('connection_error', (err) => {
    console.log('🔧 Socket.io Engine接続エラー:', {
        code: err.code,
        message: err.message,
        context: err.context,
        req: err.req ? {
            url: err.req.url,
            method: err.req.method,
            headers: {
                'user-agent': err.req.headers['user-agent'],
                'origin': err.req.headers.origin,
                'connection': err.req.headers.connection,
                'upgrade': err.req.headers.upgrade
            }
        } : null
    });
});

// 🔧 【追加】接続監視とヘルスチェック
io.engine.on('initial_headers', (headers, req) => {
    console.log('🔧 Socket.io接続ヘッダー:', {
        url: req.url,
        method: req.method,
        userAgent: req.headers['user-agent']?.substring(0, 50),
        origin: req.headers.origin
    });
});

// 🔧 【追加】定期的な接続状態監視
setInterval(() => {
    const connectedSockets = io.sockets.sockets.size;
    const engineConnections = io.engine.clientsCount;
    
    console.log(`🔧 Socket統計: Socket.IO=${connectedSockets}, Engine=${engineConnections}`);
    
    // 異常検出時の警告
    if (connectedSockets !== engineConnections) {
        console.warn('⚠️ Socket数不整合 - 接続状態をチェック中');
    }
}, 60000); // 1分間隔

// 🔧 【追加】Render.com環境でのGraceful shutdown
process.on('SIGTERM', () => {
    console.log('🔧 SIGTERM受信 - Socket.io正常終了中...');
    io.close(() => {
        console.log('🔧 Socket.io正常終了完了');
        process.exit(0);
    });
});


// 🔧 【追加】定期的な接続状態監視
setInterval(() => {
    const connectedSockets = io.sockets.sockets.size;
    const engineConnections = io.engine.clientsCount;
    
    console.log(`🔧 Socket統計詳細: Socket.IO=${connectedSockets}個, Engine=${engineConnections}個`);
    
    if (connectedSockets !== engineConnections) {
        console.warn('⚠️ Socket数の不整合を検出');
    }
}, 30000); // 30秒間隔


// 定期的なクリーンアップ（Render.com環境での推奨設定）
setInterval(() => {
    const connectedSockets = io.sockets.sockets.size;
    console.log(`📊 Socket統計: ${connectedSockets}個の接続中`);
    
    // 非アクティブな接続のクリーンアップ
    io.sockets.sockets.forEach((socket) => {
        if (!socket.connected) {
            console.log(`🧹 非アクティブSocket切断: ${socket.id}`);
            socket.disconnect(true);
        }
    });
}, 5 * 60 * 1000); // 5分間隔
const path = require('path');
const fs = require('fs');

// エラーハンドリング
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 静的ファイルの配信
const publicPath = path.join(__dirname, '../public');
console.log('Static files path:', publicPath);

if (!fs.existsSync(publicPath)) {
    console.error('Public directory does not exist:', publicPath);
    process.exit(1);
}

app.use(express.static(publicPath));

// ヘルスチェック用のエンドポイント
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// デバッグ用ルート
app.get('/debug', (req, res) => {
    try {
        const publicFiles = fs.readdirSync(publicPath);
        const cssPath = path.join(publicPath, 'css');
        const jsPath = path.join(publicPath, 'js');
        const imagesPath = path.join(publicPath, 'images');
        
        const cssFiles = fs.existsSync(cssPath) ? fs.readdirSync(cssPath) : ['CSS folder not found'];
        const jsFiles = fs.existsSync(jsPath) ? fs.readdirSync(jsPath) : ['JS folder not found'];
        const imageFiles = fs.existsSync(imagesPath) ? fs.readdirSync(imagesPath) : ['Images folder not found'];
        
        res.json({
            publicPath,
            publicFiles,
            cssFiles,
            jsFiles,
            imageFiles,
            workingDirectory: process.cwd(),
            nodeVersion: process.version,
            platform: process.platform,
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// メインページ
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(publicPath, 'index.html');
        if (!fs.existsSync(indexPath)) {
            return res.status(404).send('index.html not found');
        }
        res.sendFile(indexPath);
    } catch (error) {
        console.error('Error serving index.html:', error);
        res.status(500).send('Server error');
    }
});

// Socket.ioハンドラーの設定（統合版を使用）
try {
    // 完全版のsocketHandlersを使用
    const { setupSocketHandlers } = require('./socketHandlers');
    setupSocketHandlers(io);
    console.log('Socket handlers initialized (統合版)');
} catch (error) {
    console.error('Error initializing socket handlers:', error);
    console.log('Socket.ioなしでサーバーを起動します');
}

// 404ハンドラー
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Not Found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

// エラーハンドラー
app.use((error, req, res, next) => {
    console.error('Express error:', error);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;

// サーバー起動
const server = http.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ サーバーがポート ${PORT} で起動しました`);
    console.log(`📁 Public files served from: ${publicPath}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💾 Memory usage:`, process.memoryUsage());
});

// サーバーエラーハンドリング
server.on('error', (error) => {
    console.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

module.exports = { app, server, io };
