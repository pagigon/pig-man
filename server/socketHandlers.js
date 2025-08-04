// 恐怖の古代寺院ルール完全対応版 socketHandlers.js - 既存コードベース対応
const { 
    generateRoomId, 
    assignRoles, 
    generateAllCards, 
    distributeCards, 
    calculateVictoryGoal,
    initializeGameData,
    checkGameEndConditions,
    getCardsPerPlayerForRound,
    advanceToNextRound,
    redistributeCardsForNewRound
} = require('./game/game-Logic');

const activeRooms = new Map();
const socketRequestHistory = new Map();

// 🆕 カードリサイクル関数（直接定義）
function recycleCardsAfterRound(gameData, connectedPlayers) {
    console.log('♻️ ===== カードリサイクル処理開始 =====');
    console.log(`ラウンド ${gameData.currentRound} 終了後のカード処理`);
    
    try {
        // 1. 各プレイヤーから公開されたカードを除去
        let totalRemovedCards = 0;
        connectedPlayers.forEach((player, index) => {
            const originalHandSize = player.hand.length;
            
            // 公開されていないカードのみ残す
            player.hand = player.hand.filter(card => !card.revealed);
            
            const removedCount = originalHandSize - player.hand.length;
            totalRemovedCards += removedCount;
            
            console.log(`${player.name}: ${removedCount}枚除去, 残り${player.hand.length}枚`);
        });
        
        // その他のイベントハンドラー
        setupOtherHandlers(socket, io);
        
        // 切断時の処理
        socket.on('disconnect', (reason) => {
            console.log('🔌 切断:', socket.id, 'reason:', reason);
            socketRequestHistory.delete(socket.id);
            
            if (socket.isSpectator) {
                console.log('観戦者が切断しました');
                return;
            }
            
            handlePlayerDisconnect(socket, io);
        });
        
        console.log('🎯 イベントハンドラー登録完了:', socket.id);
    });
    
    console.log('🏁 Socket.io ハンドラー設定完了（カードリサイクル対応）');
}

// その他のハンドラー設定
function setupOtherHandlers(socket, io) {
    // チャット送信
    socket.on('sendChat', (message) => {
        if (!socket.roomId || !socket.playerName) return;
        
        const roomData = activeRooms.get(socket.roomId);
        if (!roomData) return;
        
        const chatMessage = {
            type: 'player',
            playerName: socket.playerName,
            text: message,
            timestamp: Date.now()
        };
        
        roomData.gameData.messages.push(chatMessage);
        
        if (roomData.gameData.messages.length > 20) {
            roomData.gameData.messages = roomData.gameData.messages.slice(-20);
        }
        
        io.to(socket.roomId).emit('newMessage', roomData.gameData.messages);
    });
    
    // 再入場
    socket.on('rejoinRoom', (data) => {
        console.log('🔄 再入場要求:', data);
        const { roomId, playerName } = data;
        
        const roomData = activeRooms.get(roomId);
        if (!roomData) {
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }
        
        const existingPlayer = findPlayerByName(roomData, playerName);
        if (!existingPlayer) {
            socket.emit('error', { message: 'このルームにあなたのデータが見つかりません' });
            return;
        }
        
        if (existingPlayer.connected) {
            socket.emit('error', { message: 'このプレイヤーは既に接続中です' });
            return;
        }
        
        existingPlayer.id = socket.id;
        existingPlayer.connected = true;
        existingPlayer.lastConnected = Date.now();
        
        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerName = playerName;
        
        socket.emit('rejoinSuccess', {
            roomId: roomId,
            gameData: roomData.gameData,
            isHost: roomData.gameData.host === socket.id
        });
        
        io.to(roomId).emit('gameUpdate', roomData.gameData);
        
        console.log(`✅ ${playerName} がルーム ${roomId} に再入場完了`);
    });
    
    // 観戦
    socket.on('spectateRoom', (data) => {
        console.log('👁️ 観戦要求:', data);
        const { roomId, spectatorName } = data;
        
        const roomData = activeRooms.get(roomId);
        if (!roomData) {
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }
        
        if (roomData.gameData.gameState !== 'playing') {
            socket.emit('error', { message: 'このルームはゲーム中ではありません' });
            return;
        }
        
        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerName = spectatorName;
        socket.isSpectator = true;
        
        socket.emit('spectateSuccess', {
            roomId: roomId,
            gameData: roomData.gameData
        });
        
        console.log(`✅ ${spectatorName} がルーム ${roomId} を観戦開始`);
    });
    
    // 一時退出
    socket.on('tempLeaveRoom', () => {
        console.log('🚶 一時退出:', socket.id);
        handlePlayerTempLeave(socket, io);
    });
    
    // ルーム退出
    socket.on('leaveRoom', () => {
        console.log('🚪 ルーム退出:', socket.id);
        handlePlayerLeave(socket, io);
    });
    
    // ルーム再接続
    socket.on('reconnectToRoom', (data) => {
        console.log('🔄 ルーム再接続要求:', data);
        const { roomId, playerName } = data;
        
        const roomData = activeRooms.get(roomId);
        if (!roomData) {
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }
        
        const player = findPlayerByName(roomData, playerName);
        if (!player) {
            socket.emit('error', { message: 'プレイヤーデータが見つかりません' });
            return;
        }
        
        if (!player.connected) {
            player.id = socket.id;
            player.connected = true;
            player.lastConnected = Date.now();
            
            socket.join(roomId);
            socket.roomId = roomId;
            socket.playerName = playerName;
            
            socket.emit('reconnectSuccess', {
                roomId: roomId,
                gameData: roomData.gameData,
                isHost: roomData.gameData.host === socket.id
            });
            
            io.to(roomId).emit('gameUpdate', roomData.gameData);
            
            console.log(`✅ ${playerName} がルーム ${roomId} に再接続完了`);
        }
    });
}

