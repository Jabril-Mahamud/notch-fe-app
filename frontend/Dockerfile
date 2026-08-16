FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# output: "standalone" bakes the /api rewrite destination into routes-manifest
# at build time, so API_ORIGIN is a build arg, not a runtime env var. Only
# Compose uses it; in the cluster the ingress matches /api before Next does.
ARG API_ORIGIN=http://backend:8000
ENV API_ORIGIN=$API_ORIGIN
RUN npm run build


FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# podSecurityContext.runAsNonRoot is set in services/notch/service.yaml. The
# kubelet cannot resolve a username to a UID, so `USER node` would still fail
# the check with CreateContainerConfigError - the USER must be numeric.
# 1000 is the `node` user that ships in this image.
USER 1000

EXPOSE 3000

CMD ["node", "server.js"]
