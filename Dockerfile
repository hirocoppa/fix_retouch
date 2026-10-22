FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python3-venv ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY requirements.txt ./
RUN python3 -m venv /opt/retouch-venv && /opt/retouch-venv/bin/pip install --no-cache-dir -r requirements.txt
COPY public ./public
COPY server.js track_mask.py ./
ENV NODE_ENV=production PYTHON_BIN=/opt/retouch-venv/bin/python
EXPOSE 3000
CMD ["node", "server.js"]
