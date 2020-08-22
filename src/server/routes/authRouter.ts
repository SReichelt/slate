import * as express from 'express';
import { handleAuthInfo, handleAuth } from '../handlers/authHandler';

export function authRouter() {
  let router = express.Router();
  router.get('/github-auth/info', handleAuthInfo);
  router.get('/github-auth/auth', handleAuth);
  return router;
}
