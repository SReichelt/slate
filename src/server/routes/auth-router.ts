import * as express from 'express';
import * as request from 'request';
import * as config from '../config';

export function authRouter() {
  let router = express.Router();

  router.get('/github-auth/client-id', (req, res) => {
    if (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET) {
      res.send({
        'client_id': config.GITHUB_CLIENT_ID
      });
    } else {
      res.sendStatus(501);
    }
  });

  router.get('/github-auth/auth', (req, res) => {
    if (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET) {
      let code = req.query['code'];
      let options: request.CoreOptions = {
        headers: {
          'Accept': 'application/json'
        }
      };
      request.post(`https://github.com/login/oauth/access_token?client_id=${config.GITHUB_CLIENT_ID}&client_secret=${config.GITHUB_CLIENT_SECRET}&code=${code}`, options)
        .on('error', (error) => console.log(error))
        .pipe(res);
    } else {
      res.sendStatus(501);
    }
  });

  return router;
}
