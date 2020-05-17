#!/bin/sh
set -e
src/scripts/generateMetaDeclarations.sh data/format/meta.slate src/shared/format/meta.ts
src/scripts/generateMetaDeclarations.sh data/notation/notation.slate src/shared/notation/meta.ts
src/scripts/generateMetaDeclarations.sh data/logics/library.slate src/shared/logics/library.ts
src/scripts/generateMetaDeclarations.sh data/logics/hlm.slate src/shared/logics/hlm/meta.ts data/notation/notation.slate src/shared/notation/meta.ts
