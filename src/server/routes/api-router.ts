import * as path from 'path';
import * as express from 'express';
import * as proxy from 'http-proxy-middleware';
import { Router } from 'express';

export function apiRouter() {
  const router = Router();
  const rootPath = path.join(__dirname, '..', '..', '..');
  const dataPath = path.join(rootPath, 'data');
  const fontPath = path.join(rootPath, 'node_modules', 'mathjax', 'fonts');

  router.use(express.static(dataPath));
  router.use('/fonts', express.static(fontPath));

  return router;
}
