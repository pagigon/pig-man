// ルーム関連のSocket.ioイベントハンドラー
const { generateRoomId } = require('../game/game-logic');
const { validatePlayerName, validateRoomId } = require('../utils/validation');
const { checkRateLimit } = require('../utils/rate-limiter');

let activeRooms = new Map();

function setupRoomHandlers(io, socket, socketRequestHistory) {
    
    // ルーム一覧要求
    socket.on('getRoomList', () => {
        console.log('📋 ルーム一覧要求受信:', socket.id);
        const roomList = Array.from(activeRooms.values())
            .filter(room => room.gameData.gameState === 'waiting')
            .map(room => ({
                id: room.id,
                hostName: room.hostName,
                playerCount: room.players.filter(p => p.connected).length,
                hasPassword: !!room.gameData.password
            }));
        socket.emit('roomList', roomList);
    });
    
    // 進行中ゲーム一覧要求
    socket.on('getOngoingGames', () => {
        console.log('📋 進行中ゲーム一覧要求受信:', socket.id);
        const ongoingGames = Array.from(activeRooms.values())
            .filter(room => room.gameData.gameState === 'playing')
            .map(room => ({
                id: room.id,
                currentRound: room.gameData.currentRound,
                playerCount: room.players.filter(p => p.connected).length,
                treasureFound: room.gameData.treasureFound,
                treasureGoal: room.gameData.treasureGoal,
                trapTriggered: room.gameData.trapTriggered,
                trapGoal: room.gameData.trapGoal
            }));
        socket.emit('ongoingGames', ongoingGames);
    });
    
    // ルーム作成
    socket.on('createRoom', (data) => {
        if (!checkRateLimit(socket.id, 'create', socketRequestHistory)) {
            socket.emit('error', { message: 'しばらく待ってから再試行してください' });
            return;
        }
        
        console.log('🏠 ===== ルーム作成要求受信 =====');
        console.log('Socket ID:', socket.id);
        console.log('データ:', JSON.stringify(data, null, 2));
        
        // バリデーション
        if (!validatePlayerName(data.playerName)) {
            socket.emit('error', { message: 'プレイヤー名が無効です' });
            return;
        }
        
        // 既に他のルームにいないかチェック
        for (const [roomId, room] of activeRooms) {
            const existingPlayer = room.players.find(p => p.id === socket.id);
            if (existingPlayer) {
                socket.emit('error', { 
                    message: `既にルーム ${roomId} に参加しています` 
                });
                return;
            }
        }
        
        try {
            const roomId = generateRoomId();
            console.log('生成ルームID:', roomId);
            
            const gameData = {
                id: roomId,
                players: [{
                    id: socket.id,
                    name: data.playerName || 'プレイヤー',
                    connected: true,
                    role: null,
                    hand: []
                }],
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
            activeRooms.set(roomId, {
                id: roomId,
                hostName: data.playerName || 'プレイヤー',
                players: gameData.players,
                gameData: gameData
            });
            
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
            updateRoomList(io);
            
            console.log('🎉 ===== ルーム作成処理完了 =====');
            
        } catch (error) {
            console.error('❌ ===== ルーム作成エラー =====');
            console.error('エラー詳細:', error);
            socket.emit('error', { 
                message: 'ルーム作成に失敗しました: ' + error.message 
            });
        }
    });
    
    // ルーム参加
    socket.on('joinRoom', (data) => {
        if (!checkRateLimit(socket.id, 'join', socketRequestHistory)) {
            socket.emit('error', { message: 'しばらく待ってから再試行してください' });
            return;
        }
        
        console.log('👥 ルーム参加要求:', data, 'Socket:', socket.id);
        const { roomId, playerName, password } = data;
        
        // バリデーション
        if (!validatePlayerName(playerName) || !validateRoomId(roomId)) {
            socket.emit('error', { message: '入力データが無効です' });
            return;
        }
        
        const room = activeRooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }
        
        // パスワードチェック
        if (room.gameData.password && room.gameData.password !== password) {
            socket.emit('error', { message: 'パスワードが正しくありません' });
            return;
        }
        
        // ゲーム状態チェック
        if (room.gameData.gameState !== 'waiting') {
            socket.emit('error', { message: 'このルームはゲーム中です。観戦モードで参加してください。' });
            return;
        }
        
        // このSocketが既にルームに参加していないかチェック
        const socketAlreadyInRoom = room.players.find(p => p.id === socket.id);
        if (socketAlreadyInRoom) {
            console.warn(`⚠️ Socket ${socket.id} は既にルームに参加済み`);
            socket.emit('error', { message: '既にこのルームに参加しています' });
            return;
        }
        
        // 同じ名前のアクティブプレイヤーがいないかチェック
        const nameConflict = room.players.find(p => p.name === playerName && p.connected);
        if (nameConflict) {
            console.warn(`⚠️ プレイヤー名 "${playerName}" は既に使用中`);
            socket.emit('error', { 
                message: `プレイヤー名 "${playerName}" は既に使用されています` 
            });
            return;
        }
        
        // 最大プレイヤー数チェック
        const connectedCount = room.players.filter(p => p.connected).length;
        if (connectedCount >= 10) {
            socket.emit('error', { message: 'ルームが満員です' });
            return;
        }
        
        // 切断済みの同名プレイヤーを探す
        const disconnectedPlayer = room.players.find(p => p.name === playerName && !p.connected);
        
        if (disconnectedPlayer) {
            // 再接続処理
            disconnectedPlayer.id = socket.id;
            disconnectedPlayer.connected = true;
            console.log(`${playerName} が再接続しました`);
        } else {
            // 新規プレイヤー追加
            const newPlayer = {
                id: socket.id,
                name: playerName,
                connected: true,
                role: null,
                hand: []
            };
            room.players.push(newPlayer);
            room.gameData.players.push(newPlayer);
            console.log(`${playerName} が新規参加しました`);
        }
        
        // ソケットの情報を設定
        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerName = playerName;
        
        // 成功応答
        socket.emit('joinSuccess', {
            roomId: roomId,
            gameData: room.gameData,
            playerInfo: {
                roomId: roomId,
                playerName: playerName,
                isHost: room.gameData.host === socket.id
            }
        });
        
        // ルーム内の全員に更新を送信
        io.to(roomId).emit('gameUpdate', room.gameData);
        
        // ルーム一覧更新
        updateRoomList(io);
        
        console.log(`✅ ${playerName} がルーム ${roomId} に参加完了`);
    });
    
    // 再入場
    socket.on('rejoinRoom', (data) => {
        console.log('🔄 再入場要求:', data);
        const { roomId, playerName } = data;
        
        // バリデーション
        if (!validatePlayerName(playerName) || !validateRoomId(roomId)) {
            socket.emit('error', { message: '入力データが無効です' });
            return;
        }
        
        const room = activeRooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }
        
        // 既存プレイヤーを探す
        const existingPlayer = room.players.find(p => p.name === playerName);
        if (!existingPlayer) {
            socket.emit('error', { message: 'このルームにあなたのデータが見つかりません' });
            return;
        }
        
        // 既に接続中の場合
        if (existingPlayer.connected) {
            socket.emit('error', { message: 'このプレイヤーは既に接続中です' });
            return;
        }
        
        // 再接続処理
        existingPlayer.id = socket.id;
        existingPlayer.connected = true;
        
        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerName = playerName;
        
        socket.emit('rejoinSuccess', {
            roomId: roomId,
            gameData: room.gameData,
            isHost: room.gameData.host === socket.id
        });
        
        io.to(roomId).emit('gameUpdate', room.gameData);
        
        console.log(`✅ ${playerName} がルーム ${roomId} に再入場完了`);
    });
    
    // 観戦
    socket.on('spectateRoom', (data) => {
        console.log('👁️ 観戦要求:', data);
        const { roomId, spectatorName } = data;
        
        // バリデーション
        if (!validatePlayerName(spectatorName) || !validateRoomId(roomId)) {
            socket.emit('error', { message: '入力データが無効です' });
            return;
        }
        
        const room = activeRooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }
        
        if (room.gameData.gameState !== 'playing') {
            socket.emit('error', { message: 'このルームはゲーム中ではありません' });
            return;
        }
        
        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerName = spectatorName;
        socket.isSpectator = true;
        
        socket.emit('spectateSuccess', {
            roomId: roomId,
            gameData: room.gameData
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
        
        // バリデーション
        if (!validatePlayerName(playerName) || !validateRoomId(roomId)) {
            socket.emit('error', { message: '入力データが無効です' });
            return;
        }
        
        const room = activeRooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }
        
        const player = room.players.find(p => p.name === playerName);
        if (!player) {
            socket.emit('error', { message: 'プレイヤーデータが見つかりません' });
            return;
        }
        
        // 再接続処理
        if (!player.connected) {
            player.id = socket.id;
            player.connected = true;
            
            socket.join(roomId);
            socket.roomId = roomId;
            socket.playerName = playerName;
            
            socket.emit('reconnectSuccess', {
                roomId: roomId,
                gameData: room.gameData,
                isHost: room.gameData.host === socket.id
            });
            
            io.to(roomId).emit('gameUpdate', room.gameData);
            
            console.log(`✅ ${playerName} がルーム ${roomId} に再接続完了`);
        }
    });
}

