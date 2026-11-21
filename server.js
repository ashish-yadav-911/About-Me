require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (_req, res) => {
  res.json({
    assistantId: process.env.ASSISTANT_ID || 'f9f3f69d-66ae-4e4a-bbf2-7f39643f6c3f',
    publicKey: process.env.VAPI_PUBLIC_KEY || null,
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ashish-voice-portfolio listening on ${PORT}`);
});
