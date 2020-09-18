#!/bin/sh
set -e
find data/libraries/ -name '*.slate' -not -path '*/\.*' -exec src/scripts/tidy.sh '{}' +
find src/shared/logics/hlm/__tests__/data/ -name '*.slate' -not -path '*/\.*' -exec src/scripts/tidy.sh '{}' +
