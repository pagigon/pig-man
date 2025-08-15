// 接続・切断関連のSocket.ioイベントハンドラー
const { setupRoomHandlers, handlePlayerDisconnect, updateRoomList } = require('./room-handlers');
const { setupGameHandlers } = require('./game-handlers');
const { setupChatHandlers } = require('./chat-handlers');


// server/handlers/connection-handlers.js の setupConnectionHandlers 関数に追加

function setupConnectionHandlers(io) {
    const socketRequestHistory = new Map();
    
    // 🔧 【修正】クライアント接続管理（複数タブ対応）
    const clientConnections = new Map(); // clientId -> Set<socketId> のマッピング（複数socketId対応）
    
    io.on('connection', (socket) => {
        console.log('✅ 新しい接続確認:', socket.id);
        
        // 🔧 【修正】複数タブ対応の重複接続チェック
        const clientId = socket.handshake.query.clientId;
        const tabId = socket.handshake.query.tabId;
        const preventDuplicate = socket.handshake.query.preventDuplicate;
        const allowMultipleTabs = socket.handshake.query.allowMultipleTabs;
        
        console.log('🔍 接続情報確認:', { 
            clientId, 
            tabId, 
            socketId: socket.id, 
            preventDuplicate, 
            allowMultipleTabs 
        });
        
        if (clientId) {
            // 🔧 【修正】複数タブが許可されている場合は重複チェックをスキップ
            if (allowMultipleTabs === 'true') {
                console.log('✅ 複数タブモード: 重複チェックをスキップ');
                
                // 複数接続を許可（Setで管理）
                if (!clientConnections.has(clientId)) {
                    clientConnections.set(clientId, new Set());
                }
                clientConnections.get(clientId).add(socket.id);
                
            } else if (preventDuplicate === 'true') {
                // 従来の重複防止モード
                console.log('🔍 重複接続チェック（従来モード）:', { clientId, socketId: socket.id });
                
                const existingSocketIds = clientConnections.get(clientId);
                if (existingSocketIds && existingSocketIds.size > 0) {
                    // 古い接続を全て切断
                    for (const existingSocketId of existingSocketIds) {
                        const existingSocket = io.sockets.sockets.get(existingSocketId);
                        if (existingSocket && existingSocket.connected) {
                            console.warn(`⚠️ 重複接続検出: 古い接続 ${existingSocketId} を切断`);
                            existingSocket.emit('error', { message: '新しい接続により切断されました' });
                            existingSocket.disconnect(true);
                        }
                    }
                }
                
                // 新しい接続を記録（Setで管理）
                clientConnections.set(clientId, new Set([socket.id]));
            }
            
            socket.clientId = clientId;
            socket.tabId = tabId;
        }
        
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
        setupGameHandlers(io, socket, socketRequestHistory);
        setupChatHandlers(io, socket, socketRequestHistory);
        setupLobbyHandlers(io, socket);
        
        // クライアントエラー受信
        socket.on('clientError', (errorInfo) => {
            console.error('クライアントエラー受信:', {
                socketId: socket.id,
                clientId: socket.clientId,
                tabId: socket.tabId,
                error: errorInfo,
                timestamp: new Date().toISOString()
            });
        });
        
        // 🔧 【修正】切断時の処理（複数タブ対応）
        socket.on('disconnect', (reason) => {
            console.log('🔌 切断:', socket.id, 'reason:', reason);
            
            // 🔧 【修正】クライアント接続記録更新（複数タブ対応）
            if (socket.clientId) {
                const socketIds = clientConnections.get(socket.clientId);
                if (socketIds) {
                    socketIds.delete(socket.id);
                    
                    // 最後の接続が切断された場合のみ削除
                    if (socketIds.size === 0) {
                        clientConnections.delete(socket.clientId);
                        console.log('🗑️ 最後の接続が切断 - クライアント記録削除:', socket.clientId);
                    } else {
                        console.log('🔌 タブ切断 - 他のタブは接続中:', { 
                            clientId: socket.clientId, 
                            remainingConnections: socketIds.size 
                        });
                    }
                }
            }
            
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
    
    // 🔧 【修正】定期的なクライアント接続クリーンアップ（複数タブ対応）
    setInterval(() => {
        const currentTime = Date.now();
        let cleanedCount = 0;
        
        for (const [clientId, socketIds] of clientConnections) {
            const connectedSocketIds = new Set();
            
            // 接続中のsocketIdのみ残す
            for (const socketId of socketIds) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket && socket.connected) {
                    connectedSocketIds.add(socketId);
                }
            }
            
            // 更新または削除
            if (connectedSocketIds.size > 0) {
                clientConnections.set(clientId, connectedSocketIds);
            } else {
                clientConnections.delete(clientId);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 クライアント接続記録クリーンアップ: ${cleanedCount}件削除`);
        }
    }, 300000); // 5分ごと
    
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
