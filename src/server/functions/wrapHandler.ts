import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult, Context, Callback } from 'aws-lambda';
import { Readable } from 'stream';
import { Handler, Request, Response, Query } from '../handlers/types';

class AWSRequest extends Readable implements Request {
  constructor(public url: string, public query: Query, body?: string | null) {
    super();
    if (body) {
      this.push(body);
    }
    this.push(null);
  }
}

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
      let req = new AWSRequest(event.path, event.queryStringParameters ?? {}, event.body);
      let res = new AWSResponse(callback);
      handler(req, res);
    } else {
      callback(`Expected method ${expectedMethod} instead of ${event.httpMethod}`);
    }
  };
}
