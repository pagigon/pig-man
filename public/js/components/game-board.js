// ゲーム画面描画コンポーネント - エラー修正版
import { UIManager } from '../core/ui-manager.js';
import { safeGetElement, safeSetText, vibrate } from '../utils/helpers.js';

export class GameBoard {
    constructor(game) {
        this.game = game;
    }

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
            
            // 個別に安全に更新
            const gameData = this.game.gameData;
            
            // 基本情報の安全な更新
            this.safeUpdateElement('current-round', gameData.currentRound || 1);
            this.safeUpdateElement('treasure-found', gameData.treasureFound || 0);
            this.safeUpdateElement('trap-triggered', gameData.trapTriggered || 0);
            this.safeUpdateElement('trap-goal', gameData.trapGoal || 2);
            this.safeUpdateElement('treasure-goal', gameData.treasureGoal || 7);
            this.safeUpdateElement('cards-per-player', gameData.cardsPerPlayer || 5);
            this.safeUpdateElement('cards-flipped', gameData.cardsFlippedThisRound || 0);
            
            // ラウンド表示の特別処理
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
            // ラウンド表示の更新（エラー対応版）
            const roundElement = safeGetElement('current-round');
            if (roundElement && roundElement.parentElement) {
                const currentRound = gameData.currentRound || 1;
                const maxRounds = gameData.maxRounds || 4;
                
                // 親要素を安全に更新
                const parentEl = roundElement.parentElement;
                if (parentEl.classList.contains('info-item')) {
                    // info-itemの構造を維持して更新
                    parentEl.innerHTML = 
                        '<span class="label">R</span>' +
                        '<span class="value">' + currentRound + '/' + maxRounds + '</span>';
                } else {
                    // 通常のテキスト更新
                    roundElement.textContent = currentRound;
                }
                
                console.log(`✅ ラウンド表示更新: ${currentRound}/${maxRounds}`);
            }
        } catch (error) {
            console.error('ラウンド表示更新エラー:', error);
            // フォールバック: 基本的なテキスト更新
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
                roleText.textContent = '⛏️ 探検家 (Explorer)';
                roleDesc.textContent = `子豚に変えられた子供を${this.game.gameData.treasureGoal || 7}匹すべて救出することが目標です！`;
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
                roleDesc.textContent = `罠を${this.game.gameData.trapGoal || 2}個すべて発動させるか、4ラウンド終了まで子豚たちを隠し続けることが目標です！`;
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
        } catch (error) {
            console.error('役職表示エラー:', error);
        }
    }

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
                    keyImg.src = '/images/key-icon.png';
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
                            img.src = `/images/card-${card.type}-medium.png`;
                            img.alt = card.type;
                            
                            img.onerror = () => {
                                img.style.display = 'none';
                                const emoji = document.createElement('div');
                                emoji.style.fontSize = '1.5em';
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
                                cardDiv.appendChild(emoji);
                            };
                            
                            cardDiv.appendChild(img);
                        } else {
                            const img = document.createElement('img');
                            img.className = 'other-card-image';
                            img.src = '/images/card-back-medium.png';
                            img.alt = 'カード裏面';
                            
                            img.onerror = () => {
                                img.style.display = 'none';
                                const emoji = document.createElement('div');
                                emoji.textContent = '❓';
                                emoji.style.fontSize = '1.5em';
                                emoji.style.textAlign = 'center';
                                emoji.style.lineHeight = '1';
                                cardDiv.appendChild(emoji);
                            };
                            
                            cardDiv.appendChild(img);
                            
                            if (isMyTurn && !card.revealed && player.connected && !this.game.isSpectator) {
                                cardDiv.addEventListener('click', () => {
                                    this.selectCard(player.id, index);
                                });
                            } else {
                                cardDiv.classList.add('disabled');
                            }
                        }
                        
                        cardsGrid.appendChild(cardDiv);
                    });
                }

                playerBox.appendChild(cardsGrid);
                container.appendChild(playerBox);
            });
            
        } catch (error) {
            console.error('他プレイヤー描画エラー:', error);
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
