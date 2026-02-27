const { dictionaryQueries } = require('./database');

/**
 * Fetch word information from local dictionary_entries table.
 * @param {string} word - The word to look up
 * @returns {Promise<{meaning: string, pronunciation: string}|null>}
 */
async function getWordInfo(word) {
  const normalizedWord = (word || '').toLowerCase().trim();
  if (!normalizedWord) {
    return null;
  }

  try {
    const entry = await dictionaryQueries.getByWord(normalizedWord);
    if (!entry) return null;

    if (!entry.meaning && !entry.pronunciation) {
      return null;
    }

    return {
      meaning: entry.meaning || null,
      pronunciation: entry.pronunciation || null
    };
  } catch (error) {
    console.error(`Dictionary lookup error for word "${word}":`, error.message);
    return null;
  }
}

module.exports = {
  getWordInfo
};
