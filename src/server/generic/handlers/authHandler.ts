import fetch from 'node-fetch';
import { Request, Response } from './types';
import FetchHelper from 'slate-env-web/utils/fetchHelper';
import { AuthInfo } from 'slate-env-web-api/auth';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URL = process.env.GITHUB_REDIRECT_URL;

export function handleAuthInfo(req: Request, res: Response): void {
  if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
    let info: AuthInfo = {
      clientID: GITHUB_CLIENT_ID,
      redirectURL: GITHUB_REDIRECT_URL
    };
    res.json(info);
  } else {
    res.sendStatus(501);
  }
}

export function handleAuth(req: Request, res: Response): void {
  if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
    let codeArg = req.query['code'];
    if (codeArg) {
      let fetchHelper = new FetchHelper(fetch);
      let code = encodeURI(codeArg);
      fetchHelper.fetchJSON(`https://github.com/login/oauth/access_token?client_id=${GITHUB_CLIENT_ID}&client_secret=${GITHUB_CLIENT_SECRET}&code=${code}`)
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
