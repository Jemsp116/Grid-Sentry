# Grid Sentry backend — dev-oriented image.
# docker-compose bind-mounts ./backend over /app and keeps the image's
# node_modules, so source edits hot-reload via `tsx watch`.
FROM node:22-alpine

WORKDIR /app

# Install deps first for better layer caching
COPY package.json package-lock.json* ./
RUN npm install

# Copy source (overlaid by the compose bind mount at runtime)
COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]
