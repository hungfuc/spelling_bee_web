const STORAGE_KEY = 'spelling-bee-tts-settings';

export const TTS_ENGINES = [
  { id: 'melo', label: 'Melo (backend default)' },
  { id: 'kokoro', label: 'Kokoro (backend service)' },
  { id: 'coqui', label: 'Coqui XTTS (backend service)' },
  { id: 'styletts2', label: 'StyleTTS2 (backend service)' },
  { id: 'browser', label: 'Browser SpeechSynthesis' },
  { id: 'custom', label: 'Custom HTTP TTS endpoint' }
];

export const DEFAULT_TTS_SETTINGS = {
  engine: 'melo',
  voice: '',
  speed: 1,
  customUrl: '',
  serviceUrl: ''
};

function sanitizeSettings(input) {
  const source = input && typeof input === 'object' ? input : {};
  const knownEngine = TTS_ENGINES.some((engine) => engine.id === source.engine);
  const speed = Number(source.speed);
  return {
    engine: knownEngine ? source.engine : DEFAULT_TTS_SETTINGS.engine,
    voice: String(source.voice || '').trim(),
    speed: Number.isFinite(speed) ? Math.min(2, Math.max(0.5, speed)) : DEFAULT_TTS_SETTINGS.speed,
    customUrl: String(source.customUrl || '').trim(),
    serviceUrl: String(source.serviceUrl || '').trim()
  };
}

export function getTtsSettings() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_TTS_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_TTS_SETTINGS };
    }
    return sanitizeSettings(JSON.parse(raw));
  } catch (error) {
    return { ...DEFAULT_TTS_SETTINGS };
  }
}

export function saveTtsSettings(nextSettings) {
  const clean = sanitizeSettings(nextSettings);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  }
  return clean;
}
