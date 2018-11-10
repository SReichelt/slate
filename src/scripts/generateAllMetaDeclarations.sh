#!/bin/sh
set -e
./src/scripts/generateMetaDeclarations.sh data/format/meta.hlm src/shared/format/meta.ts
./src/scripts/generateMetaDeclarations.sh data/format/library.hlm src/shared/format/library.ts
./src/scripts/generateMetaDeclarations.sh data/display/display.hlm src/shared/display/meta.ts
./src/scripts/generateMetaDeclarations.sh data/logics/hlm.hlm src/shared/logics/hlm/meta.ts data/display/display.hlm src/shared/display/meta.ts
