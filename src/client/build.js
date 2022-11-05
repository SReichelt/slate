//@ts-check

'use strict';

const esbuild = require('esbuild');
const { livereloadPlugin } = require('@jgoz/esbuild-plugin-livereload');
const { typecheckPlugin } = require('@jgoz/esbuild-plugin-typecheck');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');

const dist = path.join('..', '..', 'dist');
const target = path.join(dist, 'public');

if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist);
}
fs.cpSync('public', target, {
  recursive: true,
  force: true
});

ejs.renderFile('index.ejs', {
  'isStatic': false,
  'isEmbedded': false,
  'title': 'Slate'
}, { rmWhitespace: true }).then((content) => fs.promises.writeFile(path.join(target, 'index.html'), content));
fs.promises.copyFile('index.ejs', path.join(target, 'index.ejs'));

const watch = process.argv.includes('--watch');

esbuild.build({
  entryPoints: ['client.tsx'],
  bundle: true,
  outfile: path.join(target, 'js', 'main.js'),
  platform: 'browser',
  loader: {
    '.ttf': 'file',
    '.woff2': 'file'
  },
  sourcemap: process.env.NODE_ENV === 'development',
  minify: process.env.NODE_ENV === 'production',
  watch: watch ? {
    onRebuild: (error) => {
      if (error) {
        console.error('[watch] build failed:', error);
      } else {
        console.log('[watch] build finished');
      }
    }
  } : undefined,
  plugins: watch ? [livereloadPlugin(), typecheckPlugin()] : [typecheckPlugin()]
}).then(() => console.log(watch ? '[watch] build finished, watching for changes...' : 'build finished'));
