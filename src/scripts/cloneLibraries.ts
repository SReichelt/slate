import { spawnSync } from 'child_process';

const Libraries = require('../../data/libraries/libraries.json');

for (let libraryName of Object.keys(Libraries)) {
  let library = Libraries[libraryName];
  spawnSync('git', ['clone', '-b', library.branch, `https://github.com/${library.repository}.git`, `./data/libraries/${libraryName}`]);
}
