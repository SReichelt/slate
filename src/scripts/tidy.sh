#!/bin/sh
set -e
TS_NODE_COMPILER_OPTIONS={\"module\":\"commonjs\"} ts-node src/scripts/tidy.ts "$@"
