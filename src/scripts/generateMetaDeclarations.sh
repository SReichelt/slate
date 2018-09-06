#!/bin/sh
set -e
ts-node src/scripts/generateMetaDeclarations.ts "$@"
