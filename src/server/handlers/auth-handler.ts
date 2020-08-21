import * as express from 'express';
import * as request from 'request';
import * as config from '../config';

export function handleGetClientID(req: express.Request, res: express.Response): void {
  if (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET) {
    res.json({
      'client_id': config.GITHUB_CLIENT_ID
    });
  } else {
    res.sendStatus(501);
  }
}

export function handleAuth(req: express.Request, res: express.Response): void {
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
}
