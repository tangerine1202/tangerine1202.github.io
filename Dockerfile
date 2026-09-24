# Production image: a snapshot of the site, built once and served as static files.
# Built by deploy.sh from this folder, content/ included; nothing on the host is mounted,
# so editing files or running `npm run dev` doesn't touch production until the next deploy.

FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
ENV TZ=Asia/Taipei MEANWHILE_BASE=/
RUN node --test test/*.test.mjs && node build.mjs

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
EXPOSE 80
CMD ["caddy", "file-server", "--root", "/srv", "--listen", ":80"]
