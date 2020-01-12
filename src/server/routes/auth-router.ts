import { Router } from 'express';
import * as request from 'request';
import * as config from '../config';

export function authRouter() {
  let router = Router();

  router.get('/github-auth/client-id', (req, res) => {
    if (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET) {
      res.send(config.GITHUB_CLIENT_ID);
    } else {
      res.sendStatus(501);
    }
  });

  router.get('/github-auth/auth', (req, res) => {
    if (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET) {
      let code = req.query['code'];
      request.post(`https://github.com/login/oauth/access_token?client_id=${config.GITHUB_CLIENT_ID}&client_secret=${config.GITHUB_CLIENT_SECRET}&code=${code}`)
        .on('error', (error) => console.log(error))
        .pipe(res);
    } else {
      res.sendStatus(501);
    }
  });

  return router;
}
