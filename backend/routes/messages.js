const express = require('express');
const router = express.Router();

router.get('/:conversationId', (req, res) => {
  res.json({ message: 'Get messages for conversation - to be implemented' });
});

router.post('/', (req, res) => {
  res.json({ message: 'Send message - to be implemented' });
});

module.exports = router;