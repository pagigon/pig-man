// 簡易ルーム管理
const activeRooms = new Map();

function setupSocketHandlers(io) {
    console.log('🚀 Socket.io ハンドラー設定開始（修正版）');
    
    io.on('connection', (socket) => {
        console.log('✅ 新しい接続確認:', socket.id);
        
        // 接続直後にルーム一覧を送信
        const roomList = Array.from(activeRooms.values()).map(room => ({
            id: room.id,
            hostName: room.hostName,
            playerCount: room.players.length,
            hasPassword: false
        }));
        socket.emit('roomList', roomList);
        
        // ルーム一覧要求
        socket.on('getRoomList', () => {
            console.log('📋 ルーム一覧要求受信:', socket.id);
            const roomList = Array.from(activeRooms.values()).map(room => ({
                id: room.id,
                hostName: room.hostName,
                playerCount: room.players.length,
                hasPassword: false
            }));
            socket.emit('roomList', roomList);
        });
        
        // ルーム作成
        socket.on('createRoom', (data) => {
            console.log('🏠 ===== ルーム作成要求受信 =====');
            console.log('Socket ID:', socket.id);
            console.log('データ:', JSON.stringify(data, null, 2));
            
            try {
                const roomId = 'PIG' + Date.now().toString().slice(-4);
                console.log('生成ルームID:', roomId);
                
                const gameData = {
                    id: roomId,
                    players: [{
                        id: socket.id,
                        name: data.playerName || 'テストプレイヤー',
                        connected: true,
                        role: null,
                        hand: []
                    }],
                    gameState: 'waiting',
                    host: socket.id,
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
                    maxRounds: 4
                };
                
                // ルームを保存
                activeRooms.set(roomId, {
                    id: roomId,
                    hostName: data.playerName || 'テストプレイヤー',
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
                        playerName: data.playerName || 'テストプレイヤー',
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
            console.log('👥 ルーム参加要求:', data);
            const { roomId, playerName } = data;
            
            const room = activeRooms.get(roomId);
            if (!room) {
                socket.emit('error', { message: 'ルームが見つかりません' });
                return;
            }
            
            // ゲーム状態チェック
            if (room.gameData.gameState !== 'waiting') {
                socket.emit('error', { message: 'このルームはゲーム中です。観戦モードで参加してください。' });
                return;
            }
            
            // 重複チェック：同じ名前のプレイヤーが既に存在するか
            const existingPlayer = room.players.find(p => p.name === playerName);
            if (existingPlayer && existingPlayer.connected) {
                socket.emit('error', { message: `プレイヤー名 "${playerName}" は既に使用されています` });
                return;
            }
            
            // 同じSocketIDが既に存在するかチェック
            const existingSocket = room.players.find(p => p.id === socket.id);
            if (existingSocket) {
                socket.emit('error', { message: '既にこのルームに参加しています' });
                return;
            }
            
            // 最大プレイヤー数チェック
            if (room.players.filter(p => p.connected).length >= 10) {
                socket.emit('error', { message: 'ルームが満員です' });
                return;
            }
            
            // 既存の切断プレイヤーを再接続として処理
            if (existingPlayer && !existingPlayer.connected) {
                existingPlayer.id = socket.id;
                existingPlayer.connected = true;
                console.log(`${playerName} が再接続しました`);
            } else {
                // 新しいプレイヤーを追加
                const newPlayer = {
                    id: socket.id,
                    name: playerName,
                    connected: true,
                    role: null,
                    hand: []
                };
                room.players.push(newPlayer);
                room.gameData.players.push(newPlayer);
            }
            
            socket.join(roomId);
            socket.roomId = roomId;
            socket.playerName = playerName;
            
            socket.emit('joinSuccess', {
                roomId: roomId,
                gameData: room.gameData,
                playerInfo: {
                    roomId: roomId,
                    playerName: playerName,
                    isHost: false
                }
            });
            
            // ルーム内の全員に更新を送信
            io.to(roomId).emit('gameUpdate', room.gameData);
            
            // ルーム一覧更新
            updateRoomList(io);
            
            console.log(`${playerName} がルーム ${roomId} に参加`);
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
            
            // ターンチェック
            if (room.gameData.keyHolderId !== socket.id) {
                socket.emit('error', { message: 'あなたのターンではありません' });
                return;
            }
            
            try {
                // カード選択処理（簡易版）
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
        
        // ルーム退出
        socket.on('leaveRoom', () => {
            console.log('🚪 ルーム退出:', socket.id);
            handlePlayerLeave(socket, io);
        });
        
        // 切断イベント
        socket.on('disconnect', (reason) => {
            console.log('🔌 切断:', socket.id, 'reason:', reason);
            handlePlayerLeave(socket, io);
        });
        
        console.log('🎯 イベントハンドラー登録完了:', socket.id);
    });
    
    console.log('🏁 Socket.io ハンドラー設定完了');
}

// ゲーム開始ロジック（簡易版）
function startGameLogic(gameData, playerCount) {
    const { assignRoles, generateAllCards, distributeCards, calculateVictoryGoal } = require('./gameLogic');
    
    // 役職割り当て
    const roles = assignRoles(playerCount);
    gameData.players.forEach((player, index) => {
        player.role = roles[index];
    });
    
    // カード生成と配布
    const { cards, treasureCount, trapCount } = generateAllCards(playerCount);
    const { playerHands } = distributeCards(cards, playerCount, 5);
    
    // 各プレイヤーにカードを配布
    gameData.players.forEach((player, index) => {
        player.hand = playerHands[index] || [];
    });
    
    // 勝利条件設定
    const { treasureGoal, trapGoal } = calculateVictoryGoal(playerCount);
    gameData.treasureGoal = treasureGoal;
    gameData.trapGoal = trapGoal;
    gameData.totalTreasures = treasureCount;
    gameData.totalTraps = trapCount;
    
    // 最初のプレイヤーに鍵を渡す
    gameData.keyHolderId = gameData.players[0].id;
    
    console.log('ゲーム開始処理完了:', {
        playerCount,
        treasureGoal,
        trapGoal,
        keyHolder: gameData.players[0].name
    });
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
    if (gameData.cardsFlippedThisRound >= gameData.players.length) {
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

// プレイヤー退出処理
function handlePlayerLeave(socket, io) {
    if (!socket.roomId) return;
    
    const room = activeRooms.get(socket.roomId);
    if (!room) return;
    
    // プレイヤーを切断状態に
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
        player.connected = false;
    }
    
    // ホストが退出した場合、次のプレイヤーをホストに
    if (room.gameData.host === socket.id) {
        const nextHost = room.players.find(p => p.connected && p.id !== socket.id);
        if (nextHost) {
            room.gameData.host = nextHost.id;
            console.log(`新しいホスト: ${nextHost.name}`);
        }
    }
    
    // 全員が切断した場合、ルームを削除
    if (room.players.every(p => !p.connected)) {
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
            hasPassword: false
        }));
    
    io.emit('roomList', roomList);
    console.log('📋 ルーム一覧更新送信完了, ルーム数:', roomList.length);
}

module.exports = { setupSocketHandlers };
