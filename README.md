# Spelling Bee Application

A web application for practicing spelling with words imported from text files. Built with SvelteKit, Node.js/Express, and MySQL, all running in Docker containers.

## Features

1. Text file import and tokenization
2. Automatic meaning/pronunciation enrichment from local Kaikki/Wiktionary dictionary data
3. Multiple tags can be added during file upload
4. Random spelling test words can be filtered by selected tags
5. Interactive test card with speech and reveal controls (MeloTTS local service)

## Tech Stack

- Frontend: SvelteKit
- Backend: Node.js + Express
- Database: MySQL 8.0
- Containerization: Docker Compose

## Project Structure

```text
spelling_bee_web/
├── frontend/
├── backend/
├── database/
├── nginx/
├── docker-compose.yml
├── docker-compose-prod.yml
└── deploy-prod.sh
```

## Getting Started (Development)

1. Start dev stack:

```bash
docker compose up --build
```

2. Access services:
- App (Nginx): http://localhost:8088
- Backend API: http://localhost:3001
- MySQL: localhost:3366
- phpMyAdmin: http://localhost:8091

## Usage

1. Import words:
- Go to `/`
- Upload a `.txt` file
- Optionally add multiple tags before upload

2. Take test:
- Go to `/test`
- Optionally select tags to filter test words
- Click Next Word for another random word in the current filter

## API Endpoints

- `POST /api/upload` - Upload text file (`multipart/form-data`) with optional `tags` JSON array (requires upload token in `x-access-token`)
- `GET /api/words` - List words (`page`, `limit`, optional `tagIds=1,2`)
- `GET /api/words/random` - Random word (optional `tagIds=1,2`, requires test token in `x-access-token`)
- `GET /api/words/tags` - List all tags with word counts (requires test token in `x-access-token`)
- `POST /api/words/tts` - Generate pronunciation audio from MeloTTS service (requires test token in `x-access-token`)
- `GET /api/words/:id` - Get word by ID
- `POST /api/words` - Create word manually
- `PUT /api/words/:id` - Update word
- `DELETE /api/words/:id` - Delete word

## Production Deployment

Use the production compose file with compiled frontend assets:

```bash
docker compose -f docker-compose-prod.yml up -d --build
```

Or run the deployment script:

```bash
./deploy-prod.sh
```

Production ports:
- Frontend Nginx: http://localhost:8090
- phpMyAdmin: http://localhost:8091
- MySQL: localhost:3366

## Production Nginx Config

`nginx/prod.conf`:

```nginx
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;
  client_max_body_size 20m;

  location /api/ {
    proxy_pass http://backend:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## Environment Variables

## Token Configuration

Set tokens in `backend/config.json`:

```json
{
  "uploadToken": "your-upload-token",
  "testToken": "your-test-token",
  "ttsRequestTimeoutMs": 300000,
  "ttsRetryWindowMs": 330000,
  "ttsRetryDelayMs": 1500,
  "ttsShortRetryWindowMs": 4000
}
```

- `ttsRequestTimeoutMs`: timeout for one backend->TTS HTTP call
- `ttsRetryWindowMs`: total retry window for default engine URLs
- `ttsRetryDelayMs`: delay between retries
- `ttsShortRetryWindowMs`: shorter retry window for user-provided `serviceUrl`

Backend:
- `DB_HOST` (default: `mysql`)
- `DB_USER` (default: `root`)
- `DB_PASSWORD` (default: `password`)
- `DB_NAME` (default: `spelling_bee`)
- `PORT` (default: `3001`)
- `TTS_SERVICE_URL` (default: `http://tts:8000`)

Frontend:
- `PUBLIC_API_URL` (default: empty, so requests use `/api`)

TTS service (Compose env vars):
- `MELO_LANGUAGE` (default: `EN`)
- `MELO_SPEAKER` (default: `EN-US`)
- `MELO_SPEED` (default: `1.0`)
- `MELO_DEVICE` (default: `cpu`)

## License

ISC
