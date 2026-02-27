const express = require('express');
const router = express.Router();
const { wordQueries, tagQueries } = require('../services/database');
const { requireTestToken } = require('../middleware/tokens');
const { synthesizeSpeech } = require('../services/tts');

function parseTagIdsParam(value) {
  if (!value) {
    return [];
  }

  const ids = String(value)
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => Number.isInteger(id) && id > 0);

  return [...new Set(ids)];
}

// Get all words with pagination
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const tagIds = parseTagIdsParam(req.query.tagIds);
    const result = await wordQueries.getAll(page, limit, tagIds);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get all tags
router.get('/tags', requireTestToken, async (req, res, next) => {
  try {
    const tags = await tagQueries.getAll();
    res.json({ tags });
  } catch (error) {
    next(error);
  }
});

// Get random word
router.get('/random', requireTestToken, async (req, res, next) => {
  try {
    const tagIds = parseTagIdsParam(req.query.tagIds);
    const word = await wordQueries.getRandom(tagIds);
    if (!word) {
      return res.status(404).json({ error: 'No words found in database' });
    }
    res.json(word);
  } catch (error) {
    next(error);
  }
});

// Text-to-speech for test words
router.post('/tts', requireTestToken, async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > 100) {
      return res.status(400).json({ error: 'text is too long' });
    }

    const { buffer, contentType } = await synthesizeSpeech(text);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (error) {
    if (error.response?.status === 400) {
      return res.status(400).json({ error: 'Invalid TTS request' });
    }
    if (error.response?.status >= 500) {
      return res.status(502).json({ error: 'TTS service unavailable' });
    }
    next(error);
  }
});

// Get word by ID
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const word = await wordQueries.getById(id);
    if (!word) {
      return res.status(404).json({ error: 'Word not found' });
    }
    res.json(word);
  } catch (error) {
    next(error);
  }
});

// Create word manually
router.post('/', async (req, res, next) => {
  try {
    const { word, meaning, pronunciation } = req.body;
    if (!word) {
      return res.status(400).json({ error: 'Word is required' });
    }

    const existingWord = await wordQueries.getByWord(word);
    if (existingWord) {
      return res.status(409).json({ error: 'Word already exists', word: existingWord });
    }

    const id = await wordQueries.create(word, meaning, pronunciation);
    const newWord = await wordQueries.getById(id);
    res.status(201).json(newWord);
  } catch (error) {
    next(error);
  }
});

// Update word
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { meaning, pronunciation } = req.body;

    const existingWord = await wordQueries.getById(id);
    if (!existingWord) {
      return res.status(404).json({ error: 'Word not found' });
    }

    await wordQueries.update(id, meaning, pronunciation);
    const updatedWord = await wordQueries.getById(id);
    res.json(updatedWord);
  } catch (error) {
    next(error);
  }
});

// Delete word
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await wordQueries.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Word not found' });
    }
    res.json({ message: 'Word deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
