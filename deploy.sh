#!/bin/bash
# Build this folder as it is now (code + content/) and publish it to blog.alans.dev on Cloudflare Workers.
# The build runs the tests first, in Docker; if they or the build fail, nothing is uploaded and the live
# site is as it was. Needs Docker and node (for npx wrangler), and the API token in ~/.config/cloudflare.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf .deploy/site
docker build --target site --output type=local,dest=.deploy/site .
CLOUDFLARE_API_TOKEN=$(< ~/.config/cloudflare/api-token) WRANGLER_SEND_METRICS=false npx --yes wrangler@4 deploy
