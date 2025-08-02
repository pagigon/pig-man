// バリデーション関数群

function validatePlayerName(name) {
    if (!name || typeof name !== 'string') {
        return false;
    }
    
    const trimmed = name.trim();
    
    // 長さチェック
    if (trimmed.length < 1 || trimmed.length > 20) {
        return false;
    }
    
    // 文字種チェック（日本語、英数字、一部記号を許可）
    const validPattern = /^[a-zA-Z0-9ひらがなカタカナ漢字_\-\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/;
    if (!validPattern.test(trimmed)) {
        return false;
    }
    
    // 禁止ワードチェック
    const forbiddenWords = ['admin', 'system', 'null', 'undefined', 'server', 'host'];
    const lowerName = trimmed.toLowerCase();
    for (const word of forbiddenWords) {
        if (lowerName.includes(word)) {
            return false;
        }
    }
    
    return true;
}

function validateRoomId(roomId) {
    if (!roomId || typeof roomId !== 'string') {
        return false;
    }
    
    const trimmed = roomId.trim().toUpperCase();
    
    // 長さチェック
    if (trimmed.length < 3 || trimmed.length > 10) {
        return false;
    }
    
    // 文字種チェック（英数字のみ）
    const validPattern = /^[A-Z0-9]+$/;
    if (!validPattern.test(trimmed)) {
        return false;
    }
    
    return true;
}

function validatePassword(password) {
    if (!password) {
        return true; // パスワードなしは有効
    }
    
    if (typeof password !== 'string') {
        return false;
    }
    
    const trimmed = password.trim();
    
    // 長さチェック
    if (trimmed.length > 50) {
        return false;
    }
    
    return true;
}

function validateChatMessage(message) {
    if (!message || typeof message !== 'string') {
        return false;
    }
    
    const trimmed = message.trim();
    
    // 長さチェック
    if (trimmed.length === 0 || trimmed.length > 100) {
        return false;
    }
    
    // 基本的な文字種チェック（制御文字を除外）
    const validPattern = /^[^\x00-\x1F\x7F]+$/;
    if (!validPattern.test(trimmed)) {
        return false;
    }
    
    return true;
}

function sanitizeInput(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }
    
    return input
        .trim()
        .replace(/[<>]/g, '') // HTMLタグの基本的な除去
        .substring(0, 1000); // 最大長制限
}

module.exports = {
    validatePlayerName,
    validateRoomId,
    validatePassword,
    validateChatMessage,
    sanitizeInput
};