// ユーティリティ関数群
function createPlayer(socketId, playerName) {
    return {
        id: socketId,
        name: playerName,
        connected: true,
        role: null,
        hand: [],
        joinedAt: Date.now(),
        lastConnected: Date.now()
    };
}

function isPlayerInAnyRoom(socketId) {
    for (const roomData of activeRooms.values()) {
        if (isPlayerInRoom(roomData, socketId)) {
            return true;
        }
    }
    return false;
}

function isPlayerInRoom(roomData, socketId) {
    return roomData.gameData.players.some(p => p.id === socketId);
}

function isPlayerNameActiveInRoom(roomData, playerName) {
    return roomData.gameData.players.some(p => p.name === playerName && p.connected);
}

function findPlayerByName(roomData, playerName) {
    return roomData.gameData.players.find(p => p.name === playerName);
}

function findDisconnectedPlayerByName(roomData, playerName) {
    return roomData.gameData.players.find(p => p.name === playerName && !p.connected);
}

function getConnectedPlayerCount(roomData) {
    return roomData.gameData.players.filter(p => p.connected).length;
}

function sendRoomList(socket) {
    try {
        const roomList = Array.from(activeRooms.values())
            .filter(roomData => roomData.gameData.gameState === 'waiting')
            .map(roomData => ({
                id: roomData.id,
                hostName: roomData.hostName,
                playerCount: getConnectedPlayerCount(roomData),
                hasPassword: !!roomData.gameData.password
            }));
        
        console.log(`📋 ルーム一覧送信: ${roomList.length}個のルーム`);
        socket.emit('roomList', roomList);
    } catch (error) {
        console.error('ルーム一覧送信エラー:', error);
        socket.emit('roomList', []);
    }
}

