const express = require('express');
const router = express.Router();
const { wordQueries } = require('../services/database');

// Get all words with pagination
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = await wordQueries.getAll(page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get random word
router.get('/random', async (req, res, next) => {
  try {
    const word = await wordQueries.getRandom();
    if (!word) {
      return res.status(404).json({ error: 'No words found in database' });
    }
    res.json(word);
  } catch (error) {
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
