FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY admin/package.json admin/package-lock.json ./admin/
RUN npm --prefix admin ci
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY admin ./admin
RUN npm run build

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/admin-dist ./admin-dist
COPY migrations ./migrations
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node
EXPOSE 3000
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/src/server.js"]