// プレイヤー一時退出処理
function handlePlayerTempLeave(socket, io) {
    if (!socket.roomId) return;
    
    const room = activeRooms.get(socket.roomId);
    if (!room) return;
    
    // プレイヤーを切断状態に
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
        player.connected = false;
        console.log(`${player.name} が一時退出しました`);
    }
    
    // ルーム内の他のプレイヤーに更新を送信
    io.to(socket.roomId).emit('gameUpdate', room.gameData);
    
    // ルーム一覧更新
    updateRoomList(io);
}

// プレイヤー退出処理
function handlePlayerLeave(socket, io) {
    if (!socket.roomId) return;
    
    const room = activeRooms.get(socket.roomId);
    if (!room) return;
    
    // プレイヤーを完全に削除
    room.players = room.players.filter(p => p.id !== socket.id);
    room.gameData.players = room.gameData.players.filter(p => p.id !== socket.id);
    
    // ホストが退出した場合、次のプレイヤーをホストに
    if (room.gameData.host === socket.id) {
        const nextHost = room.players.find(p => p.connected);
        if (nextHost) {
            room.gameData.host = nextHost.id;
            console.log(`新しいホスト: ${nextHost.name}`);
        }
    }
    
    // 全員が退出した場合、ルームを削除
    if (room.players.length === 0) {
        activeRooms.delete(socket.roomId);
        console.log('空のルームを削除:', socket.roomId);
    } else {
        // ルーム内の他のプレイヤーに更新を送信
        io.to(socket.roomId).emit('gameUpdate', room.gameData);
    }
    
    // ルーム一覧更新
    updateRoomList(io);
}

