// 完全版 socketHandlers.js（重複問題+ラウンド制修正）
const activeRooms = new Map();
const socketRequestHistory = new Map();

function setupSocketHandlers(io) {
    console.log('🚀 Socket.io ハンドラー設定開始（完全修正版）');
    
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
        
        // ルーム参加 - 完全修正版
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
            
            console.log('👥 ===== ルーム参加要求受信 =====');
            console.log('Socket ID:', socket.id);
            console.log('データ:', data);
            
            const { roomId, playerName, password } = data;
            
            const roomData = activeRooms.get(roomId);
            if (!roomData) {
                socket.emit('error', { message: 'ルームが見つかりません' });
                return;
            }
            
            // パスワードチェック
            if (roomData.gameData.password && roomData.gameData.password !== password) {
                socket.emit('error', { message: 'パスワードが正しくありません' });
                return;
            }
            
            // ゲーム状態チェック
            if (roomData.gameData.gameState !== 'waiting') {
                socket.emit('error', { message: 'このルームはゲーム中です。観戦モードで参加してください。' });
                return;
            }
            
            // 重複チェック：Socket IDベース
            if (isPlayerInRoom(roomData, socket.id)) {
                console.warn(`⚠️ Socket ${socket.id} は既にルームに参加済み`);
                socket.emit('error', { message: '既にこのルームに参加しています' });
                return;
            }
            
            // 重複チェック：プレイヤー名ベース（接続中のみ）
            if (isPlayerNameActiveInRoom(roomData, playerName)) {
                console.warn(`⚠️ プレイヤー名 "${playerName}" は既に使用中`);
                socket.emit('error', { 
                    message: `プレイヤー名 "${playerName}" は既に使用されています` 
                });
                return;
            }
            
            // 最大プレイヤー数チェック
            const connectedCount = getConnectedPlayerCount(roomData);
            if (connectedCount >= 10) {
                socket.emit('error', { message: 'ルームが満員です' });
                return;
            }
            
            // プレイヤー処理
            let player = findDisconnectedPlayerByName(roomData, playerName);
            
            if (player) {
                // 再接続処理
                console.log(`${playerName} が再接続します`);
                player.id = socket.id;
                player.connected = true;
                player.lastConnected = Date.now();
            } else {
                // 新規プレイヤー追加
                console.log(`${playerName} が新規参加します`);
                player = createPlayer(socket.id, playerName);
                roomData.gameData.players.push(player);
            }
            
            // ソケット情報設定
            socket.join(roomId);
            socket.roomId = roomId;
            socket.playerName = playerName;
            
            // データ整合性確認
            console.log('参加後の状態確認:');
            console.log('- プレイヤー数:', roomData.gameData.players.length);
            console.log('- 接続中:', getConnectedPlayerCount(roomData));
            roomData.gameData.players.forEach((p, i) => {
                console.log(`  ${i}: ${p.name} (${p.id.slice(-4)}) ${p.connected ? '接続' : '切断'}`);
            });
            
            // 成功応答
            socket.emit('joinSuccess', {
                roomId: roomId,
                gameData: roomData.gameData,
                playerInfo: {
                    roomId: roomId,
                    playerName: playerName,
                    isHost: roomData.gameData.host === socket.id
                }
            });
            
            // ルーム内の全員に更新を送信
            io.to(roomId).emit('gameUpdate', roomData.gameData);
            
            // ルーム一覧更新
            broadcastRoomList(io);
            
            console.log(`✅ ${playerName} がルーム ${roomId} に参加完了`);
            console.log('🏁 ===== ルーム参加処理完了 =====');
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
            
            // 既存プレイヤーを探す
            const existingPlayer = findPlayerByName(roomData, playerName);
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
        
        // ゲーム開始
        socket.on('startGame', () => {
            console.log('🎮 ゲーム開始要求:', socket.id);
            
            if (!socket.roomId) {
                socket.emit('error', { message: 'ルームに参加していません' });
                return;
            }
            
            const roomData = activeRooms.get(socket.roomId);
            if (!roomData) {
                socket.emit('error', { message: 'ルームが見つかりません' });
                return;
            }
            
            // ホスト権限チェック
            if (roomData.gameData.host !== socket.id) {
                socket.emit('error', { message: 'ゲーム開始権限がありません' });
                return;
            }
            
            // プレイヤー数チェック
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
                // ゲーム開始処理
                startGameLogic(roomData.gameData, connectedCount);
                
                // ゲーム状態更新
                roomData.gameData.gameState = 'playing';
                
                // 全プレイヤーにゲーム開始を通知
                io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
                io.to(socket.roomId).emit('roundStart', 1);
                
                // ルーム一覧から削除（進行中ゲームは非表示）
                broadcastRoomList(io);
                
                console.log(`ルーム ${socket.roomId} でゲーム開始`);
                
            } catch (error) {
                console.error('ゲーム開始エラー:', error);
                socket.emit('error', { message: 'ゲーム開始に失敗しました' });
            }
        });
        
        // カード選択 - ラウンド制修正版
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
                
                // 🔧 ラウンド開始前の状態をログ出力
                console.log('=== カード公開前の状態 ===');
                console.log('現在のラウンド:', roomData.gameData.currentRound);
                console.log('このラウンドで公開されたカード数:', roomData.gameData.cardsFlippedThisRound);
                console.log('接続中プレイヤー数:', getConnectedPlayerCount(roomData));
                console.log('財宝発見数:', roomData.gameData.treasureFound, '/', roomData.gameData.treasureGoal);
                console.log('罠発動数:', roomData.gameData.trapTriggered, '/', roomData.gameData.trapGoal);
                
                // カードを公開
                selectedCard.revealed = true;
                console.log('カードを公開しました:', selectedCard.type);
                
                // 進捗更新
                if (selectedCard.type === 'treasure') {
                    roomData.gameData.treasureFound++;
                    console.log(`💎 財宝発見！ 合計: ${roomData.gameData.treasureFound}/${roomData.gameData.treasureGoal}`);
                } else if (selectedCard.type === 'trap') {
                    roomData.gameData.trapTriggered++;
                    console.log(`💀 罠発動！ 合計: ${roomData.gameData.trapTriggered}/${roomData.gameData.trapGoal}`);
                } else {
                    console.log('🏠 空き部屋でした');
                }
                
                // 🔧 このラウンドで公開されたカード数を増加
                roomData.gameData.cardsFlippedThisRound++;
                console.log(`📊 このラウンドでのカード公開数: ${roomData.gameData.cardsFlippedThisRound}`);
                
                // 🔧 勝利条件チェック（ラウンド処理の前に）
                const victoryResult = checkWinConditions(roomData.gameData);
                if (victoryResult) {
                    console.log('🏆 勝利条件達成:', victoryResult);
                    // 勝利した場合は鍵の移動やラウンド処理をしない
                    io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
                    return;
                }
                
                // 🔧 ラウンド終了チェック（接続中プレイヤー数と比較）
                const connectedPlayerCount = getConnectedPlayerCount(roomData);
                console.log(`🔄 ラウンド終了チェック: ${roomData.gameData.cardsFlippedThisRound} >= ${connectedPlayerCount} ?`);
                
                if (roomData.gameData.cardsFlippedThisRound >= connectedPlayerCount) {
                    console.log('📋 ラウンド終了条件達成！');
                    
                    // ラウンド終了処理
                    const nextRoundResult = advanceToNextRound(roomData.gameData, connectedPlayerCount);
                    if (nextRoundResult.gameEnded) {
                        console.log('🎮 ゲーム終了:', nextRoundResult.reason);
                        io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
                        return;
                    }
                    
                    if (nextRoundResult.newRound) {
                        console.log(`🆕 ラウンド ${nextRoundResult.newRound} 開始！`);
                        // 新しいラウンド開始の通知
                        io.to(socket.roomId).emit('roundStart', nextRoundResult.newRound);
                        
                        // カードを再配布
                        redistributeCards(roomData.gameData);
                    }
                } else {
                    // 通常のターン移行
                    console.log('🔄 次のプレイヤーにターン移行');
                }
                
                // 鍵を次のプレイヤーに渡す（対象プレイヤーに）
                roomData.gameData.keyHolderId = data.targetPlayerId;
                const newKeyHolder = roomData.gameData.players.find(p => p.id === data.targetPlayerId);
                console.log('🗝️ 鍵の移動:', socket.playerName, '→', newKeyHolder?.name);
                
                // 🔧 ラウンド後の状態をログ出力
                console.log('=== カード公開後の状態 ===');
                console.log('現在のラウンド:', roomData.gameData.currentRound);
                console.log('このラウンドで公開されたカード数:', roomData.gameData.cardsFlippedThisRound);
                console.log('現在の鍵保持者:', newKeyHolder?.name);
                console.log('ゲーム状態:', roomData.gameData.gameState);
                
                // 全員に更新を送信
                io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
                
                console.log('✅ カード選択処理完了');
                
            } catch (error) {
                console.error('❌ カード選択エラー:', error);
                socket.emit('error', { message: 'カード選択に失敗しました' });
            }
        });
        
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
            
            // 最新20件のみ保持
            if (roomData.gameData.messages.length > 20) {
                roomData.gameData.messages = roomData.gameData.messages.slice(-20);
            }
            
            io.to(socket.roomId).emit('newMessage', roomData.gameData.messages);
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
            
            // 再接続処理
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
            
            handlePlayerDisconnect(socket, io);
        });
        
        // クライアントエラー受信
        socket.on('clientError', (errorInfo) => {
            console.error('クライアントエラー受信:', errorInfo);
        });
        
        console.log('🎯 イベントハンドラー登録完了:', socket.id);
    });
    
    console.log('🏁 Socket.io ハンドラー設定完了');
}

