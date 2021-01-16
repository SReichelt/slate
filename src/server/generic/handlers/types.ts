// These types are stripped-down versions of Express types, which we use
// directly for Express but implement ourselves for AWS Lambda.

import { Readable } from 'stream';

export interface Request extends Readable {
  url: string;
  query: Query;
}

export interface Query {
  [param: string]: string | undefined;
}

export interface Response {
  sendStatus(statusCode: number): void;
  json(obj: any): void;
}

export type Handler = (req: Request, res: Response) => void;
