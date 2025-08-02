// UIManager クラス - UI操作の責任を持つ
export class UIManager {
    static showSpectatorMode(isSpectator) {
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
    }

    static addSpectatorInfo() {
        const gameBoard = this.safeGetElement('game-board');
        if (!gameBoard || document.getElementById('spectator-controls')) return;

        const spectatorControls = document.createElement('div');
        spectatorControls.id = 'spectator-controls';
        spectatorControls.className = 'spectator-controls';
        spectatorControls.innerHTML = `
            <div class="spectator-info">
                観戦モード - ゲームの進行を見ることができますが、操作はできません
            </div>
        `;

        gameBoard.insertBefore(spectatorControls, gameBoard.firstChild);
    }

    static removeSpectatorInfo() {
        const spectatorControls = document.getElementById('spectator-controls');
        if (spectatorControls) {
            spectatorControls.remove();
        }
    }

    static showConnectionStatus(status) {
        console.log(`接続状態変更: ${status}`);
        const statusEl = this.safeGetElement('connection-status');
        if (!statusEl) return;
        
        if (status === 'connected') {
            statusEl.textContent = '🟢 接続済み';
            statusEl.className = 'connection-status connected';
        } else {
            statusEl.textContent = '🔴 切断';
            statusEl.className = 'connection-status disconnected';
        }
    }

