const mysql = require('mysql2/promise');
let missingDictionaryTableWarned = false;
let ensureTagTablesPromise = null;

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
  getTagsByWordIds: async (wordIds = []) => {
    await ensureTagTables();

    if (wordIds.length === 0) {
      return new Map();
    }

    const placeholders = wordIds.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `
      SELECT wt.word_id, t.id, t.name
      FROM word_tags wt
      JOIN tags t ON t.id = wt.tag_id
      WHERE wt.word_id IN (${placeholders})
      ORDER BY t.name ASC
      `,
      wordIds
    );

    const tagsByWordId = new Map();
    for (const row of rows) {
      if (!tagsByWordId.has(row.word_id)) {
        tagsByWordId.set(row.word_id, []);
      }
      tagsByWordId.get(row.word_id).push({ id: row.id, name: row.name });
    }

    return tagsByWordId;
  },

  attachTags: async (words = []) => {
    if (words.length === 0) {
      return words;
    }

    const ids = words.map((word) => word.id);
    const tagsByWordId = await wordQueries.getTagsByWordIds(ids);
    return words.map((word) => ({
      ...word,
      tags: tagsByWordId.get(word.id) || []
    }));
  },

  // Get all words with pagination
  getAll: async (page = 1, limit = 50, tagIds = []) => {
    await ensureTagTables();

    const safePage = Number.isFinite(Number(page)) ? Math.max(1, parseInt(page, 10)) : 1;
    const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, parseInt(limit, 10)) : 50;
    const offset = (safePage - 1) * safeLimit;
    let rows = [];
    let total = 0;

    if (tagIds.length > 0) {
      const placeholders = tagIds.map(() => '?').join(', ');
      const [filteredRows] = await pool.query(
        `
        SELECT w.*
        FROM words w
        JOIN word_tags wt ON wt.word_id = w.id
        WHERE wt.tag_id IN (${placeholders})
        GROUP BY w.id
        HAVING COUNT(DISTINCT wt.tag_id) = ?
        ORDER BY w.created_at DESC
        LIMIT ? OFFSET ?
        `,
        [...tagIds, tagIds.length, safeLimit, offset]
      );
      rows = filteredRows;

      const [count] = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM (
          SELECT w.id
          FROM words w
          JOIN word_tags wt ON wt.word_id = w.id
          WHERE wt.tag_id IN (${placeholders})
          GROUP BY w.id
          HAVING COUNT(DISTINCT wt.tag_id) = ?
        ) matched_words
        `,
        [...tagIds, tagIds.length]
      );
      total = count[0].total;
    } else {
      const [unfilteredRows] = await pool.query(
        'SELECT * FROM words ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [safeLimit, offset]
      );
      rows = unfilteredRows;

      const [count] = await pool.execute('SELECT COUNT(*) as total FROM words');
      total = count[0].total;
    }

    const wordsWithTags = await wordQueries.attachTags(rows);
    return {
      words: wordsWithTags,
      total,
      page: safePage,
      limit: safeLimit
    };
  },

  // Get random word
  getRandom: async (tagIds = []) => {
    await ensureTagTables();

    let word = null;

    if (tagIds.length > 0) {
      const placeholders = tagIds.map(() => '?').join(', ');
      const [rows] = await pool.query(
        `
        SELECT w.*
        FROM words w
        JOIN word_tags wt ON wt.word_id = w.id
        WHERE wt.tag_id IN (${placeholders})
        GROUP BY w.id
        HAVING COUNT(DISTINCT wt.tag_id) = ?
        ORDER BY RAND()
        LIMIT 1
        `,
        [...tagIds, tagIds.length]
      );
      word = rows[0] || null;
    } else {
      const [rows] = await pool.execute(
        'SELECT * FROM words ORDER BY RAND() LIMIT 1'
      );
      word = rows[0] || null;
    }

    if (!word) {
      return null;
    }

    const [wordWithTags] = await wordQueries.attachTags([word]);
    return wordWithTags || null;
  },

  // Get word by ID
  getById: async (id) => {
    const [rows] = await pool.execute(
      'SELECT * FROM words WHERE id = ?',
      [id]
    );
    if (!rows[0]) {
      return null;
    }
    const [word] = await wordQueries.attachTags([rows[0]]);
    return word || null;
  },

  // Get word by word text
  getByWord: async (word) => {
    const [rows] = await pool.execute(
      'SELECT * FROM words WHERE word = ?',
      [word]
    );
    if (!rows[0]) {
      return null;
    }
    const [wordWithTags] = await wordQueries.attachTags([rows[0]]);
    return wordWithTags || null;
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
  },

  addTags: async (wordId, tagIds = []) => {
    if (!tagIds.length) {
      return 0;
    }

    const values = tagIds.map((tagId) => [wordId, tagId]);
    const [result] = await pool.query(
      'INSERT IGNORE INTO word_tags (word_id, tag_id) VALUES ?',
      [values]
    );
    return result.affectedRows;
  }
};

const tagQueries = {
  normalizeTagName: (name) => name.trim().toLowerCase(),

  getAll: async () => {
    await ensureTagTables();

    const [rows] = await pool.execute(
      `
      SELECT t.id, t.name, COUNT(wt.word_id) AS wordCount
      FROM tags t
      LEFT JOIN word_tags wt ON wt.tag_id = t.id
      GROUP BY t.id
      ORDER BY t.name ASC
      `
    );
    return rows;
  },

  ensureTags: async (tagNames = []) => {
    await ensureTagTables();

    const cleanedNames = [...new Set(
      tagNames
        .map((name) => (typeof name === 'string' ? tagQueries.normalizeTagName(name) : ''))
        .filter(Boolean)
    )];

    if (!cleanedNames.length) {
      return [];
    }

    const values = cleanedNames.map((name) => [name]);
    await pool.query(
      'INSERT IGNORE INTO tags (name) VALUES ?',
      [values]
    );

    const placeholders = cleanedNames.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `SELECT id, name FROM tags WHERE name IN (${placeholders})`,
      cleanedNames
    );
    return rows;
  }
};

async function ensureTagTables() {
  if (!ensureTagTablesPromise) {
    ensureTagTablesPromise = (async () => {
      await pool.execute(
        `
        CREATE TABLE IF NOT EXISTS tags (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        `
      );
      await pool.execute(
        `
        CREATE TABLE IF NOT EXISTS word_tags (
          word_id INT NOT NULL,
          tag_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (word_id, tag_id),
          CONSTRAINT fk_word_tags_word
            FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
          CONSTRAINT fk_word_tags_tag
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
          INDEX idx_word_tags_tag_id (tag_id)
        )
        `
      );
    })().catch((error) => {
      ensureTagTablesPromise = null;
      throw error;
    });
  }

  return ensureTagTablesPromise;
}

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
  tagQueries,
  dictionaryQueries
};
