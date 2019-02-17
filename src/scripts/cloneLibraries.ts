import { spawnSync } from 'child_process';

const Libraries = require('../../data/libraries/libraries.json');

for (let libraryName of Object.keys(Libraries)) {
  spawnSync('git', ['submodule', 'update', `./data/libraries/${libraryName}`]);
}
