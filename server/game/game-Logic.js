// 恐怖の古代寺院ルール完全対応版 game-Logic.js - カードリサイクル修正

function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'PIG';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// プレイヤー数に応じた役職割り当て（恐怖の古代寺院ルール準拠）
function assignRoles(playerCount) {
    console.log('🎭 役職割り当て開始:', playerCount, '人');
    
    if (!playerCount || playerCount < 3 || playerCount > 10) {
        console.warn('無効なプレイヤー数:', playerCount);
        playerCount = Math.max(3, Math.min(10, playerCount || 3));
    }

    let adventurerCount, guardianCount;
    
    switch(playerCount) {
        case 3:
            // パターン1: 探検家1人、豚男2人 / パターン2: 探検家2人、豚男1人
            if (Math.random() < 0.5) {
                adventurerCount = 1;
                guardianCount = 2;
            } else {
                adventurerCount = 2;
                guardianCount = 1;
            }
            break;
        case 4:
            // パターン1: 探検家3人、豚男1人 / パターン2: 探検家2人、豚男2人
            if (Math.random() < 0.5) {
                adventurerCount = 3;
                guardianCount = 1;
            } else {
                adventurerCount = 2;
                guardianCount = 2;
            }
            break;
        case 5:
            adventurerCount = 3;
            guardianCount = 2;
            break;
        case 6:
            adventurerCount = 4;
            guardianCount = 2;
            break;
        case 7:
            // パターン1: 探検家5人、豚男2人 / パターン2: 探検家4人、豚男3人
            if (Math.random() < 0.5) {
                adventurerCount = 5;
                guardianCount = 2;
            } else {
                adventurerCount = 4;
                guardianCount = 3;
            }
            break;
        case 8:
            // パターン1: 探検家6人、豚男2人 / パターン2: 探検家5人、豚男3人
            if (Math.random() < 0.5) {
                adventurerCount = 6;
                guardianCount = 2;
            } else {
                adventurerCount = 5;
                guardianCount = 3;
            }
            break;
        case 9:
            adventurerCount = 6;
            guardianCount = 3;
            break;
        case 10:
            // パターン1: 探検家7人、豚男3人 / パターン2: 探検家6人、豚男4人
            if (Math.random() < 0.5) {
                adventurerCount = 7;
                guardianCount = 3;
            } else {
                adventurerCount = 6;
                guardianCount = 4;
            }
            break;
        default:
            adventurerCount = Math.ceil(playerCount * 0.6);
            guardianCount = Math.floor(playerCount * 0.4);
    }

    const roles = [];
    
    // 役職を配列に追加
    for (let i = 0; i < adventurerCount; i++) {
        roles.push('adventurer');
    }
    for (let i = 0; i < guardianCount; i++) {
        roles.push('guardian');
    }
    
    // シャッフル
    for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    
    console.log(`役職割り当て完了: 探検家${adventurerCount}人、豚男${guardianCount}人`);
    return roles.slice(0, playerCount);
}

// プレイヤー数に応じたカード生成（恐怖の古代寺院ルール準拠）
function generateAllCards(playerCount) {
    console.log('🃏 カード生成開始:', playerCount, '人用');
    
    if (!playerCount || playerCount < 3 || playerCount > 10) {
        console.warn('無効なプレイヤー数:', playerCount);
        playerCount = Math.max(3, Math.min(10, playerCount || 3));
    }

    let treasureCount, trapCount, emptyCount;

    // 恐怖の古代寺院ルール準拠のカード配分
    switch(playerCount) {
        case 3:
            treasureCount = 5;  // 子豚カード
            trapCount = 2;      // 罠カード
            emptyCount = 8;     // 空き部屋
            break;
        case 4:
            treasureCount = 6;
            trapCount = 2;
            emptyCount = 12;
            break;
        case 5:
            treasureCount = 7;
            trapCount = 2;
            emptyCount = 16;
            break;
        case 6:
            treasureCount = 8;
            trapCount = 2;
            emptyCount = 20;
            break;
        case 7:
            treasureCount = 7;
            trapCount = 2;
            emptyCount = 26;
            break;
        case 8:
            treasureCount = 8;
            trapCount = 2;
            emptyCount = 30;
            break;
        case 9:
            treasureCount = 9;
            trapCount = 2;
            emptyCount = 34;
            break;
        case 10:
            treasureCount = 10;
            trapCount = 3;
            emptyCount = 37;
            break;
        default:
            treasureCount = 7;
            trapCount = 2;
            emptyCount = 16;
    }

    const cards = [];
    
    // 財宝カード（子豚）
    for (let i = 0; i < treasureCount; i++) {
        cards.push({ 
            type: 'treasure', 
            id: `treasure-${i}`, 
            revealed: false 
        });
    }
    
    // 罠カード
    for (let i = 0; i < trapCount; i++) {
        cards.push({ 
            type: 'trap', 
            id: `trap-${i}`, 
            revealed: false 
        });
    }
    
    // 空きカード（空き部屋）
    for (let i = 0; i < emptyCount; i++) {
        cards.push({ 
            type: 'empty', 
            id: `empty-${i}`, 
            revealed: false 
        });
    }
    
    console.log(`カード生成完了: 子豚${treasureCount}枚、罠${trapCount}枚、空き部屋${emptyCount}枚`);
    console.log(`総カード数: ${cards.length}枚`);
    
    return { cards, treasureCount, trapCount };
}

