import * as express from 'express';
import { handleSubmit } from 'slate-server-generic/handlers/submitHandler';

export function prodRouter(): express.Router {
  const router = express.Router();

  router.put('/data/libraries/*', handleSubmit);

  return router;
}
