# Oracle Cloud Always Free optimized Dockerfile
# Target: OCI Ampere A1 (linux/arm64) or regular x86_64 Linux.

FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0
ENV DEBUG=False
ENV OMP_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV NUMEXPR_NUM_THREADS=1

# libgomp1 is needed by XGBoost/OpenMP on slim images.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    gcc \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && pip install -r requirements.txt

COPY . .

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=5).raise_for_status()"

CMD ["gunicorn", \
     "--workers=1", \
     "--threads=2", \
     "--worker-class=gthread", \
     "--bind=0.0.0.0:8000", \
     "--timeout=120", \
     "--access-logfile=-", \
     "--error-logfile=-", \
     "--log-level=info", \
     "app:app"]
