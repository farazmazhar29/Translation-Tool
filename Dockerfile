# Stage 1: build the React frontend
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: API + built frontend in one image (single central web server)
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 DATA_DIR=/data
WORKDIR /srv/backend

# Hash-locked dependencies: pip refuses anything that is not exactly what was locked and audited.
COPY backend/requirements.lock ./
RUN pip install --require-hashes -r requirements.lock

COPY backend/app app
COPY backend/migrations migrations
COPY backend/alembic.ini ./
COPY --from=web /web/dist /srv/frontend/dist

# The app runs as an unprivileged user: the entrypoint starts as root only to fix volume ownership, then drops privileges.
# A home of its own: libpq looks for optional client certificates in $HOME/.postgresql, and /root is closed to it.
RUN useradd --system --uid 10001 --create-home --home-dir /home/app app && mkdir /data && chown app /data
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
VOLUME /data
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request as u; u.urlopen('http://localhost:8000/api/ready')"
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