// ユーティリティ関数群

function generateRoomId() {
    return 'PIG' + Math.random().toString(36).substr(2, 4).toUpperCase();
}

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

// ゲーム開始ロジック
function startGameLogic(gameData, playerCount) {
    console.log('🎮 ゲーム開始ロジック実行:', { playerCount });
    
    try {
        // 基本的なゲーム開始処理
        gameData.players.forEach((player, index) => {
            if (player.connected) {
                player.role = index % 2 === 0 ? 'adventurer' : 'guardian';
                player.hand = [];
                
                // 簡単なカード配布
                for (let i = 0; i < 5; i++) {
                    const cardType = Math.random() < 0.3 ? 'treasure' : 
                                   Math.random() < 0.1 ? 'trap' : 'empty';
                    player.hand.push({
                        type: cardType,
                        id: cardType + '-' + player.id + '-' + i,
                        revealed: false
                    });
                }
            }
        });
        
        // 最初のプレイヤーに鍵を渡す
        const connectedPlayers = gameData.players.filter(p => p.connected);
        if (connectedPlayers.length > 0) {
            gameData.keyHolderId = connectedPlayers[0].id;
        }
        
        console.log('ゲーム開始処理完了:', {
            playerCount,
            keyHolder: connectedPlayers[0]?.name
        });
        
    } catch (error) {
        console.error('ゲーム開始ロジックエラー:', error);
        // フォールバック処理
        gameData.players.forEach((player, index) => {
            player.role = index % 2 === 0 ? 'adventurer' : 'guardian';
            player.hand = [];
        });
        gameData.keyHolderId = gameData.players.find(p => p.connected)?.id;
    }
}

