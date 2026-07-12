FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ui/package.json packages/ui/package.json
COPY apps/super-admin/package.json apps/super-admin/package.json
RUN pnpm install --filter @novachat/super-admin... --frozen-lockfile=false

FROM deps AS build
COPY packages/ui packages/ui
COPY apps/super-admin apps/super-admin
RUN pnpm --filter @novachat/ui build
RUN pnpm --filter @novachat/super-admin build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/apps/super-admin/.next/standalone ./
COPY --from=build /app/apps/super-admin/.next/static ./apps/super-admin/.next/static
COPY --from=build /app/apps/super-admin/public ./apps/super-admin/public
EXPOSE 3001
CMD ["node", "apps/super-admin/server.js"]
