const mysql = require('mysql2/promise');
let missingDictionaryTableWarned = false;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'spelling_bee',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection
pool.getConnection()
  .then(connection => {
    console.log('Connected to MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('Database connection error:', err);
  });

// Word operations
const wordQueries = {
  // Get all words with pagination
  getAll: async (page = 1, limit = 50) => {
    const offset = (page - 1) * limit;
    const [rows] = await pool.execute(
      'SELECT * FROM words ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    const [count] = await pool.execute('SELECT COUNT(*) as total FROM words');
    return {
      words: rows,
      total: count[0].total,
      page,
      limit
    };
  },

  // Get random word
  getRandom: async () => {
    const [rows] = await pool.execute(
      'SELECT * FROM words ORDER BY RAND() LIMIT 1'
    );
    return rows[0] || null;
  },

  // Get word by ID
  getById: async (id) => {
    const [rows] = await pool.execute(
      'SELECT * FROM words WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  // Get word by word text
  getByWord: async (word) => {
    const [rows] = await pool.execute(
      'SELECT * FROM words WHERE word = ?',
      [word]
    );
    return rows[0] || null;
  },

  // Create word
  create: async (word, meaning = null, pronunciation = null) => {
    const [result] = await pool.execute(
      'INSERT INTO words (word, meaning, pronunciation) VALUES (?, ?, ?)',
      [word, meaning, pronunciation]
    );
    return result.insertId;
  },

  // Update word
  update: async (id, meaning = null, pronunciation = null) => {
    const updates = [];
    const values = [];

    if (meaning !== null) {
      updates.push('meaning = ?');
      values.push(meaning);
    }
    if (pronunciation !== null) {
      updates.push('pronunciation = ?');
      values.push(pronunciation);
    }

    if (updates.length === 0) {
      return null;
    }

    values.push(id);
    await pool.execute(
      `UPDATE words SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    return id;
  },

  // Batch insert words (ignore duplicates)
  batchInsert: async (words) => {
    if (words.length === 0) return [];

    const values = words.map(w => [w.word, w.meaning || null, w.pronunciation || null]);
    const [result] = await pool.query(
      'INSERT IGNORE INTO words (word, meaning, pronunciation) VALUES ?',
      [values]
    );
    return result.affectedRows;
  },

  // Delete word
  delete: async (id) => {
    const [result] = await pool.execute(
      'DELETE FROM words WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
};

const dictionaryQueries = {
  getByWord: async (word) => {
    try {
      const [rows] = await pool.execute(
        'SELECT meaning, pronunciation FROM dictionary_entries WHERE word = ? LIMIT 1',
        [word]
      );
      return rows[0] || null;
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        if (!missingDictionaryTableWarned) {
          console.warn('dictionary_entries table is missing. Run the dictionary import setup first.');
          missingDictionaryTableWarned = true;
        }
        return null;
      }
      throw error;
    }
  },

  upsertBatch: async (entries) => {
    if (!entries.length) return 0;

    const placeholders = entries.map(() => '(?, ?, ?, ?)').join(', ');
    const values = entries.flatMap(entry => [
      entry.word,
      entry.meaning,
      entry.pronunciation,
      entry.source || 'kaikki'
    ]);

    const sql = `
      INSERT INTO dictionary_entries (word, meaning, pronunciation, source)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        meaning = COALESCE(dictionary_entries.meaning, VALUES(meaning)),
        pronunciation = COALESCE(dictionary_entries.pronunciation, VALUES(pronunciation)),
        source = VALUES(source),
        updated_at = CURRENT_TIMESTAMP
    `;

    const [result] = await pool.query(sql, values);
    return result.affectedRows;
  }
};

module.exports = {
  pool,
  wordQueries,
  dictionaryQueries
};
