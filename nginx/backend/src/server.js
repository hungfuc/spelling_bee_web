require('dotenv').config();
const express = require('express');
const cors = require('cors');
const wordsRouter = require('./routes/words');
const uploadRouter = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/words', wordsRouter);
app.use('/api/upload', uploadRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Spelling Bee API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
