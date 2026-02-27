FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r /app/requirements.txt && \
    python - <<'PY'
import nltk
nltk.download("averaged_perceptron_tagger", quiet=True)
nltk.download("averaged_perceptron_tagger_eng", quiet=True)
nltk.download("cmudict", quiet=True)
PY

COPY app.py /app/app.py

EXPOSE 8000

CMD ["sh", "-c", "mkdir -p /usr/local/lib/python3.10/site-packages/unidic && rm -rf /usr/local/lib/python3.10/site-packages/unidic/dicdir && ln -s /usr/local/lib/python3.10/site-packages/unidic_lite/dicdir /usr/local/lib/python3.10/site-packages/unidic/dicdir && exec uvicorn app:app --host 0.0.0.0 --port 8000"]
