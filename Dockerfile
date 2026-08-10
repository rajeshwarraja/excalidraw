FROM --platform=${BUILDPLATFORM} node:24@sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --frozen-lockfile --network-timeout 600000

ARG NODE_ENV=production

RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

FROM nginx:stable-alpine-slim@sha256:2c605dbeab79a6b2a63340474fe58119d0ef95bdc4b1f41df0aa689659b3d13b

ARG BUILD_VERSION=unknown

LABEL org.opencontainers.image.title="Excalidraw" \
      org.opencontainers.image.description="Virtual collaborative whiteboard for sketching hand-drawn like diagrams" \
      org.opencontainers.image.vendor="Excalidraw" \
      org.opencontainers.image.authors="Excalidraw <https://github.com/excalidraw/excalidraw>" \
      org.opencontainers.image.source="https://github.com/excalidraw/excalidraw" \
      org.opencontainers.image.url="https://github.com/excalidraw/excalidraw" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${BUILD_VERSION}"

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html
COPY --from=build /opt/node_app/LICENSE /usr/share/nginx/html/LICENSE

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
