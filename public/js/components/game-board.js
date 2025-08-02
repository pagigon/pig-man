// ゲーム画面描画コンポーネント
import { UIManager } from '../core/ui-manager.js';
import { safeGetElement, safeSetText, vibrate } from '../utils/helpers.js';

export class GameBoard {
    constructor(game) {
        this.game = game;
    }

    updateGameUI() {
        UIManager.showScreen('game-board');

        UIManager.updateGameOverview(this.game.gameData.players.length);
        UIManager.updateProgressBars(this.game.gameData);
        UIManager.updateGameInfo(this.game.gameData);

        const keyHolder = this.game.gameData.players.find(p => p.id === this.game.gameData.keyHolderId);
        safeSetText('key-holder-name', keyHolder?.name || '不明');
        
        const isMyTurn = this.game.gameData.keyHolderId === this.game.mySocketId;
        safeSetText('turn-message', isMyTurn ? 'あなたのターンです！他のプレイヤーのカードを選んでください' : '待機中...');

        this.showPlayerRole();
        this.renderMyCards();
        this.renderOtherPlayers(isMyTurn);

        this.addCardRevealEffects();
    }

    addCardRevealEffects() {
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
    }

    showPlayerRole() {
        const myPlayer = this.game.gameData.players.find(p => p.id === this.game.mySocketId);
        const myRole = myPlayer?.role;
        const roleCard = safeGetElement('role-reveal');
        const roleText = safeGetElement('player-role');
        const roleDesc = safeGetElement('role-description');
        const roleImage = safeGetElement('role-image');

        if (!roleCard || !roleText || !roleDesc || !roleImage) return;

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
    }

    renderMyCards() {
        const myCardsSection = document.querySelector('.my-cards-section');
        if (this.game.isSpectator) {
            if (myCardsSection) myCardsSection.style.display = 'none';
            return;
        } else {
            if (myCardsSection) myCardsSection.style.display = 'block';
        }

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

        safeSetText('my-treasure', treasureCount);
        safeSetText('my-trap', trapCount);
        safeSetText('my-empty', emptyCount);
    }

    renderOtherPlayers(isMyTurn) {
        const container = safeGetElement('other-players-container');
        if (!container) return;
        
        container.innerHTML = '';

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
    }

    selectCard(targetPlayerId, cardIndex) {
        if (this.game.isSpectator) {
            UIManager.showError('観戦者はカードを選択できません');
            return;
        }
        
        this.game.socketClient.selectCard(targetPlayerId, cardIndex);
    }

    updateLobbyUI() {
        console.log('🏠 ロビーUI更新');
        UIManager.showScreen('room-info');
        
        if (this.game.gameData.players) {
            UIManager.updatePlayersList(this.game.gameData.players, this.game.gameData.host);
        }
        
        const startButton = safeGetElement('start-game');
        const tempLeaveSection = safeGetElement('temp-leave-section');
        
        const count = this.game.gameData.players ? this.game.gameData.players.filter(p => p.connected).length : 0;
        
        if (this.game.isHost && count >= 3 && startButton) {
            startButton.style.display = 'block';
        } else if (startButton) {
            startButton.style.display = 'none';
        }
        
        if (tempLeaveSection) {
            tempLeaveSection.style.display = 'none';
        }
    }

    handleVictoryScreen(gameData) {
        UIManager.showVictoryScreen(gameData);
        
        if (gameData.winningTeam === 'adventurer') {
            vibrate([200, 100, 200, 100, 200]);
        } else {
            vibrate([100, 50, 100, 50, 300]);
        }
    }
}
