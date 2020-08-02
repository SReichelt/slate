#!/bin/sh
set -e
node_modules/.bin/ts-node -P src/scripts/tsconfig.json src/scripts/checkLinks.ts "$@"
