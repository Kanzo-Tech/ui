# The storage service, built from the repository root (compose.yaml's context), because it runs on
# the workspace's own @kanzo-tech/auth and @kanzo-tech/kernel at the same commit — the halves checked
# against each other (/docs/design/services).
FROM node:24-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @kanzo-tech/storage-service... \
 && pnpm --filter @kanzo-tech/kernel --filter @kanzo-tech/auth build \
 && pnpm --filter @kanzo-tech/storage-service deploy --prod --legacy /service

FROM node:24-slim
WORKDIR /service
COPY --from=build /service .
USER node
# Node runs the TypeScript as it is: type stripping, no build step of its own.
CMD ["node", "src/main.ts"]