// 配列シャッフル
function shuffleArray(array) {
    if (!Array.isArray(array)) {
        console.warn('シャッフル対象が配列ではありません:', array);
        return [];
    }

    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// ラウンドに応じた手札枚数を計算（恐怖の古代寺院ルール）
function getCardsPerPlayerForRound(round) {
    // 恐怖の古代寺院ルール: 1ラウンド=5枚、2ラウンド=4枚、3ラウンド=3枚、4ラウンド=2枚
    const cardsPerRound = {
        1: 5,
        2: 4,
        3: 3,
        4: 2
    };
    
    return cardsPerRound[round] || 5;
}

// カード配布（ラウンド対応版）
function distributeCards(allCards, playerCount, cardsPerPlayer) {
    console.log('🎴 カード配布開始:', `${playerCount}人に${cardsPerPlayer}枚ずつ`);
    
    if (!Array.isArray(allCards) || allCards.length === 0) {
        console.warn('無効なカード配列:', allCards);
        return { playerHands: {}, remainingCards: [] };
    }

    if (!playerCount || playerCount < 1) {
        console.warn('無効なプレイヤー数:', playerCount);
        return { playerHands: {}, remainingCards: allCards };
    }

    if (!cardsPerPlayer || cardsPerPlayer < 1) {
        console.warn('無効な配布カード数:', cardsPerPlayer);
        cardsPerPlayer = 5; // デフォルト値
    }

    // 必要なカード数を計算
    const totalNeededCards = playerCount * cardsPerPlayer;
    if (allCards.length < totalNeededCards) {
        console.warn(`カード不足: 必要${totalNeededCards}枚、利用可能${allCards.length}枚`);
    }

    const shuffledCards = shuffleArray([...allCards]);
    const playerHands = {};
    
    for (let i = 0; i < playerCount; i++) {
        const hand = shuffledCards.splice(0, cardsPerPlayer);
        playerHands[i] = shuffleArray(hand);
        console.log(`プレイヤー${i}: ${hand.length}枚配布`);
        
        // カードの中身をログ出力（デバッグ用）
        const cardTypes = hand.reduce((acc, card) => {
            acc[card.type] = (acc[card.type] || 0) + 1;
            return acc;
        }, {});
        console.log(`  - 内訳: 子豚${cardTypes.treasure || 0}, 罠${cardTypes.trap || 0}, 空き${cardTypes.empty || 0}`);
    }
    
    console.log(`配布完了: 残りカード${shuffledCards.length}枚`);
    return { playerHands, remainingCards: shuffledCards };
}

// 🔧 修正版：カードリサイクルシステム
function recycleCardsAfterRound(gameData, connectedPlayers) {
    console.log('♻️ ===== カードリサイクル処理開始（修正版） =====');
    console.log(`ラウンド ${gameData.currentRound} 終了後のカード処理`);
    
    try {
        // 1. 公開されたカードの統計を取得
        const revealedStats = getRevealedCardStatistics(connectedPlayers);
        console.log('公開されたカード統計:', revealedStats);
        
        // 2. 各プレイヤーから公開されたカードを除去
        let totalRemovedCards = 0;
        connectedPlayers.forEach((player, index) => {
            const originalHandSize = player.hand.length;
            
            // 公開されていないカードのみ残す
            player.hand = player.hand.filter(card => !card.revealed);
            
            const removedCount = originalHandSize - player.hand.length;
            totalRemovedCards += removedCount;
            
            console.log(`${player.name}: ${removedCount}枚除去, 残り${player.hand.length}枚`);
        });
        
        console.log(`合計除去カード数: ${totalRemovedCards}枚`);
        
        // 3. 次ラウンドの手札枚数を計算
        const nextRoundCardsPerPlayer = getCardsPerPlayerForRound(gameData.currentRound);
        console.log(`次ラウンドの手札枚数: ${nextRoundCardsPerPlayer}枚`);
        
        // 4. 不足分を空き部屋カードで補充
        connectedPlayers.forEach((player, index) => {
            const currentHandSize = player.hand.length;
            const neededCards = nextRoundCardsPerPlayer - currentHandSize;
            
            if (neededCards > 0) {
                // 空き部屋カードを生成して追加
                const emptyCards = generateEmptyCards(neededCards, `${player.id}-r${gameData.currentRound}`);
                player.hand.push(...emptyCards);
                
                console.log(`${player.name}: ${neededCards}枚の空き部屋カードを補充`);
            }
            
            // 5. 各プレイヤーの手札をシャッフル
            player.hand = shuffleArray(player.hand);
            
            console.log(`${player.name}: 最終手札${player.hand.length}枚（シャッフル済み）`);
        });
        
        // 6. ゲームデータの更新
        gameData.cardsPerPlayer = nextRoundCardsPerPlayer;
        
        console.log('✅ カードリサイクル処理完了');
        return {
            success: true,
            removedCards: totalRemovedCards,
            newCardsPerPlayer: nextRoundCardsPerPlayer,
            stats: revealedStats
        };
        
    } catch (error) {
        console.error('❌ カードリサイクル処理エラー:', error);
        
        // エラー時のフォールバック処理
        const nextRoundCardsPerPlayer = getCardsPerPlayerForRound(gameData.currentRound);
        connectedPlayers.forEach((player) => {
            // 全て空き部屋カードで置き換え
            player.hand = generateEmptyCards(nextRoundCardsPerPlayer, `${player.id}-fallback`);
        });
        
        gameData.cardsPerPlayer = nextRoundCardsPerPlayer;
        
        return {
            success: false,
            error: error.message,
            newCardsPerPlayer: nextRoundCardsPerPlayer
        };
    }
}

// 空き部屋カード生成関数
function generateEmptyCards(count, idPrefix = 'empty') {
    const emptyCards = [];
    
    for (let i = 0; i < count; i++) {
        emptyCards.push({
            type: 'empty',
            id: `${idPrefix}-empty-${i}-${Date.now()}`,
            revealed: false
        });
    }
    
    return emptyCards;
}

// 公開カード統計の取得
function getRevealedCardStatistics(players) {
    const stats = {
        treasure: { revealed: 0, total: 0 },
        trap: { revealed: 0, total: 0 },
        empty: { revealed: 0, total: 0 },
        totalRevealed: 0,
        totalCards: 0
    };
    
    if (!Array.isArray(players)) {
        return stats;
    }
    
    players.forEach(player => {
        if (player && Array.isArray(player.hand)) {
            player.hand.forEach(card => {
                if (card && card.type) {
                    stats[card.type].total++;
                    stats.totalCards++;
                    
                    if (card.revealed) {
                        stats[card.type].revealed++;
                        stats.totalRevealed++;
                    }
                }
            });
        }
    });
    
    return stats;
}

// 勝利条件計算
function calculateVictoryGoal(playerCount) {
    if (!playerCount || playerCount < 3 || playerCount > 10) {
        console.warn('無効なプレイヤー数:', playerCount);
        playerCount = Math.max(3, Math.min(10, playerCount || 5));
    }

    let treasureGoal, trapGoal;
    
    // 財宝の勝利条件：全ての財宝を発見する
    switch(playerCount) {
        case 3: treasureGoal = 5; break;
        case 4: treasureGoal = 6; break;
        case 5: treasureGoal = 7; break;
        case 6: treasureGoal = 8; break;
        case 7: treasureGoal = 7; break;
        case 8: treasureGoal = 8; break;
        case 9: treasureGoal = 9; break;
        case 10: treasureGoal = 10; break;
        default: treasureGoal = 7; break;
    }
    
    // 罠の勝利条件：全ての罠を発動させる
    trapGoal = playerCount === 10 ? 3 : 2;
    
    console.log(`勝利条件設定: 財宝${treasureGoal}個、罠${trapGoal}個`);
    
    return { treasureGoal, trapGoal };
}

// ラウンド進行処理（修正版）
function advanceToNextRound(gameData, connectedPlayerCount) {
    console.log('📋 ===== ラウンド進行処理 =====');
    console.log('現在のラウンド:', gameData.currentRound);
    
    // ラウンドを進める
    gameData.currentRound++;
    console.log(`📈 ラウンド進行: ${gameData.currentRound - 1} → ${gameData.currentRound}`);
    
    // 最大ラウンド到達チェック（4ラウンド終了で豚男チーム勝利）
    if (gameData.currentRound > gameData.maxRounds) {
        console.log('⏰ 4ラウンド終了！豚男チームの勝利');
        gameData.gameState = 'finished';
        gameData.winningTeam = 'guardian';
        gameData.victoryMessage = `${gameData.maxRounds}ラウンドが終了しました！豚男チームの勝利です！`;
        return { gameEnded: true, reason: 'max_rounds_reached' };
    }
    
    // 新しいラウンドの手札枚数を設定
    const newCardsPerPlayer = getCardsPerPlayerForRound(gameData.currentRound);
    gameData.cardsPerPlayer = newCardsPerPlayer;
    
    // カード公開数をリセット
    gameData.cardsFlippedThisRound = 0;
    
    console.log(`🆕 ラウンド ${gameData.currentRound} 開始準備完了（手札${newCardsPerPlayer}枚）`);
    return { 
        newRound: gameData.currentRound, 
        gameEnded: false, 
        cardsPerPlayer: newCardsPerPlayer,
        needsCardRecycle: true 
    };
}

// ゲーム終了条件チェック
function checkGameEndConditions(gameData) {
    console.log('🏁 ゲーム終了条件チェック:', {
        treasureFound: gameData.treasureFound,
        treasureGoal: gameData.treasureGoal,
        trapTriggered: gameData.trapTriggered,
        trapGoal: gameData.trapGoal,
        currentRound: gameData.currentRound,
        maxRounds: gameData.maxRounds
    });
    
    // 探検家チーム勝利：全ての財宝を発見
    if (gameData.treasureFound >= gameData.treasureGoal) {
        console.log('🏆 探検家チーム勝利（全財宝発見）');
        return {
            ended: true,
            winner: 'adventurer',
            reason: 'all_treasures_found',
            message: `全ての子豚（${gameData.treasureGoal}匹）を救出しました！探検家チームの勝利です！`
        };
    }
    
    // 豚男チーム勝利：全ての罠を発動
    if (gameData.trapTriggered >= gameData.trapGoal) {
        console.log('🏆 豚男チーム勝利（全罠発動）');
        return {
            ended: true,
            winner: 'guardian',
            reason: 'all_traps_triggered',
            message: `全ての罠（${gameData.trapGoal}個）が発動しました！豚男チームの勝利です！`
        };
    }
    
    // 豚男チーム勝利：4ラウンド終了
    if (gameData.currentRound > gameData.maxRounds) {
        console.log('🏆 豚男チーム勝利（4ラウンド終了）');
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

// ゲームデータ初期化
function initializeGameData(playerCount) {
    console.log('🎮 ゲームデータ初期化:', playerCount, '人（恐怖の古代寺院ルール）');
    
    const { cards, treasureCount, trapCount } = generateAllCards(playerCount);
    const { treasureGoal, trapGoal } = calculateVictoryGoal(playerCount);
    const roles = assignRoles(playerCount);
    
    return {
        // カード情報
        allCards: cards,
        treasureCount: treasureCount,
        trapCount: trapCount,
        totalTreasures: treasureCount,
        totalTraps: trapCount,
        
        // 勝利条件
        treasureGoal: treasureGoal,
        trapGoal: trapGoal,
        
        // 役職
        assignedRoles: roles,
        
        // ゲーム進行（恐怖の古代寺院ルール）
        currentRound: 1,
        maxRounds: 4,  // 4ラウンド制
        cardsPerPlayer: getCardsPerPlayerForRound(1), // 1ラウンド目は5枚
        cardsFlippedThisRound: 0,
        
        // 進捗
        treasureFound: 0,
        trapTriggered: 0,
        
        // ターン管理
        keyHolderId: null,
        turnInRound: 0
    };
}

module.exports = {
    generateRoomId,
    assignRoles,
    generateAllCards,
    shuffleArray,
    distributeCards,
    calculateVictoryGoal,
    initializeGameData,
    checkGameEndConditions,
    getCardsPerPlayerForRound,
    advanceToNextRound,
    recycleCardsAfterRound,
    generateEmptyCards,
    getRevealedCardStatistics
};
