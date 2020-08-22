import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult, Context, Callback } from 'aws-lambda';
import { Readable } from 'stream';
import { Handler, Request, Response } from '../handlers/types';

class AWSResponse implements Response {
  constructor(private callback: Callback<APIGatewayProxyResult>) {}

  sendStatus(statusCode: number): void {
    this.callback(undefined, {
      statusCode: statusCode,
      body: ''
    });
  }

  json(obj: any): void {
    this.callback(undefined, {
      statusCode: 200,
      body: JSON.stringify(obj)
    });
  }
}

export function wrapHandler(handler: Handler, expectedMethod: string): APIGatewayProxyHandler {
  return (event: APIGatewayProxyEvent, context: Context, callback: Callback<APIGatewayProxyResult>) => {
    if (event.httpMethod === expectedMethod) {
      let req: Request = Object.assign(Readable.from(event.body ?? ''), {
        url: event.path,
        query: event.queryStringParameters ?? {}
      });
      let res = new AWSResponse(callback);
      handler(req, res);
    } else {
      callback(`Expected method ${expectedMethod} instead of ${event.httpMethod}`);
    }
  };
}
