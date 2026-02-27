CREATE DATABASE IF NOT EXISTS spelling_bee;
USE spelling_bee;

CREATE TABLE IF NOT EXISTS words (
    id INT PRIMARY KEY AUTO_INCREMENT,
    word VARCHAR(255) UNIQUE NOT NULL,
    meaning TEXT,
    pronunciation VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_word (word)
);

CREATE TABLE IF NOT EXISTS dictionary_entries (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    word VARCHAR(255) UNIQUE NOT NULL,
    meaning TEXT,
    pronunciation VARCHAR(255),
    source VARCHAR(64) DEFAULT 'kaikki',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dictionary_word (word)
);

CREATE TABLE IF NOT EXISTS tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);
