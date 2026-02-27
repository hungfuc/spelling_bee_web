import axios from 'axios';

const RAW_API_URL = import.meta.env.PUBLIC_API_URL ?? '';
const API_URL = RAW_API_URL.replace(/\/$/, '');

const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Words API
export const wordsAPI = {
  // Get all words
  getAll: (page = 1, limit = 50) => {
    return api.get('/words', { params: { page, limit } });
  },

  // Get random word
  getRandom: () => {
    return api.get('/words/random');
  },

  // Get word by ID
  getById: (id) => {
    return api.get(`/words/${id}`);
  },

  // Create word
  create: (word, meaning = null, pronunciation = null) => {
    return api.post('/words', { word, meaning, pronunciation });
  },

  // Update word
  update: (id, meaning = null, pronunciation = null) => {
    return api.put(`/words/${id}`, { meaning, pronunciation });
  },

  // Delete word
  delete: (id) => {
    return api.delete(`/words/${id}`);
  }
};

// Upload API
export const uploadAPI = {
  // Upload text file
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }
};

export default api;
