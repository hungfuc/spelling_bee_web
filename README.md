# Spelling Bee Application

A web application for practicing spelling with words imported from text files. Built with SvelteKit, Node.js/Express, and MySQL, all running in Docker containers.

## Features

1. **Text File Import**: Upload a text file and automatically tokenize it into words
2. **Automatic Word Processing**: Words are automatically enriched with meanings and pronunciations from a local dictionary dataset (Kaikki/Wiktionary)
3. **Spelling Bee Test**: Interactive card-based test interface with:
   - Hidden word display (covered initially)
   - Text-to-speech pronunciation
   - Answer reveal (card flip animation)
   - Word meaning display

## Tech Stack

- **Frontend**: SvelteKit
- **Backend**: Node.js + Express
- **Database**: MySQL 8.0
- **Containerization**: Docker Compose
- **Data Sources**: Kaikki/Wiktionary dictionary data, Web Speech API

## Project Structure

```
spelling_bee/
├── frontend/          # SvelteKit application
├── backend/           # Express API server
├── database/          # Database initialization scripts
└── docker-compose.yml # Docker orchestration
```

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- Git (optional)

### Installation

1. Clone or download this repository

2. Start the application:
   ```bash
   docker-compose up --build
   ```

3. Access the application:
   - App (Nginx): http://localhost:8088
   - Backend API: http://localhost:3001
   - MySQL: localhost:3366
   - phpMyAdmin: http://localhost:8090

### Usage

1. **Import Words**:
   - Go to the home page
   - Upload a `.txt` file containing text
   - The system will automatically:
     - Extract all words
     - Fetch meanings from local dictionary data
     - Store pronunciations
     - Save everything to the database

2. **Take a Test**:
   - Navigate to the "Test" page
   - A random word will be displayed on a card (hidden initially)
   - Use the buttons to:
     - **Speak**: Hear the word pronounced
     - **Show Answer**: Reveal the word
     - **Meaning**: View the word's definition
   - Click "Next Word" to get a new random word

## API Endpoints

- `POST /api/upload` - Upload text file
- `GET /api/words` - List all words (with pagination)
- `GET /api/words/random` - Get random word
- `GET /api/words/:id` - Get word by ID
- `POST /api/words` - Create word manually
- `PUT /api/words/:id` - Update word
- `DELETE /api/words/:id` - Delete word

## Environment Variables

### Backend
- `DB_HOST` - MySQL host (default: mysql)
- `DB_USER` - MySQL user (default: root)
- `DB_PASSWORD` - MySQL password (default: password)
- `DB_NAME` - Database name (default: spelling_bee)
- `PORT` - Backend port (default: 3001)

### Frontend
- `PUBLIC_API_URL` - Backend API URL (default: http://localhost:3001)

## Development

### Backend Development
```bash
cd backend
npm install
npm run dev
```

### Load Local Dictionary Data (Kaikki)
1. Download an English Kaikki JSONL file and save it at:
   - `backend/data/kaikki-en.jsonl`
2. Ensure containers are running:
   ```bash
   docker compose up -d
   ```
3. Create dictionary table for existing DBs (one-time, if DB already existed before this change):
   ```bash
   docker compose exec mysql mysql -uroot -ppassword spelling_bee -e "CREATE TABLE IF NOT EXISTS dictionary_entries (id BIGINT PRIMARY KEY AUTO_INCREMENT, word VARCHAR(255) UNIQUE NOT NULL, meaning TEXT, pronunciation VARCHAR(255), source VARCHAR(64) DEFAULT 'kaikki', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_dictionary_word (word));"
   ```
4. Import data:
   ```bash
   docker compose exec backend npm run import:dictionary
   ```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

## Notes

- Dictionary meanings/pronunciations are loaded from local Kaikki data into MySQL
- Web Speech API works on localhost and HTTPS-enabled sites
- Words are stored with unique constraints to prevent duplicates
- The application handles API failures gracefully and continues processing

## License

ISC
