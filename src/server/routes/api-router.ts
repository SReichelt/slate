import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';
import { Router } from 'express';
import * as config from '../config';

export function apiRouter() {
  const router = Router();
  const rootPath = path.join(__dirname, '..', '..', '..');
  const dataPath = path.join(rootPath, 'data');
  const fontPath = path.join(rootPath, 'node_modules', 'mathjax', 'fonts');

  router.use(express.static(dataPath));

  router.use('/fonts', express.static(fontPath));

  router.put('/libraries/*', (request, response) => {
    if (config.IS_PRODUCTION) {
      // TODO
      response.sendStatus(501);
    } else {
      let fileName = path.join(dataPath, decodeURI(request.url));
      request.pipe(fs.createWriteStream(fileName));
      request.on('end', () => response.sendStatus(200));
    }
  });

  return router;
}
