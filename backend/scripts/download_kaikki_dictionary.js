const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

const DEFAULT_URL = 'https://kaikki.org/dictionary/English/words/kaikki.org-dictionary-English-words.jsonl.gz';
const DOWNLOAD_URL = process.env.DICTIONARY_DOWNLOAD_URL || DEFAULT_URL;
const OUTPUT_FILE = path.resolve(__dirname, '../data/kaikki-en.jsonl');
const ARCHIVE_FILE = path.resolve(__dirname, '../data/kaikki-en.jsonl.gz');
const MAX_REDIRECTS = 5;

function getClient(url) {
  return url.startsWith('https:') ? https : http;
}

function request(url) {
  return new Promise((resolve, reject) => {
    const req = getClient(url).get(url, (res) => resolve(res));
    req.on('error', reject);
  });
}

async function fetchWithRedirects(url, redirectsLeft = MAX_REDIRECTS) {
  const res = await request(url);
  const statusCode = res.statusCode || 0;

  if ([301, 302, 303, 307, 308].includes(statusCode)) {
    const location = res.headers.location;
    res.resume();
    if (!location) throw new Error(`Redirect response missing Location header: ${statusCode}`);
    if (redirectsLeft <= 0) throw new Error('Too many redirects while downloading dictionary data');
    const nextUrl = new URL(location, url).toString();
    return fetchWithRedirects(nextUrl, redirectsLeft - 1);
  }

  if (statusCode < 200 || statusCode >= 300) {
    res.resume();
    throw new Error(`Failed to download dictionary data: HTTP ${statusCode}`);
  }

  return res;
}

async function downloadArchive(sourceUrl, archivePath) {
  const res = await fetchWithRedirects(sourceUrl);
  let downloaded = 0;

  res.on('data', (chunk) => {
    downloaded += chunk.length;
    if (downloaded % (50 * 1024 * 1024) < chunk.length) {
      const mb = Math.round(downloaded / (1024 * 1024));
      console.log(`Downloaded ${mb} MB...`);
    }
  });

  await pipeline(res, fs.createWriteStream(archivePath));
}

async function extractArchive(archivePath, outputPath) {
  const isGzip = archivePath.endsWith('.gz');
  if (!isGzip) {
    await pipeline(fs.createReadStream(archivePath), fs.createWriteStream(outputPath));
    return;
  }

  await pipeline(
    fs.createReadStream(archivePath),
    zlib.createGunzip(),
    fs.createWriteStream(outputPath)
  );
}

async function run() {
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  console.log(`Downloading dictionary data from: ${DOWNLOAD_URL}`);
  console.log(`Archive target: ${ARCHIVE_FILE}`);
  console.log(`Output target: ${OUTPUT_FILE}`);

  await downloadArchive(DOWNLOAD_URL, ARCHIVE_FILE);
  console.log('Download completed, extracting...');
  await extractArchive(ARCHIVE_FILE, OUTPUT_FILE);

  const stats = fs.statSync(OUTPUT_FILE);
  const mb = (stats.size / (1024 * 1024)).toFixed(1);
  console.log(`Dictionary ready at ${OUTPUT_FILE} (${mb} MB)`);
}

run().catch((error) => {
  console.error('Dictionary download failed:', error.message);
  process.exitCode = 1;
});
