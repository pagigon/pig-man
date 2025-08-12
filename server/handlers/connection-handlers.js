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
        // 各種ハンドラーを設定
        setupRoomHandlers(io, socket, socketRequestHistory);
        setupGameHandlers(io, socket, socketRequestHistory);
        setupChatHandlers(io, socket, socketRequestHistory);
        
        // 🔧 【追加】ロビー復帰・連戦機能のハンドラー
        setupLobbyHandlers(io, socket);
        
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

// 🔧 【追加】ロビー復帰・連戦機能のハンドラー
function setupLobbyHandlers(io, socket) {
    const { getActiveRooms } = require('./room-handlers');
    const { sendGameLog } = require('./chat-handlers');
    
    // ロビーに戻る
    socket.on('returnToLobby', () => {
        console.log('🏠 ロビー復帰要求:', socket.id);
        
        if (!socket.roomId) {
            socket.emit('error', { message: 'ルームに参加していません' });
            return;
        }
        
        const activeRooms = getActiveRooms();
        const room = activeRooms.get(socket.roomId);
        if (!room) {
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }
        
        try {
            // ゲーム状態をwaitingに戻す
            room.gameData.gameState = 'waiting';
            
            // ゲーム関連データをリセット
            resetGameData(room.gameData);
            
            // 全プレイヤーに更新を送信
            io.to(socket.roomId).emit('gameUpdate', room.gameData);
            
            console.log(`✅ ルーム ${socket.roomId} がロビーに復帰`);
            
        } catch (error) {
            console.error('ロビー復帰エラー:', error);
            socket.emit('error', { message: 'ロビー復帰に失敗しました' });
        }
    });
    
    // 連戦開始（ホスト専用）
    socket.on('restartGame', () => {
        console.log('🔄 連戦開始要求:', socket.id);
        
        if (!socket.roomId) {
            socket.emit('error', { message: 'ルームに参加していません' });
            return;
        }
        
        const activeRooms = getActiveRooms();
        const room = activeRooms.get(socket.roomId);
        if (!room) {
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }
        
        if (room.gameData.host !== socket.id) {
            socket.emit('error', { message: '連戦開始権限がありません' });
            return;
        }
        
        const connectedCount = room.gameData.players.filter(p => p.connected).length;
        if (connectedCount < 3) {
            socket.emit('error', { message: '連戦開始には最低3人必要です' });
            return;
        }
        
        try {
            console.log('🎮 連戦開始:', connectedCount, '人');
            
            // ゲーム初期化を実行
            const { initializeGameData } = require('../game/game-Logic');
            resetGameData(room.gameData);
            const gameInitData = initializeGameData(connectedCount);
            Object.assign(room.gameData, gameInitData);
            
            // 連戦開始のゲームログ
            sendGameLog(io, socket.roomId, `🔄 連戦開始！新しいゲームが始まります！`, activeRooms);
            
            // 全員に更新を送信
            io.to(socket.roomId).emit('gameUpdate', room.gameData);
            io.to(socket.roomId).emit('roundStart', 1);
            
            console.log(`✅ ルーム ${socket.roomId} で連戦開始完了`);
            
        } catch (error) {
            console.error('❌ 連戦開始エラー:', error);
            socket.emit('error', { message: '連戦開始に失敗しました: ' + error.message });
        }
    });
}

// 🔧 【追加】ゲームデータリセット関数
function resetGameData(gameData) {
    // ゲーム進行状態をリセット
    gameData.gameState = 'waiting';
    gameData.currentRound = 1;
    gameData.treasureFound = 0;
    gameData.trapTriggered = 0;
    gameData.keyHolderId = null;
    gameData.cardsPerPlayer = 5;
    gameData.cardsFlippedThisRound = 0;
    gameData.turnInRound = 0;
    gameData.allCards = [];
    gameData.playerHands = {};
    gameData.remainingCards = [];
    
    // 最後にターゲットされたプレイヤーIDもリセット
    gameData.lastTargetedPlayerId = null;
    
    // 勝利関連データをクリア
    delete gameData.winningTeam;
    delete gameData.victoryMessage;
    
    // プレイヤーの手札と役職をリセット
    if (gameData.players) {
        gameData.players.forEach(player => {
            player.role = null;
            player.hand = [];
        });
    }
    
    console.log('🔄 ゲームデータリセット完了');
}

module.exports = {
    setupConnectionHandlers
};
