#!/bin/sh
set -e
for dir in data/libraries/*; do
  if [ -d $dir ]; then
    for file in $dir/*.slate; do
      src/scripts/check.sh "$file"
    done
  fi
done
