// ============================================
// Botpress Service - Handles all API communication
// with Botpress Cloud via the Chat API
// Stateless version for Vercel serverless functions
// ============================================

const axios = require('axios');

class BotpressService {
  constructor() {
    this.chatApiBase = 'https://chat.botpress.cloud';
    this.webhookId = process.env.BOTPRESS_WEBHOOK_ID;
    this.botId = process.env.BOTPRESS_BOT_ID;
    this.baseURL = `${this.chatApiBase}/${this.webhookId}`;
  }

  // ─── USER OPERATIONS ───────────────────────────

  async createUser(userId, userData = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/users`, {
        name: userData.name || 'Website User'
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      const user = response.data.user || response.data;
      const key = response.data.key;

      if (!key) {
        throw new Error('No user key returned from Botpress.');
      }

      return { id: user.id, key: key };
    } catch (error) {
      console.error('Botpress createUser error:', error.response?.data || error.message);
      throw new Error(`Failed to create user: ${error.response?.data?.message || error.message}`);
    }
  }

  // ─── CONVERSATION OPERATIONS ─────────────────────

  async createConversation(userKey) {
    try {
      const response = await axios.post(`${this.baseURL}/conversations`, {}, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-key': userKey
        },
        timeout: 30000
      });

      const conversation = response.data.conversation || response.data;
      return { id: conversation.id };
    } catch (error) {
      console.error('Botpress createConversation error:', error.response?.data || error.message);
      throw new Error(`Failed to create conversation: ${error.response?.data?.message || error.message}`);
    }
  }

  // ─── MESSAGE OPERATIONS ──────────────────────────

  async sendMessage(conversationId, text, userKey) {
    try {
      const requestBody = {
        conversationId: conversationId,
        payload: { type: 'text', text: text }
      };

      const response = await axios.post(`${this.baseURL}/messages`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-key': userKey
        },
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error('Botpress sendMessage error:', error.response?.data || error.message);
      throw new Error(`Failed to send message: ${error.response?.data?.message || error.message}`);
    }
  }

  async getMessages(conversationId, userKey) {
    try {
      const response = await axios.get(
        `${this.baseURL}/conversations/${conversationId}/messages`, {
          headers: {
            'Content-Type': 'application/json',
            'x-user-key': userKey
          },
          timeout: 30000
        }
      );
      return response.data;
    } catch (error) {
      console.error('Botpress getMessages error:', error.response?.data || error.message);
      throw new Error(`Failed to get messages: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Poll for the bot's latest reply after sending a message.
   * Only looks at NEW bot messages that appeared after knownBotMessageCount.
   */
  async getBotReply(conversationId, userKey, botpressUserId, knownBotMessageCount = 0, maxRetries = 20, delayMs = 500) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const data = await this.getMessages(conversationId, userKey);
        const messages = data.messages || [];

        const botMessages = messages.filter(msg => msg.userId !== botpressUserId);
        const newBotCount = botMessages.length - knownBotMessageCount;
        const newBotMessages = newBotCount > 0 ? botMessages.slice(0, newBotCount) : [];

        if (newBotMessages.length > 0) {
          const latestBotMessage = newBotMessages[0];

          let replyText = '';
          if (latestBotMessage.payload) {
            if (typeof latestBotMessage.payload === 'string') {
              replyText = latestBotMessage.payload;
            } else if (latestBotMessage.payload.text) {
              replyText = latestBotMessage.payload.text;
            } else if (latestBotMessage.payload.message) {
              replyText = latestBotMessage.payload.message;
            }
          }

          if (replyText) {
            console.log(`Bot reply received: "${replyText.substring(0, 80)}..."`);
            return replyText;
          }
        }

        console.log(`Waiting for bot reply... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (error) {
        console.log(`Polling error, retrying... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return null;
  }

  // ─── MAIN CHAT METHOD (STATELESS) ──────────────

  /**
   * Send a chat message and get the bot's reply.
   * All state (userKey, botpressUserId) is passed in — no server-side sessions.
   * If the bot doesn't respond, automatically retries with a new conversation.
   */
  async chat(userId, userMessage, conversationId = null, userKey = null, botpressUserId = null) {
    console.log(`Chat request from ${userId}: "${userMessage}"`);

    // Step 1: Create user if we don't have credentials
    if (!userKey) {
      const user = await this.createUser(userId);
      userKey = user.key;
      botpressUserId = user.id;
    }

    // Step 2: Create conversation if we don't have one
    if (!conversationId) {
      const conv = await this.createConversation(userKey);
      conversationId = conv.id;
    }

    // Step 3: Count existing bot messages BEFORE sending
    let knownBotMessageCount = 0;
    try {
      const beforeData = await this.getMessages(conversationId, userKey);
      const beforeMessages = beforeData.messages || [];
      knownBotMessageCount = beforeMessages.filter(msg => msg.userId !== botpressUserId).length;
    } catch (e) {
      // If we can't get messages, start from 0
    }

    // Step 4: Send user message
    await this.sendMessage(conversationId, userMessage, userKey);

    // Step 5: Wait for bot response
    let botReply = await this.getBotReply(conversationId, userKey, botpressUserId, knownBotMessageCount);

    // Step 6: AUTO-RETRY with a fresh conversation if the bot didn't respond
    if (!botReply) {
      console.log('Bot did not respond. Creating a new conversation and retrying...');

      const newConv = await this.createConversation(userKey);
      conversationId = newConv.id;

      await this.sendMessage(conversationId, userMessage, userKey);
      botReply = await this.getBotReply(conversationId, userKey, botpressUserId, 0);

      if (!botReply) {
        throw new Error('Bot did not respond within the timeout period. Please try again.');
      }
    }

    return {
      reply: botReply,
      conversationId: conversationId,
      userKey: userKey,
      botpressUserId: botpressUserId
    };
  }

  /**
   * Get conversation history formatted for the frontend
   */
  async getChatHistory(conversationId, userKey) {
    try {
      const data = await this.getMessages(conversationId, userKey);
      const messages = data.messages || [];

      return messages.map(msg => ({
        direction: msg.direction,
        text: msg.payload?.text || msg.payload?.message || '',
        timestamp: msg.createdAt,
        type: msg.type
      })).filter(msg => msg.text);
    } catch (error) {
      console.error('Botpress getChatHistory error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Health check - verify Botpress Chat API is reachable
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.chatApiBase}/health`, {
        timeout: 10000
      });
      return { status: 'ok', data: response.data };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
}

module.exports = new BotpressService();
