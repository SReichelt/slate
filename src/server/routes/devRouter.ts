import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { exec } from 'child_process';

function makeDirectories(fileName: string): void {
  let dirName = path.dirname(fileName);
  if (dirName && !fs.existsSync(dirName)) {
    makeDirectories(dirName);
    fs.mkdirSync(dirName);
  }
}

function saveLocally(request: express.Request, response: express.Response, localPath: string): void {
  let requestPath = decodeURI(request.url);
  let fileName = path.join(localPath, requestPath);
  try {
    makeDirectories(fileName);
    let stream = fs.createWriteStream(fileName);
    stream.on('error', (error: any) => {
      console.error(error);
      response.sendStatus(400);
    });
    stream.on('close', () => response.sendStatus(200));
    request.pipe(stream);
  } catch (error) {
    console.error(error);
    response.sendStatus(400);
  }
}

function openInVSCode(request: express.Request, response: express.Response, localPath: string): void {
  let requestPath = decodeURI(request.url);
  let fileName = path.join(localPath, requestPath);
  // Use exec instead of spawn to make this work on Windows.
  exec(`code "${fileName}"`);
  response.sendStatus(200);
}

export function devRouter(rootPath: string): express.Router {
  let router = express.Router();

  let dataPath = path.join(rootPath, 'data');

  router.use('/data', express.static(dataPath));
  router.use('/docs', express.static(path.join(rootPath, 'docs')));
  router.use('/fonts/MathJax', express.static(path.join(rootPath, 'node_modules', 'mathjax', 'fonts', 'HTML-CSS', 'TeX', 'woff')));

  router.put('/data/libraries/*', (request, response) => saveLocally(request, response, rootPath));

  router.report('/docs/*', (request, response) => openInVSCode(request, response, rootPath));
  router.report('/data/libraries/*', (request, response) => openInVSCode(request, response, rootPath));

  // All the assets are hosted by Webpack on localhost:8080 (Webpack-dev-server)
  router.use('*.*', createProxyMiddleware({
    target: 'http://localhost:8080/',
    ws: true
  }));

  // Any route without a dot should render the web app html (hosted by by Webpack-dev-server)
  router.use('**', createProxyMiddleware({
    target: 'http://localhost:8080/',
    pathRewrite: _ => '/index.html'
  }));

  return router;
}
