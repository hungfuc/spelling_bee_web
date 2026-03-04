import os
import tempfile
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

# Melo imports MeCab language modules at import time.
# Force a valid MeCab dictionary path up-front to avoid defaulting to missing unidic data.
MECABRC_CANDIDATES = [
    "/usr/local/lib/python3.10/site-packages/unidic_lite/dicdir/mecabrc",
    "/usr/local/lib/python3.11/site-packages/unidic_lite/dicdir/mecabrc",
    "/usr/local/lib/python3.10/site-packages/unidic/dicdir/mecabrc",
    "/usr/local/lib/python3.11/site-packages/unidic/dicdir/mecabrc",
]
for candidate in MECABRC_CANDIDATES:
    if os.path.exists(candidate):
        os.environ["MECABRC"] = candidate
        break

from melo.api import TTS

app = FastAPI(title="MeloTTS Service")

LANGUAGE = os.getenv("MELO_LANGUAGE", "EN")
SPEAKER = os.getenv("MELO_SPEAKER", "EN-US")
SPEED = float(os.getenv("MELO_SPEED", "1.0"))
DEVICE = os.getenv("MELO_DEVICE", "cpu")
WARMUP_ON_STARTUP = os.getenv("TTS_WARMUP_ON_STARTUP", "false").lower() == "true"

tts_model = None
speaker_id = None


class TTSRequest(BaseModel):
    text: str


def ensure_model_loaded():
    global tts_model, speaker_id
    if tts_model is not None and speaker_id is not None:
        return

    tts_model = TTS(language=LANGUAGE, device=DEVICE)
    speaker_map = tts_model.hps.data.spk2id

    if SPEAKER not in speaker_map:
        raise RuntimeError(f"Unknown speaker '{SPEAKER}' for language '{LANGUAGE}'")

    speaker_id = speaker_map[SPEAKER]


def warmup_synthesis():
    """Run one tiny synthesis at startup so runtime dependencies are ready."""
    ensure_model_loaded()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
        tts_model.tts_to_file("roughs", speaker_id, tmp.name, speed=SPEED)


@app.on_event("startup")
def startup_event():
    # Keep startup fast; heavy synthesis warmup can block service readiness for minutes.
    if WARMUP_ON_STARTUP:
        warmup_synthesis()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "language": LANGUAGE,
        "speaker": SPEAKER,
        "device": DEVICE
    }


@app.post("/tts")
def tts(req: TTSRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if len(text) > 100:
        raise HTTPException(status_code=400, detail="text is too long")

    try:
        ensure_model_loaded()
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
            tts_model.tts_to_file(text, speaker_id, tmp.name, speed=SPEED)
            tmp.seek(0)
            audio = tmp.read()
        return Response(content=audio, media_type="audio/wav")
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {error}")
