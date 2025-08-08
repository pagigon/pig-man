// ゲーム画面描画コンポーネント - 画像対応修正版
import { UIManager } from '../core/ui-manager.js';
import { safeGetElement, safeSetText, vibrate } from '../utils/helpers.js';

export class GameBoard {
    constructor(game) {
        this.game = game;
    }

    // 🔧 【修正】画像読み込みとフォールバック処理
    loadImageWithFallback(img, basePath, type, size = 'medium') {
        const formats = ['webp', 'png', 'jpg'];
        const sizes = ['large', 'medium', 'small'];
        
        // 現在のサイズから開始して、小さいサイズへフォールバック
        const sizeIndex = sizes.indexOf(size);
        const fallbackSizes = sizes.slice(sizeIndex);
        
        const tryLoad = (formatIndex = 0, sizeIndex = 0) => {
            if (formatIndex >= formats.length) {
                if (sizeIndex + 1 < fallbackSizes.length) {
                    tryLoad(0, sizeIndex + 1);
                    return;
                } else {
                    // 全ての画像読み込みに失敗した場合の絵文字フォールバック
                    this.setEmojiFallback(img, type);
                    return;
                }
            }
            
            const currentSize = fallbackSizes[sizeIndex];
            const currentFormat = formats[formatIndex];
            const imagePath = `${basePath}${type}-${currentSize}.${currentFormat}`;
            
            img.src = imagePath;
            
            img.onerror = () => {
                console.warn(`画像読み込み失敗: ${imagePath}`);
                tryLoad(formatIndex + 1, sizeIndex);
            };
        };
        
        tryLoad();
    }

    // 🔧 【追加】絵文字フォールバック処理
    setEmojiFallback(img, type) {
        img.style.display = 'none';
        const emoji = document.createElement('div');
        emoji.style.cssText = 'font-size: 2.5em; text-align: center; line-height: 1; display: flex; align-items: center; justify-content: center; height: 100%; width: 100%;';
        
        switch (type) {
            case 'treasure':
                emoji.textContent = '🐷';
                break;
            case 'trap':
                emoji.textContent = '💀';
                break;
            case 'empty':
                emoji.textContent = '🏠';
                break;
            case 'adventurer':
                emoji.textContent = '⛏️';
                break;
            case 'pig-man':
                emoji.textContent = '🐷';
                break;
            default:
                emoji.textContent = '❓';
        }
        
        img.parentNode.insertBefore(emoji, img.nextSibling);
    }

    // 🔧 【修正】役職表示（新しい画像パス対応）
    // 🔧 【最小修正】既存の game-board.js の safeShowPlayerRole メソッドを以下に置き換えてください

safeShowPlayerRole() {
    try {
        if (!this.game.gameData.players) return;
        
        const myPlayer = this.game.gameData.players.find(p => p.id === this.game.mySocketId);
        if (!myPlayer || !myPlayer.role) return;
        
        const myRole = myPlayer.role;
        const roleCard = safeGetElement('role-reveal');
        const roleText = safeGetElement('player-role');
        const roleDesc = safeGetElement('role-description');
        const roleImage = safeGetElement('role-image');

        if (!roleCard || !roleText || !roleDesc || !roleImage) {
            console.warn('役職表示要素が見つかりません');
            return;
        }

        if (myRole === 'adventurer') {
            roleCard.className = 'role-card role-adventurer compact';
            roleText.textContent = '⛏️ 探検家 (Adventurer)';
            roleDesc.textContent = `子豚に変えられた子供を${this.game.gameData.treasureGoal || 7}匹すべて救出することが目標です！`;
            
            // 🔧 【修正】正しい画像パスを設定
            roleImage.src = '/images/roles/adventurer.webp';
            roleImage.alt = '探検家';
            
            // 🔧 【追加】画像読み込みエラー時の処理
            roleImage.onerror = function() {
                console.warn('探検家画像読み込み失敗、代替表示に切り替え');
                this.style.display = 'none';
                // 代替として絵文字を表示
                if (!this.nextElementSibling || !this.nextElementSibling.classList.contains('emoji-fallback')) {
                    const emoji = document.createElement('div');
                    emoji.className = 'emoji-fallback';
                    emoji.style.cssText = 'font-size: 4em; text-align: center; width: 80px; height: 100px; display: flex; align-items: center; justify-content: center;';
                    emoji.textContent = '⛏️';
                    this.parentNode.insertBefore(emoji, this.nextSibling);
                }
            };
            
        } else if (myRole === 'guardian') {
            roleCard.className = 'role-card role-guardian compact';
            roleText.textContent = '🐷 豚男 (Pig Man)';
            roleDesc.textContent = `罠を${this.game.gameData.trapGoal || 2}個すべて発動させるか、4ラウンド終了まで子豚たちを隠し続けることが目標です！`;
            
            // 🔧 【修正】正しい画像パスを設定
            roleImage.src = '/images/roles/pig-man.webp';
            roleImage.alt = '豚男';
            
            // 🔧 【追加】画像読み込みエラー時の処理
            roleImage.onerror = function() {
                console.warn('豚男画像読み込み失敗、代替表示に切り替え');
                this.style.display = 'none';
                // 代替として絵文字を表示
                if (!this.nextElementSibling || !this.nextElementSibling.classList.contains('emoji-fallback')) {
                    const emoji = document.createElement('div');
                    emoji.className = 'emoji-fallback';
                    emoji.style.cssText = 'font-size: 4em; text-align: center; width: 80px; height: 100px; display: flex; align-items: center; justify-content: center;';
                    emoji.textContent = '🐷';
                    this.parentNode.insertBefore(emoji, this.nextSibling);
                }
            };
        }
    } catch (error) {
        console.error('役職表示エラー:', error);
    }
}

