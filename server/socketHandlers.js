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
        setupGameHandlers(io, socket, activeRooms);  // 統合版ゲームハンドラー
        
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

// 🔧 【統合修正】ゲームハンドラー（全ゲーム機能を統合）
function setupGameHandlers(io, socket, activeRooms) {
    
    // 🔧 【ロビー復帰・連戦機能】
    
    // ロビーに戻る
    socket.on('returnToLobby', () => {
        console.log('🏠 ロビー復帰要求:', socket.id);
        
        if (!socket.roomId) {
            socket.emit('error', { message: 'ルームに参加していません' });
            return;
        }
        
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
            
            // ルーム一覧を更新（待機中ルームとして表示）
            broadcastRoomList(io);
            
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
            
            // ゲーム関連データをリセット
            resetGameData(room.gameData);
            
            // 新しいゲームを初期化
            const gameInitData = initializeGameData(connectedCount);
            Object.assign(room.gameData, gameInitData);
            
            const connectedPlayers = room.gameData.players.filter(p => p.connected);
            
            // 役職を再割り当て
            connectedPlayers.forEach((player, index) => {
                player.role = gameInitData.assignedRoles[index];
                console.log(`${player.name} → ${player.role}`);
            });
            
            // カードを再配布
            const round1CardsPerPlayer = getCardsPerPlayerForRound(1);
            const { playerHands } = distributeCards(
                gameInitData.allCards, 
                connectedCount, 
                round1CardsPerPlayer
            );
            
            connectedPlayers.forEach((player, index) => {
                player.hand = playerHands[index] || [];
                console.log(`${player.name} に ${player.hand.length} 枚配布`);
            });
            
            // 初期鍵保持者を設定
           // 🔧 【修正】連戦時も初期鍵保持者をランダムに選択
if (connectedPlayers.length > 0) {
    const randomIndex = Math.floor(Math.random() * connectedPlayers.length);
    const randomPlayer = connectedPlayers[randomIndex];
    room.gameData.keyHolderId = randomPlayer.id;
    console.log(`🗝️ 連戦初期鍵保持者: ${randomPlayer.name} (ランダム選択)`);
}

// 🔧 【追加】lastTargetedPlayerIdを初期化
room.gameData.lastTargetedPlayerId = null;
            
            room.gameData.gameState = 'playing';
            room.gameData.cardsPerPlayer = round1CardsPerPlayer;
            
            // 連戦開始のゲームログ
            const restartLogMessage = {
                type: 'game-log',
                text: `🔄 連戦開始！新しいゲームが始まります！`,
                timestamp: Date.now()
            };
            
            if (!room.gameData.messages) {
                room.gameData.messages = [];
            }
            room.gameData.messages.push(restartLogMessage);
            
            // 全員に更新を送信
            io.to(socket.roomId).emit('gameUpdate', room.gameData);
            io.to(socket.roomId).emit('newMessage', room.gameData.messages);
            io.to(socket.roomId).emit('roundStart', 1);
            
            // ルーム一覧を更新
            broadcastRoomList(io);
            
            console.log(`✅ ルーム ${socket.roomId} で連戦開始完了`);
            
        } catch (error) {
            console.error('❌ 連戦開始エラー:', error);
            socket.emit('error', { message: '連戦開始に失敗しました: ' + error.message });
        }
    });

    // 🔧 【カード選択処理】
    
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

            // 🔧 【重要】最後にカードをめくられたプレイヤーを記録
            room.gameData.lastTargetedPlayerId = data.targetPlayerId;
            
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
            if (room.gameData.messages.length > 100) {
            room.gameData.messages = room.gameData.messages.slice(-100);
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
            
            // 🔧 【修正】ラウンド終了チェックと進行処理（3秒遅延追加）
            if (room.gameData.cardsFlippedThisRound >= connectedPlayerCount) {
                console.log('📋 ラウンド終了条件達成');
                
                // 🔧 【追加】ラウンド終了告知を送信
                const currentRoundEndMessage = {
                    type: 'game-log',
                    text: `🎯 ラウンド${room.gameData.currentRound}終了！3秒後に次のラウンドが開始されます...`,
                    timestamp: Date.now()
                };
                
                room.gameData.messages.push(currentRoundEndMessage);
                if (room.gameData.messages.length > 100) {
        room.gameData.messages = room.gameData.messages.slice(-100);
    }

                
                // ラウンド終了をクライアントに送信
                io.to(socket.roomId).emit('newMessage', room.gameData.messages);
                io.to(socket.roomId).emit('gameUpdate', room.gameData);
                
                // 🔧 【追加】3秒の遅延後にラウンド進行処理
                setTimeout(() => {
                    console.log('⏰ 3秒経過 - ラウンド進行処理開始');
                    
                    try {
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
                                if (room.gameData.messages.length > 100) {
        room.gameData.messages = room.gameData.messages.slice(-100);
    }

                                
                                io.to(socket.roomId).emit('newMessage', room.gameData.messages);
                            } else {
                                console.error('❌ カードリサイクル失敗:', recycleResult.error);
                            }
                        }
                        
                        // ラウンド開始イベントを送信（3秒遅延後）
                        io.to(socket.roomId).emit('roundStart', roundResult.newRound);
                        
                        // 🔧 【修正】新ラウンドの鍵保持者を正しく設定
                        // 最後にカードをめくられたプレイヤーに鍵を渡す
                        if (room.gameData.lastTargetedPlayerId) {
                        const lastTargetedPlayer = room.gameData.players.find(p => p.id === room.gameData.lastTargetedPlayerId);
                        if (lastTargetedPlayer && lastTargetedPlayer.connected) {
                        room.gameData.keyHolderId = room.gameData.lastTargetedPlayerId;
                        console.log(`🗝️ 新ラウンドの鍵保持者: ${lastTargetedPlayer.name} (最後にめくられたプレイヤー)`);
                        } else {
        // フォールバック：最後にめくられたプレイヤーが切断している場合
        const firstConnectedPlayer = room.gameData.players.find(p => p.connected);
        if (firstConnectedPlayer) {
            room.gameData.keyHolderId = firstConnectedPlayer.id;
            console.log(`🗝️ フォールバック鍵保持者: ${firstConnectedPlayer.name} (最初の接続プレイヤー)`);
        }
    }
} else {
    // フォールバック：lastTargetedPlayerIdが記録されていない場合
    const firstConnectedPlayer = room.gameData.players.find(p => p.connected);
    if (firstConnectedPlayer) {
        room.gameData.keyHolderId = firstConnectedPlayer.id;
        console.log(`🗝️ フォールバック鍵保持者: ${firstConnectedPlayer.name} (記録なしのため最初の接続プレイヤー)`);
    }
}

// 🔧 【重要】lastTargetedPlayerIdをクリア（次ラウンド用）
room.gameData.lastTargetedPlayerId = null;
                        
                        // 全員に更新を送信
                        io.to(socket.roomId).emit('gameUpdate', room.gameData);
                        
                        console.log(`🆕 ラウンド ${roundResult.newRound} 開始完了（3秒遅延後）`);
                        
                    } catch (error) {
                        console.error('❌ 遅延ラウンド進行エラー:', error);
                        // エラー時も続行
                        io.to(socket.roomId).emit('gameUpdate', room.gameData);
                    }
                    
                }, 3000); // 🔧 【重要】3秒（3000ミリ秒）の遅延
                
                // 🔧 【重要】ここでreturnして、通常のターン進行をスキップ
                return;
                
            } else {
                // 通常のターン進行：次のプレイヤーに鍵を渡す
                passKeyToNextPlayer(room.gameData, data.targetPlayerId);
                
                // 全員に更新を送信
                io.to(socket.roomId).emit('gameUpdate', room.gameData);
            }
            
        } catch (error) {
            console.error('カード選択エラー:', error);
            socket.emit('error', { message: 'カード選択に失敗しました: ' + error.message });
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
    
    // 🔧 【追加】最後にターゲットされたプレイヤーIDもリセット
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
    
    // 🔧 【修正】ルーム参加処理（正しい実装）
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
        
        // 🔧 【修正】パスワードチェック
        if (roomData.gameData.password && roomData.gameData.password !== password) {
            socket.emit('error', { message: 'パスワードが正しくありません' });
            return;
        }
        
        // 🔧 【修正】ゲーム状態チェック
        if (roomData.gameData.gameState !== 'waiting') {
            socket.emit('error', { message: 'このルームはゲーム中です。観戦モードで参加してください。' });
            return;
        }
        
        // 🔧 【修正】重複参加チェック
        if (isPlayerInRoom(roomData, socket.id)) {
            console.warn(`⚠️ Socket ${socket.id} は既にルームに参加済み`);
            socket.emit('error', { message: '既にこのルームに参加しています' });
            return;
        }
        
        // 🔧 【修正】名前重複チェック
        if (isPlayerNameActiveInRoom(roomData, playerName)) {
            console.warn(`⚠️ プレイヤー名 "${playerName}" は既に使用中`);
            socket.emit('error', { 
                message: `プレイヤー名 "${playerName}" は既に使用されています` 
            });
            return;
        }
        
        // 🔧 【修正】満員チェック
        const connectedCount = getConnectedPlayerCount(roomData);
        if (connectedCount >= 10) {
            socket.emit('error', { message: 'ルームが満員です' });
            return;
        }
        
        try {
            let player = findDisconnectedPlayerByName(roomData, playerName);
            
            if (player) {
                // 再接続処理
                console.log(`${playerName} が再接続します`);
                player.id = socket.id;
                player.connected = true;
                player.lastConnected = Date.now();
            } else {
                // 新規参加処理
                console.log(`${playerName} が新規参加します`);
                player = createPlayer(socket.id, playerName);
                roomData.gameData.players.push(player);
            }
            
            // ソケット情報設定
            socket.join(roomId);
            socket.roomId = roomId;
            socket.playerName = playerName;
            
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
            broadcastRoomList(io);
            
            console.log(`✅ ${playerName} がルーム ${roomId} に参加完了`);
            
        } catch (error) {
            console.error('❌ ルーム参加エラー:', error);
            socket.emit('error', { message: 'ルーム参加に失敗しました: ' + error.message });
        }
    });
    
    // 🔧 【修正】ゲーム開始処理（正しい実装）
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
        
        // 🔧 【修正】ホスト権限チェック
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
            
            // 🔧 【修正】初期鍵保持者をランダムに選択（ホスト固定を避ける）
