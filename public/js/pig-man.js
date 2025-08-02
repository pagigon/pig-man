window.addEventListener('unhandledrejection', (event) => {
            self.logError('Unhandled Promise Rejection', {
                reason: event.reason,
                promise: event.promise
            });
        });

        this.socketErrorCount = 0;
        this.lastSocketError = null;
    }

    logError(type, details) {
        const errorInfo = {
            type,
            details,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            roomId: this.roomId,
            playerName: this.myName,
            isSpectator: this.isSpectator
        };

        console.error('Game Error:', errorInfo);

        if (this.socketClient && this.socketClient.isConnected()) {
            this.socketClient.emit('clientError', errorInfo);
        }

        if (type === 'JavaScript Error' || type === 'Unhandled Promise Rejection') {
            UIManager.showError('予期しないエラーが発生しました。ページをリロードしてください。', 'error');
        }
    }

    vibrate(pattern) {
        if (navigator.vibrate && ('ontouchstart' in window || typeof window.DeviceMotionEvent !== 'undefined')) {
            try {
                const result = navigator.vibrate(pattern);
                console.log('Vibration result:', result, 'Pattern:', pattern);
                return result;
            } catch (error) {
                console.warn('Vibration error:', error);
                return false;
            }
        } else {
            console.log('Vibration not supported on this device');
            return false;
        }
    }

    initializeEventListeners() {
        console.log('🎮 イベントリスナー設定開始');
        
        // パスワード表示切り替え
        const passwordToggleSuccess = safeAddEventListener('use-password', 'change', (e) => {
            console.log('パスワード設定切り替え:', e.target.checked);
            const passwordGroup = safeGetElement('password-group');
            if (passwordGroup) {
                passwordGroup.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // ルーム作成ボタン
        const createRoomSuccess = safeAddEventListener('create-room', 'click', (e) => {
            console.log('🏠 ルーム作成ボタンクリック');
            e.preventDefault();
            this.createRoom();
        });

        // ルーム参加ボタン
        const joinRoomSuccess = safeAddEventListener('join-room', 'click', (e) => {
            console.log('👥 ルーム参加ボタンクリック');
            e.preventDefault();
            this.joinRoom();
        });

        // 再入場ボタン
        const rejoinRoomSuccess = safeAddEventListener('rejoin-room', 'click', (e) => {
            console.log('🔄 再入場ボタンクリック');
            e.preventDefault();
            this.rejoinRoom();
        });

        // 観戦ボタン
        const spectateRoomSuccess = safeAddEventListener('spectate-room', 'click', (e) => {
            console.log('👁️ 観戦ボタンクリック');
            e.preventDefault();
            this.spectateRoom();
        });

        // ルーム退出ボタン
        const leaveRoomSuccess = safeAddEventListener('leave-room', 'click', (e) => {
            console.log('🚪 ルーム退出ボタンクリック');
            e.preventDefault();
            this.leaveRoom();
        });

        // 一時退出ボタン
        const tempLeaveSuccess = safeAddEventListener('temp-leave-room', 'click', (e) => {
            console.log('🚶 一時退出ボタンクリック');
            e.preventDefault();
            this.tempLeaveRoom();
        });

        // 一時退出キャンセル
        const cancelTempLeaveSuccess = safeAddEventListener('cancel-temp-leave', 'click', (e) => {
            console.log('❌ 一時退出キャンセル');
            e.preventDefault();
            this.cancelTempLeave();
        });

        // ゲーム中退出ボタン
        const gameLeaveSuccess = safeAddEventListener('game-leave-room', 'click', (e) => {
            console.log('🚶 ゲーム中退出ボタンクリック');
            e.preventDefault();
            this.showTempLeaveDialog();
        });

        // ゲーム開始ボタン
        const startGameSuccess = safeAddEventListener('start-game', 'click', (e) => {
            console.log('🎮 ゲーム開始ボタンクリック');
            e.preventDefault();
            this.startGame();
        });

        // ロビーに戻るボタン
        const returnLobbySuccess = safeAddEventListener('return-to-lobby', 'click', (e) => {
            console.log('🏠 ロビーに戻るボタンクリック');
            e.preventDefault();
            this.returnToLobby();
        });

        // リフレッシュボタン
        const refreshRoomsSuccess = safeAddEventListener('refresh-rooms', 'click', (e) => {
            console.log('🔄 ルーム一覧更新ボタンクリック');
            e.preventDefault();
            this.socketClient.getRoomList();
        });

        const refreshOngoingSuccess = safeAddEventListener('refresh-ongoing', 'click', (e) => {
            console.log('🔄 進行中ゲーム更新ボタンクリック');
            e.preventDefault();
            this.socketClient.getOngoingGames();
        });

        // チャット
        const sendChatSuccess = safeAddEventListener('send-chat', 'click', (e) => {
            console.log('💬 チャット送信ボタンクリック');
            e.preventDefault();
            this.sendChat();
        });
        
        const chatInput = safeGetElement('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendChat();
                }
            });
        }

        // ページ離脱時の警告
        window.addEventListener('beforeunload', (e) => {
            if (this.roomId && this.gameData && this.gameData.gameState === 'playing') {
                e.preventDefault();
                e.returnValue = 'ゲーム中です。本当にページを離れますか？';
                return e.returnValue;
            }
        });

        // 手動再接続ボタンを追加
        this.addManualReconnectButton();

        // イベント設定結果の確認
        const results = {
            passwordToggle: passwordToggleSuccess,
            createRoom: createRoomSuccess,
            joinRoom: joinRoomSuccess,
            rejoinRoom: rejoinRoomSuccess,
            spectateRoom: spectateRoomSuccess,
            leaveRoom: leaveRoomSuccess,
            tempLeave: tempLeaveSuccess,
            cancelTempLeave: cancelTempLeaveSuccess,
            gameLeave: gameLeaveSuccess,
            startGame: startGameSuccess,
            returnLobby: returnLobbySuccess,
            refreshRooms: refreshRoomsSuccess,
            refreshOngoing: refreshOngoingSuccess,
            sendChat: sendChatSuccess
        };

        console.log('イベントリスナー設定結果:', results);
        
        const failedEvents = Object.entries(results)
            .filter(([key, success]) => !success)
            .map(([key]) => key);

        if (failedEvents.length > 0) {
            console.error('❌ 設定に失敗したイベント:', failedEvents);
            UIManager.showError(`一部のボタンが正常に動作しない可能性があります: ${failedEvents.join(', ')}`);
        } else {
            console.log('✅ すべてのイベントリスナー設定成功');
        }
    }

    addManualReconnectButton() {
        const reconnectBtn = document.createElement('button');
        reconnectBtn.id = 'manual-reconnect';
        reconnectBtn.className = 'btn btn-small';
        reconnectBtn.textContent = '🔄 再接続';
        reconnectBtn.style.position = 'fixed';
        reconnectBtn.style.top = '10px';
        reconnectBtn.style.left = '200px';
        reconnectBtn.style.zIndex = '1000';
        reconnectBtn.style.width = 'auto';
        
        reconnectBtn.onclick = () => {
            console.log('手動再接続ボタンクリック');
            this.socketClient.forceReconnect();
            UIManager.showError('再接続を試行中...', 'warning');
        };
        
        document.body.appendChild(reconnectBtn);
    }

    attemptReconnection() {
        try {
            const rejoinInfo = localStorage.getItem('pigGameRejoinInfo');
            if (rejoinInfo) {
                const info = JSON.parse(rejoinInfo);
                console.log('保存された再入場情報:', info);
                
                if (Date.now() - info.timestamp < 24 * 60 * 60 * 1000) {
                    this.populateRejoinInfo(info);
                    UIManager.showError('前回のゲームへの再入場情報が見つかりました', 'warning');
                } else {
                    localStorage.removeItem('pigGameRejoinInfo');
                }
                return;
            }

            const savedPlayerInfo = localStorage.getItem('pigGamePlayerInfo');
            if (savedPlayerInfo) {
                const playerInfo = JSON.parse(savedPlayerInfo);
                console.log('保存された情報で再接続を試行:', playerInfo);
                
                this.myName = playerInfo.playerName;
                this.isHost = playerInfo.isHost;
                UIManager.showPlayerName(this.myName);
                
                setTimeout(() => {
                    this.socketClient.reconnectToRoom(playerInfo.roomId, playerInfo.playerName);
                }, 1000);
            }
        } catch (error) {
            console.error('再接続情報の読み込みエラー:', error);
            localStorage.removeItem('pigGamePlayerInfo');
            localStorage.removeItem('pigGameRejoinInfo');
        }
    }

    savePlayerInfo(playerInfo) {
        try {
            localStorage.setItem('pigGamePlayerInfo', JSON.stringify(playerInfo));
            console.log('プレイヤー情報を保存:', playerInfo);
        } catch (error) {
            console.error('プレイヤー情報の保存エラー:', error);
        }
    }

    clearPlayerInfo() {
        try {
            localStorage.removeItem('pigGamePlayerInfo');
            console.log('プレイヤー情報を削除');
        } catch (error) {
            console.error('プレイヤー情報の削除エラー:', error);
        }
    }

    createRoom() {
        console.log('🏠 ルーム作成処理開始');
        
        if (!this.socketClient.isConnected()) {
            console.error('❌ ルーム作成失敗: Socket未接続');
            UIManager.showError('サーバーに接続されていません。再接続ボタンを押してください。');
            return;
        }

        const nameInput = safeGetElement('player-name-create');
        const passwordCheck = safeGetElement('use-password');
        const passwordInput = safeGetElement('room-password');

        if (!nameInput) {
            console.error('❌ プレイヤー名入力欄が見つかりません');
            UIManager.showError('プレイヤー名入力欄が見つかりません');
            return;
        }

        const playerName = nameInput.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
        const hasPassword = passwordCheck ? passwordCheck.checked : false;
        const password = hasPassword && passwordInput ? passwordInput.value : '';

        console.log('ルーム作成パラメータ:', {
            playerName,
            hasPassword,
            passwordLength: password.length
        });

        this.myName = playerName;
        UIManager.showPlayerName(this.myName);

        const success = this.socketClient.createRoom(playerName, hasPassword, password);
        
        if (success) {
            UIManager.showError('ルームを作成中...', 'warning');
            
            setTimeout(() => {
                if (!this.roomId) {
                    console.warn('⚠️ ルーム作成がタイムアウトしました');
                    UIManager.showError('ルーム作成に時間がかかっています。もう一度お試しください。', 'warning');
                }
            }, 15000);
        }
    }

    joinRoom() {
        console.log('👥 ルーム参加処理開始');
        
        if (!this.socketClient.isConnected()) {
            console.error('❌ ルーム参加失敗: Socket未接続');
            UIManager.showError('サーバーに接続されていません');
            return;
        }

        const nameInput = safeGetElement('player-name-join');
        const roomInput = safeGetElement('room-id-input');
        const passwordInput = safeGetElement('join-password');

        if (!nameInput || !roomInput) {
            console.error('❌ 必要な入力欄が見つかりません');
            UIManager.showError('入力欄が見つかりません');
            return;
        }

        const playerName = nameInput.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
        const roomId = roomInput.value.trim().toUpperCase();
        const password = passwordInput ? passwordInput.value : '';

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            return;
        }

        console.log('ルーム参加パラメータ:', { playerName, roomId });

        this.myName = playerName;
        this.roomId = roomId;
        UIManager.showPlayerName(this.myName);

        const success = this.socketClient.joinRoom(roomId, playerName, password);
        
        if (success) {
            UIManager.showError('ルームに参加中...', 'warning');
        }
    }

    rejoinRoom() {
        console.log('🔄 再入場処理開始');
        
        const nameInput = safeGetElement('rejoin-player-name');
        const roomInput = safeGetElement('rejoin-room-id');
        
        const playerName = nameInput?.value.trim() || '';
        const roomId = roomInput?.value.trim().toUpperCase() || '';

        if (!playerName) {
            UIManager.showError('プレイヤー名を入力してください');
            return;
        }

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            return;
        }

        this.myName = playerName;
        UIManager.showPlayerName(this.myName);
        this.roomId = roomId;
        
        this.socketClient.rejoinRoom(roomId, playerName);
    }

    spectateRoom() {
        console.log('👁️ 観戦処理開始');
        
        const nameInput = safeGetElement('spectator-name');
        const roomInput = safeGetElement('spectate-room-id');
        
        const spectatorName = nameInput?.value.trim() || `観戦者${Math.floor(Math.random() * 1000)}`;
        const roomId = roomInput?.value.trim().toUpperCase() || '';

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            return;
        }

        this.myName = spectatorName;
        this.isSpectator = true;
        UIManager.showPlayerName(this.myName + ' (観戦)');
        this.roomId = roomId;
        
        this.socketClient.spectateRoom(roomId, spectatorName);
    }

    showTempLeaveDialog() {
        if (this.gameData && this.gameData.gameState === 'playing') {
            const tempLeaveSection = safeGetElement('temp-leave-section');
            if (tempLeaveSection) {
                tempLeaveSection.style.display = 'block';
            }
            UIManager.showScreen('room-info');
            const roomIdDisplay = safeGetElement('room-id-display');
            if (roomIdDisplay && this.roomId) {
                roomIdDisplay.textContent = this.roomId;
            }
        } else {
            this.leaveRoom();
        }
    }

    cancelTempLeave() {
        const tempLeaveSection = safeGetElement('temp-leave-section');
        if (tempLeaveSection) {
            tempLeaveSection.style.display = 'none';
        }
        if (this.gameData && this.gameData.gameState === 'playing') {
            UIManager.showScreen('game-board');
        }
    }

    tempLeaveRoom() {
        const rejoinInfo = {
            roomId: this.roomId,
            playerName: this.myName,
            tempLeft: true,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem('pigGameRejoinInfo', JSON.stringify(rejoinInfo));
        } catch (error) {
            console.error('再入場情報の保存エラー:', error);
        }

        this.socketClient.tempLeaveRoom();
        
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.isSpectator = false;
        
        UIManager.showSpectatorMode(false);
        UIManager.showScreen('lobby');
        
        this.populateRejoinInfo(rejoinInfo);
        
        UIManager.showError('一時退出しました。同じプレイヤー名とルームIDで再入場できます。', 'warning');
    }

    populateRejoinInfo(rejoinInfo) {
        const rejoinPlayerNameEl = safeGetElement('rejoin-player-name');
        const rejoinRoomIdEl = safeGetElement('rejoin-room-id');
        
        if (rejoinPlayerNameEl) rejoinPlayerNameEl.value = rejoinInfo.playerName;
        if (rejoinRoomIdEl) rejoinRoomIdEl.value = rejoinInfo.roomId;
    }

    // サーバーからのイベント処理
    onRoomCreated(data) {
        console.log('✅ ルーム作成成功コールバック:', data);
        
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = true;
        
        this.savePlayerInfo(data.playerInfo);

        UIManager.showError(`ルーム ${data.roomId} を作成しました！`, 'success');
        this.showRoomInfo();
        this.updateUI();
    }

    onJoinSuccess(data) {
        console.log('✅ ルーム参加成功コールバック:', data);
        
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.playerInfo?.isHost || false;
        
        this.savePlayerInfo(data.playerInfo);

        UIManager.showError(`ルーム ${data.roomId} に参加しました！`, 'success');
        this.updateUI();
    }

    onSpectateSuccess(data) {
        console.log('✅ 観戦成功コールバック:', data);
        
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isSpectator = true;
        
        UIManager.showSpectatorMode(true);
        this.updateUI();
    }

    onRejoinSuccess(data) {
        console.log('✅ 再入場成功コールバック:', data);
        
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.isHost;
        
        try {
            localStorage.removeItem('pigGameRejoinInfo');
        } catch (error) {
            console.error('再入場情報の削除エラー:', error);
        }
        
        UIManager.showError('ゲームに再入場しました！', 'success');
        this.updateUI();
    }

    onReconnectSuccess(data) {
        console.log('✅ 再接続成功コールバック:', data);
        
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.isHost;
        
        UIManager.showError('ゲームに再接続しました！', 'success');
        this.updateUI();
    }

    showRoomInfo() {
        console.log('🏠 ルーム情報画面表示');
        UIManager.showScreen('room-info');
        
        const roomIdDisplay = safeGetElement('room-id-display');
        if (roomIdDisplay && this.roomId) {
            roomIdDisplay.textContent = this.roomId;
        }
        
        // プレイヤー一覧も更新
        if (this.gameData && this.gameData.players) {
            UIManager.updatePlayersList(this.gameData.players, this.gameData.host);
        }
    }

    updateUI() {
        console.log('🎨 UI更新');
        if (!this.gameData) {
            console.warn('⚠️ ゲームデータが存在しません');
            return;
        }

        // 財宝目標をUIに反映
        const treasureGoalEl = safeGetElement('treasure-goal');
        if (treasureGoalEl) {
            treasureGoalEl.textContent = this.gameData.treasureGoal || 7;
        }

        // プレイヤー一覧を常に更新
        if (this.gameData.players) {
            UIManager.updatePlayersList(this.gameData.players, this.gameData.host);
        }

        if (this.gameData.gameState === 'waiting') {
            this.updateLobbyUI();
        } else if (this.gameData.gameState === 'playing') {
            this.updateGameUI();
        } else if (this.gameData.gameState === 'finished') {
            UIManager.showVictoryScreen(this.gameData);
            
            if (this.gameData.winningTeam === 'adventurer') {
                this.vibrate([200, 100, 200, 100, 200]);
            } else {
                this.vibrate([100, 50, 100, 50, 300]);
            }
        }
    }

    updateLobbyUI() {
        console.log('🏠 ロビーUI更新');
        UIManager.showScreen('room-info');
        
        // プレイヤー一覧を再更新
        if (this.gameData.players) {
            UIManager.updatePlayersList(this.gameData.players, this.gameData.host);
        }
        
        const startButton = safeGetElement('start-game');
        const tempLeaveSection = safeGetElement('temp-leave-section');
        
        const count = this.gameData.players ? this.gameData.players.filter(p => p.connected).length : 0;
        
        if (this.isHost && count >= 3 && startButton) {
            startButton.style.display = 'block';
        } else if (startButton) {
            startButton.style.display = 'none';
        }
        
        if (tempLeaveSection) {
            tempLeaveSection.style.display = 'none';
        }
    }

    updateGameUI() {
        UIManager.showScreen('game-board');

        UIManager.updateGameOverview(this.gameData.players.length);
        UIManager.updateProgressBars(this.gameData);
        UIManager.updateGameInfo(this.gameData);

        const keyHolder = this.gameData.players.find(p => p.id === this.gameData.keyHolderId);
        safeSetText('key-holder-name', keyHolder?.name || '不明');
        
        const isMyTurn = this.gameData.keyHolderId === this.mySocketId;
        safeSetText('turn-message', isMyTurn ? 'あなたのターンです！他のプレイヤーのカードを選んでください' : '待機中...');

        this.showPlayerRole();
        this.renderMyCards();
        this.renderOtherPlayers(isMyTurn);

        this.addCardRevealEffects();
    }

    addCardRevealEffects() {
        if (this.gameData.lastRevealedCard) {
            const cardType = this.gameData.lastRevealedCard.type;
            
            switch (cardType) {
                case 'treasure':
                    this.vibrate([100, 50, 100]);
                    break;
                case 'trap':
                    this.vibrate([200, 100, 200, 100, 200]);
                    break;
                case 'empty':
                    this.vibrate([50]);
                    break;
            }
            
            delete this.gameData.lastRevealedCard;
        }
    }

    showPlayerRole() {
        const myPlayer = this.gameData.players.find(p => p.id === this.mySocketId);
        const myRole = myPlayer?.role;
        const roleCard = safeGetElement('role-reveal');
        const roleText = safeGetElement('player-role');
        const roleDesc = safeGetElement('role-description');
        const roleImage = safeGetElement('role-image');

        if (!roleCard || !roleText || !roleDesc || !roleImage) return;

        if (myRole === 'adventurer') {
            roleCard.className = 'role-card role-adventurer compact';
            roleText.textContent = '⛏️ 探検家 (Explorer)';
            roleDesc.textContent = `子豚に変えられた子供を${this.gameData.treasureGoal || 7}匹すべて救出することが目標です！`;
            roleImage.src = '/images/role-adventurer.png';
            roleImage.alt = '探検家';
            
            roleImage.onerror = () => {
                roleImage.style.display = 'none';
                const emoji = document.createElement('div');
                emoji.textContent = '⛏️';
                emoji.style.fontSize = '4em';
                emoji.style.textAlign = 'center';
                roleImage.parentNode.insertBefore(emoji, roleImage.nextSibling);
            };
        } else if (myRole === 'guardian') {
            roleCard.className = 'role-card role-guardian compact';
            roleText.textContent = '🐷 豚男 (Pig Man)';
            roleDesc.textContent = `罠を${this.gameData.trapGoal || 2}個すべて発動させるか、4ラウンド終了まで子豚たちを隠し続けることが目標です！`;
            roleImage.src = '/images/role-guardian.png';
            roleImage.alt = '豚男';
            
            roleImage.onerror = () => {
                roleImage.style.display = 'none';
                const emoji = document.createElement('div');
                emoji.textContent = '🐷';
                emoji.style.fontSize = '4em';
                emoji.style.textAlign = 'center';
                roleImage.parentNode.insertBefore(emoji, roleImage.nextSibling);
            };
        }
    }

    renderMyCards() {
        const myCardsSection = document.querySelector('.my-cards-section');
        if (this.isSpectator) {
            if (myCardsSection) myCardsSection.style.display = 'none';
            return;
        } else {
            if (myCardsSection) myCardsSection.style.display = 'block';
        }

        const myPlayer = this.gameData.players.find(p => p.id === this.mySocketId);
        if (!myPlayer || !myPlayer.hand) return;

        const container = safeGetElement('my-cards-grid');
        if (!container) return;
        
        container.innerHTML = '';

        let treasureCount = 0, trapCount = 0, emptyCount = 0;
        
        myPlayer.hand.forEach((card, index) => {
            const div = document.createElement('div');
            div.className = 'card';
            
            if (card.revealed) {
                div.classList.add('revealed', card.type);
                const img = document.createElement('img');
                img.className = 'card-image';
                img.src = `/images/card-${card.type}-large.png`;
                img.alt = card.type;
                
                img.onerror = () => {
                    img.style.display = 'none';
                    const emoji = document.createElement('div');
                    emoji.style.fontSize = '2.5em';
                    emoji.style.textAlign = 'center';
                    emoji.style.lineHeight = '1';
                    switch (card.type) {
                        case 'treasure':
                            emoji.textContent = '🐷';
                            break;
                        case 'trap':
                            emoji.textContent = '💀';
                            break;
                        case 'empty':
                            emoji.textContent = '🏠';
                            break;
                    }
                    div.appendChild(emoji);
                };
                
                div.appendChild(img);
            } else {
                const img = document.createElement('img');
                img.className = 'card-image';
                img.src = '/images/card-back-large.png';
                img.alt = 'カード裏面';
                
                img.onerror = () => {
                    img.style.display = 'none';
                    const emoji = document.createElement('div');
                    emoji.textContent = '❓';
                    emoji.style.fontSize = '2.5em';
                    emoji.style.textAlign = 'center';
                    emoji.style.lineHeight = '1';
                    div.appendChild(emoji);
                };
                
                div.appendChild(img);
                
                switch (card.type) {
                    case 'treasure':
                        treasureCount++;
                        break;
                    case 'trap':
                        trapCount++;
                        break;// 豚小屋探検隊 - 修正版完全JavaScript
console.log('🐷 豚小屋探検隊 JavaScript 開始');

// Render環境の検出
const isRenderEnvironment = window.location.hostname.includes('render') || 
                           window.location.hostname.includes('onrender');
console.log('Render環境:', isRenderEnvironment);

// デバッグ用のグローバル関数
window.debugInfo = () => {
    console.log('=== デバッグ情報 ===');
    console.log('URL:', window.location.href);
    console.log('Render環境:', isRenderEnvironment);
    console.log('Socket.io 存在:', typeof io !== 'undefined');
    console.log('PigManGame インスタンス:', window.pigGame ? '存在' : '未作成');
    if (window.pigGame?.socketClient?.socket) {
        console.log('Socket ID:', window.pigGame.socketClient.socket.id);
        console.log('Socket 接続状態:', window.pigGame.socketClient.socket.connected);
        console.log('Socket Transport:', window.pigGame.socketClient.socket.io.engine.transport.name);
    }
    console.log('現在のルームID:', window.pigGame?.roomId || 'なし');
    console.log('プレイヤー名:', window.pigGame?.myName || 'なし');
    console.log('==================');
};

// ユーティリティ関数
const safeGetElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`⚠️ 要素が見つかりません: #${id}`);
    }
    return element;
};

const safeSetText = (id, text) => {
    const el = safeGetElement(id);
    if (el) {
        el.textContent = text;
        return true;
    }
    return false;
};

const safeAddEventListener = (id, event, handler) => {
    const element = safeGetElement(id);
    if (element) {
        element.addEventListener(event, handler);
        console.log(`✅ ${id} に${event}イベント追加成功`);
        return true;
    } else {
        console.warn(`⚠️ イベント追加失敗: #${id}`);
        return false;
    }
};

// UIManager クラス
class UIManager {
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
            
            const gameBoard = safeGetElement('game-board');
            if (gameBoard) {
                gameBoard.classList.add('spectator-mode');
            }
            
            this.addSpectatorInfo();
        } else {
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            const gameBoard = safeGetElement('game-board');
            if (gameBoard) {
                gameBoard.classList.remove('spectator-mode');
            }
            
            this.removeSpectatorInfo();
        }
    }

    static addSpectatorInfo() {
        const gameBoard = safeGetElement('game-board');
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

    static showError(message, type = 'error') {
        console.log(`UI エラー表示: ${message} (タイプ: ${type})`);
        const errorEl = safeGetElement('error-message');
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
        const displayEl = safeGetElement('player-name-display');
        const nameEl = safeGetElement('my-name');
        
        if (displayEl && nameEl) {
            displayEl.style.display = 'block';
            nameEl.textContent = name;
        }
    }

    static updateRoomList(rooms) {
        console.log(`ルーム一覧更新: ${rooms.length}個のルーム`);
        const container = safeGetElement('room-list-container');
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
                const roomIdInput = safeGetElement('room-id-input');
                if (roomIdInput) roomIdInput.value = room.id;
                if (room.hasPassword) {
                    const passwordGroup = safeGetElement('join-password-group');
                    if (passwordGroup) passwordGroup.style.display = 'block';
                }
            };
            
            roomDiv.appendChild(infoDiv);
            roomDiv.appendChild(joinBtn);
            container.appendChild(roomDiv);
        });
    }

    static updateOngoingGames(games) {
        const container = safeGetElement('ongoing-games-container');
        if (!container) return;
        
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
                const spectateRoomInput = safeGetElement('spectate-room-id');
                const spectatorNameInput = safeGetElement('spectator-name');
                
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
            const element = safeGetElement(screen);
            if (element) {
                element.style.display = 'none';
            }
        });
        
        if (screenName) {
            const screen = safeGetElement(screenName);
            if (screen) {
                screen.style.display = 'block';
            }
        }
    }

    static updatePlayersList(players, hostId) {
        console.log(`プレイヤー一覧更新: ${players.length}人`);
        const container = safeGetElement('players-list');
        const countEl = safeGetElement('player-count');
        
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

        safeSetText('role-possibility-text', roleText);
        safeSetText('card-distribution-text', cardText);
    }

    static updateProgressBars(gameData) {
        const treasureTotal = gameData.totalTreasures || gameData.treasureGoal || 7;
        const trapTotal = gameData.totalTraps || gameData.trapGoal || 2;
        const treasureFound = gameData.treasureFound || 0;
        const trapTriggered = gameData.trapTriggered || 0;

        // 財宝の進捗バー
        const treasureContainer = safeGetElement('treasure-icons');
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
        const trapContainer = safeGetElement('trap-icons');
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
        safeSetText('current-round', gameData.currentRound);
        safeSetText('treasure-found', gameData.treasureFound || 0);
        safeSetText('trap-triggered', gameData.trapTriggered || 0);
        safeSetText('trap-goal', gameData.trapGoal || 2);
        safeSetText('cards-per-player', gameData.cardsPerPlayer || 5);
        safeSetText('cards-flipped', gameData.cardsFlippedThisRound || 0);
        safeSetText('treasure-goal', gameData.treasureGoal || 7);
    }

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
    }

    static showVictoryScreen(gameData) {
        const screen = safeGetElement('victory-screen');
        const title = safeGetElement('victory-title');
        const messageEl = safeGetElement('victory-message');
        const winnersList = safeGetElement('winners-list');
        
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
        const container = safeGetElement('chat-container');
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
}

