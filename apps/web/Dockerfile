FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY packages/types/package.json packages/types/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter=web... || pnpm install --filter=web...

FROM deps AS build
COPY packages/types packages/types
COPY apps/web apps/web
RUN pnpm --filter @keyvantic/types run build
RUN pnpm --filter web run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next apps/web/.next
COPY --from=build /repo/apps/web/public apps/web/public
COPY --from=build /repo/apps/web/package.json apps/web/package.json
COPY --from=build /repo/packages/types/dist packages/types/dist
COPY --from=build /repo/packages/types/package.json packages/types/package.json
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/apps/web/node_modules apps/web/node_modules
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
