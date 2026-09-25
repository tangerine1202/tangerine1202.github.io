#!/bin/bash
# Build this folder as it is now (code + content/) into the production image and swap the container.
# The build runs the tests first; if they or the build fail, the running container is left as it was.
set -euo pipefail
cd "$(dirname "$0")"
docker compose build
docker compose up -d
