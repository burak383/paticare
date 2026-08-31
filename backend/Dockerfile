# Production image for the PatiCare backend — works the same way on any
# host that can run a Dockerfile (Railway, Render, Fly.io, a plain VPS via
# `docker run`, ...). See README.md's "Backend'i deploy etmek" section.
FROM node:22-slim

WORKDIR /app

# Install deps first so this layer only rebuilds when package*.json changes,
# not on every source edit.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
# The platform's own PORT env var (Railway, Render, ...) overrides this at
# runtime — src/index.js already reads process.env.PORT — this is just the
# container's default when run standalone (e.g. `docker run -p 4000:4000`).
ENV PORT=4000
EXPOSE 4000

CMD ["node", "src/index.js"]