function sendOngoingGames(socket) {
    try {
        const ongoingGames = Array.from(activeRooms.values())
            .filter(roomData => roomData.gameData.gameState === 'playing')
            .map(roomData => ({
                id: roomData.id,
                currentRound: roomData.gameData.currentRound,
                maxRounds: roomData.gameData.maxRounds,
                cardsPerPlayer: roomData.gameData.cardsPerPlayer,
                playerCount: getConnectedPlayerCount(roomData),
                treasureFound: roomData.gameData.treasureFound,
                treasureGoal: roomData.gameData.treasureGoal,
                trapTriggered: roomData.gameData.trapTriggered,
                trapGoal: roomData.gameData.trapGoal
            }));
        
        console.log(`📋 進行中ゲーム送信: ${ongoingGames.length}個のゲーム`);
        socket.emit('ongoingGames', ongoingGames);
    } catch (error) {
        console.error('進行中ゲーム送信エラー:', error);
        socket.emit('ongoingGames', []);
    }
}

function broadcastRoomList(io) {
    try {
        const roomList = Array.from(activeRooms.values())
            .filter(roomData => roomData.gameData.gameState === 'waiting')
            .map(roomData => ({
                id: roomData.id,
                hostName: roomData.hostName,
                playerCount: getConnectedPlayerCount(roomData),
                hasPassword: !!roomData.gameData.password
            }));
        
        io.emit('roomList', roomList);
        console.log(`📋 全体ルーム一覧更新: ${roomList.length}個のルーム`);
    } catch (error) {
        console.error('全体ルーム一覧更新エラー:', error);
    }
}

// プレイヤー処理関数
function handlePlayerTempLeave(socket, io) {
    if (!socket.roomId) return;
    
    const roomData = activeRooms.get(socket.roomId);
    if (!roomData) return;
    
    const player = roomData.gameData.players.find(p => p.id === socket.id);
    if (player) {
        player.connected = false;
        player.lastDisconnected = Date.now();
        console.log(`${player.name} が一時退出しました`);
    }
    
    io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
    broadcastRoomList(io);
}

function handlePlayerLeave(socket, io) {
    if (!socket.roomId) return;
    
    const roomData = activeRooms.get(socket.roomId);
    if (!roomData) return;
    
    roomData.gameData.players = roomData.gameData.players.filter(p => p.id !== socket.id);
    
    console.log(`プレイヤー ${socket.playerName} (${socket.id}) をルーム ${socket.roomId} から完全削除`);
    
    if (roomData.gameData.host === socket.id) {
        const nextHost = roomData.gameData.players.find(p => p.connected);
        if (nextHost) {
            roomData.gameData.host = nextHost.id;
            console.log(`新しいホスト: ${nextHost.name}`);
        }
    }
    
    if (roomData.gameData.players.length === 0) {
        activeRooms.delete(socket.roomId);
        console.log('空のルームを削除:', socket.roomId);
    } else {
        io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
    }
    
    broadcastRoomList(io);
}

function handlePlayerDisconnect(socket, io) {
    if (!socket.roomId) return;
    
    const roomData = activeRooms.get(socket.roomId);
    if (!roomData) return;
    
    const player = roomData.gameData.players.find(p => p.id === socket.id);
    if (player) {
        player.connected = false;
        player.lastDisconnected = Date.now();
        console.log(`${player.name} が切断しました`);
    }
    
    if (roomData.gameData.players.every(p => !p.connected)) {
        activeRooms.delete(socket.roomId);
        console.log('全員切断のためルームを削除:', socket.roomId);
    } else {
        io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
    }
    
    broadcastRoomList(io);
}

