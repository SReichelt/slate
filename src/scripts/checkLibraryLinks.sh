#!/bin/sh
set -e
find data/libraries/ -name '*.slate' -exec src/scripts/checkLinks.sh '{}' +
