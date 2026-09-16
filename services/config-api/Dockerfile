FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY services/config-api/package.json services/config-api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY services/config-api services/config-api

RUN npm run build --workspace=@opspilot/contracts \
  && npm run db:generate --workspace=@opspilot/config-api \
  && npm run build --workspace=@opspilot/config-api

# One-shot targets used during deployment before the long-running API starts.
FROM builder AS migrator
CMD ["npm", "run", "db:deploy", "--workspace=@opspilot/config-api"]

FROM builder AS seeder
CMD ["npm", "run", "db:seed", "--workspace=@opspilot/config-api"]

FROM builder AS production-deps
RUN npm prune --omit=dev

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/services/config-api/package.json ./services/config-api/package.json
COPY --from=builder /app/services/config-api/dist ./services/config-api/dist
COPY --from=builder /app/services/config-api/prisma/schema.prisma ./services/config-api/prisma/schema.prisma

EXPOSE 4000
CMD ["node", "services/config-api/dist/main.js"]