// エクスポート
module.exports = { 
    setupSocketHandlers
};
        
        console.log(`合計除去カード数: ${totalRemovedCards}枚`);
        
        // 2. 次ラウンドの手札枚数を計算
        const nextRoundCardsPerPlayer = getCardsPerPlayerForRound(gameData.currentRound);
        console.log(`次ラウンドの手札枚数: ${nextRoundCardsPerPlayer}枚`);
        
        // 3. 不足分を空き部屋カードで補充
        connectedPlayers.forEach((player, index) => {
            const currentHandSize = player.hand.length;
            const neededCards = nextRoundCardsPerPlayer - currentHandSize;
            
            if (neededCards > 0) {
                // 空き部屋カードを生成して追加
                for (let i = 0; i < neededCards; i++) {
                    player.hand.push({
                        type: 'empty',
                        id: `${player.id}-r${gameData.currentRound}-empty-${i}-${Date.now()}`,
                        revealed: false
                    });
                }
                
                console.log(`${player.name}: ${neededCards}枚の空き部屋カードを補充`);
            }
            
            // 4. 各プレイヤーの手札をシャッフル
            player.hand = shuffleArray(player.hand);
            
            console.log(`${player.name}: 最終手札${player.hand.length}枚（シャッフル済み）`);
        });
        
        // 5. ゲームデータの更新
        gameData.cardsPerPlayer = nextRoundCardsPerPlayer;
        
        console.log('✅ カードリサイクル処理完了');
        return {
            success: true,
            removedCards: totalRemovedCards,
            newCardsPerPlayer: nextRoundCardsPerPlayer
        };
        
    } catch (error) {
        console.error('❌ カードリサイクル処理エラー:', error);
        
        // エラー時のフォールバック処理
        const nextRoundCardsPerPlayer = getCardsPerPlayerForRound(gameData.currentRound);
        connectedPlayers.forEach((player) => {
            // 全て空き部屋カードで置き換え
            player.hand = [];
            for (let i = 0; i < nextRoundCardsPerPlayer; i++) {
                player.hand.push({
                    type: 'empty',
                    id: `${player.id}-fallback-${i}`,
                    revealed: false
                });
            }
        });
        
        gameData.cardsPerPlayer = nextRoundCardsPerPlayer;
        
        return {
            success: false,
            error: error.message,
            newCardsPerPlayer: nextRoundCardsPerPlayer
        };
    }
}

