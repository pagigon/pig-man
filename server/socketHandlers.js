// 完全版socketHandlers.js - 重複防止機能付き
const activeRooms = new Map();
const socketRequestHistory = new Map();

function setupSocketHandlers(io) {
    console.log('🚀 Socket.io ハンドラー設定開始（完全版）');
    
    io.on('connection', (socket) => {
        console.log('✅ 新しい接続確認:', socket.id);
        
        // Socket毎の要求履歴を初期化
        socketRequestHistory.set(socket.id, {
            lastJoinRequest: 0,
            lastCreateRequest: 0,
            requestCooldown: 3000 // 3秒
        });
        
        // 接続直後にルーム一覧を送信
        const roomList = Array.from(activeRooms.values())
            .filter(room => room.gameData.gameState === 'waiting')
            .map(room => ({
                id: room.id,
                hostName: room.hostName,
                playerCount: room.players.filter(p => p.connected).length,
                hasPassword: !!room.gameData.password
            }));
        socket.emit('roomList', roomList);
        
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
        
        // ルーム作成（重複防止強化版）
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
                const roomId = 'PIG' + Date.now().toString().slice(-4);
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
        
        // ルーム参加（重複防止強化版）
        socket.on('joinRoom', (data) => {
            const now = Date.now();
            const history = socketRequestHistory.get(socket.id);
            
            // クールダウンチェック
            if (history && (now - history.lastJoinRequest) < history.requestCooldown) {
                console.warn(`⚠️ Socket ${socket.id} クールダウン中`);
                socket.emit('error', { 
                    message: 'しばらく待ってから再試行してください' 
                });
                return;
            }
            
            // 履歴更新
            if (history) {
                history.lastJoinRequest = now;
            }
            
            console.log('👥 ルーム参加要求:', data, 'Socket:', socket.id);
            const { roomId, playerName, password } = data;
            
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
        
        // ゲーム開始
        socket.on('startGame', () => {
            console.log('🎮 ゲーム開始要求:', socket.id);
            
            if (!socket.roomId) {
                socket.emit('error', { message: 'ルームに参加していません' });
                return;
            }
            
            const room = activeRooms.get(socket.roomId);
            if (!room) {
                socket.emit('error', { message: 'ルームが見つかりません' });
                return;
            }
            
            // ホスト権限チェック
            if (room.gameData.host !== socket.id) {
                socket.emit('error', { message: 'ゲーム開始権限がありません' });
                return;
            }
            
            // プレイヤー数チェック
            const connectedPlayers = room.players.filter(p => p.connected);
            if (connectedPlayers.length < 3) {
                socket.emit('error', { message: 'ゲーム開始には最低3人必要です' });
                return;
            }
            
            if (connectedPlayers.length > 10) {
                socket.emit('error', { message: 'プレイヤー数が多すぎます（最大10人）' });
                return;
            }
            
            try {
                // ゲーム開始処理
                startGameLogic(room.gameData, connectedPlayers.length);
                
                // ゲーム状態更新
                room.gameData.gameState = 'playing';
                
                // 全プレイヤーにゲーム開始を通知
                io.to(socket.roomId).emit('gameUpdate', room.gameData);
                io.to(socket.roomId).emit('roundStart', 1);
                
                // ルーム一覧から削除（進行中ゲームは非表示）
                updateRoomList(io);
                
                console.log(`ルーム ${socket.roomId} でゲーム開始`);
                
            } catch (error) {
                console.error('ゲーム開始エラー:', error);
                socket.emit('error', { message: 'ゲーム開始に失敗しました' });
            }
        });
        
        // カード選択
        socket.on('selectCard', (data) => {
            console.log('🃏 カード選択:', data);
            
            if (!socket.roomId) {
                socket.emit('error', { message: 'ルームに参加していません' });
                return;
            }
            
            const room = activeRooms.get(socket.roomId);
            if (!room || room.gameData.gameState !== 'playing') {
                socket.emit('error', { message: 'ゲームが進行していません' });
                return;
            }
            
            // 観戦者チェック
            if (socket.isSpectator) {
                socket.emit('error', { message: '観戦者はカードを選択できません' });
                return;
            }
            
            // ターンチェック
            if (room.gameData.keyHolderId !== socket.id) {
                socket.emit('error', { message: 'あなたのターンではありません' });
                return;
            }
            
            try {
                // カード選択処理
                const targetPlayer = room.gameData.players.find(p => p.id === data.targetPlayerId);
                if (!targetPlayer || !targetPlayer.hand[data.cardIndex]) {
                    socket.emit('error', { message: '無効なカード選択です' });
                    return;
                }
                
                const selectedCard = targetPlayer.hand[data.cardIndex];
                if (selectedCard.revealed) {
                    socket.emit('error', { message: 'そのカードは既に公開されています' });
                    return;
                }
                
                // カードを公開
                selectedCard.revealed = true;
                
                // 進捗更新
                if (selectedCard.type === 'treasure') {
                    room.gameData.treasureFound++;
                } else if (selectedCard.type === 'trap') {
                    room.gameData.trapTriggered++;
                }
                
                room.gameData.cardsFlippedThisRound++;
                
                // 勝利条件チェック
                checkWinConditions(room.gameData);
                
                // 次のプレイヤーに鍵を渡す
                if (room.gameData.gameState === 'playing') {
                    passKeyToNextPlayer(room.gameData, data.targetPlayerId);
                }
                
                // 全員に更新を送信
                io.to(socket.roomId).emit('gameUpdate', room.gameData);
                
            } catch (error) {
                console.error('カード選択エラー:', error);
                socket.emit('error', { message: 'カード選択に失敗しました' });
            }
        });
        
        // チャット送信
        socket.on('sendChat', (message) => {
            if (!socket.roomId || !socket.playerName) return;
            
            const room = activeRooms.get(socket.roomId);
            if (!room) return;
            
            const chatMessage = {
                type: 'player',
                playerName: socket.playerName,
                text: message,
                timestamp: Date.now()
            };
            
            room.gameData.messages.push(chatMessage);
            
            // 最新20件のみ保持
            if (room.gameData.messages.length > 20) {
                room.gameData.messages = room.gameData.messages.slice(-20);
            }
            
            io.to(socket.roomId).emit('newMessage', room.gameData.messages);
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
        
        // 切断時の履歴削除
        socket.on('disconnect', (reason) => {
            console.log('🔌 切断:', socket.id, 'reason:', reason);
            
            // 履歴削除
            socketRequestHistory.delete(socket.id);
            
            // 観戦者の場合は単純に切断
            if (socket.isSpectator) {
                console.log('観戦者が切断しました');
                return;
            }
            
            handlePlayerDisconnect(socket, io);
        });
        
        // クライアントエラー受信
        socket.on('clientError', (errorInfo) => {
            console.error('クライアントエラー受信:', errorInfo);
            // エラー情報をログに記録（本番では外部ログシステムに送信）
        });
        
        console.log('🎯 イベントハンドラー登録完了:', socket.id);
    });
    
    console.log('🏁 Socket.io ハンドラー設定完了');
}

// ゲーム開始ロジック
function startGameLogic(gameData, playerCount) {
    console.log('🎮 ゲーム開始ロジック実行:', { playerCount });
    
    try {
        const { assignRoles, generateAllCards, distributeCards, calculateVictoryGoal } = require('./gameLogic');
        
        // 役職割り当て
        const roles = assignRoles(playerCount);
        gameData.players.forEach((player, index) => {
            if (player.connected) {
                player.role = roles[index];
            }
        });
        
        // カード生成と配布
        const { cards, treasureCount, trapCount } = generateAllCards(playerCount);
        const { playerHands } = distributeCards(cards, playerCount, 5);
        
        // 各プレイヤーにカードを配布
        const connectedPlayers = gameData.players.filter(p => p.connected);
        connectedPlayers.forEach((player, index) => {
            player.hand = playerHands[index] || [];
        });
        
        // 勝利条件設定
        const { treasureGoal, trapGoal } = calculateVictoryGoal(playerCount);
        gameData.treasureGoal = treasureGoal;
        gameData.trapGoal = trapGoal;
        gameData.totalTreasures = treasureCount;
        gameData.totalTraps = trapCount;
        
        // 最初のプレイヤーに鍵を渡す
        gameData.keyHolderId = connectedPlayers[0].id;
        
        console.log('ゲーム開始処理完了:', {
            playerCount,
            treasureGoal,
            trapGoal,
            keyHolder: connectedPlayers[0].name
        });
        
    } catch (error) {
        console.error('ゲーム開始ロジックエラー:', error);
        // フォールバック処理
        gameData.players.forEach((player, index) => {
            player.role = index % 2 === 0 ? 'adventurer' : 'guardian';
            player.hand = [];
        });
        gameData.treasureGoal = 7;
        gameData.trapGoal = 2;
        gameData.keyHolderId = gameData.players.find(p => p.connected)?.id;
    }
}

// 勝利条件チェック
function checkWinConditions(gameData) {
    // 探検家チームの勝利：すべての財宝を発見
    if (gameData.treasureFound >= gameData.treasureGoal) {
        gameData.gameState = 'finished';
        gameData.winningTeam = 'adventurer';
        gameData.victoryMessage = `全ての子豚を救出しました！探検家チームの勝利です！`;
        return;
    }
    
    // 豚男チームの勝利：すべての罠を発動
    if (gameData.trapTriggered >= gameData.trapGoal) {
        gameData.gameState = 'finished';
        gameData.winningTeam = 'guardian';
        gameData.victoryMessage = `すべての罠が発動しました！豚男チームの勝利です！`;
        return;
    }
    
    // ラウンド終了チェック
    const connectedPlayerCount = gameData.players.filter(p => p.connected).length;
    if (gameData.cardsFlippedThisRound >= connectedPlayerCount) {
        gameData.currentRound++;
        gameData.cardsFlippedThisRound = 0;
        
        // 最大ラウンド到達で豚男チームの勝利
        if (gameData.currentRound > gameData.maxRounds) {
            gameData.gameState = 'finished';
            gameData.winningTeam = 'guardian';
            gameData.victoryMessage = `4ラウンドが終了しました！豚男チームの勝利です！`;
        }
    }
}

// 鍵を次のプレイヤーに渡す
function passKeyToNextPlayer(gameData, currentTargetId) {
    gameData.keyHolderId = currentTargetId;
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

// 進行中ゲーム一覧更新
function updateOngoingGamesList(io) {
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
    
    io.emit('ongoingGames', ongoingGames);
    console.log('📋 進行中ゲーム一覧更新送信完了, ゲーム数:', ongoingGames.length);
}

// ルーム情報の整合性チェック
function validateRoomData(room) {
    if (!room || !room.gameData) {
        return false;
    }
    
    // 必要なプロパティの存在チェック
    const requiredProps = ['id', 'players', 'gameState', 'host'];
    for (const prop of requiredProps) {
        if (!room.gameData.hasOwnProperty(prop)) {
            console.warn(`ルームデータに必要なプロパティが不足: ${prop}`);
            return false;
        }
    }
    
    // プレイヤー数の整合性チェック
    if (!Array.isArray(room.gameData.players)) {
        console.warn('プレイヤーデータが配列ではありません');
        return false;
    }
    
    return true;
}

// デバッグ用：ルーム状態出力
function debugRoomState(roomId) {
    const room = activeRooms.get(roomId);
    if (!room) {
        console.log(`デバッグ: ルーム ${roomId} が見つかりません`);
        return;
    }
    
    console.log(`=== ルーム ${roomId} 状態 ===`);
    console.log('ゲーム状態:', room.gameData.gameState);
    console.log('プレイヤー数:', room.players.length);
    console.log('接続中プレイヤー:', room.players.filter(p => p.connected).length);
    console.log('ホスト:', room.players.find(p => p.id === room.gameData.host)?.name || '不明');
    console.log('現在のラウンド:', room.gameData.currentRound);
    console.log('財宝発見数:', room.gameData.treasureFound);
    console.log('罠発動数:', room.gameData.trapTriggered);
    console.log('鍵保持者:', room.players.find(p => p.id === room.gameData.keyHolderId)?.name || '不明');
    console.log('====================');
}

// 定期的なルーム整理（30分ごと）
setInterval(() => {
    console.log('🧹 定期的なルーム整理実行');
    const now = Date.now();
    const roomsToDelete = [];
    
    for (const [roomId, room] of activeRooms) {
        // 全員が切断して30分以上経過したルームを削除
        if (room.players.every(p => !p.connected)) {
            const lastActivity = room.lastActivity || room.createdAt || now;
            if (now - lastActivity > 30 * 60 * 1000) { // 30分
                roomsToDelete.push(roomId);
            }
        }
        
        // 作成から24時間経過したルームを削除
        const createdAt = room.createdAt || now;
        if (now - createdAt > 24 * 60 * 60 * 1000) { // 24時間
            roomsToDelete.push(roomId);
        }
    }
    
    roomsToDelete.forEach(roomId => {
        activeRooms.delete(roomId);
        console.log(`期限切れルームを削除: ${roomId}`);
    });
    
    if (roomsToDelete.length > 0) {
        console.log(`${roomsToDelete.length}個のルームを削除しました`);
    }
    
    console.log(`現在のアクティブルーム数: ${activeRooms.size}`);
}, 30 * 60 * 1000); // 30分ごと

// Socket要求履歴の定期清理（1時間ごと）
setInterval(() => {
    console.log('🧹 Socket履歴の定期清理実行');
    const now = Date.now();
    const toDelete = [];
    
    for (const [socketId, history] of socketRequestHistory) {
        // 1時間以上活動がない履歴を削除
        const lastActivity = Math.max(history.lastJoinRequest, history.lastCreateRequest);
        if (now - lastActivity > 60 * 60 * 1000) { // 1時間
            toDelete.push(socketId);
        }
    }
    
    toDelete.forEach(socketId => {
        socketRequestHistory.delete(socketId);
    });
    
    if (toDelete.length > 0) {
        console.log(`${toDelete.length}個のSocket履歴を削除しました`);
    }
    
    console.log(`現在のSocket履歴数: ${socketRequestHistory.size}`);
}, 60 * 60 * 1000); // 1時間ごと

// エラーハンドリング用のユーティリティ
function safeEmit(socket, event, data) {
    try {
        if (socket && socket.connected) {
            socket.emit(event, data);
            return true;
        }
    } catch (error) {
        console.error(`Socket emit エラー (${event}):`, error);
    }
    return false;
}

function safeBroadcast(io, roomId, event, data) {
    try {
        if (io && roomId) {
            io.to(roomId).emit(event, data);
            return true;
        }
    } catch (error) {
        console.error(`Socket broadcast エラー (${event}):`, error);
    }
    return false;
}

// 統計情報の取得
function getServerStats() {
    const totalRooms = activeRooms.size;
    const waitingRooms = Array.from(activeRooms.values()).filter(r => r.gameData.gameState === 'waiting').length;
    const playingRooms = Array.from(activeRooms.values()).filter(r => r.gameData.gameState === 'playing').length;
    const finishedRooms = Array.from(activeRooms.values()).filter(r => r.gameData.gameState === 'finished').length;
    
    const totalPlayers = Array.from(activeRooms.values()).reduce((sum, room) => {
        return sum + room.players.filter(p => p.connected).length;
    }, 0);
    
    const socketHistoryCount = socketRequestHistory.size;
    
    return {
        totalRooms,
        waitingRooms,
        playingRooms,
        finishedRooms,
        totalPlayers,
        socketHistoryCount,
        timestamp: new Date().toISOString()
    };
}

// 管理用のログ出力（5分ごと）
setInterval(() => {
    const stats = getServerStats();
    console.log('📊 サーバー統計情報:', stats);
}, 5 * 60 * 1000); // 5分ごと

// デバッグ用のエクスポート関数
function getDebugInfo() {
    const rooms = Array.from(activeRooms.entries()).map(([id, room]) => ({
        id,
        gameState: room.gameData.gameState,
        playerCount: room.players.length,
        connectedCount: room.players.filter(p => p.connected).length,
        host: room.players.find(p => p.id === room.gameData.host)?.name || '不明'
    }));
    
    return {
        rooms,
        stats: getServerStats(),
        socketHistorySize: socketRequestHistory.size
    };
}

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
    console.log('🛑 サーバー終了中...');
    console.log('最終統計:', getServerStats());
    
    // アクティブなルームの情報を保存（必要に応じて）
    const roomData = Array.from(activeRooms.entries()).map(([id, room]) => ({
        id,
        playerCount: room.players.length,
        gameState: room.gameData.gameState
    }));
    
    if (roomData.length > 0) {
        console.log('終了時のアクティブルーム:', roomData);
    }
    
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 サーバー強制終了...');
    process.exit(0);
});

// エクスポート
module.exports = { 
    setupSocketHandlers,
    getDebugInfo,
    getServerStats,
    debugRoomState
};('gameUpdate', room.gameData);
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
        io.to(socket.roomId).emit
