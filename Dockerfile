# Production image: a snapshot of the site, built once and served as static files.
# Built by deploy.sh from this folder, content/ included; nothing on the host is mounted,
# so editing files or running `npm run dev` doesn't touch production until the next deploy.

FROM node:22-bookworm-slim AS build
# deb.debian.org (Fastly) crawls at ~0.1 MB/s over IPv4 from this network, and containers only have IPv4;
# the NCHC mirror in Taiwan runs at ~7 MB/s. It has no debian-security, so that one is left as it is.
ARG DEBIAN_MIRROR=http://ftp.tw.debian.org/debian
RUN sed -i "s|http://deb.debian.org/debian$|$DEBIAN_MIRROR|" /etc/apt/sources.list.d/debian.sources
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
ENV TZ=Asia/Taipei MEANWHILE_BASE=/
RUN node --test test/*.test.mjs && node build.mjs

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
EXPOSE 80
CMD ["caddy", "file-server", "--root", "/srv", "--listen", ":80"]
