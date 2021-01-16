import { Request, Response } from './types';
import { fetchJSON } from '../../../envs/web/utils/fetch';
import { AuthInfo } from '../../../envs/web/api/auth';
import * as config from '../../config';

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
    let codeArg = req.query['code'];
    if (codeArg) {
      let code = encodeURI(codeArg);
      fetchJSON(`https://github.com/login/oauth/access_token?client_id=${config.GITHUB_CLIENT_ID}&client_secret=${config.GITHUB_CLIENT_SECRET}&code=${code}`)
        .then((result: any) => res.json(result))
        .catch((error) => {
          console.log(error);
          res.sendStatus(503);
        });
    } else {
      res.sendStatus(400);
    }
  } else {
    res.sendStatus(501);
  }
}
