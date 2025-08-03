// 恐怖の古代寺院ルール対応版 game-Logic.js
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'PIG';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// プレイヤー数に応じた役職割り当て
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

// プレイヤー数に応じたカード生成
function generateAllCards(playerCount) {
    console.log('🃏 カード生成開始:', playerCount, '人用');
    
    if (!playerCount || playerCount < 3 || playerCount > 10) {
        console.warn('無効なプレイヤー数:', playerCount);
        playerCount = Math.max(3, Math.min(10, playerCount || 3));
    }

    let treasureCount, trapCount, emptyCount;

    // プレイヤー数に応じたカード配分
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
            // フォールバック
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

// カード配布
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

    const shuffledCards = shuffleArray([...allCards]);
    const playerHands = {};
    
    for (let i = 0; i < playerCount; i++) {
        const hand = shuffledCards.splice(0, cardsPerPlayer);
        playerHands[i] = shuffleArray(hand);
        console.log(`プレイヤー${i}: ${hand.length}枚配布`);
    }
    
    console.log(`配布完了: 残りカード${shuffledCards.length}枚`);
    return { playerHands, remainingCards: shuffledCards };
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

// 恐怖の古代寺院ゲームデータ初期化
function initializeGameData(playerCount) {
    console.log('🎮 ゲームデータ初期化:', playerCount, '人');
    
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
        
        // ゲーム進行
        currentRound: 1,
        maxRounds: 4,
        cardsPerPlayer: 5,
        cardsFlippedThisRound: 0,
        
        // 進捗
        treasureFound: 0,
        trapTriggered: 0,
        
        // ターン管理
        keyHolderId: null,
        turnInRound: 0
    };
}

// ゲーム状態の検証
function validateGameState(gameData) {
    if (!gameData || typeof gameData !== 'object') {
        return { valid: false, errors: ['ゲームデータが無効'] };
    }
    
    const errors = [];
    
    // 必須フィールドチェック
    const requiredFields = [
        'treasureGoal', 'trapGoal', 'currentRound', 'maxRounds',
        'treasureFound', 'trapTriggered', 'cardsFlippedThisRound'
    ];
    
    requiredFields.forEach(field => {
        if (typeof gameData[field] !== 'number') {
            errors.push(`${field}が数値ではありません`);
        }
    });
    
    // 論理チェック
    if (gameData.treasureFound > gameData.treasureGoal) {
        errors.push('発見済み財宝数が目標を超えています');
    }
    
    if (gameData.trapTriggered > gameData.trapGoal) {
        errors.push('発動済み罠数が目標を超えています');
    }
    
    if (gameData.currentRound > gameData.maxRounds) {
        errors.push('現在ラウンドが最大ラウンドを超えています');
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

// カードタイプ別の統計取得
function getCardStatistics(players) {
    const stats = {
        revealed: { treasure: 0, trap: 0, empty: 0 },
        hidden: { treasure: 0, trap: 0, empty: 0 },
        total: { treasure: 0, trap: 0, empty: 0 }
    };
    
    if (!Array.isArray(players)) {
        return stats;
    }
    
    players.forEach(player => {
        if (player && Array.isArray(player.hand)) {
            player.hand.forEach(card => {
                if (card && card.type) {
                    stats.total[card.type]++;
                    if (card.revealed) {
                        stats.revealed[card.type]++;
                    } else {
                        stats.hidden[card.type]++;
                    }
                }
            });
        }
    });
    
    return stats;
}

// プレイヤー統計の取得
function getPlayerStatistics(players) {
    if (!Array.isArray(players)) {
        return { connected: 0, adventurers: 0, guardians: 0 };
    }
    
    const stats = {
        connected: 0,
        adventurers: 0,
        guardians: 0,
        withCards: 0
    };
    
    players.forEach(player => {
        if (player && player.connected) {
            stats.connected++;
            
            if (player.role === 'adventurer') {
                stats.adventurers++;
            } else if (player.role === 'guardian') {
                stats.guardians++;
            }
            
            if (player.hand && player.hand.length > 0) {
                stats.withCards++;
            }
        }
    });
    
    return stats;
}

// ゲーム終了条件チェック
function checkGameEndConditions(gameData) {
    const validation = validateGameState(gameData);
    if (!validation.valid) {
        console.error('ゲーム状態が無効:', validation.errors);
        return null;
    }
    
    // 探検家チーム勝利：全ての財宝を発見
    if (gameData.treasureFound >= gameData.treasureGoal) {
        return {
            ended: true,
            winner: 'adventurer',
            reason: 'all_treasures_found',
            message: `全ての子豚（${gameData.treasureGoal}匹）を救出しました！探検家チームの勝利です！`
        };
    }
    
    // 豚男チーム勝利：全ての罠を発動
    if (gameData.trapTriggered >= gameData.trapGoal) {
        return {
            ended: true,
            winner: 'guardian',
            reason: 'all_traps_triggered',
            message: `全ての罠（${gameData.trapGoal}個）が発動しました！豚男チームの勝利です！`
        };
    }
    
    // 豚男チーム勝利：最大ラウンド到達
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

module.exports = {
    generateRoomId,
    assignRoles,
    generateAllCards,
    shuffleArray,
    distributeCards,
    calculateVictoryGoal,
    initializeGameData,
    validateGameState,
    getCardStatistics,
    getPlayerStatistics,
    checkGameEndConditions
};
