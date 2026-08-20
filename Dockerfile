ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/game-core/package.json ./packages/game-core/package.json
COPY packages/clocktower/package.json ./packages/clocktower/package.json
COPY packages/poker/package.json ./packages/poker/package.json
COPY packages/gomoku/package.json ./packages/gomoku/package.json
COPY packages/manor/package.json ./packages/manor/package.json
COPY patches ./patches

RUN pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages

RUN pnpm build

FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/app/data/party-games.sqlite
ENV WEB_DIST_PATH=/app/apps/web/dist

WORKDIR /app

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/packages ./packages

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "apps/server/dist/index.js"]
