// ============================================
// Vercel Serverless Function - Express App
// Handles ALL /api/* routes for 3Boxes Chat
// Stateless: all session data comes from frontend
// ============================================

const express = require('express');
const cors = require('cors');
const botpressService = require('../lib/botpressService');

const app = express();

// ─── MIDDLEWARE ──────────────────────────────────
app.use(express.json({ limit: '1mb' }));

app.use(cors({
  origin: true,  // Allow all origins on Vercel
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// ─── API ROUTES ──────────────────────────────────

/**
 * GET /api/session
 * Returns session info (stateless — frontend stores everything)
 */
app.get('/session', async (req, res) => {
  try {
    const userId = req.query.userId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const conversationId = req.query.conversationId || null;

    res.json({
      success: true,
      userId,
      conversationId,
      hasActiveConversation: !!conversationId
    });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({ success: false, error: 'Failed to get session' });
  }
});

/**
 * POST /api/chat/message
 * Body: { userId, message, conversationId?, userKey?, botpressUserId? }
 * Returns: { success, reply, conversationId, userKey, botpressUserId }
 *
 * IMPORTANT: userKey and botpressUserId are stored in localStorage on the
 * frontend and sent with each request. This makes the backend fully stateless
 * so it works with Vercel serverless functions.
 */
app.post('/chat/message', async (req, res) => {
  try {
    const { userId, message, conversationId, userKey, botpressUserId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    console.log(`Chat: ${userId} -> "${message.trim().substring(0, 50)}" (conv: ${conversationId || 'new'})`);

    // Call Botpress — pass all state from the request
    const result = await botpressService.chat(
      userId,
      message.trim(),
      conversationId || null,
      userKey || null,
      botpressUserId || null
    );

    res.json({
      success: true,
      reply: result.reply,
      conversationId: result.conversationId,
      userKey: result.userKey,
      botpressUserId: result.botpressUserId,
      userId: userId
    });

  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get bot response',
      shouldReset: error.message.includes('timeout') || error.message.includes('did not respond')
    });
  }
});

/**
 * GET /api/chat/history/:conversationId
 * Query: ?userKey=required
 */
app.get('/chat/history/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userKey } = req.query;

    if (!userKey || !conversationId) {
      return res.status(400).json({ success: false, error: 'userKey and conversationId are required' });
    }

    const history = await botpressService.getChatHistory(conversationId, userKey);
    res.json({ success: true, conversationId, messages: history });

  } catch (error) {
    console.error('Chat history error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to get chat history' });
  }
});

/**
 * POST /api/chat/reset
 * Body: { userId }
 * Stateless — frontend just clears localStorage, no server-side action needed
 */
app.post('/chat/reset', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Conversation reset. Clear localStorage on the frontend. A new conversation will be created on the next message.'
    });
  } catch (error) {
    console.error('Chat reset error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to reset conversation' });
  }
});

/**
 * GET /api/health
 */
app.get('/health', async (req, res) => {
  const botpressHealth = await botpressService.healthCheck();
  res.json({
    status: 'ok',
    service: '3boxes-chatbot-backend',
    botpress: {
      webhookId: process.env.BOTPRESS_WEBHOOK_ID ? 'Configured' : 'Missing',
      botId: process.env.BOTPRESS_BOT_ID ? 'Configured' : 'Missing',
      chatApi: botpressHealth.status
    },
    timestamp: new Date().toISOString()
  });
});

// ─── EXPORT FOR VERCEL ──────────────────────────
// Vercel wraps Express as a serverless function
module.exports = app;