// プレイヤー切断処理
function handlePlayerDisconnect(socket, io) {
    if (!socket.roomId) return;
    
    const room = activeRooms.get(socket.roomId);
    if (!room) return;
    
    // プレイヤーを切断状態に（削除はしない）
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
        player.connected = false;
        console.log(`${player.name} が切断しました`);
    }
    
    // 全員が切断した場合、ルームを削除
    if (room.players.every(p => !p.connected)) {
        activeRooms.delete(socket.roomId);
        console.log('全員切断のためルームを削除:', socket.roomId);
    } else {
        // ルーム内の他のプレイヤーに更新を送信
        io.to(socket.roomId).emit('gameUpdate', room.gameData);
    }
    
    // ルーム一覧更新
    updateRoomList(io);
}

// ルーム一覧更新
function updateRoomList(io) {
    const roomList = Array.from(activeRooms.values())
        .filter(room => room.gameData.gameState === 'waiting')
        .map(room => ({
            id: room.id,
            hostName: room.hostName,
            playerCount: room.players.filter(p => p.connected).length,
            hasPassword: !!room.gameData.password
        }));
    
    io.emit('roomList', roomList);
    console.log('📋 ルーム一覧更新送信完了, ルーム数:', roomList.length);
}

// ルームデータの取得
function getActiveRooms() {
    return activeRooms;
}

// ルームデータの設定（他のハンドラーから使用）
function setActiveRooms(rooms) {
    activeRooms = rooms;
}

module.exports = {
    setupRoomHandlers,
    handlePlayerTempLeave,
    handlePlayerLeave,
    handlePlayerDisconnect,
    updateRoomList,
    getActiveRooms,
    setActiveRooms
};
