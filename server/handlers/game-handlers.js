// server/handlers/game-handlers.js - 画面遷移修正版

function setupGameHandlers(io, socket, socketRequestHistory) {
    // activeRoomsは room-handlers.js から取得
    const { getActiveRooms } = require('./room-handlers');
    const { sendGameLog } = require('./chat-handlers');
    
    // 🔧 【重要修正】game-Logic.js から全ての関数をインポート
    const { 
        initializeGameData, 
        distributeCards, 
        checkGameEndConditions, 
        advanceToNextRound,
        correctCardRecycleSystem  // ⭐ 追加！
    } = require('../game/game-Logic');
    
    // ゲーム開始
    socket.on('startGame', () => {
        console.log('🎮 ゲーム開始要求:', socket.id);
        
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
            socket.emit('error', { message: 'ゲーム開始権限がありません' });
            return;
        }

        const connectedPlayers = room.gameData.players.filter(p => p.connected);
        if (connectedPlayers.length < 3) {
            socket.emit('error', { message: 'ゲーム開始には最低3人必要です' });
            return;
        }

        try {
            // ゲーム初期化
            const gameInitData = initializeGameData(connectedPlayers.length);
            
            // ゲームデータに初期化データを統合
            Object.assign(room.gameData, gameInitData);
            room.gameData.gameState = 'playing';
            
            // 役職をプレイヤーに割り当て
            connectedPlayers.forEach((player, index) => {
                if (gameInitData.assignedRoles && gameInitData.assignedRoles[index]) {
                    player.role = gameInitData.assignedRoles[index];
                }
            });
            
            // カード配布
            const { playerHands } = distributeCards(
                gameInitData.allCards, 
                connectedPlayers.length, 
                gameInitData.cardsPerPlayer || 5
            );
            
            // プレイヤーにカードを割り当て
            connectedPlayers.forEach((player, index) => {
                if (playerHands[index]) {
                    player.hand = playerHands[index];
                }
            });
            
            // 初期手札枚数を設定
            room.gameData.cardsPerPlayer = 5; // 1ラウンド目は5枚
            
            // 最初の鍵保持者をランダムに決定
            const randomIndex = Math.floor(Math.random() * connectedPlayers.length);
            room.gameData.keyHolderId = connectedPlayers[randomIndex].id;
            
            console.log('🎮 ゲーム開始成功');
            
            // 🔧 【重要修正】gameStarted イベントを送信してから他のイベントを送信
            io.to(socket.roomId).emit('gameStarted', room.gameData);
            
            // 少し遅延してから他のイベントを送信（クライアント処理時間を確保）
            setTimeout(() => {
                io.to(socket.roomId).emit('gameUpdate', room.gameData);
                io.to(socket.roomId).emit('roundStart', 1);
            }, 100);
            
            // ゲームログ
            sendGameLog(io, socket.roomId, '🎮 豚小屋探検隊ゲームが開始されました！', activeRooms);
            
        } catch (error) {
            console.error('🎮 ゲーム開始エラー:', error);
            socket.emit('error', { message: 'ゲーム開始に失敗しました' });
        }
    });

    // カード選択処理
    socket.on('selectCard', (data) => {
        console.log('🎯 カード選択:', socket.id, data);
        
        if (!socket.roomId) {
            socket.emit('error', { message: 'ルームに参加していません' });
            return;
        }

        const activeRooms = getActiveRooms();
        const room = activeRooms.get(socket.roomId);
        if (!room || room.gameData.gameState !== 'playing') {
            socket.emit('error', { message: 'ゲームが進行中ではありません' });
            return;
        }

        // 現在の鍵保持者チェック
        if (socket.id !== room.gameData.keyHolderId) {
            socket.emit('error', { message: 'あなたの番ではありません' });
            return;
        }

        // 対象プレイヤーのバリデーション
        const targetPlayer = room.gameData.players.find(p => p.id === data.targetPlayerId);
        if (!targetPlayer) {
            socket.emit('error', { message: '無効な対象プレイヤー' });
            return;
        }

        // 自分を選択できないチェック
        if (data.targetPlayerId === socket.id) {
            socket.emit('error', { message: '自分のカードは選択できません' });
            return;
        }

        // カードインデックスのバリデーション
        if (data.cardIndex < 0 || data.cardIndex >= targetPlayer.hand.length) {
            socket.emit('error', { message: '無効なカードインデックス' });
            return;
        }

        try {
            // 選択されたカードを取得
            const selectedCard = targetPlayer.hand[data.cardIndex];
            if (selectedCard.revealed) {
                socket.emit('error', { message: 'そのカードは既に公開されています' });
                return;
            }

            // カードを公開
            selectedCard.revealed = true;
            
            // ゲーム統計を更新
            if (selectedCard.type === 'treasure') {
                room.gameData.treasureFound = (room.gameData.treasureFound || 0) + 1;
            } else if (selectedCard.type === 'trap') {
                room.gameData.trapTriggered = (room.gameData.trapTriggered || 0) + 1;
            }
            
            room.gameData.cardsFlippedThisRound = (room.gameData.cardsFlippedThisRound || 0) + 1;

            // 鍵を次のプレイヤーに移す
            room.gameData.keyHolderId = targetPlayer.id;
            room.gameData.lastTargetedPlayerId = targetPlayer.id;

            console.log(`🎯 カード公開: ${selectedCard.type}, 鍵移動: ${targetPlayer.name}`);

            // 勝利条件チェック
            const endCheck = checkGameEndConditions(room.gameData);
            if (endCheck.ended) {
                room.gameData.gameState = 'finished';
                room.gameData.winner = endCheck.winner;
                room.gameData.winMessage = endCheck.message;
                
                console.log('🏆 ゲーム終了:', endCheck);
                
                io.to(socket.roomId).emit('gameUpdate', room.gameData);
                io.to(socket.roomId).emit('gameEnded', {
                    winner: endCheck.winner,
                    message: endCheck.message
                });
                
                sendGameLog(io, socket.roomId, `🏆 ${endCheck.message}`, activeRooms);
                return;
            }

            // ラウンド終了チェック
            const connectedPlayerCount = room.gameData.players.filter(p => p.connected).length;
            const maxCardsThisRound = connectedPlayerCount;
            
            if (room.gameData.cardsFlippedThisRound >= maxCardsThisRound) {
                console.log('📋 ラウンド終了条件達成');
                
                // 次ラウンドへ進行
                const roundResult = advanceToNextRound(room.gameData, connectedPlayerCount);
                
                if (roundResult.gameEnded) {
                    room.gameData.gameState = 'finished';
                    room.gameData.winner = 'guardian';
                    room.gameData.winMessage = roundResult.reason === 'max_rounds_reached' ? 
                        `${room.gameData.maxRounds}ラウンドが終了しました！豚男チームの勝利です！` : 
                        '豚男チームの勝利です！';
                    
                    io.to(socket.roomId).emit('gameUpdate', room.gameData);
                    return;
                }
                

                // 【新コード】（上記の既存コードを以下に置き換え）
if (roundResult.needsCardRecycle) {
    // 🆕 【改良】GameManager を活用したカードリサイクル
    const GameManager = require('../game/game-Manager');
    const recycleResult = GameManager.processCardRecycle(socket.roomId, roundResult.newRound);
    
    if (recycleResult.success) {
        console.log('♻️ カードリサイクル成功');
        
        // GameManager側でゲームデータも更新
        GameManager.updateRoundProgress(socket.roomId, {
            currentRound: roundResult.newRound,
            cardsPerPlayer: recycleResult.newCardsPerPlayer
        });
        
        // 既存のログ送信機能を活用（変更なし）
        sendGameLog(io, socket.roomId, 
            `♻️ ラウンド${roundResult.newRound}開始！全カード回収→残存カード保証→再配布完了（手札${recycleResult.newCardsPerPlayer}枚）`, 
            activeRooms
        );
    } else {
        console.error('❌ カードリサイクル失敗:', recycleResult.error);
        // エラーが発生した場合でも処理を継続（既存の安全性を維持）
    }
}
                
                // 新ラウンド開始時にカード選択履歴をクリア
                room.gameData.lastCardSelections = new Map();
                
                // ラウンド開始イベントを送信
                io.to(socket.roomId).emit('roundStart', roundResult.newRound);
                
                // 新ラウンドの鍵保持者を正しく設定
                if (room.gameData.lastTargetedPlayerId) {
                    const lastTargetedPlayer = room.gameData.players.find(p => p.id === room.gameData.lastTargetedPlayerId);
                    if (lastTargetedPlayer && lastTargetedPlayer.connected) {
                        room.gameData.keyHolderId = lastTargetedPlayer.id;
                        console.log(`🗝️ 新ラウンド鍵保持者: ${lastTargetedPlayer.name}`);
                    }
                }
            }

            // ゲーム更新を全員に送信
            io.to(socket.roomId).emit('gameUpdate', room.gameData);
            
            // カード選択イベントを送信
            io.to(socket.roomId).emit('cardSelected', {
                targetPlayerId: data.targetPlayerId,
                cardIndex: data.cardIndex,
                cardType: selectedCard.type,
                newKeyHolder: targetPlayer.id
            });
            
            // ゲームログに記録
            const cardTypeText = selectedCard.type === 'treasure' ? '🐷 子豚' : 
                                selectedCard.type === 'trap' ? '💀 罠' : '🏠 空き部屋';
            sendGameLog(io, socket.roomId, 
                `🎯 ${targetPlayer.name}の部屋を調査 → ${cardTypeText}を発見！`, 
                activeRooms
            );

        } catch (error) {
            console.error('🎯 カード選択エラー:', error);
            socket.emit('error', { message: 'カード選択処理でエラーが発生しました' });
        }
    });

    // 連戦開始
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

        try {
            // ゲーム状態をリセット
            const connectedPlayers = room.gameData.players.filter(p => p.connected);
            
            // ゲーム初期化
            const gameInitData = initializeGameData(connectedPlayers.length);
            
            // 基本情報は保持して、ゲーム関連データのみリセット
            const hostId = room.gameData.host;
            const players = room.gameData.players; // プレイヤー情報は保持
            
            // ゲームデータをリセット
            Object.assign(room.gameData, gameInitData);
            room.gameData.gameState = 'playing';
            room.gameData.host = hostId;
            room.gameData.players = players;
            
            // 役職を再割り当て
            connectedPlayers.forEach((player, index) => {
                if (gameInitData.assignedRoles && gameInitData.assignedRoles[index]) {
                    player.role = gameInitData.assignedRoles[index];
                }
            });
            
            // カード再配布
            const { playerHands } = distributeCards(
                gameInitData.allCards, 
                connectedPlayers.length, 
                gameInitData.cardsPerPlayer || 5
            );
            
            connectedPlayers.forEach((player, index) => {
                if (playerHands[index]) {
                    player.hand = playerHands[index];
                }
            });
            
            // 初期手札枚数を設定
            room.gameData.cardsPerPlayer = 5;
            
            // 鍵保持者をランダムに再決定
            const randomIndex = Math.floor(Math.random() * connectedPlayers.length);
            room.gameData.keyHolderId = connectedPlayers[randomIndex].id;
            
            console.log('🔄 連戦開始成功');
            
            // 🔧 【重要修正】gameRestarted イベントを送信
            io.to(socket.roomId).emit('gameRestarted', room.gameData);
            
            // 少し遅延してから他のイベントを送信
            setTimeout(() => {
                io.to(socket.roomId).emit('gameUpdate', room.gameData);
                io.to(socket.roomId).emit('roundStart', 1);
            }, 100);
            
            sendGameLog(io, socket.roomId, '🔄 連戦開始！新しい豚小屋探検が始まりました！', activeRooms);
            
        } catch (error) {
            console.error('🔄 連戦開始エラー:', error);
            socket.emit('error', { message: '連戦開始に失敗しました' });
        }
    });
}

module.exports = { setupGameHandlers };
