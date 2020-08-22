import { Request, Response } from './types';
import { fetchJSON } from '../../shared/utils/fetch';
import { AuthInfo } from '../../shared/api/auth'
import * as config from '../config';

export function handleAuthInfo(req: Request, res: Response): void {
  if (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET) {
    let info: AuthInfo = {
      clientID: config.GITHUB_CLIENT_ID,
      redirectURL: config.GITHUB_REDIRECT_URL
    };
    res.json(info);
  } else {
    res.sendStatus(501);
  }
}

export function handleAuth(req: Request, res: Response): void {
  if (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET) {
    let code = req.query['code'];
    fetchJSON(`https://github.com/login/oauth/access_token?client_id=${config.GITHUB_CLIENT_ID}&client_secret=${config.GITHUB_CLIENT_SECRET}&code=${code}`)
      .then((result: any) => res.json(result))
      .catch((error) => {
        console.log(error);
        res.sendStatus(503);
      });
  } else {
    res.sendStatus(501);
  }
}