// SocketClient クラス
class SocketClient {
    constructor(game) {
        console.log('SocketClient 初期化開始');
        this.game = game;
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.connectionTimeout = null;
        this.initializeSocket();
    }

    initializeSocket() {
        console.log('Socket.io 初期化開始 (Render対応)');
        
        if (typeof io === 'undefined') {
            console.error('❌ Socket.io が読み込まれていません');
            UIManager.showError('Socket.io ライブラリが読み込まれていません');
            return;
        }

        try {
            const socketConfig = {
                transports: ['polling', 'websocket'],
                timeout: 15000,
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 3000,
                reconnectionDelayMax: 15000,
                forceNew: false,
                pingInterval: 25000,
                pingTimeout: 20000,
                upgrade: true,
                autoConnect: true
            };

            console.log('Socket.io 設定:', socketConfig);
            this.socket = io(socketConfig);

            console.log('Socket.io インスタンス作成成功');
            this.setupEventListeners();
            this.setupConnectionMonitoring();
            
        } catch (error) {
            console.error('❌ Socket.io 初期化エラー:', error);
            UIManager.showError('サーバー接続の初期化に失敗しました');
        }
    }

    setupEventListeners() {
        console.log('Socket イベントリスナー設定開始');
        
        if (!this.socket) {
            console.error('❌ Socket が存在しません');
            return;
        }

        // 接続イベント
        this.socket.on('connect', () => {
            console.log('✅ Socket.io 接続成功:', this.socket.id);
            console.log('Transport:', this.socket.io.engine.transport.name);
            
            this.game.mySocketId = this.socket.id;
            UIManager.showConnectionStatus('connected');
            this.reconnectAttempts = 0;
            
            setTimeout(() => {
                this.getRoomList();
            }, 1000);
        });

        // Transport変更を監視
        this.socket.io.on('upgrade', (transport) => {
            console.log('🔄 Transport アップグレード:', transport.name);
        });

        // 切断イベント
        this.socket.on('disconnect', (reason) => {
            console.log('❌ Socket.io 切断:', reason);
            UIManager.showConnectionStatus('disconnected');
            
            if (reason !== 'io client disconnect') {
                UIManager.showError('サーバーとの接続が切断されました。再接続を試行中...', 'warning');
            }
        });

        // エラーイベント
        this.socket.on('connect_error', (error) => {
            console.error('❌ Socket.io 接続エラー:', error);
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                UIManager.showError('サーバーに接続できません。ページをリロードしてください。');
            } else {
                UIManager.showError(`接続エラー (${this.reconnectAttempts}/${this.maxReconnectAttempts}): ${error.message}`, 'warning');
            }
        });

