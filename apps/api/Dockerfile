FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/database/package.json packages/database/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @novachat/api... --frozen-lockfile=false

FROM deps AS build
COPY packages/database packages/database
COPY packages/shared-types packages/shared-types
COPY apps/api apps/api
RUN pnpm --filter @novachat/shared-types build
RUN pnpm --filter @novachat/database prisma:generate
RUN pnpm --filter @novachat/database build
RUN pnpm --filter @novachat/api build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/packages/database/package.json ./packages/database/package.json
COPY --from=build /app/packages/database/prisma ./packages/database/prisma
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
