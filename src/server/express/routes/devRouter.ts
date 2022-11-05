import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

function makeDirectories(fileName: string): void {
  const dirName = path.dirname(fileName);
  if (dirName && !fs.existsSync(dirName)) {
    makeDirectories(dirName);
    fs.mkdirSync(dirName);
  }
}

function saveLocally(request: express.Request, response: express.Response, localPath: string): void {
  const requestPath = decodeURI(request.url);
  const fileName = path.join(localPath, requestPath);
  try {
    makeDirectories(fileName);
    const stream = fs.createWriteStream(fileName);
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
  const requestPath = decodeURI(request.url);
  const fileName = path.join(localPath, requestPath);
  // Use exec instead of spawn to make this work on Windows.
  exec(`code "${fileName}"`);
  response.sendStatus(200);
}

export function devRouter(rootPath: string): express.Router {
  const router = express.Router();

  const dataPath = path.join(rootPath, 'data');

  router.use('/data', express.static(dataPath));
  router.use('/docs', express.static(path.join(rootPath, 'docs')));

  router.put('/data/libraries/*', (request, response) => saveLocally(request, response, rootPath));

  router.report('/docs/*', (request, response) => openInVSCode(request, response, rootPath));
  router.report('/data/libraries/*', (request, response) => openInVSCode(request, response, rootPath));

  return router;
}
