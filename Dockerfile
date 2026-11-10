# EduSmart API image.
#   build:  docker build -t edusmart-api .
#   run:    see deploy/uat/docker-compose.yml (needs DATABASE_URL, JWT_SECRET, ...)

# ---- build: compile TypeScript, generate the Prisma client for Linux ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---- MySQL client tools, matching the server version ------------------------------
FROM mysql:8.4 AS mysql

# ---- runtime ------------------------------------------------------------------
FROM node:24-bookworm-slim

# Oracle's MySQL client, not Debian's MariaDB one: the nightly backup
# (scripts/db-backup.js) passes --set-gtid-purged, which MariaDB's mysqldump rejects.
# Copied from the official image because Oracle's apt repo key has expired.
# The binaries need only libssl, zlib and (for `mysql`) ncurses.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl libssl3 zlib1g libncurses6 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=mysql /usr/bin/mysqldump /usr/bin/mysql /usr/local/bin/
RUN mysqldump --version && mysql --version

WORKDIR /app
ENV NODE_ENV=production

# Dev dependencies are kept on purpose: the Prisma CLI (db push) and ts-node
# (prisma db seed) are run inside this image when setting up a database.
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/tsconfig.json /app/prisma.config.ts ./

# Data folders; in compose they are mounted from the host so they survive redeploys.
RUN mkdir -p uploads storage/private backups && chown -R node:node /app
USER node

EXPOSE 5000
CMD ["node", "dist/src/main.js"]