// シャッフル関数（内部用）
function shuffleArray(array) {
    if (!Array.isArray(array)) {
        return [];
    }
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function setupSocketHandlers(io) {
    console.log('🚀 Socket.io ハンドラー設定開始（カードリサイクル対応版）');
    
    io.on('connection', (socket) => {
        console.log('✅ 新しい接続確認:', socket.id);
        
        // Socket毎の要求履歴を初期化
        socketRequestHistory.set(socket.id, {
            lastJoinRequest: 0,
            lastCreateRequest: 0,
            requestCooldown: 3000 // 3秒
        });
        
        // 接続直後にルーム一覧を送信
        setTimeout(() => {
            sendRoomList(socket);
        }, 1000);
        
        // ルーム一覧要求
        socket.on('getRoomList', () => {
            console.log('📋 ルーム一覧要求受信:', socket.id);
            sendRoomList(socket);
        });
        
        // 進行中ゲーム一覧要求
        socket.on('getOngoingGames', () => {
            console.log('📋 進行中ゲーム一覧要求受信:', socket.id);
            sendOngoingGames(socket);
        });
        
        // ルーム作成
        socket.on('createRoom', (data) => {
            const now = Date.now();
            const history = socketRequestHistory.get(socket.id);
            
            // クールダウンチェック
            if (history && (now - history.lastCreateRequest) < history.requestCooldown) {
                console.warn(`⚠️ Socket ${socket.id} 作成クールダウン中`);
                socket.emit('error', { 
                    message: 'しばらく待ってから再試行してください' 
                });
                return;
            }
            
            // 履歴更新
            if (history) {
                history.lastCreateRequest = now;
            }
            
            console.log('🏠 ===== ルーム作成要求受信 =====');
            console.log('Socket ID:', socket.id);
            console.log('データ:', JSON.stringify(data, null, 2));
            
            // 既に他のルームにいないかチェック
            if (isPlayerInAnyRoom(socket.id)) {
                socket.emit('error', { 
                    message: '既に他のルームに参加しています' 
                });
                return;
            }
            
            try {
                const roomId = generateRoomId();
                console.log('生成ルームID:', roomId);
                
                // プレイヤーデータ作成
                const hostPlayer = createPlayer(socket.id, data.playerName || 'プレイヤー');
                
                const gameData = {
                    id: roomId,
                    players: [hostPlayer],
                    gameState: 'waiting',
                    host: socket.id,
                    password: data.hasPassword ? data.password : null,
                    messages: [],
                    currentRound: 1,
                    treasureFound: 0,
                    trapTriggered: 0,
                    treasureGoal: 7,
                    trapGoal: 2,
                    totalTreasures: 7,
                    totalTraps: 2,
                    keyHolderId: null,
                    cardsPerPlayer: 5,
                    cardsFlippedThisRound: 0,
                    maxRounds: 4,
                    turnInRound: 0,
                    allCards: [],
                    playerHands: {},
                    remainingCards: []
                };
                
                // ルームを保存
                const roomData = {
                    id: roomId,
                    hostName: data.playerName || 'プレイヤー',
                    gameData: gameData,
                    createdAt: Date.now()
                };
                
                activeRooms.set(roomId, roomData);
                
                // ソケットルーム参加
                socket.join(roomId);
                socket.roomId = roomId;
                socket.playerName = data.playerName;
                console.log('ソケットルーム参加完了:', roomId);
                
                // 応答データ作成
                const responseData = {
                    roomId: roomId,
                    gameData: gameData,
                    playerInfo: {
                        roomId: roomId,
                        playerName: data.playerName || 'プレイヤー',
                        isHost: true
                    }
                };
                
                // クライアントに応答送信
                socket.emit('roomCreated', responseData);
                console.log('✅ roomCreated イベント送信完了');
                
                // 全クライアントにルーム一覧更新を送信
                broadcastRoomList(io);
                
                console.log('🎉 ===== ルーム作成処理完了 =====');
                
            } catch (error) {
                console.error('❌ ===== ルーム作成エラー =====');
                console.error('エラー詳細:', error);
                socket.emit('error', { 
                    message: 'ルーム作成に失敗しました: ' + error.message 
                });
            }
        });
        
        // ルーム参加処理
        socket.on('joinRoom', (data) => {
            const now = Date.now();
            const history = socketRequestHistory.get(socket.id);
            
            if (history && (now - history.lastJoinRequest) < history.requestCooldown) {
                console.warn(`⚠️ Socket ${socket.id} クールダウン中`);
                socket.emit('error', { 
                    message: 'しばらく待ってから再試行してください' 
                });
                return;
            }
            
            if (history) {
                history.lastJoinRequest = now;
            }
            
            console.log('👥 ===== ルーム参加要求受信 =====');
            console.log('Socket ID:', socket.id);
            console.log('データ:', data);
            
            const { roomId, playerName, password } = data;
            
            const roomData = activeRooms.get(roomId);
            if (!roomData) {
                socket.emit('error', { message: 'ルームが見つかりません' });
                return;
            }
            
            if (roomData.gameData.password && roomData.gameData.password !== password) {
                socket.emit('error', { message: 'パスワードが正しくありません' });
                return;
            }
            
            if (roomData.gameData.gameState !== 'waiting') {
                socket.emit('error', { message: 'このルームはゲーム中です。観戦モードで参加してください。' });
                return;
            }
            
            if (isPlayerInRoom(roomData, socket.id)) {
                console.warn(`⚠️ Socket ${socket.id} は既にルームに参加済み`);
                socket.emit('error', { message: '既にこのルームに参加しています' });
                return;
            }
            
            if (isPlayerNameActiveInRoom(roomData, playerName)) {
                console.warn(`⚠️ プレイヤー名 "${playerName}" は既に使用中`);
                socket.emit('error', { 
                    message: `プレイヤー名 "${playerName}" は既に使用されています` 
                });
                return;
            }
            
            const connectedCount = getConnectedPlayerCount(roomData);
            if (connectedCount >= 10) {
                socket.emit('error', { message: 'ルームが満員です' });
                return;
            }
            
            let player = findDisconnectedPlayerByName(roomData, playerName);
            
            if (player) {
                console.log(`${playerName} が再接続します`);
                player.id = socket.id;
                player.connected = true;
                player.lastConnected = Date.now();
            } else {
                console.log(`${playerName} が新規参加します`);
                player = createPlayer(socket.id, playerName);
                roomData.gameData.players.push(player);
            }
            
            socket.join(roomId);
            socket.roomId = roomId;
            socket.playerName = playerName;
            
            socket.emit('joinSuccess', {
                roomId: roomId,
                gameData: roomData.gameData,
                playerInfo: {
                    roomId: roomId,
                    playerName: playerName,
                    isHost: roomData.gameData.host === socket.id
                }
            });
            
            io.to(roomId).emit('gameUpdate', roomData.gameData);
            broadcastRoomList(io);
            
            console.log(`✅ ${playerName} がルーム ${roomId} に参加完了`);
        });
        
        // ゲーム開始
        socket.on('startGame', () => {
            console.log('🎮 ===== ゲーム開始要求 =====');
            console.log('Socket ID:', socket.id);
            
            if (!socket.roomId) {
                socket.emit('error', { message: 'ルームに参加していません' });
                return;
            }
            
            const roomData = activeRooms.get(socket.roomId);
            if (!roomData) {
                socket.emit('error', { message: 'ルームが見つかりません' });
                return;
            }
            
            if (roomData.gameData.host !== socket.id) {
                socket.emit('error', { message: 'ゲーム開始権限がありません' });
                return;
            }
            
            const connectedCount = getConnectedPlayerCount(roomData);
            if (connectedCount < 3) {
                socket.emit('error', { message: 'ゲーム開始には最低3人必要です' });
                return;
            }
            
            if (connectedCount > 10) {
                socket.emit('error', { message: 'プレイヤー数が多すぎます（最大10人）' });
                return;
            }
            
            try {
                console.log('🎭 ゲーム開始:', connectedCount, '人');
                
                // ゲーム初期化
                const gameInitData = initializeGameData(connectedCount);
                console.log('ゲーム初期化データ:', gameInitData);
                
                // ゲームデータに反映
                Object.assign(roomData.gameData, gameInitData);
                
                // 役職割り当て
                const connectedPlayers = roomData.gameData.players.filter(p => p.connected);
                console.log('接続中プレイヤー:', connectedPlayers.map(p => p.name));
                
                connectedPlayers.forEach((player, index) => {
                    player.role = gameInitData.assignedRoles[index];
                    console.log(`${player.name} → ${player.role}`);
                });
                
                // 1ラウンド目のカード配布（5枚ずつ）
                const round1CardsPerPlayer = getCardsPerPlayerForRound(1);
                console.log(`1ラウンド目: ${round1CardsPerPlayer}枚ずつ配布`);
                
                const { playerHands } = distributeCards(
                    gameInitData.allCards, 
                    connectedCount, 
                    round1CardsPerPlayer
                );
                
                // 各プレイヤーにカードを配布
                connectedPlayers.forEach((player, index) => {
                    player.hand = playerHands[index] || [];
                    console.log(`${player.name} に ${player.hand.length} 枚配布`);
                });
                
                // 最初のプレイヤーに鍵を渡す
                if (connectedPlayers.length > 0) {
                    roomData.gameData.keyHolderId = connectedPlayers[0].id;
                    console.log(`🗝️ 初期鍵保持者: ${connectedPlayers[0].name}`);
                }
                
                // ゲーム状態更新
                roomData.gameData.gameState = 'playing';
                roomData.gameData.cardsPerPlayer = round1CardsPerPlayer;
                
                console.log('📊 ゲーム開始時の状態:', {
                    playerCount: connectedCount,
                    treasureGoal: roomData.gameData.treasureGoal,
                    trapGoal: roomData.gameData.trapGoal,
                    cardsPerPlayer: roomData.gameData.cardsPerPlayer,
                    currentRound: roomData.gameData.currentRound,
                    maxRounds: roomData.gameData.maxRounds,
                    keyHolder: connectedPlayers[0]?.name
                });
                
                // 全プレイヤーにゲーム開始を通知
                io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
                io.to(socket.roomId).emit('roundStart', 1);
                
                // ルーム一覧から削除（進行中ゲームは非表示）
                broadcastRoomList(io);
                
                console.log(`✅ ルーム ${socket.roomId} でゲーム開始完了`);
                
            } catch (error) {
                console.error('❌ ゲーム開始エラー:', error);
                socket.emit('error', { message: 'ゲーム開始に失敗しました: ' + error.message });
            }
        });
        
        // 🔧 カード選択 - カードリサイクル対応版
        socket.on('selectCard', (data) => {
            console.log('🃏 ===== カード選択要求受信 =====');
            console.log('選択者:', socket.playerName, '(', socket.id, ')');
            console.log('データ:', data);
            
            if (!socket.roomId) {
                socket.emit('error', { message: 'ルームに参加していません' });
                return;
            }
            
            const roomData = activeRooms.get(socket.roomId);
            if (!roomData || roomData.gameData.gameState !== 'playing') {
                socket.emit('error', { message: 'ゲームが進行していません' });
                return;
            }
            
            // 観戦者チェック
            if (socket.isSpectator) {
                socket.emit('error', { message: '観戦者はカードを選択できません' });
                return;
            }
            
            // ターンチェック
            if (roomData.gameData.keyHolderId !== socket.id) {
                socket.emit('error', { message: 'あなたのターンではありません' });
                return;
            }
            
            try {
                // 対象プレイヤーを検索
                const targetPlayer = roomData.gameData.players.find(p => p.id === data.targetPlayerId);
                if (!targetPlayer) {
                    console.error('対象プレイヤーが見つかりません:', data.targetPlayerId);
                    socket.emit('error', { message: '対象プレイヤーが見つかりません' });
                    return;
                }
                
                console.log('対象プレイヤー:', targetPlayer.name);
                console.log('カードインデックス:', data.cardIndex);
                
                // カードの存在チェック
                if (!targetPlayer.hand || !targetPlayer.hand[data.cardIndex]) {
                    console.error('カードが存在しません');
                    socket.emit('error', { message: '無効なカード選択です' });
                    return;
                }
                
                const selectedCard = targetPlayer.hand[data.cardIndex];
                console.log('選択されたカード:', selectedCard);
                
                // 既に公開済みかチェック
                if (selectedCard.revealed) {
                    console.warn('既に公開済みのカード');
                    socket.emit('error', { message: 'そのカードは既に公開されています' });
                    return;
                }
                
                // カード公開前の状態をログ出力
                console.log('=== カード公開前の状態 ===');
                console.log('現在のラウンド:', roomData.gameData.currentRound, '/', roomData.gameData.maxRounds);
                console.log('このラウンドで公開されたカード数:', roomData.gameData.cardsFlippedThisRound);
                console.log('接続中プレイヤー数:', getConnectedPlayerCount(roomData));
                console.log('現在の手札枚数設定:', roomData.gameData.cardsPerPlayer);
                console.log('財宝発見数:', roomData.gameData.treasureFound, '/', roomData.gameData.treasureGoal);
                console.log('罠発動数:', roomData.gameData.trapTriggered, '/', roomData.gameData.trapGoal);
                
                // カードを公開
                selectedCard.revealed = true;
                console.log('✅ カードを公開しました:', selectedCard.type);
                
                // 進捗更新
                if (selectedCard.type === 'treasure') {
                    roomData.gameData.treasureFound++;
                    console.log(`💎 子豚発見！ 合計: ${roomData.gameData.treasureFound}/${roomData.gameData.treasureGoal}`);
                } else if (selectedCard.type === 'trap') {
                    roomData.gameData.trapTriggered++;
                    console.log(`💀 罠発動！ 合計: ${roomData.gameData.trapTriggered}/${roomData.gameData.trapGoal}`);
                } else {
                    console.log('🏠 空き部屋でした');
                }
                
                // このラウンドで公開されたカード数を増加
                roomData.gameData.cardsFlippedThisRound++;
                console.log(`📊 このラウンドでのカード公開数: ${roomData.gameData.cardsFlippedThisRound}`);
                
                // 勝利条件チェック
                const endResult = checkGameEndConditions(roomData.gameData);
                if (endResult.ended) {
                    console.log('🏆 ゲーム終了:', endResult);
                    roomData.gameData.gameState = 'finished';
                    roomData.gameData.winningTeam = endResult.winner;
                    roomData.gameData.victoryMessage = endResult.message;
                    
                    // 勝利画面表示
                    io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
                    console.log('✅ 勝利条件達成 - ゲーム終了');
                    return;
                }
                
                // 鍵を次のプレイヤーに渡す（対象プレイヤーに）
                roomData.gameData.keyHolderId = data.targetPlayerId;
                const newKeyHolder = roomData.gameData.players.find(p => p.id === data.targetPlayerId);
                console.log('🗝️ 鍵の移動:', socket.playerName, '→', newKeyHolder?.name);
                
                // 🆕 ラウンド終了チェック（カードリサイクル対応）
                const connectedPlayerCount = getConnectedPlayerCount(roomData);
                console.log(`🔄 ラウンド終了チェック: ${roomData.gameData.cardsFlippedThisRound} >= ${connectedPlayerCount} ?`);
                
                if (roomData.gameData.cardsFlippedThisRound >= connectedPlayerCount) {
                    console.log('📋 ===== ラウンド終了条件達成！カードリサイクル開始 =====');
                    
                    // ラウンド終了処理
                    const nextRoundResult = advanceToNextRound(roomData.gameData, connectedPlayerCount);
                    
                    if (nextRoundResult.gameEnded) {
                        console.log('🎮 4ラウンド終了によるゲーム終了:', nextRoundResult.reason);
                        io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
                        return;
                    }
                    
                    if (nextRoundResult.newRound) {
                        console.log(`🆕 ラウンド ${nextRoundResult.newRound} 開始準備 - カードリサイクル実行`);
                        
                        // 🔧 カードリサイクル処理を実行
                        const connectedPlayers = roomData.gameData.players.filter(p => p.connected);
                        const recycleResult = recycleCardsAfterRound(roomData.gameData, connectedPlayers);
                        
                        if (recycleResult.success) {
                            console.log(`✅ ラウンド ${nextRoundResult.newRound} のカードリサイクル完了`);
                            
                            // 最初のプレイヤーに鍵を渡す
                            if (connectedPlayers.length > 0) {
                                roomData.gameData.keyHolderId = connectedPlayers[0].id;
                                console.log(`🗝️ ラウンド ${nextRoundResult.newRound} の最初の鍵保持者: ${connectedPlayers[0].name}`);
                            }
                            
                            // 新しいラウンド開始の通知
                            io.to(socket.roomId).emit('roundStart', nextRoundResult.newRound);
                        } else {
                            console.error('❌ カードリサイクルに失敗:', recycleResult.error);
                        }
                    }
                } else {
                    // 通常のターン移行
                    console.log('🔄 次のプレイヤーにターン移行（ラウンド継続）');
                }
                
                // カード公開後の状態をログ出力
                console.log('=== カード公開後の状態 ===');
                console.log('現在のラウンド:', roomData.gameData.currentRound, '/', roomData.gameData.maxRounds);
                console.log('このラウンドで公開されたカード数:', roomData.gameData.cardsFlippedThisRound);
                console.log('現在の手札枚数設定:', roomData.gameData.cardsPerPlayer);
                console.log('現在の鍵保持者:', newKeyHolder?.name);
                console.log('ゲーム状態:', roomData.gameData.gameState);
                
                // 全員に更新を送信
                io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
                
                console.log('✅ カード選択処理完了（カードリサイクル対応）');
                
            } catch (error) {
                console.error('❌ カード選択エラー:', error);
                socket.emit('error', { message: 'カード選択に失敗しました: ' + error.message });
            }