    // 🔧 【修正】自分のカード描画（新しい画像パス対応）
    safeRenderMyCards() {
    try {
        const myCardsSection = document.querySelector('.my-cards-section');
        if (this.game.isSpectator) {
            if (myCardsSection) myCardsSection.style.display = 'none';
            return;
        } else {
            if (myCardsSection) myCardsSection.style.display = 'block';
        }

        if (!this.game.gameData.players) return;
        
        const myPlayer = this.game.gameData.players.find(p => p.id === this.game.mySocketId);
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
                img.alt = card.type;
                
                // 🔧 【修正】PC用高解像度画像を使用
                const isPC = window.innerWidth >= 769;
                const imageSize = isPC ? 'large' : 'medium';
                img.src = `/images/cards/${card.type}-${imageSize}.webp`;
                
                img.onerror = () => {
                    // フォールバック: PNG → 絵文字
                    img.src = `/images/cards/${card.type}-${imageSize}.png`;
                    img.onerror = () => {
                        this.setCardEmojiFallback(img, card.type);
                    };
                };
                
                div.appendChild(img);
            } else {
                // 🔧 【修正】カード裏面は絵文字のみ使用
                const emojiDiv = document.createElement('div');
                emojiDiv.className = 'card-back-emoji';
                emojiDiv.style.cssText = `
                    font-size: 2.5em;
                    text-align: center;
                    line-height: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    width: 100%;
                `;
                emojiDiv.textContent = '❓';
                
                div.appendChild(emojiDiv);
                
                switch (card.type) {
                    case 'treasure':
                        treasureCount++;
                        break;
                    case 'trap':
                        trapCount++;
                        break;
                    case 'empty':
                        emptyCount++;
                        break;
                }
            }
            
            container.appendChild(div);
        });

        // 安全にカウント表示を更新
        this.safeUpdateElement('my-treasure', treasureCount);
        this.safeUpdateElement('my-trap', trapCount);
        this.safeUpdateElement('my-empty', emptyCount);
        
    } catch (error) {
        console.error('自分のカード描画エラー:', error);
    }
}

    // 🔧 【修正】他プレイヤーカード描画（新しい画像パス対応）
    safeRenderOtherPlayers(isMyTurn) {
        try {
            const container = safeGetElement('other-players-container');
            if (!container) return;
            
            container.innerHTML = '';

            if (!this.game.gameData.players) return;

            this.game.gameData.players.forEach((player) => {
                if (player.id === this.game.mySocketId) return;

                const playerBox = document.createElement('div');
                playerBox.className = 'other-player-box';
                if (player.id === this.game.gameData.keyHolderId) {
                    playerBox.classList.add('has-key');
                }

                const header = document.createElement('h4');
                header.textContent = player.name;
                
                if (!player.connected) {
                    header.textContent += ' (切断中)';
                    header.style.color = '#888';
                }
                
                if (player.id === this.game.gameData.keyHolderId) {
                    const keyImg = document.createElement('img');
                    keyImg.src = '/images/key-icon.webp';
                    keyImg.className = 'key-icon-small';
                    keyImg.alt = '鍵';
                    
                    keyImg.onerror = () => {
                        keyImg.style.display = 'none';
                        const emoji = document.createElement('span');
                        emoji.textContent = '🗝️';
                        emoji.style.fontSize = '20px';
                        emoji.style.marginLeft = '8px';
                        header.appendChild(emoji);
                    };
                    
                    header.appendChild(keyImg);
                }
                playerBox.appendChild(header);

                const cardsGrid = document.createElement('div');
                cardsGrid.className = 'other-player-cards';

                if (player.hand) {
                    player.hand.forEach((card, index) => {
                        const cardDiv = document.createElement('div');
                        cardDiv.className = 'other-card';
                        
                        if (card.revealed) {
    cardDiv.classList.add('revealed', card.type);
    const img = document.createElement('img');
    img.className = 'other-card-image';
    img.alt = card.type;
    
    // 🔧 【修正】PC用高解像度画像
    const isPC = window.innerWidth >= 769;
    const imageSize = isPC ? 'large' : 'medium';
    img.src = `/images/cards/${card.type}-${imageSize}.webp`;
    
    img.onerror = () => {
        img.src = `/images/cards/${card.type}-${imageSize}.png`;
        img.onerror = () => {
            this.setCardEmojiFallback(img, card.type);
        };
    };
    
    cardDiv.appendChild(img);
} else {
    // 🔧 【修正】カード裏面は絵文字のみ使用
    const emojiDiv = document.createElement('div');
    emojiDiv.className = 'other-card-back-emoji';
    emojiDiv.style.cssText = `
        font-size: 1.8em;
        text-align: center;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
    `;
    emojiDiv.textContent = '❓';
    
    cardDiv.appendChild(emojiDiv);
    
    // クリック処理など...
}

// 🔧 【追加】カード絵文字フォールバック処理
setCardEmojiFallback(img, cardType) {
    try {
        img.style.display = 'none';
        
        let emojiElement = img.nextElementSibling;
        if (!emojiElement || !emojiElement.classList.contains('card-emoji-fallback')) {
            emojiElement = document.createElement('div');
            emojiElement.className = 'card-emoji-fallback';
            emojiElement.style.cssText = `
                font-size: 2.5em;
                text-align: center;
                line-height: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                width: 100%;
                position: absolute;
                top: 0;
                left: 0;
            `;
            img.parentNode.style.position = 'relative';
            img.parentNode.appendChild(emojiElement);
        }
        
        switch (cardType) {
            case 'treasure':
                emojiElement.textContent = '🐷';
                break;
            case 'trap':
                emojiElement.textContent = '💀';
                break;
            case 'empty':
                emojiElement.textContent = '🏠';
                break;
            default:
                emojiElement.textContent = '❓';
        }
        
        console.log(`🎯 カード絵文字フォールバック: ${cardType} → ${emojiElement.textContent}`);
        
    } catch (error) {
        console.error('カード絵文字フォールバック処理エラー:', error);
    }
}

    // 既存のメソッドはそのまま維持
    updateGameUI() {
        try {
            console.log('🎨 ゲームUI更新開始');
            
            if (!this.game || !this.game.gameData) {
                console.warn('⚠️ ゲームデータが存在しません');
                return;
            }

            UIManager.showScreen('game-board');

            // 安全にUI更新を実行
            this.safeUpdateGameOverview();
            this.safeUpdateProgressBars();
            this.safeUpdateGameInfo();
            // 🔧 正しいカードリサイクル情報も更新
            UIManager.updateRoundDisplayWithCards(this.game.gameData);
            this.safeUpdateKeyHolder();
            this.safeShowPlayerRole();
            this.safeRenderMyCards();
            
            const isMyTurn = this.game.gameData.keyHolderId === this.game.mySocketId;
            this.safeRenderOtherPlayers(isMyTurn);
            this.addCardRevealEffects();
            
            console.log('✅ ゲームUI更新完了');
            
        } catch (error) {
            console.error('❌ ゲームUI更新エラー:', error);
            UIManager.showError('ゲーム画面の更新でエラーが発生しました');
        }
    }

    // 🔧 【既存メソッドを維持】
    safeUpdateGameOverview() {
        try {
            if (!this.game.gameData.players) return;
            UIManager.updateGameOverview(this.game.gameData.players.length);
        } catch (error) {
            console.error('ゲーム概要更新エラー:', error);
        }
    }

    safeUpdateProgressBars() {
        try {
            UIManager.updateProgressBars(this.game.gameData);
        } catch (error) {
            console.error('進捗バー更新エラー:', error);
        }
    }

    safeUpdateGameInfo() {
        try {
            console.log('📊 ゲーム情報更新:', this.game.gameData);
            
            const gameData = this.game.gameData;
            
            this.safeUpdateElement('current-round', gameData.currentRound || 1);
            this.safeUpdateElement('treasure-found', gameData.treasureFound || 0);
            this.safeUpdateElement('trap-triggered', gameData.trapTriggered || 0);
            this.safeUpdateElement('trap-goal', gameData.trapGoal || 2);
            this.safeUpdateElement('treasure-goal', gameData.treasureGoal || 7);
            this.safeUpdateElement('cards-per-player', gameData.cardsPerPlayer || 5);
            this.safeUpdateElement('cards-flipped', gameData.cardsFlippedThisRound || 0);
            
            this.updateRoundDisplay(gameData);
            
        } catch (error) {
            console.error('ゲーム情報更新エラー:', error);
        }
    }

    safeUpdateElement(elementId, value) {
        try {
            const element = safeGetElement(elementId);
            if (element) {
                element.textContent = String(value);
                console.log(`✅ ${elementId} 更新: ${value}`);
            } else {
                console.warn(`⚠️ 要素が見つかりません: ${elementId}`);
            }
        } catch (error) {
            console.error(`要素更新エラー (${elementId}):`, error);
        }
    }

    updateRoundDisplay(gameData) {
        try {
            const roundElement = safeGetElement('current-round');
            if (roundElement && roundElement.parentElement) {
                const currentRound = gameData.currentRound || 1;
                const maxRounds = gameData.maxRounds || 4;
                
                const parentEl = roundElement.parentElement;
                if (parentEl.classList.contains('info-item')) {
                    parentEl.innerHTML = 
                        '<span class="label">R</span>' +
                        '<span class="value">' + currentRound + '/' + maxRounds + '</span>';
                } else {
                    roundElement.textContent = currentRound;
                }
                
                console.log(`✅ ラウンド表示更新: ${currentRound}/${maxRounds}`);
            }
        } catch (error) {
            console.error('ラウンド表示更新エラー:', error);
            safeSetText('current-round', gameData.currentRound || 1);
        }
    }

    safeUpdateKeyHolder() {
        try {
            const keyHolder = this.game.gameData.players.find(p => p.id === this.game.gameData.keyHolderId);
            safeSetText('key-holder-name', keyHolder?.name || '不明');
            
            const isMyTurn = this.game.gameData.keyHolderId === this.game.mySocketId;
            const turnMessage = isMyTurn ? 
                'あなたのターンです！他のプレイヤーのカードを選んでください' : 
                '待機中...';
            safeSetText('turn-message', turnMessage);
            
        } catch (error) {
            console.error('鍵保持者情報更新エラー:', error);
        }
    }

    addCardRevealEffects() {
        try {
            if (this.game.gameData.lastRevealedCard) {
                const cardType = this.game.gameData.lastRevealedCard.type;
                
                switch (cardType) {
                    case 'treasure':
                        vibrate([100, 50, 100]);
                        break;
                    case 'trap':
                        vibrate([200, 100, 200, 100, 200]);
                        break;
                    case 'empty':
                        vibrate([50]);
                        break;
                }
                
                delete this.game.gameData.lastRevealedCard;
            }
        } catch (error) {
            console.error('カード公開エフェクトエラー:', error);
        }
    }

    selectCard(targetPlayerId, cardIndex) {
        try {
            if (this.game.isSpectator) {
                UIManager.showError('観戦者はカードを選択できません');
                return;
            }
            
            console.log('🃏 カード選択:', { targetPlayerId, cardIndex });
            this.game.socketClient.selectCard(targetPlayerId, cardIndex);
            
        } catch (error) {
            console.error('カード選択エラー:', error);
            UIManager.showError('カード選択でエラーが発生しました');
        }
    }

    updateLobbyUI() {
        try {
            console.log('🏠 ロビーUI更新');
            UIManager.showScreen('room-info');
            
            if (this.game.gameData && this.game.gameData.players) {
                UIManager.updatePlayersList(this.game.gameData.players, this.game.gameData.host);
            }
            
            const startButton = safeGetElement('start-game');
            const tempLeaveSection = safeGetElement('temp-leave-section');
            
            const count = this.game.gameData && this.game.gameData.players ? 
                this.game.gameData.players.filter(p => p.connected).length : 0;
            
            if (this.game.isHost && count >= 3 && startButton) {
                startButton.style.display = 'block';
            } else if (startButton) {
                startButton.style.display = 'none';
            }
            
            if (tempLeaveSection) {
                tempLeaveSection.style.display = 'none';
            }
            
        } catch (error) {
            console.error('ロビーUI更新エラー:', error);
        }
    }

    handleVictoryScreen(gameData) {
        try {
            UIManager.showVictoryScreen(gameData);
            
            if (gameData.winningTeam === 'adventurer') {
                vibrate([200, 100, 200, 100, 200]);
            } else {
                vibrate([100, 50, 100, 50, 300]);
            }
        } catch (error) {
            console.error('勝利画面表示エラー:', error);
        }
    }
}
