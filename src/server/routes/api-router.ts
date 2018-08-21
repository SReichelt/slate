import * as path from 'path';
import * as express from 'express';
import * as proxy from 'http-proxy-middleware';
import { Router } from 'express';

export function apiRouter() {
  const router = Router();
  const dataPath = path.join(__dirname, '..', '..', '..', 'data');

  router.use(express.static(dataPath));

  router.use('/fonts', proxy(
    {
      target: 'http://cdn.mathjax.org/mathjax/latest',
      changeOrigin: true
    }));

  return router;
}
