// 修正版 UIManager クラス - カードリサイクルシステム対応
export class UIManager {
    // 🆕 ゲーム情報更新（カードリサイクル対応版）
    static updateGameInfo(gameData) {
        try {
            if (!gameData || typeof gameData !== 'object') {
                console.warn('無効なゲームデータ:', gameData);
                return;
            }

            console.log('📊 ゲーム情報更新開始（カードリサイクル対応）:', gameData);

            // 基本情報の安全な更新
            this.safeSetText('current-round', gameData.currentRound || 1);
            this.safeSetText('treasure-found', gameData.treasureFound || 0);
            this.safeSetText('trap-triggered', gameData.trapTriggered || 0);
            this.safeSetText('trap-goal', gameData.trapGoal || 2);
            this.safeSetText('treasure-goal', gameData.treasureGoal || 7);
            this.safeSetText('cards-per-player', gameData.cardsPerPlayer || 5);
            this.safeSetText('cards-flipped', gameData.cardsFlippedThisRound || 0);
            
            // 🆕 カードリサイクル情報の表示
            this.updateCardRecycleInfo(gameData);
            
            // ラウンド表示の特別処理
            this.updateRoundDisplay(gameData);
            
            console.log('✅ ゲーム情報更新完了（カードリサイクル対応）:', {
                round: (gameData.currentRound || 1) + '/4',
                cardsPerPlayer: gameData.cardsPerPlayer || 5,
                treasures: (gameData.treasureFound || 0) + '/' + (gameData.treasureGoal || 7),
                traps: (gameData.trapTriggered || 0) + '/' + (gameData.trapGoal || 2),
                cardsFlipped: gameData.cardsFlippedThisRound || 0
            });
            
        } catch (error) {
            console.error('❌ ゲーム情報更新エラー:', error);
        }
    }

    // 🆕 カードリサイクル情報の表示
    static updateCardRecycleInfo(gameData) {
        try {
            // ラウンド別の手札枚数を表示
            const expectedCards = this.getExpectedCardsForRound(gameData.currentRound);
            const actualCards = gameData.cardsPerPlayer;
            
            if (expectedCards !== actualCards) {
                console.warn(`⚠️ 手札枚数不整合: 期待値${expectedCards}枚、実際${actualCards}枚`);
            }
            
            // プログレス表示の更新
            this.updateRoundProgress(gameData);
            
        } catch (error) {
            console.error('カードリサイクル情報更新エラー:', error);
        }
    }

    // 🆕 ラウンド別手札枚数の期待値
    static getExpectedCardsForRound(round) {
        const cardsPerRound = { 1: 5, 2: 4, 3: 3, 4: 2 };
        return cardsPerRound[round] || 5;
    }

