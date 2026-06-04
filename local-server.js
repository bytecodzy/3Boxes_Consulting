require('dotenv').config();
const express = require('express');
const apiApp = require('./api/index');
const path = require('path');

const app = express();

// Mount API routes under /api
app.use('/api', apiApp);

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('');
  console.log('  3Boxes Consulting - Local Dev Server');
  console.log(`  Website: http://localhost:${PORT}`);
  console.log(`  API:     http://localhost:${PORT}/api/chat/message`);
  console.log(`  Health:  http://localhost:${PORT}/api/health`);
  console.log('');
});