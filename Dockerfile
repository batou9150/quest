# One image serves the API and the built React app. Build from the repo root:
#   docker build -t quest .
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/shared/package.json packages/shared/
COPY packages/levels-demo/package.json packages/levels-demo/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY packages packages
COPY apps apps
RUN npm run build

# Production dependencies of the API only. Everything else is bundled into dist/server.js;
# @google-cloud/firestore stays a real package because it reads protobuf files at runtime.
FROM node:24-slim AS deps
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages/engine/package.json packages/engine/
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/levels-demo/package.json packages/levels-demo/
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @quest/api --ignore-scripts

FROM node:24-slim
ENV NODE_ENV=production PORT=8080 WEB_DIST=/app/web GUIDES_DIR=/app/content/guides
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/apps/api/dist api
COPY --from=build /app/apps/web/dist web
COPY content content
USER node
EXPOSE 8080
CMD ["node", "--enable-source-maps", "api/server.js"]