// 🔧 勝利条件チェック関数（修正版）
function checkWinConditions(gameData) {
    console.log('🏆 勝利条件チェック開始');
    
    // 探検家チームの勝利：すべての財宝を発見
    if (gameData.treasureFound >= gameData.treasureGoal) {
        gameData.gameState = 'finished';
        gameData.winningTeam = 'adventurer';
        gameData.victoryMessage = `全ての子豚を救出しました！探検家チームの勝利です！`;
        console.log('🎉 探検家チーム勝利！');
        return { team: 'adventurer', reason: 'all_treasures_found' };
    }
    
    // 豚男チームの勝利：すべての罠を発動
    if (gameData.trapTriggered >= gameData.trapGoal) {
        gameData.gameState = 'finished';
        gameData.winningTeam = 'guardian';
        gameData.victoryMessage = `すべての罠が発動しました！豚男チームの勝利です！`;
        console.log('🎉 豚男チーム勝利！');
        return { team: 'guardian', reason: 'all_traps_triggered' };
    }
    
    console.log('🔄 勝利条件未達成、ゲーム継続');
    return null;
}

// 🔧 ラウンド進行処理（新規作成）
function advanceToNextRound(gameData, connectedPlayerCount) {
    console.log('📋 ===== ラウンド進行処理開始 =====');
    
    // カード公開数をリセット
    gameData.cardsFlippedThisRound = 0;
    
    // ラウンドを進める
    gameData.currentRound++;
    console.log(`📈 ラウンド進行: ${gameData.currentRound - 1} → ${gameData.currentRound}`);
    
    // 最大ラウンド到達チェック
    if (gameData.currentRound > gameData.maxRounds) {
        console.log('⏰ 最大ラウンド到達！豚男チームの勝利');
        gameData.gameState = 'finished';
        gameData.winningTeam = 'guardian';
        gameData.victoryMessage = `${gameData.maxRounds}ラウンドが終了しました！豚男チームの勝利です！`;
        return { gameEnded: true, reason: 'max_rounds_reached' };
    }
    
    console.log(`🆕 ラウンド ${gameData.currentRound} 開始準備完了`);
    return { newRound: gameData.currentRound, gameEnded: false };
}

