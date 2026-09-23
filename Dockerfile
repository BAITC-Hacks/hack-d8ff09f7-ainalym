FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production \
    DATABASE_PATH=/data/ainalym.db \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY next.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src
COPY fixtures ./fixtures
COPY scripts ./scripts
RUN npm run build

RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

# The ETL lane adds scripts.etl. Initialise the persistent volume once when it exists.
CMD ["sh", "-c", "if [ ! -s \"$DATABASE_PATH\" ] && node -e \"process.exit(require('./package.json').scripts.etl ? 0 : 1)\"; then npm run etl -- --db \"$DATABASE_PATH\" || exit; fi; exec npm start"]
