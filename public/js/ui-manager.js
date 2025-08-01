// UI管理クラス

console.log('🎨 UI-Manager.js 読み込み開始');

class UIManager {
    static toastCount = 0;
    static activeToasts = new Set();

    // トースト通知
    static showToast(message, type = 'info', duration = 3000) {
        // 同じメッセージの重複を防ぐ
        const toastId = `toast-${Date.now()}-${++this.toastCount}`;
        
        // 既存のトーストを削除（最大3個まで）
        if (this.activeToasts.size >= 3) {
            const oldestToast = document.querySelector('.toast');
            if (oldestToast) {
                this.removeToast(oldestToast);
            }
    
    // ローディング表示
    static showLoading(show = true) {
        const overlay = safeGetElement('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }
    
    // 確認ダイアログ
    static showConfirm(title, message) {
        return new Promise((resolve) => {
            const modal = safeGetElement('confirm-modal');
            const titleEl = safeGetElement('confirm-title');
            const messageEl = safeGetElement('confirm-message');
            const yesBtn = safeGetElement('confirm-yes');
            const noBtn = safeGetElement('confirm-no');
            
            if (!modal) {
                console.error('確認モーダルが見つかりません');
                resolve(false);
                return;
            }
            
            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.textContent = message;
            
            modal.style.display = 'flex';
            
            const cleanup = () => {
                modal.style.display = 'none';
                yesBtn?.removeEventListener('click', handleYes);
                noBtn?.removeEventListener('click', handleNo);
                document.removeEventListener('keydown', handleEscape);
            };
            
            const handleYes = () => {
                cleanup();
                resolve(true);
            };
            
            const handleNo = () => {
                cleanup();
                resolve(false);
            };
            
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                }
            };
            
            yesBtn?.addEventListener('click', handleYes);
            noBtn?.addEventListener('click', handleNo);
            document.addEventListener('keydown', handleEscape);
            
            // フォーカス管理
            if (yesBtn) {
                setTimeout(() => yesBtn.focus(), 100);
            }
        });
    }
    
    // 進捗バー
    static showProgress(percent) {
        const progressBar = safeGetElement('progress-bar');
        const progressFill = safeGetElement('progress-fill');
        
        if (progressBar && progressFill) {
            progressBar.style.display = 'block';
            const clampedPercent = Math.max(0, Math.min(100, percent));
            progressFill.style.width = `${clampedPercent}%`;
            
            if (clampedPercent >= 100) {
                setTimeout(() => {
                    progressBar.style.display = 'none';
                    progressFill.style.width = '0%';
                }, 1500);
            }
        }
    }

    // 改善されたエラー表示
    static showError(message, type = 'error') {
        const errorEl = safeGetElement('error-message');
        if (!errorEl) {
            // フォールバック: トーストのみ表示
            this.showToast(message, type);
            return;
        }
        
        errorEl.textContent = message;
        errorEl.className = 'error-message';
        
        if (type === 'success') {
            errorEl.classList.add('status-success');
        } else if (type === 'warning') {
            errorEl.classList.add('status-warning');
        }
        
        errorEl.style.display = 'block';
        
        const hideTimeout = type === 'success' ? 3000 : 5000;
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, hideTimeout);

        // トースト通知も表示
        this.showToast(message, type, hideTimeout);
    }

    // 接続状態表示
    static showConnectionStatus(status) {
        const statusEl = safeGetElement('connection-status');
        if (!statusEl) return;
        
        if (status === 'connected') {
            statusEl.textContent = '🟢 接続済み';
            statusEl.className = 'connection-status connected';
        } else {
            statusEl.textContent = '🔴 切断';
            statusEl.className = 'connection-status disconnected';
        }
    }

    // プレイヤー名表示
    static showPlayerName(name) {
        const displayEl = safeGetElement('player-name-display');
        const nameEl = safeGetElement('my-name');
        
        if (displayEl && nameEl) {
            displayEl.style.display = 'block';
            nameEl.textContent = name;
        }
    }

    // ゲーム中ルームID表示
    static showGameRoomId(roomId) {
        const gameRoomIdEl = safeGetElement('game-room-id');
        const gameRoomIdTextEl = safeGetElement('game-room-id-text');
        
        if (gameRoomIdEl && gameRoomIdTextEl) {
            if (roomId) {
                gameRoomIdTextEl.textContent = roomId;
                gameRoomIdEl.style.display = 'block';
            } else {
                gameRoomIdEl.style.display = 'none';
            }
        }
    }

    // 画面切り替え
    static showScreen(screenName) {
        const screens = ['lobby', 'room-info', 'game-board', 'victory-screen'];
        
        screens.forEach(screen => {
            const element = safeGetElement(screen);
            if (element) {
                element.style.display = 'none';
            }
        });
        
        if (screenName) {
            const screen = safeGetElement(screenName);
            if (screen) {
                screen.style.display = 'block';
                
                // 画面遷移時のフォーカス管理
                const firstInput = screen.querySelector('input:not([disabled])');
                if (firstInput) {
                    setTimeout(() => firstInput.focus(), 100);
                }
            }
        }

        // ゲーム画面の場合はルームIDを表示
        if (screenName === 'game-board' && window.game?.roomId) {
            this.showGameRoomId(window.game.roomId);
        } else {
            this.showGameRoomId(null);
        }
    }

    // プレイヤーリスト更新
    static updatePlayersList(players, hostId) {
        const container = safeGetElement('players-list');
        const countEl = safeGetElement('player-count');
        
        if (!container || !countEl || !Array.isArray(players)) return;
        
        const connectedPlayers = players.filter(p => p.connected);
        const count = connectedPlayers.length;
        countEl.textContent = count;
        
        container.innerHTML = '';
        
        // 接続中のプレイヤーを先に表示
        const sortedPlayers = [...players].sort((a, b) => {
            if (a.connected && !b.connected) return -1;
            if (!a.connected && b.connected) return 1;
            if (a.id === hostId) return -1;
            if (b.id === hostId) return 1;
            return a.name.localeCompare(b.name);
        });
        
        sortedPlayers.forEach((player) => {
            const div = document.createElement('div');
            div.className = 'player-item';
            
            if (player.id === hostId) {
                div.classList.add('host');
                div.title = 'ホスト';
            }
            
            const status = player.connected ? '🟢' : '🔴';
            const disconnectedText = player.connected ? '' : ' (切断中)';
            const hostText = player.id === hostId ? ' 👑' : '';
            
            div.innerHTML = `
                <span>${status} ${player.name}${disconnectedText}${hostText}</span>
                ${player.role ? `<small style="color: #87CEEB;">${this.getRoleDisplayName(player.role)}</small>` : ''}
            `;
            
            if (!player.connected) {
                div.style.opacity = '0.6';
                div.style.fontStyle = 'italic';
            }
            
            container.appendChild(div);
        });
    }

    // 役職表示名取得
    static getRoleDisplayName(role) {
        switch (role) {
            case 'adventurer': return '⛏️ 探検家';
            case 'guardian': return '🐷 豚男';
            default: return role;
        }
    }

    // ゲーム概要更新
    static updateGameOverview(playerCount) {
        let roleText = '';
        let cardText = '';

        const roleConfig = {
            3: { roleText: '探検家 1-2人、豚男 1-2人', cardText: '子豚5匹、罠2個、空き部屋8個' },
            4: { roleText: '探検家 2-3人、豚男 1-2人', cardText: '子豚6匹、罠2個、空き部屋12個' },
            5: { roleText: '探検家 3人、豚男 2人', cardText: '子豚7匹、罠2個、空き部屋16個' },
            6: { roleText: '探検家 4人、豚男 2人', cardText: '子豚8匹、罠2個、空き部屋20個' },
            7: { roleText: '探検家 4-5人、豚男 2-3人', cardText: '子豚7匹、罠2個、空き部屋26個' },
            8: { roleText: '探検家 5-6人、豚男 2-3人', cardText: '子豚8匹、罠2個、空き部屋30個' },
            9: { roleText: '探検家 6人、豚男 3人', cardText: '子豚9匹、罠2個、空き部屋34個' },
            10: { roleText: '探検家 6-7人、豚男 3-4人', cardText: '子豚10匹、罠3個、空き部屋37個' }
        };

        const config = roleConfig[playerCount] || roleConfig[5];
        roleText = config.roleText;
        cardText = config.cardText;

        safeSetText('role-possibility-text', roleText);
        safeSetText('card-distribution-text', cardText);
    }

    // 進捗バー更新
    static updateProgressBars(gameData) {
        const treasureTotal = gameData.totalTreasures || gameData.treasureGoal || 7;
        const trapTotal = gameData.totalTraps || gameData.trapGoal || 2;
        const treasureFound = gameData.treasureFound || 0;
        const trapTriggered = gameData.trapTriggered || 0;

        // 財宝の進捗バー
        this.updateIconRow('treasure-icons', treasureTotal, treasureFound, 'treasure');
        // 罠の進捗バー
        this.updateIconRow('trap-icons', trapTotal, trapTriggered, 'trap');
    }

    // アイコン行更新
    static updateIconRow(containerId, total, used, type) {
        const container = safeGetElement(containerId);
        if (!container) return;

        container.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const icon = document.createElement('div');
            icon.className = `progress-icon ${type}`;
            
            if (i < used) {
                icon.classList.add('used');
            }
            
            // アイコンの内容設定
            if (type === 'treasure') {
                icon.textContent = i < used ? '👶' : '🐷';
                icon.title = i < used ? '救出済み' : '救出待ち';
            } else if (type === 'trap') {
                icon.textContent = '💀';
                icon.title = i < used ? '発動済み' : '未発動';
                if (i < used) {
                    icon.style.filter = 'grayscale(100%) brightness(0.7)';
                }
            }
            
            container.appendChild(icon);
        }
    }

