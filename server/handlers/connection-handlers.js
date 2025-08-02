// 接続・切断関連のSocket.ioイベントハンドラー
const { setupRoomHandlers, handlePlayerDisconnect, updateRoomList } = require('./room-handlers');
const { setupGameHandlers } = require('./game-handlers');
const { setupChatHandlers } = require('./chat-handlers');

function setupConnectionHandlers(io) {
    const socketRequestHistory = new Map();
    
    io.on('connection', (socket) => {
        console.log('✅ 新しい接続確認:', socket.id);
        
        // Socket毎の要求履歴を初期化
        socketRequestHistory.set(socket.id, {
            lastJoinRequest: 0,
            lastCreateRequest: 0,
            lastChatRequest: 0,
            requestCooldown: 3000 // 3秒
        });
        
        // 接続直後にルーム一覧を送信
        setTimeout(() => {
            updateRoomList(io);
        }, 1000);
        
        // 各種ハンドラーを設定
        setupRoomHandlers(io, socket, socketRequestHistory);
        setupGameHandlers(io, socket);
        setupChatHandlers(io, socket);
        
        // クライアントエラー受信
        socket.on('clientError', (errorInfo) => {
            console.error('クライアントエラー受信:', {
                socketId: socket.id,
                error: errorInfo,
                timestamp: new Date().toISOString()
            });
            // エラー情報をログに記録（本番では外部ログシステムに送信）
        });
        
        // 切断時の処理
        socket.on('disconnect', (reason) => {
            console.log('🔌 切断:', socket.id, 'reason:', reason);
            
            // 履歴削除
            socketRequestHistory.delete(socket.id);
            
            // 観戦者の場合は単純に切断
            if (socket.isSpectator) {
                console.log('観戦者が切断しました');
                return;
            }
            
            // プレイヤーの切断処理
            handlePlayerDisconnect(socket, io);
        });
        
        console.log('🎯 Socket接続処理完了:', socket.id);
    });
    
    return socketRequestHistory;
}

module.exports = {
    setupConnectionHandlers
};
