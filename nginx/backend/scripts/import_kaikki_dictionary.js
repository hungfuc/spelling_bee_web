require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { dictionaryQueries, pool } = require('../src/services/database');

const DEFAULT_DATA_FILE = path.resolve(__dirname, '../data/kaikki-en.jsonl');
const DATA_FILE = process.env.DICTIONARY_DATA_FILE || DEFAULT_DATA_FILE;
const BATCH_SIZE = Number(process.env.DICTIONARY_IMPORT_BATCH_SIZE || 500);

function normalizeWord(word) {
  if (!word || typeof word !== 'string') return null;
  const normalized = word.toLowerCase().trim();
  if (!/^[a-z]+$/.test(normalized)) return null;
  return normalized;
}

function extractMeaning(entry) {
  if (!Array.isArray(entry.senses)) return null;
  for (const sense of entry.senses) {
    if (Array.isArray(sense.glosses) && sense.glosses.length > 0 && sense.glosses[0]) {
      return String(sense.glosses[0]).trim();
    }
    if (Array.isArray(sense.raw_glosses) && sense.raw_glosses.length > 0 && sense.raw_glosses[0]) {
      return String(sense.raw_glosses[0]).trim();
    }
  }
  return null;
}

function extractPronunciation(entry) {
  if (!Array.isArray(entry.sounds)) return null;
  for (const sound of entry.sounds) {
    if (sound.ipa) return String(sound.ipa).trim();
    if (sound.enpr) return String(sound.enpr).trim();
    if (sound.text) return String(sound.text).trim();
  }
  return null;
}

async function flushBatch(batch) {
  if (!batch.length) return 0;
  return dictionaryQueries.upsertBatch(batch);
}

async function run() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Dictionary data file not found: ${DATA_FILE}`);
  }

  console.log(`Importing dictionary data from: ${DATA_FILE}`);
  console.log(`Batch size: ${BATCH_SIZE}`);

  const stream = fs.createReadStream(DATA_FILE, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let scanned = 0;
  let parsed = 0;
  let imported = 0;
  let skipped = 0;
  let batch = [];
  const seenInBatch = new Set();

  for await (const line of rl) {
    scanned += 1;
    if (!line || !line.trim()) {
      skipped += 1;
      continue;
    }

    let entry;
    try {
      entry = JSON.parse(line);
      parsed += 1;
    } catch (error) {
      skipped += 1;
      continue;
    }

    const word = normalizeWord(entry.word);
    if (!word) {
      skipped += 1;
      continue;
    }

    const meaning = extractMeaning(entry);
    const pronunciation = extractPronunciation(entry);
    if (!meaning && !pronunciation) {
      skipped += 1;
      continue;
    }

    const dedupeKey = `${word}|${meaning || ''}|${pronunciation || ''}`;
    if (seenInBatch.has(dedupeKey)) {
      skipped += 1;
      continue;
    }
    seenInBatch.add(dedupeKey);

    batch.push({
      word,
      meaning: meaning || null,
      pronunciation: pronunciation || null,
      source: 'kaikki'
    });

    if (batch.length >= BATCH_SIZE) {
      imported += await flushBatch(batch);
      batch = [];
      seenInBatch.clear();
    }

    if (scanned % 10000 === 0) {
      console.log(`Progress scanned=${scanned} parsed=${parsed} imported=${imported} skipped=${skipped}`);
    }
  }

  imported += await flushBatch(batch);

  console.log('Import completed');
  console.log(`Scanned lines: ${scanned}`);
  console.log(`Parsed JSON lines: ${parsed}`);
  console.log(`Imported/updated rows: ${imported}`);
  console.log(`Skipped lines: ${skipped}`);
}

run()
  .catch((error) => {
    console.error('Dictionary import failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (error) {
      // noop
    }
  });
