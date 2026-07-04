// Gemini-generated file. Contains all logic for the in-game chat.

const chat = {
    history: [],
    isActive: false,
    inputEl: null,
    logEl: null,
    containerEl: null,
    CHAT_FADE_TIME: 10000, // 10 seconds
    FADE_DURATION: 1000, // 1 second fade
};

chat.init = function() {
    // Create chat container
    this.containerEl = document.createElement('div');
    this.containerEl.id = 'chat-container';

    // Create message log
    this.logEl = document.createElement('div');
    this.logEl.id = 'chat-log';
    this.logEl.style.display = 'none'; // Initially hidden

    // Create input field
    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.id = 'chat-input';
    this.inputEl.placeholder = 'Введите сообщение...';
    this.inputEl.style.display = 'none'; // Initially hidden
    this.inputEl.maxLength = 100;

    // Assemble elements
    this.containerEl.appendChild(this.logEl);
    this.containerEl.appendChild(this.inputEl);
    document.body.appendChild(this.containerEl);

    // Prevent game actions when typing
    this.inputEl.addEventListener('mousedown', (e) => {
        uiInteraction = true;
        e.stopPropagation();
    });
     this.inputEl.addEventListener('mouseup', (e) => {
        uiInteraction = false;
        e.stopPropagation();
    });
};

chat.toggle = function(forceState) {
    this.isActive = typeof forceState === 'boolean' ? forceState : !this.isActive;
    this.inputEl.style.display = this.isActive ? 'block' : 'none';
    this.logEl.style.opacity = this.isActive ? '1' : '0.7';

    if (this.isActive) {
        this.inputEl.focus();
        // Un-fade all messages when chat becomes active
        this.logEl.querySelectorAll('.chat-message').forEach(msg => {
            msg.classList.remove('fade-out');
            if (msg.fadeTimeout) clearTimeout(msg.fadeTimeout);
            if (msg.removeTimeout) clearTimeout(msg.removeTimeout);
        });
    } else {
        this.inputEl.blur();
        // Re-apply fade-out to all messages when chat is closed
        this.history.forEach(msgObject => {
             if (msgObject.element) {
                this.scheduleMessageFade(msgObject.element);
            }
        });
    }
};

chat.sendMessage = function() {
    const messageText = this.inputEl.value.trim();
    if (messageText === '') return;

    // Assuming 'player' is a global object
    if (window.player) {
        this.addMessage(messageText, player.name, player.factionInfo, player.color);
    } else {
        // Fallback for testing if player is not available
        this.addMessage(messageText, "TestUser", { icon: '🏴' }, "#FFFFFF");
    }

    this.inputEl.value = '';
    this.toggle(false);
};

chat.addMessage = function(text, sender, factionInfo, color) {
    this.logEl.style.display = 'block'; // Make sure the log is visible

    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const msgObject = {
        text,
        sender,
        factionInfo,
        color,
        timestamp,
        element: null
    };

    this.history.push(msgObject);
    if (this.history.length > 50) {
        // Just remove from array, the element will be removed by the fade schedule
        this.history.shift();
    }

    this.renderMessage(msgObject);
};

chat.renderMessage = function(msgObject) {
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message';

    const factionIcon = msgObject.factionInfo ? `<span class="pixel-emoji">${msgObject.factionInfo.icon}</span>` : '';

    msgEl.innerHTML = `
        <span class="chat-timestamp">[${msgObject.timestamp}]</span>
        ${factionIcon}
        <span class="chat-sender" style="color: ${msgObject.color}; text-shadow: 1px 1px #000;">${msgObject.sender}</span>:
        <span class="chat-text">${msgObject.text}</span>
    `;

    this.logEl.appendChild(msgEl);
    msgObject.element = msgEl;

    // Scroll to the bottom
    this.logEl.scrollTop = this.logEl.scrollHeight;

    // Schedule fade-out unless chat is active
    if (!this.isActive) {
        this.scheduleMessageFade(msgEl);
    }
};

chat.scheduleMessageFade = function(msgEl) {
    if (msgEl.fadeTimeout) clearTimeout(msgEl.fadeTimeout);
    if (msgEl.removeTimeout) clearTimeout(msgEl.removeTimeout);

    msgEl.fadeTimeout = setTimeout(() => {
        msgEl.classList.add('fade-out');
    }, this.CHAT_FADE_TIME);

    msgEl.removeTimeout = setTimeout(() => {
        if (msgEl.parentElement) {
            msgEl.parentElement.removeChild(msgEl);
        }
        
        const msgObjectIndex = this.history.findIndex(m => m.element === msgEl);
        if (msgObjectIndex > -1) {
            this.history.splice(msgObjectIndex, 1);
        }

        // After removing, check if the log is empty
        if (this.logEl.childElementCount === 0) {
            this.logEl.style.display = 'none';
        }
    }, this.CHAT_FADE_TIME + this.FADE_DURATION);
};
