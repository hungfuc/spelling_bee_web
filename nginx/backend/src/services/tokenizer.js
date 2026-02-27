/**
 * Tokenize text into words
 * @param {string} text - The text to tokenize
 * @returns {string[]} Array of unique, normalized words
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Split by whitespace and punctuation, filter out empty strings
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/) // Split by whitespace
    .filter(word => word.length > 0) // Remove empty strings
    .filter(word => /^[a-z]+$/.test(word)); // Only alphabetic words

  // Remove duplicates and return
  return [...new Set(words)];
}

module.exports = {
  tokenize
};
