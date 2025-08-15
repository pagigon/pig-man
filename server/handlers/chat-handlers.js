// server/handlers/chat-handlers.js - チャットログ100件対応版

function setupChatHandlers(io, socket, activeRooms) {  // activeRoomsを引数で受け取る
    
    // チャット送信
    socket.on('sendChat', (message) => {
    console.log(`📨 sendChat イベント受信:`, {
        socketId: socket.id,
        roomId: socket.roomId,
        playerName: socket.playerName,
        message: message
    });
    
    if (!socket.roomId || !socket.playerName) {
        console.warn('❌ チャット送信失敗: ルーム情報不足', {
            roomId: socket.roomId,
            playerName: socket.playerName
        });
        return;
    }
    
    const room = activeRooms.get(socket.roomId);
    if (!room) {
        console.warn('❌ チャット送信失敗: ルームが見つからない', {
            roomId: socket.roomId,
            activeRoomsKeys: Array.from(activeRooms.keys())
        });
        return;
    }
    
    // メッセージバリデーション
    if (!message || typeof message !== 'string') {
        console.warn('❌ 無効なメッセージ:', typeof message, message);
        socket.emit('error', { message: 'メッセージが無効です' });
        return;
    }
    
    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
        console.warn('❌ 空のメッセージ');
        return;
    }
    
    if (trimmedMessage.length > 100) {
        console.warn('❌ メッセージが長すぎます:', trimmedMessage.length);
        socket.emit('error', { message: 'メッセージが長すぎます（100文字以内）' });
        return;
    }
    
    // チャットメッセージオブジェクト作成
    const chatMessage = {
        type: 'player',
        playerName: socket.playerName,
        text: trimmedMessage,
        timestamp: Date.now()
    };
    
    // システムメッセージの場合
    if (socket.isSpectator) {
        chatMessage.playerName = `👁️ ${socket.playerName}`;
    }
    
    // ルームのメッセージ履歴に追加
    if (!room.gameData.messages) {
        room.gameData.messages = [];
        console.log('📝 メッセージ配列を新規作成');
    }
    
    room.gameData.messages.push(chatMessage);
    console.log(`📝 メッセージ配列に追加: ${room.gameData.messages.length}件`);
    
    // 🔧 【修正】最新100件を保持（20件から100件に拡張）
    if (room.gameData.messages.length > 100) {
        room.gameData.messages = room.gameData.messages.slice(-100);
        console.log('✂️ メッセージ履歴を100件に制限');
    }
    
    // 🔧 【重要】ルーム内の全員にメッセージを送信
    console.log(`📤 newMessage イベント送信開始: roomId=${socket.roomId}`);
    console.log(`📤 送信するメッセージ配列:`, room.gameData.messages);
    
    io.to(socket.roomId).emit('newMessage', room.gameData.messages);
    
    console.log(`✅ newMessage イベント送信完了: [${socket.roomId}] ${socket.playerName}: ${trimmedMessage}`);
});
}

// 🔧 【修正】ゲームログ送信関数（100件対応）
function sendGameLog(io, roomId, logMessage, activeRooms) {
    if (!activeRooms) {
        console.error('❌ activeRoomsが提供されていません');
        return;
    }
    
    const room = activeRooms.get(roomId);
    if (!room) {
        console.warn('❌ ゲームログ送信: ルームが見つかりません');
        return;
    }
    
    const gameLogMessage = {
        type: 'game-log',
        text: logMessage,
        timestamp: Date.now()
    };
    
    if (!room.gameData.messages) {
        room.gameData.messages = [];
    }
    
    room.gameData.messages.push(gameLogMessage);
    
    // 🔧 【修正】最新100件を保持（20件から100件に拡張）
    if (room.gameData.messages.length > 100) {
        room.gameData.messages = room.gameData.messages.slice(-100);
    }
    
    io.to(roomId).emit('newMessage', room.gameData.messages);
    console.log(`🎮 ゲームログ: [${roomId}] ${logMessage}`);
}

module.exports = {
    setupChatHandlers,
    sendGameLog
};