        // 再接続試行
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔄 再接続試行 ${attemptNumber}/${this.maxReconnectAttempts}`);
            UIManager.showError(`再接続中... (${attemptNumber}/${this.maxReconnectAttempts})`, 'warning');
        });

        // 再接続成功
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`✅ 再接続成功 (試行回数: ${attemptNumber})`);
            UIManager.showError('サーバーに再接続しました！', 'success');
        });

        // ゲーム関連イベント
        this.socket.on('roomList', (rooms) => {
            console.log('📋 ルーム一覧受信:', rooms);
            UIManager.updateRoomList(rooms);
        });

        this.socket.on('ongoingGames', (games) => {
            console.log('📋 進行中ゲーム一覧受信:', games);
            UIManager.updateOngoingGames(games);
        });

        this.socket.on('roomCreated', (data) => {
            console.log('✅ ルーム作成成功:', data);
            this.game.onRoomCreated(data);
        });

        this.socket.on('joinSuccess', (data) => {
            console.log('✅ ルーム参加成功:', data);
            this.game.onJoinSuccess(data);
        });

        this.socket.on('rejoinSuccess', (data) => {
            console.log('✅ 再入場成功:', data);
            this.game.onRejoinSuccess(data);
        });

        this.socket.on('spectateSuccess', (data) => {
            console.log('✅ 観戦成功:', data);
            this.game.onSpectateSuccess(data);
        });

        this.socket.on('reconnectSuccess', (data) => {
            console.log('✅ 再接続成功:', data);
            this.game.onReconnectSuccess(data);
        });

        this.socket.on('gameUpdate', (gameData) => {
            console.log('🎮 ゲーム状態更新');
            this.game.gameData = gameData;
            this.game.updateUI();
        });

        this.socket.on('newMessage', (messages) => {
            UIManager.updateMessages(messages);
        });

        this.socket.on('roundStart', (roundNumber) => {
            UIManager.showRoundStart(roundNumber);
        });

        this.socket.on('error', (error) => {
            console.error('❌ サーバーエラー:', error);
            UIManager.showError(error.message || 'サーバーエラーが発生しました');
        });

        console.log('✅ Socket イベントリスナー設定完了');
    }

    setupConnectionMonitoring() {
        this.connectionTimeout = setTimeout(() => {
            if (!this.socket.connected) {
                console.warn('⚠️ 初期接続がタイムアウトしました');
                UIManager.showError('サーバー接続に時間がかかっています...', 'warning');
            }
        }, 10000);

        setInterval(() => {
            if (this.socket && !this.socket.connected) {
                console.warn('⚠️ Socket接続が切れています');
            }
        }, 30000);
    }

    emit(event, data) {
        console.log(`📤 Socket送信: ${event}`, data);
        
        if (!this.socket) {
            console.error('❌ Socket が存在しません');
            UIManager.showError('サーバー接続が初期化されていません');
            return false;
        }

        if (!this.socket.connected) {
            console.error('❌ Socket 未接続');
            UIManager.showError('サーバーに接続されていません。接続を確認中...');
            
            if (!this.socket.connecting) {
                this.socket.connect();
            }
            return false;
        }

        try {
            this.socket.emit(event, data);
            console.log(`✅ Socket送信成功: ${event}`);
            return true;
        } catch (error) {
            console.error(`❌ Socket送信エラー: ${event}`, error);
            UIManager.showError('通信エラーが発生しました');
            return false;
        }
    }

    getRoomList() {
        console.log('📋 ルーム一覧要求');
        return this.emit('getRoomList');
    }

    getOngoingGames() {
        console.log('📋 進行中ゲーム一覧要求');
        return this.emit('getOngoingGames');
    }

    createRoom(playerName, hasPassword, password) {
        console.log('🏠 ルーム作成要求:', { playerName, hasPassword: !!hasPassword });
        return this.emit('createRoom', { playerName, hasPassword, password });
    }

    joinRoom(roomId, playerName, password) {
        console.log('👥 ルーム参加要求:', { roomId, playerName });
        return this.emit('joinRoom', { roomId, playerName, password });
    }

    rejoinRoom(roomId, playerName) {
        console.log('🔄 再入場要求:', { roomId, playerName });
        return this.emit('rejoinRoom', { roomId, playerName });
    }

    tempLeaveRoom() {
        console.log('🚶 一時退出要求');
        return this.emit('tempLeaveRoom');
    }

    spectateRoom(roomId, spectatorName) {
        console.log('👁️ 観戦要求:', { roomId, spectatorName });
        return this.emit('spectateRoom', { roomId, spectatorName });
    }

    reconnectToRoom(roomId, playerName) {
        console.log(`🔄 ルーム再接続を試行: ${playerName} -> ${roomId}`);
        return this.emit('reconnectToRoom', { roomId, playerName });
    }

    sendChat(message) {
        console.log('💬 チャット送信:', message);
        return this.emit('sendChat', message);
    }

    startGame() {
        console.log('🎮 ゲーム開始要求');
        return this.emit('startGame');
    }

    selectCard(targetPlayerId, cardIndex) {
        console.log('🃏 カード選択:', { targetPlayerId, cardIndex });
        return this.emit('selectCard', { targetPlayerId, cardIndex });
    }

    leaveRoom() {
        console.log('🚪 ルーム退出要求');
        return this.emit('leaveRoom');
    }

    isConnected() {
        const connected = this.socket && this.socket.connected;
        return connected;
    }

    forceReconnect() {
        console.log('🔄 手動再接続開始');
        if (this.socket) {
            this.socket.disconnect();
            setTimeout(() => {
                this.socket.connect();
            }, 1000);
        }
    }
}

// メインゲームクラス
class PigManGame {
    constructor() {
        console.log('🐷 PigManGame 初期化開始');
        
        this.socket = null;
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.mySocketId = null;
        this.myName = null;
        this.isSpectator = false;
        
        this.socketClient = new SocketClient(this);
        this.initializeEventListeners();
        this.initializeErrorMonitoring();
        
        this.attemptReconnection();
        
        console.log('✅ PigManGame 初期化完了');
    }

    initializeErrorMonitoring() {
        const self = this; // thisを保存
        
        window.addEventListener('error', (event) => {
            self.logError('JavaScript Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            self.logError('Unhandled Promise