    // ゲーム情報更新
    static updateGameInfo(gameData) {
        const updates = {
            'current-round': gameData.currentRound,
            'treasure-found': gameData.treasureFound || 0,
            'trap-triggered': gameData.trapTriggered || 0,
            'trap-goal': gameData.trapGoal || 2,
            'cards-per-player': gameData.cardsPerPlayer || 5,
            'cards-flipped': gameData.cardsFlippedThisRound || 0,
            'treasure-goal': gameData.treasureGoal || 7
        };

        Object.entries(updates).forEach(([id, value]) => {
            safeSetText(id, value);
        });
    }

    // ラウンド開始演出
    static showRoundStart(roundNumber) {
        const overlay = safeGetElement('round-start-overlay');
        const message = safeGetElement('round-start-message');
        
        if (overlay && message) {
            message.textContent = `ラウンド ${roundNumber} スタート！`;
            overlay.style.display = 'flex';
            
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 3000);
        }
        
        // トーストでも通知
        this.showToast(`ラウンド ${roundNumber} 開始！`, 'info', 2000);
    }

    // 勝利画面表示
    static showVictoryScreen(gameData) {
        this.showScreen('victory-screen');
        
        const title = safeGetElement('victory-title');
        const message = safeGetElement('victory-message');
        const winnersList = safeGetElement('winners-list');
        
        if (!title || !message || !winnersList) return;
        
        if (gameData.winningTeam === 'adventurer') {
            title.textContent = '⛏️ 探検家チームの勝利！';
            title.style.color = '#FFD700';
        } else {
            title.textContent = '🐷 豚男チームの勝利！';
            title.style.color = '#DC143C';
        }
        
        message.textContent = gameData.victoryMessage || 'ゲーム終了！';
        
        // 勝利者一覧表示
        winnersList.innerHTML = '<h3>勝利チーム:</h3>';
        if (gameData.players) {
            gameData.players.forEach((player) => {
                const isWinner = (gameData.winningTeam === 'adventurer' && player.role === 'adventurer') ||
                                (gameData.winningTeam === 'guardian' && player.role === 'guardian');
                
                if (isWinner) {
                    const div = document.createElement('div');
                    div.innerHTML = `🎉 ${player.name} <small>(${this.getRoleDisplayName(player.role)})</small>`;
                    div.style.cssText = 'color: #FFD700; margin: 5px 0; font-weight: bold;';
                    winnersList.appendChild(div);
                }
            });
        }

        // 勝利時のトースト
        this.showToast('ゲーム終了！お疲れ様でした！', 'success', 5000);
    }

    // メッセージ更新
    static updateMessages(messages) {
        const container = safeGetElement('chat-container');
        if (!container || !Array.isArray(messages)) return;
        
        const recentMessages = messages.slice(-20);
        
        container.innerHTML = '';
        recentMessages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-message ${msg.type}`;
            
            const timestamp = new Date(msg.timestamp).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            if (msg.type === 'player') {
                div.innerHTML = `
                    <span class="message-time">[${timestamp}]</span>
                    <strong>${msg.playerName}:</strong> ${msg.text}
                `;
            } else {
                div.innerHTML = `
                    <span class="message-time">[${timestamp}]</span>
                    ${msg.text}
                `;
            }
            
            container.appendChild(div);
        });
        
        container.scrollTop = container.scrollHeight;
    }

    // クイック参加ボタンの表示制御
    static showQuickJoinButton(show = true) {
        const quickJoinBtn = safeGetElement('quick-join');
        if (quickJoinBtn) {
            if (show) {
                quickJoinBtn.style.display = 'block';
                setTimeout(() => {
                    quickJoinBtn.style.opacity = '1';
                }, 100);
            } else {
                quickJoinBtn.style.opacity = '0.5';
                setTimeout(() => {
                    quickJoinBtn.style.display = 'none';
                }, 300);
            }
        }
    }

    // アクセシビリティ: フォーカス管理
    static manageFocus() {
        // モーダルが開いている時の処理
        const modal = safeGetElement('confirm-modal');
        if (modal && modal.style.display === 'flex') {
            const focusableElements = modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusableElements.length > 0) {
                focusableElements[0].focus();
            }
        }
    }

    // デバッグ情報表示
    static showDebugInfo(info) {
        if (window.location.search.includes('debug=1')) {
            console.log('🐛 Debug Info:', info);
            this.showToast(`Debug: ${JSON.stringify(info)}`, 'info', 2000);
        }
    }
}

// グローバルに公開
window.UIManager = UIManager;

console.log('✅ UI-Manager.js 読み込み完了');
        }
        
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        // 閉じるボタンを追加（長いメッセージの場合）
        if (message.length > 50) {
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: inherit;
                font-size: 18px;
                font-weight: bold;
                margin-left: 10px;
                cursor: pointer;
                padding: 0;
            `;
            closeBtn.onclick = () => this.removeToast(toast);
            toast.appendChild(closeBtn);
        }
        
        document.body.appendChild(toast);
        this.activeToasts.add(toast);
        
        // アニメーション
        setTimeout(() => toast.classList.add('show'), 100);
        
        // 自動削除
        const autoRemove = setTimeout(() => {
            this.removeToast(toast);
        }, duration);
        
        // クリックで削除
        toast.onclick = () => {
            clearTimeout(autoRemove);
            this.removeToast(toast);
        };
        
        return toast;
    }
    
    static removeToast(toast) {
        if (!toast || !toast.parentNode) return;
        
        toast.classList.remove('show');
        this.activeToasts.delete(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
