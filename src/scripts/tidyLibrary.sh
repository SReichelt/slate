#!/bin/sh
set -e
find data/libraries/ -name '*.slate' -not -path '*/\.*' -exec src/scripts/tidy.sh '{}' +
