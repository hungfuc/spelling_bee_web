const express = require('express');
const multer = require('multer');
const router = express.Router();
const tokenizer = require('../services/tokenizer');
const dictionaryService = require('../services/dictionary');
const { wordQueries } = require('../services/database');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept text files
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only text files are allowed'));
    }
  }
});

// Upload and process text file
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const text = req.file.buffer.toString('utf-8');
    const words = tokenizer.tokenize(text);

    if (words.length === 0) {
      return res.status(400).json({ error: 'No words found in file' });
    }

    // Process words: fetch meanings and pronunciations
    const processedWords = [];
    let successCount = 0;
    let errorCount = 0;

    for (const word of words) {
      try {
        // Check if word already exists
        const existingWord = await wordQueries.getByWord(word);
        if (existingWord) {
          processedWords.push({
            word,
            meaning: existingWord.meaning,
            pronunciation: existingWord.pronunciation,
            status: 'exists'
          });
          continue;
        }

        // Fetch meaning and pronunciation from dictionary API
        const dictData = await dictionaryService.getWordInfo(word);
        
        processedWords.push({
          word,
          meaning: dictData?.meaning || null,
          pronunciation: dictData?.pronunciation || null,
          status: dictData ? 'success' : 'no_data'
        });

        // Insert into database
        await wordQueries.create(word, dictData?.meaning || null, dictData?.pronunciation || null);
        successCount++;
      } catch (error) {
        console.error(`Error processing word "${word}":`, error.message);
        errorCount++;
        // Still insert word without meaning/pronunciation
        try {
          await wordQueries.create(word, null, null);
          processedWords.push({
            word,
            meaning: null,
            pronunciation: null,
            status: 'error'
          });
        } catch (dbError) {
          // Word might already exist, skip
        }
      }
    }

    res.json({
      message: 'File processed successfully',
      totalWords: words.length,
      processed: processedWords.length,
      successCount,
      errorCount,
      words: processedWords
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
