FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY packages/types/package.json packages/types/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter=api... || pnpm install --filter=api...

FROM deps AS build
COPY packages/types packages/types
COPY apps/api apps/api
RUN pnpm --filter @keyvantic/types run build
RUN pnpm --filter api run prisma:generate
RUN pnpm --filter api run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/packages/types/dist packages/types/dist
COPY --from=build /repo/packages/types/package.json packages/types/package.json
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/apps/api/node_modules apps/api/node_modules
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
