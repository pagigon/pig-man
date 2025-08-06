const express = require('express');
const app = express();
const http = require('http').createServer(app);
// server/server.js のSocket.io設定を以下に置き換え

// server/server.js - Render.com Socket.io設定修正版（既存のSocket.io設定部分を置き換え）

const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["*"],
        credentials: false
    },
    // 🔧 【修正】Render.com環境に最適化されたSocket.io設定
    transports: ['polling'],              // pollingのみ許可（WebSocket無効）
    allowEIO3: true,
    
    // 🔧 【重要】Render.comでの400エラー対策
    pingTimeout: 120000,                  // pingタイムアウトを2分に延長
    pingInterval: 60000,                  // pingを1分間隔で送信
    connectTimeout: 45000,                // 接続タイムアウトを45秒に延長
    
    // 🔧 【追加】Render.com特有の設定
    allowUpgrades: false,                 // transport upgradeを完全無効化
    maxHttpBufferSize: 1e5,              // HTTPバッファサイズを100KBに制限（より小さく）
    httpCompression: false,               // HTTP圧縮を無効化
    
    // 🔧 【修正】接続管理の最適化
    serveClient: false,                   // クライアント配信を無効化
    cookie: {
        name: 'io',
        httpOnly: false,
        sameSite: 'lax',
        secure: false                     // HTTPSでない場合はfalse
    },
    
    // 🔧 【追加】エラー処理の改善
    destroyUpgrade: false,
    destroyUpgradeTimeout: 1000,
    
    // 🔧 【重要】Render.com用の追加設定
    allowRequest: (req, callback) => {
        // すべてのリクエストを許可（Render.comの内部通信用）
        callback(null, true);
    },
    
    // 🔧 【追加】パス設定の明示
    path: '/socket.io/',
    
    // 🔧 【追加】Render.com環境での安定性向上
    forceNew: false,
    rememberUpgrade: false,
    timeout: 45000,
    autoConnect: true
});

// 🔧 サーバー側の接続監視とクリーンアップ
io.engine.on('connection_error', (err) => {
    console.log('Socket.io Engine 接続エラー:', {
        req: err.req?.url || 'unknown',      // リクエストURL
        code: err.code,                      // エラーコード
        message: err.message,                // エラーメッセージ
        context: err.context,                // エラーコンテキスト
        type: err.type                       // エラータイプ
    });
});

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