if (connectedPlayers.length > 0) {
    const randomIndex = Math.floor(Math.random() * connectedPlayers.length);
    const randomPlayer = connectedPlayers[randomIndex];
    roomData.gameData.keyHolderId = randomPlayer.id;
    console.log(`🗝️ 初期鍵保持者: ${randomPlayer.name} (ランダム選択)`);
}

// 🔧 【追加】lastTargetedPlayerIdを初期化
roomData.gameData.lastTargetedPlayerId = null;
            
            roomData.gameData.gameState = 'playing';
            roomData.gameData.cardsPerPlayer = round1CardsPerPlayer;
            
            console.log('📊 ゲーム開始時の状態:', {
                playerCount: connectedCount,
                treasureGoal: roomData.gameData.treasureGoal,
                trapGoal: roomData.gameData.trapGoal,
                cardsPerPlayer: roomData.gameData.cardsPerPlayer,
                currentRound: roomData.gameData.currentRound,
                maxRounds: roomData.gameData.maxRounds,
                keyHolder: roomData.gameData.players.find(p => p.id === roomData.gameData.keyHolderId)?.name
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
    // 🔧 【修正】再入場処理（ゲーム中でも参加可能に）
socket.on('rejoinRoom', (data) => {
    console.log('🔄 再入場要求:', data);
    const { roomId, playerName } = data;
    
    // バリデーション
    if (!roomId || !playerName) {
        socket.emit('error', { message: 'ルームIDとプレイヤー名を入力してください' });
        return;
    }
    
    const roomData = activeRooms.get(roomId.trim().toUpperCase());
    if (!roomData) {
        socket.emit('error', { message: 'ルームが見つかりません' });
        return;
    }
    
    // 🔧 【重要】ゲーム中でも再入場を許可
    const existingPlayer = findPlayerByName(roomData, playerName.trim());
    if (!existingPlayer) {
        socket.emit('error', { message: 'このルームにあなたのデータが見つかりません' });
        return;
    }
    
    // 🔧 【修正】既に接続中でも強制的に再接続を許可（重複接続対策）
    if (existingPlayer.connected) {
        console.log(`⚠️ ${playerName} は既に接続中ですが、強制再接続します`);
        // 既存の接続を切断状態にする
        existingPlayer.connected = false;
    }
    
    try {
        // 再接続処理
        existingPlayer.id = socket.id;
        existingPlayer.connected = true;
        existingPlayer.lastConnected = Date.now();
        
        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerName = playerName.trim();
        
        // 🔧 【修正】ホスト判定を正確に
        const isHost = roomData.gameData.host === socket.id;
        
        socket.emit('rejoinSuccess', {
            roomId: roomId,
            gameData: roomData.gameData,
            isHost: isHost,
            playerInfo: {
                roomId: roomId,
                playerName: playerName.trim(),
                isHost: isHost
            }
        });
        
        // ルーム内の全員に更新を送信
        io.to(roomId).emit('gameUpdate', roomData.gameData);
        
        console.log(`✅ ${playerName} がルーム ${roomId} に再入場完了（ゲーム状態: ${roomData.gameData.gameState}）`);
        
    } catch (error) {
        console.error('❌ 再入場処理エラー:', error);
        socket.emit('error', { message: '再入場に失敗しました: ' + error.message });
    }
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
        
        // 🔧 【追加】ホスト変更をクライアントに通知
        const hostChangeMessage = {
            type: 'game-log',
            text: `👑 ${nextHost.name} が新しいホストになりました`,
            timestamp: Date.now()
        };
        
        if (!roomData.gameData.messages) {
            roomData.gameData.messages = [];
        }
        roomData.gameData.messages.push(hostChangeMessage);
        
        // ホスト変更をルーム内全員に送信
        io.to(socket.roomId).emit('hostChanged', {
            newHostId: nextHost.id,
            newHostName: nextHost.name
        });
        io.to(socket.roomId).emit('newMessage', roomData.gameData.messages);
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
        console.log(`${player.name} が切断しました（復帰可能状態で保持）`);
        
        // 🔧 【修正】ゲーム中の場合は切断されたプレイヤー情報を送信
        if (roomData.gameData.gameState === 'playing') {
            const disconnectedNames = roomData.gameData.players
                .filter(p => !p.connected)
                .map(p => p.name);
            
            io.to(socket.roomId).emit('waitingForReconnect', {
                disconnectedPlayers: disconnectedNames,
                message: `${player.name} が切断されました。復帰をお待ちください。`
            });
        }
    }
    
    // 🔧 【修正】全員が切断した場合のみルーム削除（猶予時間付き）
    if (roomData.gameData.players.every(p => !p.connected)) {
        console.log(`⏰ 全員切断 - ルーム ${socket.roomId} を10分後に削除予定`);
        
        // 10分の猶予時間を設ける
        setTimeout(() => {
            const currentRoom = activeRooms.get(socket.roomId);
            if (currentRoom && currentRoom.gameData.players.every(p => !p.connected)) {
                activeRooms.delete(socket.roomId);
                console.log(`🗑️ ルーム ${socket.roomId} を削除（10分間復帰なし）`);
            }
        }, 10 * 60 * 1000); // 10分
    } else {
        // 他に接続中のプレイヤーがいる場合は更新を送信
        io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
    }
    
    broadcastRoomList(io);
}

// エクスポート
module.exports = { 
    setupSocketHandlers
};
