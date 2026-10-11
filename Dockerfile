# FoodExpress - container image.
#
# Build:  docker build -t foodexpress .
# Run:    docker run -d --name foodexpress -p 3000:3000 foodexpress
#         docker run -d --name foodexpress -p 3000:3000 --env-file .env foodexpress   (with SMTP settings)

FROM node:20-alpine

# tini forwards stop signals to Node, so "docker stop" shuts the app down at once.
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Install dependencies first: this layer is reused until package*.json changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application code (see .dockerignore for what is left out).
COPY . .

# Run as the unprivileged "node" user that the base image provides.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
