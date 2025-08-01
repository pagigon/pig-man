const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const path = require('path');

// エラーハンドリングを追加
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 静的ファイルの配信
const publicPath = path.join(__dirname, '../public');
console.log('Static files path:', publicPath);

// 静的ファイルの存在確認
const fs = require('fs');
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

// Socket.ioハンドラーの設定
try {
    const { setupSocketHandlers } = require('./socketHandlers');
    setupSocketHandlers(io);
    console.log('Socket handlers initialized');
} catch (error) {
    console.error('Error initializing socket handlers:', error);
    // Socket.ioなしでも起動できるようにする
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