    static showError(message, type = 'error') {
        console.log(`UI エラー表示: ${message} (タイプ: ${type})`);
        const errorEl = this.safeGetElement('error-message');
        if (!errorEl) return;
        
        errorEl.textContent = message;
        
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
        
        errorEl.style.display = 'block';
        
        const displayTime = type === 'success' ? 3000 : 8000;
        
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, displayTime);
    }

    static showPlayerName(name) {
        console.log(`プレイヤー名表示: ${name}`);
        const displayEl = this.safeGetElement('player-name-display');
        const nameEl = this.safeGetElement('my-name');
        
        if (displayEl && nameEl) {
            displayEl.style.display = 'block';
            nameEl.textContent = name;
        }
    }

    static updateRoomList(rooms) {
        console.log(`ルーム一覧更新: ${rooms.length}個のルーム`);
        const container = this.safeGetElement('room-list-container');
        if (!container) return;
        
        container.innerHTML = '';

        if (rooms.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #87CEEB;">現在開設中のルームはありません</p>';
            return;
        }

        rooms.forEach(room => {
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'room-item-info';
            infoDiv.innerHTML = `
                <strong>ID: ${room.id}</strong>
                ${room.hasPassword ? '<span class="password-icon">🔒</span>' : ''}
                <br>
                ホスト: ${room.hostName} | プレイヤー: ${room.playerCount}/10
            `;
            
            const joinBtn = document.createElement('button');
            joinBtn.className = 'btn btn-small';
            joinBtn.textContent = '参加';
            joinBtn.onclick = () => {
                const roomIdInput = this.safeGetElement('room-id-input');
                if (roomIdInput) roomIdInput.value = room.id;
                if (room.hasPassword) {
                    const passwordGroup = this.safeGetElement('join-password-group');
                    if (passwordGroup) passwordGroup.style.display = 'block';
                }
            };
            
            roomDiv.appendChild(infoDiv);
            roomDiv.appendChild(joinBtn);
            container.appendChild(roomDiv);
        });
    }

    static updateOngoingGames(games) {
        const container = this.safeGetElement('ongoing-games-container');
    if (!container) {
        console.warn('room-list-container not found');
        return;
    }
        
        container.innerHTML = '';

        if (games.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #32CD32;">現在進行中のゲームはありません</p>';
            return;
        }

        games.forEach(game => {
            const gameDiv = document.createElement('div');
            gameDiv.className = 'ongoing-game-item';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'ongoing-game-info';
            infoDiv.innerHTML = `
                <strong>ID: ${game.id}</strong>
                <br>
                ラウンド: ${game.currentRound}/4 | プレイヤー: ${game.playerCount}/10
                <br>
                救出: ${game.treasureFound}/${game.treasureGoal} | 罠: ${game.trapTriggered}/${game.trapGoal}
            `;
            
            const spectateBtn = document.createElement('button');
            spectateBtn.className = 'btn btn-small';
            spectateBtn.textContent = '観戦する';
            spectateBtn.onclick = () => {
                const spectateRoomInput = this.safeGetElement('spectate-room-id');
                const spectatorNameInput = this.safeGetElement('spectator-name');
                
                if (spectateRoomInput) spectateRoomInput.value = game.id;
                
                const spectatorName = `観戦者${Math.floor(Math.random() * 1000)}`;
                if (spectatorNameInput) spectatorNameInput.value = spectatorName;
                
                if (window.pigGame) {
                    window.pigGame.spectateRoom();
                }
            };
            
            gameDiv.appendChild(infoDiv);
            gameDiv.appendChild(spectateBtn);
            container.appendChild(gameDiv);
        });
    }

    static showScreen(screenName) {
        console.log(`画面切り替え: ${screenName}`);
        const screens = ['lobby', 'room-info', 'game-board', 'victory-screen'];
        
        screens.forEach(screen => {
            const element = this.safeGetElement(screen);
            if (element) {
                element.style.display = 'none';
            }
        });
        
        if (screenName) {
            const screen = this.safeGetElement(screenName);
            if (screen) {
                screen.style.display = 'block';
            }
        }
    }

    static updatePlayersList(players, hostId) {
        console.log(`プレイヤー一覧更新: ${players.length}人`);
        const container = this.safeGetElement('players-list');
        const countEl = this.safeGetElement('player-count');
        
        if (!container || !countEl) return;
        
        const count = players.filter(p => p.connected).length;
        countEl.textContent = count;
        
        container.innerHTML = '';
        players.forEach((player) => {
            const div = document.createElement('div');
            div.className = 'player-item';
            if (player.id === hostId) {
                div.classList.add('host');
            }
            
            const status = player.connected ? '🟢' : '🔴';
            const disconnectedText = player.connected ? '' : ' (切断中)';
            div.textContent = `${status} ${player.name}${disconnectedText}`;
            
            if (!player.connected) {
                div.style.opacity = '0.6';
                div.style.fontStyle = 'italic';
            }
            
            container.appendChild(div);
        });
    }

    static updateGameOverview(playerCount) {
        let roleText = '';
        let cardText = '';

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
        }

        this.safeSetText('role-possibility-text', roleText);
        this.safeSetText('card-distribution-text', cardText);
    }

    static updateProgressBars(gameData) {
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
    }

    static updateGameInfo(gameData) {
        this.safeSetText('current-round', gameData.currentRound);
        this.safeSetText('treasure-found', gameData.treasureFound || 0);
        this.safeSetText('trap-triggered', gameData.trapTriggered || 0);
        this.safeSetText('trap-goal', gameData.trapGoal || 2);
        this.safeSetText('cards-per-player', gameData.cardsPerPlayer || 5);
        this.safeSetText('cards-flipped', gameData.cardsFlippedThisRound || 0);
        this.safeSetText('treasure-goal', gameData.treasureGoal || 7);
    }

    static showRoundStart(roundNumber) {
        const overlay = this.safeGetElement('round-start-overlay');
        const message = this.safeGetElement('round-start-message');
        
        if (overlay && message) {
            message.textContent = `ラウンド ${roundNumber} スタート！`;
            overlay.style.display = 'flex';
            
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 3000);
        }
    }

    static showVictoryScreen(gameData) {
        const screen = this.safeGetElement('victory-screen');
        const title = this.safeGetElement('victory-title');
        const messageEl = this.safeGetElement('victory-message');
        const winnersList = this.safeGetElement('winners-list');
        
        if (!screen || !title || !messageEl || !winnersList) return;
        
        if (gameData.winningTeam === 'adventurer') {
            title.textContent = '⛏️ 探検家チームの勝利！';
            title.style.color = '#FFD700';
        } else {
            title.textContent = '🐷 豚男チームの勝利！';
            title.style.color = '#DC143C';
        }
        
        messageEl.textContent = gameData.victoryMessage;
        
        winnersList.innerHTML = '<h3>勝利チーム:</h3>';
        gameData.players.forEach((player) => {
            if ((gameData.winningTeam === 'adventurer' && player.role === 'adventurer') ||
                (gameData.winningTeam === 'guardian' && player.role === 'guardian')) {
                const div = document.createElement('div');
                div.textContent = `🎉 ${player.name}`;
                div.style.color = '#FFD700';
                winnersList.appendChild(div);
            }
        });
        
        screen.style.display = 'flex';
    }

    static updateMessages(messages) {
        const container = this.safeGetElement('chat-container');
        if (!container) return;
        
        const recentMessages = messages.slice(-20);
        
        container.innerHTML = '';
        recentMessages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-message ${msg.type}`;
            
            if (msg.type === 'player') {
                div.textContent = `${msg.playerName}: ${msg.text}`;
            } else {
                div.textContent = msg.text;
            }
            
            container.appendChild(div);
        });
        
        container.scrollTop = container.scrollHeight;
    }

    // ユーティリティメソッド
    static safeGetElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`⚠️ 要素が見つかりません: #${id}`);
        }
        return element;
    }

    static safeSetText(id, text) {
        const el = this.safeGetElement(id);
        if (el) {
            el.textContent = text;
            return true;
        }
        return false;
    }
}
