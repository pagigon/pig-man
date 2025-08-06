// server/socketHandlers.js - インポート修正版（先頭部分のみ置き換え）

// 🔧 【修正】正しいインポート方法
const gameLogic = require('./game/game-Logic');

// 個別に関数を取得
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
    correctCardRecycleSystem
} = gameLogic;

// デバッグ用：インポート確認
console.log('🔧 game-Logic.js インポート確認:', {
    generateRoomId: typeof generateRoomId,
    advanceToNextRound: typeof advanceToNextRound,
    correctCardRecycleSystem: typeof correctCardRecycleSystem
});

// 🔧 【修正】個別ハンドラーを統合して循環参照を回避
const { setupChatHandlers } = require('./handlers/chat-handlers');

const activeRooms = new Map();
const socketRequestHistory = new Map();

function setupSocketHandlers(io) {
    console.log('🚀 Socket.io ハンドラー設定開始（完全修正統合版）');

    io.on('connection', (socket) => {
        console.log('✅ 新しい接続確認:', socket.id);

        // 🔧 【修正】各種ハンドラーを activeRooms を共有して設定
        setupChatHandlers(io, socket, activeRooms);
        setupGameHandlers(io, socket, activeRooms);  // この関数内で定義
        
        // Socket毎の要求履歴を初期化
        socketRequestHistory.set(socket.id, {
            lastJoinRequest: 0,
            lastCreateRequest: 0,
            requestCooldown: 3000
        });
        
        // 接続直後にルーム一覧を送信
        setTimeout(() => {
            sendRoomList(socket);
        }, 1000);
        
        // 基本的なルーム操作ハンドラーを設定
        setupRoomHandlers(io, socket);
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
    
    console.log('🏁 Socket.io ハンドラー設定完了（完全修正統合版）');
}

// 🔧 【追加】ゲームハンドラー（activeRoomsを共有）
function setupGameHandlers(io, socket, activeRooms) {
    
    // カード選択
    socket.on('selectCard', (data) => {
        console.log('🃏 カード選択:', data);
        
        if (!socket.roomId) {
            socket.emit('error', { message: 'ルームに参加していません' });
            return;
        }
        
        const room = activeRooms.get(socket.roomId);
        if (!room) {
            console.error('ルームが見つかりません:', socket.roomId);
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }
        
        if (room.gameData.gameState !== 'playing') {
            console.error('ゲーム状態が異常:', room.gameData.gameState);
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

        // プレイヤー切断チェック
        const disconnectedPlayers = room.gameData.players.filter(p => !p.connected);
        if (disconnectedPlayers.length > 0) {
            const disconnectedNames = disconnectedPlayers.map(p => p.name);
            socket.emit('error', { 
                message: `${disconnectedNames.join(', ')} が切断されています。復帰をお待ちください。` 
            });
            
            // 切断プレイヤー情報を送信
            io.to(socket.roomId).emit('waitingForReconnect', {
                disconnectedPlayers: disconnectedNames
            });
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
            room.gameData.cardsFlippedThisRound++;
            
            // 🔧 【修正】ゲームログを直接チャットに追加（循環参照回避）
            const selectorName = room.gameData.players.find(p => p.id === socket.id)?.name || '不明';
            const targetName = targetPlayer.name;
            let logMessage = '';
            
            if (selectedCard.type === 'treasure') {
                room.gameData.treasureFound++;
                logMessage = `🐷 ${selectorName} が ${targetName} のカードを選択 → 子豚発見！ (${room.gameData.treasureFound}/${room.gameData.treasureGoal})`;
            } else if (selectedCard.type === 'trap') {
                room.gameData.trapTriggered++;
                logMessage = `💀 ${selectorName} が ${targetName} のカードを選択 → 罠発動！ (${room.gameData.trapTriggered}/${room.gameData.trapGoal})`;
            } else {
                logMessage = `🏠 ${selectorName} が ${targetName} のカードを選択 → 空き部屋でした`;
            }
            
            // ゲームログをメッセージ配列に直接追加
            if (!room.gameData.messages) {
                room.gameData.messages = [];
            }
            
            const gameLogMessage = {
                type: 'game-log',
                text: logMessage,
                timestamp: Date.now()
            };
            
            room.gameData.messages.push(gameLogMessage);
            
            // 最新20件のみ保持
            if (room.gameData.messages.length > 20) {
                room.gameData.messages = room.gameData.messages.slice(-20);
            }
            
            // メッセージ更新を送信
            io.to(socket.roomId).emit('newMessage', room.gameData.messages);
            console.log(`🎮 ゲームログ: [${socket.roomId}] ${logMessage}`);
            
            // 勝利条件チェック
            const winResult = checkWinConditions(room.gameData);
            if (winResult.ended) {
                room.gameData.gameState = 'finished';
                room.gameData.winningTeam = winResult.winner;
                room.gameData.victoryMessage = winResult.message;
                
                io.to(socket.roomId).emit('gameUpdate', room.gameData);
                console.log(`🏆 ゲーム終了: ${winResult.message}`);
                return;
            }
            
            // 🔧 【追加】ラウンド終了チェックと進行処理
            const connectedPlayerCount = room.gameData.players.filter(p => p.connected).length;
            
            if (room.gameData.cardsFlippedThisRound >= connectedPlayerCount) {
                console.log('📋 ラウンド終了条件達成');
                
                // ラウンド進行処理
                const roundResult = advanceToNextRound(room.gameData, connectedPlayerCount);
                
                if (roundResult.gameEnded) {
                    // 最大ラウンド達成による豚男チーム勝利
                    room.gameData.gameState = 'finished';
                    room.gameData.winningTeam = 'guardian';
                    room.gameData.victoryMessage = roundResult.reason === 'max_rounds_reached' ? 
                        `${room.gameData.maxRounds}ラウンドが終了しました！豚男チームの勝利です！` : 
                        '豚男チームの勝利です！';
                    
                    io.to(socket.roomId).emit('gameUpdate', room.gameData);
                    return;
                }
                
                // 🔧 正しいカードリサイクルシステム実行
                if (roundResult.needsCardRecycle) {
                    const connectedPlayers = room.gameData.players.filter(p => p.connected);
                    const recycleResult = correctCardRecycleSystem(room.gameData, connectedPlayers);
                    
                    if (recycleResult.success) {
                        console.log('♻️ カードリサイクル成功');
                        
                        // リサイクル完了のゲームログ
                        const recycleLogMessage = {
                            type: 'game-log',
                            text: `♻️ ラウンド${roundResult.newRound}開始！全カード回収→残存カード保証→再配布完了（手札${recycleResult.newCardsPerPlayer}枚）`,
                            timestamp: Date.now()
                        };
                        
                        room.gameData.messages.push(recycleLogMessage);
                        if (room.gameData.messages.length > 20) {
                            room.gameData.messages = room.gameData.messages.slice(-20);
                        }
                        
                        io.to(socket.roomId).emit('newMessage', room.gameData.messages);
                    } else {
                        console.error('❌ カードリサイクル失敗:', recycleResult.error);
                    }
                }
                
                // ラウンド開始イベントを送信
                io.to(socket.roomId).emit('roundStart', roundResult.newRound);
                
                // 新ラウンドの最初のプレイヤーに鍵を渡す
                const firstPlayer = room.gameData.players.find(p => p.connected);
                if (firstPlayer) {
                    room.gameData.keyHolderId = firstPlayer.id;
                }
                
                console.log(`🆕 ラウンド ${roundResult.newRound} 開始`);
            } else {
                // 通常のターン進行：次のプレイヤーに鍵を渡す
                passKeyToNextPlayer(room.gameData, data.targetPlayerId);
            }
            
            // 全員に更新を送信
            io.to(socket.roomId).emit('gameUpdate', room.gameData);
            
        } catch (error) {
            console.error('カード選択エラー:', error);
            socket.emit('error', { message: 'カード選択に失敗しました: ' + error.message });
        }
    });
}

// 基本的なルーム操作ハンドラー
function setupRoomHandlers(io, socket) {
    
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
        
        if (history && (now - history.lastCreateRequest) < history.requestCooldown) {
            console.warn(`⚠️ Socket ${socket.id} 作成クールダウン中`);
            socket.emit('error', { 
                message: 'しばらく待ってから再試行してください' 
            });
            return;
        }
        
        if (history) {
            history.lastCreateRequest = now;
        }
        
        console.log('🏠 ===== ルーム作成要求受信 =====');
        console.log('Socket ID:', socket.id);
        console.log('データ:', JSON.stringify(data, null, 2));
        
        if (isPlayerInAnyRoom(socket.id)) {
            socket.emit('error', { 
                message: '既に他のルームに参加しています' 
            });
            return;
        }
        
        try {
            const roomId = generateRoomId();
            console.log('生成ルームID:', roomId);
            
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
            
            const roomData = {
                id: roomId,
                hostName: data.playerName || 'プレイヤー',
                gameData: gameData,
                createdAt: Date.now()
            };
            
            activeRooms.set(roomId, roomData);
            
            socket.join(roomId);
            socket.roomId = roomId;
            socket.playerName = data.playerName;
            console.log('ソケットルーム参加完了:', roomId);
            
            const responseData = {
                roomId: roomId,
                gameData: gameData,
                playerInfo: {
                    roomId: roomId,
                    playerName: data.playerName || 'プレイヤー',
                    isHost: true
                }
            };
            
            socket.emit('roomCreated', responseData);
            console.log('✅ roomCreated イベント送信完了');
            
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
            
            const gameInitData = initializeGameData(connectedCount);
            console.log('ゲーム初期化データ:', gameInitData);
            
            Object.assign(roomData.gameData, gameInitData);
            
            const connectedPlayers = roomData.gameData.players.filter(p => p.connected);
            console.log('接続中プレイヤー:', connectedPlayers.map(p => p.name));
            
            connectedPlayers.forEach((player, index) => {
                player.role = gameInitData.assignedRoles[index];
                console.log(`${player.name} → ${player.role}`);
            });
            
            const round1CardsPerPlayer = getCardsPerPlayerForRound(1);
            console.log(`1ラウンド目: ${round1CardsPerPlayer}枚ずつ配布`);
            
            const { playerHands } = distributeCards(
                gameInitData.allCards, 
                connectedCount, 
                round1CardsPerPlayer
            );
            
            connectedPlayers.forEach((player, index) => {
                player.hand = playerHands[index] || [];
                console.log(`${player.name} に ${player.hand.length} 枚配布`);
            });
            
            if (connectedPlayers.length > 0) {
                roomData.gameData.keyHolderId = connectedPlayers[0].id;
                console.log(`🗝️ 初期鍵保持者: ${connectedPlayers[0].name}`);
            }
            
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
            
            io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
            io.to(socket.roomId).emit('roundStart', 1);
            
            broadcastRoomList(io);
            
            console.log(`✅ ルーム ${socket.roomId} でゲーム開始完了`);
            
        } catch (error) {
            console.error('❌ ゲーム開始エラー:', error);
            socket.emit('error', { message: 'ゲーム開始に失敗しました: ' + error.message });
        }
    });
}

// その他のハンドラー設定
function setupOtherHandlers(socket, io) {
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

// 勝利条件チェック関数
function checkWinConditions(gameData) {
    // 探検家チームの勝利：すべての財宝を発見
    if (gameData.treasureFound >= gameData.treasureGoal) {
        return {
            ended: true,
            winner: 'adventurer',
            reason: 'all_treasures_found',
            message: `全ての子豚（${gameData.treasureGoal}匹）を救出しました！探検家チームの勝利です！`
        };
    }
    
    // 豚男チームの勝利：すべての罠を発動
    if (gameData.trapTriggered >= gameData.trapGoal) {
        return {
            ended: true,
            winner: 'guardian',
            reason: 'all_traps_triggered',
            message: `全ての罠（${gameData.trapGoal}個）が発動しました！豚男チームの勝利です！`
        };
    }
    
    // 豚男チーム勝利：4ラウンド終了
    if (gameData.currentRound > gameData.maxRounds) {
        return {
            ended: true,
            winner: 'guardian',
            reason: 'max_rounds_reached',
            message: `${gameData.maxRounds}ラウンドが終了しました！豚男チームの勝利です！`
        };
    }
    
    return {
        ended: false,
        winner: null,
        reason: null,
        message: null
    };
}

// 鍵を次のプレイヤーに渡す
function passKeyToNextPlayer(gameData, currentTargetId) {
    gameData.keyHolderId = currentTargetId;
    console.log(`🗝️ 鍵を次のプレイヤーに渡しました: ${gameData.players.find(p => p.id === currentTargetId)?.name}`);
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
