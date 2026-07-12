FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
RUN pnpm install --filter @novachat/dashboard... --frozen-lockfile=false

FROM deps AS build
COPY packages/shared-types packages/shared-types
COPY packages/ui packages/ui
COPY apps/dashboard apps/dashboard
RUN pnpm --filter @novachat/shared-types build
RUN pnpm --filter @novachat/ui build
RUN pnpm --filter @novachat/dashboard build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/apps/dashboard/.next/standalone ./
COPY --from=build /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
