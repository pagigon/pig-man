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

    // ゲーム概要更新（元のルール通り）
    static updateGameOverview(playerCount) {
        try {
            let roleText = '';
            let cardText = '';

            // 元の恐怖の古代寺院ルールに従った役職とカード構成
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
                    cardText = '子豚7匹、罠2個、空き部屋16個';
                    break;
                case 6:
                    roleText = '探検家 4人、豚男 2人';
                    cardText = '子豚8匹、罠2個、空き部屋20個';
                    break;
                case 7:
                    roleText = '探検家 4-5人、豚男 2-3人';
                    cardText = '子豚7匹、罠2個、空き部屋26個';
                    break;
                case 8:
                    roleText = '探検家 5-6人、豚男 2-3人';
                    cardText = '子豚8匹、罠2個、空き部屋30個';
                    break;
                case 9:
                    roleText = '探検家 6人、豚男 3人';
                    cardText = '子豚9匹、罠2個、空き部屋34個';
                    break;
                case 10:
                    roleText = '探検家 6-7人、豚男 3-4人';
                    cardText = '子豚10匹、罠3個、空き部屋37個';
                    break;
                default:
                    roleText = 'プレイヤー数: ' + playerCount + '人';
                    cardText = 'カード構成を計算中...';
            }

            // カードリサイクルの説明を追加
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
            
            screen.style.display = 'flex';
            
        } catch (error) {
            console.error('勝利画面表示エラー:', error);
        }
    }

    // その他の既存メソッド
    static showSpectatorMode(isSpectator) {
        try {
            const existingIndicator = document.getElementById('spectator-indicator');
            
            if (isSpectator) {
                if (!existingIndicator) {
                    const indicator = document.createElement('div');
                    indicator.id = 'spectator-indicator';
                    indicator.className = 'spectator-indicator';
                    indicator.textContent = '👁️ 観戦中';
                    document.body.appendChild(indicator);
                }
                
                const gameBoard = this.safeGetElement('game-board');
                if (gameBoard) {
                    gameBoard.classList.add('spectator-mode');
                }
                
                this.addSpectatorInfo();
            } else {
                if (existingIndicator) {
                    existingIndicator.remove();
                }
                
                const gameBoard = this.safeGetElement('game-board');
                if (gameBoard) {
                    gameBoard.classList.remove('spectator-mode');
                }
                
                this.removeSpectatorInfo();
            }
        } catch (error) {
            console.error('観戦モード表示エラー:', error);
        }
    }

    static addSpectatorInfo() {
        try {
            const gameBoard = this.safeGetElement('game-board');
            if (!gameBoard || document.getElementById('spectator-controls')) return;

            const spectatorControls = document.createElement('div');
            spectatorControls.id = 'spectator-controls';
            spectatorControls.className = 'spectator-controls';
            spectatorControls.innerHTML = '<div class="spectator-info">観戦モード - ゲームの進行を見ることができますが、操作はできません</div>';

            gameBoard.insertBefore(spectatorControls, gameBoard.firstChild);
        } catch (error) {
            console.error('観戦情報追加エラー:', error);
        }
    }

    static removeSpectatorInfo() {
        try {
            const spectatorControls = document.getElementById('spectator-controls');
            if (spectatorControls) {
                spectatorControls.remove();
            }
        } catch (error) {
            console.error('観戦情報削除エラー:', error);
        }
    }

    static showConnectionStatus(status) {
        try {
            console.log('接続状態変更: ' + status);
            const statusEl = this.safeGetElement('connection-status');
            if (!statusEl) return;
            
            if (status === 'connected') {
                statusEl.textContent = '🟢 接続済み';
                statusEl.className = 'connection-status connected';
            } else {
                statusEl.textContent = '🔴 切断';
                statusEl.className = 'connection-status disconnected';
            }
        } catch (error) {
            console.error('接続状態表示エラー:', error);
        }
    }

    static showError(message, type) {
        try {
            if (type === undefined) type = 'error';
            console.log('UI エラー表示: ' + message + ' (タイプ: ' + type + ')');
            const errorEl = this.safeGetElement('error-message');
            if (!errorEl) {
                console.warn('エラーメッセージ要素が見つかりません');
                return;
            }
            
            errorEl.textContent = message || 'エラーが発生しました';
            
            // タイプ別のスタイル設定
            errorEl.style.display = 'block';
            if (type === 'success') {
                errorEl.style.background = 'rgba(34, 139, 34, 0.9)';
                errorEl.style.borderColor = '#228B22';
            } else if (type === 'warning') {
                errorEl.style.background = 'rgba(255, 165, 0, 0.9)';
                errorEl.style.borderColor = '#FFA500';
            } else {
                errorEl.style.background = 'rgba(220, 20, 60, 0.9)';
                errorEl.style.borderColor = '#DC143C';
            }
            
            // 自動非表示タイマー
            const displayTime = type === 'success' ? 3000 : 8000;
            setTimeout(function() {
                if (errorEl && errorEl.style.display === 'block') {
                    errorEl.style.display = 'none';
                }
            }, displayTime);
        } catch (error) {
            console.error('エラー表示処理でエラー:', error);
        }
    }

    static showPlayerName(name) {
        try {
            console.log('プレイヤー名表示: ' + name);
            const displayEl = this.safeGetElement('player-name-display');
            const nameEl = this.safeGetElement('my-name');
            
            if (displayEl && nameEl && name) {
                displayEl.style.display = 'block';
                nameEl.textContent = String(name);
            }
        } catch (error) {
            console.error('プレイヤー名表示エラー:', error);
        }
    }

    static updateRoomList(rooms) {
        try {
            console.log('ルーム一覧更新: ' + (rooms ? rooms.length : 0) + '個のルーム');
            const container = this.safeGetElement('room-list-container');
            if (!container) {
                console.warn('room-list-container 要素が見つかりません');
                return;
            }
            
            container.innerHTML = '';

            if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #87CEEB;">現在開設中のルームはありません</p>';
                return;
            }

            const self = this;
            rooms.forEach(function(room, index) {
                try {
                    if (!room || typeof room !== 'object') {
                        console.warn('無効なルームデータ:', room);
                        return;
                    }

                    const roomDiv = document.createElement('div');
                    roomDiv.className = 'room-item';
                    
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'room-item-info';
                    
                    const roomId = room.id || 'ROOM' + index;
                    const hostName = room.hostName || '不明';
                    const playerCount = room.playerCount || 0;
                    const hasPassword = room.hasPassword || false;
                    
                    infoDiv.innerHTML = '<strong>ID: ' + roomId + '</strong>' +
                                       (hasPassword ? '<span class="password-icon">🔒</span>' : '') +
                                       '<br>ホスト: ' + hostName + ' | プレイヤー: ' + playerCount + '/10';
                    
                    const joinBtn = document.createElement('button');
                    joinBtn.className = 'btn btn-small';
                    joinBtn.textContent = '参加';
                    
                    joinBtn.onclick = function() {
                        try {
                            const roomIdInput = self.safeGetElement('room-id-input');
                            if (roomIdInput) {
                                roomIdInput.value = roomId;
                            }
                            
                            if (hasPassword) {
                                const passwordGroup = self.safeGetElement('join-password-group');
                                if (passwordGroup) {
                                    passwordGroup.style.display = 'block';
                                }
                            }
                            
                            const playerNameInput = self.safeGetElement('player-name-join');
                            if (playerNameInput) {
                                playerNameInput.focus();
                            }
                        } catch (error) {
                            console.error('ルーム参加ボタンクリックエラー:', error);
                            self.showError('観戦の準備でエラーが発生しました');
                        }
                    };
                    
                    gameDiv.appendChild(infoDiv);
                    gameDiv.appendChild(spectateBtn);
                    container.appendChild(gameDiv);
                } catch (error) {
                    console.error('ゲームアイテム作成エラー:', error, game);
                }
            });
        } catch (error) {
            console.error('進行中ゲーム一覧更新エラー:', error);
            const container = this.safeGetElement('ongoing-games-container');
            if (container) {
                container.innerHTML = '<p style="text-align: center; color: #DC143C;">進行中ゲーム一覧の表示でエラーが発生しました</p>';
            }
        }
    }

    static showScreen(screenName) {
        try {
            console.log('画面切り替え: ' + screenName);
            const screens = ['lobby', 'room-info', 'game-board', 'victory-screen'];
            
            const self = this;
            screens.forEach(function(screen) {
                const element = self.safeGetElement(screen);
                if (element) {
                    element.style.display = 'none';
                }
            });
            
            if (screenName) {
                const screen = this.safeGetElement(screenName);
                if (screen) {
                    screen.style.display = 'block';
                } else {
                    console.warn('画面要素が見つかりません: ' + screenName);
                }
            }
        } catch (error) {
            console.error('画面切り替えエラー:', error);
        }
    }

    static updatePlayersList(players, hostId) {
        try {
            console.log('プレイヤー一覧更新: ' + (players ? players.length : 0) + '人');
            const container = this.safeGetElement('players-list');
            const countEl = this.safeGetElement('player-count');
            
            if (!container || !countEl) {
                console.warn('プレイヤー一覧要素が見つかりません');
                return;
            }
            
            if (!players || !Array.isArray(players)) {
                console.warn('無効なプレイヤーデータ:', players);
                container.innerHTML = '<p>プレイヤー情報を取得できませんでした</p>';
                countEl.textContent = '0';
                return;
            }
            
            const count = players.filter(function(p) { return p && p.connected; }).length;
            countEl.textContent = count;
            
            container.innerHTML = '';
            players.forEach(function(player) {
                try {
                    if (!player || typeof player !== 'object') {
                        console.warn('無効なプレイヤーオブジェクト:', player);
                        return;
                    }

                    const div = document.createElement('div');
                    div.className = 'player-item';
                    
                    if (player.id === hostId) {
                        div.classList.add('host');
                    }
                    
                    const status = player.connected ? '🟢' : '🔴';
                    const playerName = player.name || '名前なし';
                    const disconnectedText = player.connected ? '' : ' (切断中)';
                    div.textContent = status + ' ' + playerName + disconnectedText;
                    
                    if (!player.connected) {
                        div.style.opacity = '0.6';
                        div.style.fontStyle = 'italic';
                    }
                    
                    container.appendChild(div);
                } catch (error) {
                    console.error('プレイヤーアイテム作成エラー:', error, player);
                }
            });
        } catch (error) {
            console.error('プレイヤー一覧更新エラー:', error);
            const container = this.safeGetElement('players-list');
            if (container) {
                container.innerHTML = '<p style="color: #DC143C;">プレイヤー一覧の表示でエラーが発生しました</p>';
            }
        }
    }

    static updateMessages(messages) {
        try {
            const container = this.safeGetElement('chat-container');
            if (!container) {
                console.warn('チャットコンテナが見つかりません');
                return;
            }
            
            if (!messages || !Array.isArray(messages)) {
                console.warn('無効なメッセージデータ:', messages);
                return;
            }
            
            const recentMessages = messages.slice(-20);
            
            container.innerHTML = '';
            recentMessages.forEach(function(msg, index) {
                try {
                    if (!msg || typeof msg !== 'object') {
                        console.warn('無効なメッセージオブジェクト:', msg);
                        return;
                    }

                    const div = document.createElement('div');
                    div.className = 'chat-message ' + (msg.type || 'player');
                    
                    if (msg.type === 'player') {
                        const playerName = msg.playerName || '名前なし';
                        const text = msg.text || '';
                        div.textContent = playerName + ': ' + text;
                    } else {
                        div.textContent = msg.text || '';
                    }
                    
                    container.appendChild(div);
                } catch (error) {
                    console.error('メッセージアイテム作成エラー:', error, msg);
                }
            });
            
            container.scrollTop = container.scrollHeight;
        } catch (error) {
            console.error('メッセージ更新エラー:', error);
        }
    }

    // ユーティリティメソッド
    static safeGetElement(id) {
        try {
            if (!id || typeof id !== 'string') {
                console.warn('無効な要素ID:', id);
                return null;
            }
            
            const element = document.getElementById(id);
            if (!element) {
                console.warn('⚠️ 要素が見つかりません: #' + id);
            }
            return element;
        } catch (error) {
            console.error('要素取得エラー (#' + id + '):', error);
            return null;
        }
    }

    static safeSetText(id, text) {
        try {
            const el = this.safeGetElement(id);
            if (el) {
                el.textContent = String(text || '');
                return true;
            }
            return false;
        } catch (error) {
            console.error('テキスト設定エラー (#' + id + '):', error);
            return false;
        }
    }
}Error('ルーム参加の準備でエラーが発生しました');
                        }
                    };
                    
                    roomDiv.appendChild(infoDiv);
                    roomDiv.appendChild(joinBtn);
                    container.appendChild(roomDiv);
                } catch (error) {
                    console.error('ルームアイテム作成エラー:', error, room);
                }
            });
        } catch (error) {
            console.error('ルーム一覧更新エラー:', error);
            const container = this.safeGetElement('room-list-container');
            if (container) {
                container.innerHTML = '<p style="text-align: center; color: #DC143C;">ルーム一覧の表示でエラーが発生しました</p>';
            }
        }
    }

    static updateOngoingGames(games) {
        try {
            console.log('進行中ゲーム一覧更新:', games ? games.length : 0);
            const container = this.safeGetElement('ongoing-games-container');
            if (!container) {
                console.warn('ongoing-games-container element not found');
                return;
            }
            
            container.innerHTML = '';

            if (!games || !Array.isArray(games) || games.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #32CD32;">現在進行中のゲームはありません</p>';
                return;
            }

            const self = this;
            games.forEach(function(game, index) {
                try {
                    if (!game || typeof game !== 'object') {
                        console.warn('無効なゲームデータ:', game);
                        return;
                    }

                    const gameDiv = document.createElement('div');
                    gameDiv.className = 'ongoing-game-item';
                    gameDiv.style.cssText = 'background: rgba(4, 56, 76, 0.3); padding: 15px; border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(135, 206, 235, 0.2); display: flex; flex-direction: column; gap: 10px;';
                    
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'ongoing-game-info';
                    
                    const gameId = game.id || 'GAME' + index;
                    const currentRound = game.currentRound || 1;
                    const maxRounds = game.maxRounds || 4;
                    const cardsPerPlayer = game.cardsPerPlayer || 5;
                    const playerCount = game.playerCount || 0;
                    const treasureFound = game.treasureFound || 0;
                    const treasureGoal = game.treasureGoal || 7;
                    const trapTriggered = game.trapTriggered || 0;
                    const trapGoal = game.trapGoal || 2;
                    
                    // カードリサイクル対応の情報表示
                    infoDiv.innerHTML = '<strong>ID: ' + gameId + '</strong><br>' +
                                       'ラウンド: ' + currentRound + '/' + maxRounds + ' | プレイヤー: ' + playerCount + '/10<br>' +
                                       '手札: ' + cardsPerPlayer + '枚 | 救出: ' + treasureFound + '/' + treasureGoal + ' | 罠: ' + trapTriggered + '/' + trapGoal;
                    
                    const spectateBtn = document.createElement('button');
                    spectateBtn.className = 'btn btn-small';
                    spectateBtn.textContent = '観戦する';
                    spectateBtn.style.width = '100%';
                    
                    spectateBtn.onclick = function() {
                        try {
                            const spectateRoomInput = self.safeGetElement('spectate-room-id');
                            const spectatorNameInput = self.safeGetElement('spectator-name');
                            
                            if (spectateRoomInput) {
                                spectateRoomInput.value = gameId;
                            }
                            
                            if (spectatorNameInput && !spectatorNameInput.value.trim()) {
                                const spectatorName = '観戦者' + Math.floor(Math.random() * 1000);
                                spectatorNameInput.value = spectatorName;
                            }
                            
                            if (spectatorNameInput) {
                                spectatorNameInput.focus();
                            }
                            
                            // PigManGameのspectateRoom メソッドを呼び出し
                            if (window.pigGame && typeof window.pigGame.spectateRoom === 'function') {
                                window.pigGame.spectateRoom();
                            } else {
                                console.warn('PigManGame インスタンスまたはspectateRoomメソッドが見つかりません');
                                self.showError('観戦機能を開始できませんでした');
                            }
                        } catch (error) {
                            console.error('観戦ボタンクリックエラー:', error);
                            self.show