    // 🆕 ラウンド進行状況の更新
    static updateRoundProgress(gameData) {
        try {
            // ラウンド進行バーの作成
            const gameInfoEl = this.safeGetElement('game-overview');
            if (!gameInfoEl) return;
            
            // 既存の進行状況表示を探す
            let progressEl = document.getElementById('round-progress');
            if (!progressEl) {
                progressEl = document.createElement('div');
                progressEl.id = 'round-progress';
                progressEl.className = 'round-progress-bar';
                progressEl.style.cssText = `
                    margin: 10px 0;
                    padding: 8px;
                    background: rgba(0,0,0,0.3);
                    border-radius: 5px;
                    border: 1px solid rgba(135,206,235,0.3);
                `;
                gameInfoEl.appendChild(progressEl);
            }
            
            // 進行状況の計算
            const currentRound = gameData.currentRound || 1;
            const maxRounds = gameData.maxRounds || 4;
            const cardsFlipped = gameData.cardsFlippedThisRound || 0;
            const totalPlayers = gameData.players ? gameData.players.filter(p => p.connected).length : 0;
            
            // HTML更新
            progressEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <span style="font-size: 12px; color: #87CEEB;">ラウンド進行</span>
                    <span style="font-size: 12px; color: #FFD700;">${currentRound}/${maxRounds}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; color: #87CEEB;">公開済み</span>
                    <span style="font-size: 12px; color: #FFA500;">${cardsFlipped}/${totalPlayers}</span>
                </div>
            `;
            
        } catch (error) {
            console.error('ラウンド進行状況更新エラー:', error);
        }
    }

    // ラウンド表示の更新（エラー対応版）
    static updateRoundDisplay(gameData) {
        try {
            const roundElement = this.safeGetElement('current-round');
            if (roundElement && roundElement.parentElement) {
                const currentRound = gameData.currentRound || 1;
                const maxRounds = gameData.maxRounds || 4;
                const cardsThisRound = gameData.cardsPerPlayer || 5;
                
                // 親要素を安全に更新
                const parentEl = roundElement.parentElement;
                if (parentEl.classList.contains('info-item')) {
                    // info-itemの構造を維持して更新（手札枚数も表示）
                    parentEl.innerHTML = 
                        '<span class="label">R' + currentRound + '</span>' +
                        '<span class="value">' + cardsThisRound + '枚</span>';
                } else {
                    // 通常のテキスト更新
                    roundElement.textContent = currentRound;
                }
                
                console.log(`✅ ラウンド表示更新: ${currentRound}/${maxRounds} (${cardsThisRound}枚)`);
            }
        } catch (error) {
            console.error('ラウンド表示更新エラー:', error);
            // フォールバック: 基本的なテキスト更新
            this.safeSetText('current-round', gameData.currentRound || 1);
        }
    }

    // 🆕 新ラウンド開始時の特別表示
    static showRoundStart(roundNumber) {
        try {
            const overlay = this.safeGetElement('round-start-overlay');
            const message = this.safeGetElement('round-start-message');
            
            if (overlay && message) {
                const roundNum = roundNumber || 1;
                const cardsThisRound = this.getExpectedCardsForRound(roundNum);
                
                // 🆕 カードリサイクル情報を含むメッセージ
                let roundMessage = `ラウンド ${roundNum} スタート！`;
                let subMessage = `手札 ${cardsThisRound} 枚`;
                
                if (roundNum > 1) {
                    subMessage += ' (カードリサイクル済み)';
                }
                
                message.innerHTML = roundMessage + '<br><small>' + subMessage + '</small>';
                overlay.style.display = 'flex';
                
                // 🆕 バイブレーション（新ラウンド開始）
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100, 50, 200]);
                }
                
                setTimeout(function() {
                    overlay.style.display = 'none';
                }, 3000);
            }
        } catch (error) {
            console.error('ラウンド開始表示エラー:', error);
        }
    }

    // ゲーム概要更新（カードリサイクル対応版）
    static updateGameOverview(playerCount) {
        try {
            let roleText = '';
            let cardText = '';

            // バランス調整済みの役職とカード構成
            switch (playerCount) {
                case 3:
                    roleText = '探検家 1-2人、豚男 1-2人';
                    cardText = '子豚5匹、罠2個、空き部屋8個';
                    break;
                case 4:
                    roleText = '探検家 2-3人、豚男 1-2人';
                    cardText = '子豚6匹、罠2個、空き部屋12個';
                    break;
                case 5:
                    roleText = '探検家 3人、豚男 2人';
                    cardText = '子豚7匹、罠3個、空き部屋15個'; // 調整済み
                    break;
                case 6:
                    roleText = '探検家 4人、豚男 2人';
                    cardText = '子豚8匹、罠3個、空き部屋19個'; // 調整済み
                    break;
                case 7:
                    roleText = '探検家 4-5人、豚男 2-3人';
                    cardText = '子豚7匹、罠3個、空き部屋25個'; // 調整済み
                    break;
                case 8:
                    roleText = '探検家 5-6人、豚男 2-3人';
                    cardText = '子豚8匹、罠3個、空き部屋29個'; // 調整済み
                    break;
                case 9:
                    roleText = '探検家 6人、豚男 3人';
                    cardText = '子豚9匹、罠4個、空き部屋32個'; // 調整済み
                    break;
                case 10:
                    roleText = '探検家 6-7人、豚男 3-4人';
                    cardText = '子豚10匹、罠4個、空き部屋36個'; // 調整済み
                    break;
                default:
                    roleText = 'プレイヤー数: ' + playerCount + '人';
                    cardText = 'カード構成を計算中...';
            }

            // 🆕 カードリサイクルの説明を追加
            cardText += '<br><small style="color: #FFA500;">※ラウンド終了時、公開カードは除去され空き部屋で補充</small>';

            this.safeSetText('role-possibility-text', roleText);
            
            // HTMLを許可するため直接設定
            const cardDistEl = this.safeGetElement('card-distribution-text');
            if (cardDistEl) {
                cardDistEl.innerHTML = cardText;
            }
        } catch (error) {
            console.error('ゲーム概要更新エラー:', error);
        }
    }

    // 進捗バー更新（バランス調整対応）
    static updateProgressBars(gameData) {
        try {
            if (!gameData || typeof gameData !== 'object') {
                console.warn('無効なゲームデータ:', gameData);
                return;
            }

            const treasureTotal = gameData.totalTreasures || gameData.treasureGoal || 7;
            const trapTotal = gameData.totalTraps || gameData.trapGoal || 2;
            const treasureFound = gameData.treasureFound || 0;
            const trapTriggered = gameData.trapTriggered || 0;

            // 財宝の進捗バー
            const treasureContainer = this.safeGetElement('treasure-icons');
            if (treasureContainer) {
                treasureContainer.innerHTML = '';
                for (let i = 0; i < treasureTotal; i++) {
                    const icon = document.createElement('div');
                    icon.className = 'progress-icon treasure';
                    if (i < treasureFound) {
                        icon.classList.add('used');
                    }
                    treasureContainer.appendChild(icon);
                }
            }

            // 罠の進捗バー
            const trapContainer = this.safeGetElement('trap-icons');
            if (trapContainer) {
                trapContainer.innerHTML = '';
                for (let i = 0; i < trapTotal; i++) {
                    const icon = document.createElement('div');
                    icon.className = 'progress-icon trap';
                    if (i < trapTriggered) {
                        icon.classList.add('used');
                    }
                    trapContainer.appendChild(icon);
                }
            }
        } catch (error) {
            console.error('進捗バー更新エラー:', error);
        }
    }

    // 勝利画面表示（カードリサイクル統計付き）
    static showVictoryScreen(gameData) {
        try {
            if (!gameData || typeof gameData !== 'object') {
                console.warn('無効な勝利データ:', gameData);
                return;
            }

            const screen = this.safeGetElement('victory-screen');
            const title = this.safeGetElement('victory-title');
            const messageEl = this.safeGetElement('victory-message');
            const winnersList = this.safeGetElement('winners-list');
            
            if (!screen || !title || !messageEl || !winnersList) {
                console.warn('勝利画面要素が見つかりません');
                return;
            }
            
            if (gameData.winningTeam === 'adventurer') {
                title.textContent = '⛏️ 探検家チームの勝利！';
                title.style.color = '#FFD700';
            } else {
                title.textContent = '🐷 豚男チームの勝利！';
                title.style.color = '#DC143C';
            }
            
            messageEl.textContent = gameData.victoryMessage || 'ゲーム終了！';
            
            // 勝利チーム表示
            winnersList.innerHTML = '<h3>勝利チーム:</h3>';
            
            // 🆕 カードリサイクル統計を含むゲーム統計
            const statsDiv = document.createElement('div');
            statsDiv.style.marginTop = '15px';
            statsDiv.style.fontSize = '14px';
            statsDiv.style.color = '#87CEEB';
            
            const finalRound = gameData.currentRound || 1;
            const maxRounds = gameData.maxRounds || 4;
            const treasureFound = gameData.treasureFound || 0;
            const treasureGoal = gameData.treasureGoal || 7;
            const trapTriggered = gameData.trapTriggered || 0;
            const trapGoal = gameData.trapGoal || 2;
            
            // カードリサイクル回数の計算
            const recycleCount = Math.max(0, finalRound - 1);
            
            statsDiv.innerHTML = '<strong>ゲーム統計:</strong><br>' +
                                '終了ラウンド: ' + finalRound + '/' + maxRounds + '<br>' +
                                '救出された子豚: ' + treasureFound + '/' + treasureGoal + '<br>' +
                                '発動した罠: ' + trapTriggered + '/' + trapGoal + '<br>' +
                                '<small style="color: #FFA500;">カードリサイクル回数: ' + recycleCount + '回</small>';
            
            winnersList.appendChild(statsDiv);
            
            // 勝者一覧
            if (gameData.players && Array.isArray(gameData.players)) {
                const winnersDiv = document.createElement('div');
                winnersDiv.style.marginTop = '15px';
                
                gameData.players.forEach(function(player) {
                    try {
                        if (!player || typeof player !== 'object') return;
                        
                        if ((gameData.winningTeam === 'adventurer' && player.role === 'adventurer') ||
                            (gameData.winningTeam === 'guardian' && player.role === 'guardian')) {
                            const div = document.createElement('div');
                            div.textContent = '🎉 ' + (player.name || '名前なし');
                            div.style.color = '#FFD700';
                            div.style.marginBottom = '5px';
                            winnersDiv.appendChild(div);
                        }
                    } catch (error) {
                        console.error('勝者表示エラー:', error, player);
                    }
                });
                
                winnersList.appendChild(winnersDiv);
            }
