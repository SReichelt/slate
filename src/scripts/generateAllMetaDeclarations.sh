#!/bin/sh
set -e
src/scripts/generateMetaDeclarations.sh data/format/meta.slate src/shared/format/meta.ts
src/scripts/generateMetaDeclarations.sh data/display/display.slate src/shared/display/meta.ts
src/scripts/generateMetaDeclarations.sh data/logics/library.slate src/shared/logics/library.ts
src/scripts/generateMetaDeclarations.sh data/logics/hlm.slate src/shared/logics/hlm/meta.ts data/display/display.slate src/shared/display/meta.ts