// 🔧 カード再配布処理（簡易版）
function redistributeCards(gameData) {
    console.log('🃏 ===== カード再配布処理開始 =====');
    
    try {
        // 全プレイヤーのカードをリセット
        gameData.players.forEach((player) => {
            if (player.connected) {
                console.log(`${player.name} のカードをリセット`);
                player.hand = [];
                
                // 新しいカードを配布（簡易版）
                for (let i = 0; i < gameData.cardsPerPlayer; i++) {
                    const cardType = Math.random() < 0.3 ? 'treasure' : 
                                   Math.random() < 0.1 ? 'trap' : 'empty';
                    player.hand.push({
                        type: cardType,
                        id: `${cardType}-${player.id}-R${gameData.currentRound}-${i}`,
                        revealed: false
                    });
                }
                
                console.log(`${player.name} に ${player.hand.length} 枚のカードを配布`);
            }
        });
        
        // 最初のプレイヤーに鍵を渡す（ラウンド開始時）
        const connectedPlayers = gameData.players.filter(p => p.connected);
        if (connectedPlayers.length > 0) {
            const firstPlayer = connectedPlayers[0];
            gameData.keyHolderId = firstPlayer.id;
            console.log(`🗝️ ラウンド ${gameData.currentRound} の最初の鍵保持者: ${firstPlayer.name}`);
        }
        
        console.log('✅ カード再配布完了');
        
    } catch (error) {
        console.error('❌ カード再配布エラー:', error);
        
        // エラー時のフォールバック処理
        gameData.players.forEach((player) => {
            if (player.connected) {
                player.hand = [];
                for (let i = 0; i < 5; i++) {
                    player.hand.push({
                        type: 'empty',
                        id: `empty-${player.id}-fallback-${i}`,
                        revealed: false
                    });
                }
            }
        });
    }
}

// プレイヤー処理関数
function handlePlayerTempLeave(socket, io) {
    if (!socket.roomId) return;
    
    const roomData = activeRooms.get(socket.roomId);
    if (!roomData) return;
    
    // プレイヤーを切断状態に
    const player = roomData.gameData.players.find(p => p.id === socket.id);
    if (player) {
        player.connected = false;
        player.lastDisconnected = Date.now();
        console.log(`${player.name} が一時退出しました`);
    }
    
    // ルーム内の他のプレイヤーに更新を送信
    io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
    
    // ルーム一覧更新
    broadcastRoomList(io);
}

