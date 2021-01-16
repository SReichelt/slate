import * as express from 'express';
import { handleAuthInfo, handleAuth } from '../../generic/handlers/authHandler';

export function authRouter(): express.Router {
  let router = express.Router();
  router.get('/github-auth/info', handleAuthInfo);
  router.get('/github-auth/auth', handleAuth);
  return router;
}
