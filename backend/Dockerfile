# backend/Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Системні пакети (серти, компілятор для можливих коліс), tzdata
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential tzdata ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Спершу залежності — для кешу
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Далі код
COPY backend /app

# Порт сервісу
EXPOSE 8000

# Uvicorn (можеш збільшити воркерів, якщо треба)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