function handlePlayerLeave(socket, io) {
    if (!socket.roomId) return;
    
    const roomData = activeRooms.get(socket.roomId);
    if (!roomData) return;
    
    // プレイヤーを完全に削除
    roomData.gameData.players = roomData.gameData.players.filter(p => p.id !== socket.id);
    
    console.log(`プレイヤー ${socket.playerName} (${socket.id}) をルーム ${socket.roomId} から完全削除`);
    
    // ホストが退出した場合、次のプレイヤーをホストに
    if (roomData.gameData.host === socket.id) {
        const nextHost = roomData.gameData.players.find(p => p.connected);
        if (nextHost) {
            roomData.gameData.host = nextHost.id;
            console.log(`新しいホスト: ${nextHost.name}`);
        }
    }
    
    // 全員が退出した場合、ルームを削除
    if (roomData.gameData.players.length === 0) {
        activeRooms.delete(socket.roomId);
        console.log('空のルームを削除:', socket.roomId);
    } else {
        // ルーム内の他のプレイヤーに更新を送信
        io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
    }
    
    // ルーム一覧更新
    broadcastRoomList(io);
}

function handlePlayerDisconnect(socket, io) {
    if (!socket.roomId) return;
    
    const roomData = activeRooms.get(socket.roomId);
    if (!roomData) return;
    
    // プレイヤーを切断状態に（削除はしない）
    const player = roomData.gameData.players.find(p => p.id === socket.id);
    if (player) {
        player.connected = false;
        player.lastDisconnected = Date.now();
        console.log(`${player.name} が切断しました`);
    }
    
    // 全員が切断した場合、ルームを削除
    if (roomData.gameData.players.every(p => !p.connected)) {
        activeRooms.delete(socket.roomId);
        console.log('全員切断のためルームを削除:', socket.roomId);
    } else {
        // ルーム内の他のプレイヤーに更新を送信
        io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
    }
    
    // ルーム一覧更新
    broadcastRoomList(io);
}

// 定期的なルーム整理（30分ごと）
setInterval(() => {
    console.log('🧹 定期的なルーム整理実行');
    const now = Date.now();
    const roomsToDelete = [];
    
    for (const [roomId, roomData] of activeRooms) {
        // 全員が切断して30分以上経過したルームを削除
        if (roomData.gameData.players.every(p => !p.connected)) {
            const lastActivity = roomData.lastActivity || roomData.createdAt || now;
            if (now - lastActivity > 30 * 60 * 1000) { // 30分
                roomsToDelete.push(roomId);
            }
        }
        
        // 作成から24時間経過したルームを削除
        const createdAt = roomData.createdAt || now;
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

// 統計情報の取得
function getServerStats() {
    const totalRooms = activeRooms.size;
    const waitingRooms = Array.from(activeRooms.values()).filter(r => r.gameData.gameState === 'waiting').length;
    const playingRooms = Array.from(activeRooms.values()).filter(r => r.gameData.gameState === 'playing').length;
    const finishedRooms = Array.from(activeRooms.values()).filter(r => r.gameData.gameState === 'finished').length;
    
    const totalPlayers = Array.from(activeRooms.values()).reduce((sum, roomData) => {
        return sum + getConnectedPlayerCount(roomData);
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
    
    // 各ルームの詳細情報も出力
    for (const [roomId, roomData] of activeRooms) {
        const playerInfo = roomData.gameData.players.map(p => ({
            id: p.id.slice(-4), // IDの最後4文字のみ表示
            name: p.name,
            connected: p.connected
        }));
        console.log(`ルーム ${roomId}: プレイヤー数 ${roomData.gameData.players.length}, 接続中 ${getConnectedPlayerCount(roomData)}`);
        console.log('  プレイヤー:', playerInfo);
    }
}, 5 * 60 * 1000); // 5分ごと

// デバッグ用のエクスポート関数
function getDebugInfo() {
    const rooms = Array.from(activeRooms.entries()).map(([id, roomData]) => ({
        id,
        gameState: roomData.gameData.gameState,
        playerCount: roomData.gameData.players.length,
        connectedCount: getConnectedPlayerCount(roomData),
        host: roomData.gameData.players.find(p => p.id === roomData.gameData.host)?.name || '不明',
        players: roomData.gameData.players.map(p => ({
            id: p.id.slice(-4),
            name: p.name,
            connected: p.connected
        }))
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
    const roomData = Array.from(activeRooms.entries()).map(([id, roomData]) => ({
        id,
        playerCount: roomData.gameData.players.length,
        gameState: roomData.gameData.gameState,
        players: roomData.gameData.players.map(p => ({ name: p.name, connected: p.connected }))
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
    getServerStats
};
