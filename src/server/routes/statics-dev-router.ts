import * as proxy from 'http-proxy-middleware';
import * as express from 'express';

export function staticsDevRouter(): express.Router {
  let router = express.Router();

  // All the assets are hosted by Webpack on localhost:8080 (Webpack-dev-server)
  router.use('/public', proxy(
    {
      target: 'http://localhost:8080/',
      ws: true
    }));

  // Any route without a dot should render the web app html (hosted by by Webpack-dev-server)
  router.get('*.*', (request, response) => response.sendStatus(404));
  router.use('**', proxy(
    {
      target: 'http://localhost:8080/',
      pathRewrite: path => '/public/index.html',
    }));

  return router;
}
