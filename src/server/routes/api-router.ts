import * as path from 'path';
import * as express from 'express';
import { Router } from 'express';

export function apiRouter() {
  const router = Router();
  const dataPath = path.join(__dirname, '..', '..', '..', 'data');

  router.use(express.static(dataPath));

  return router;
}
