import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';
import * as nodemailer from 'nodemailer';
import * as config from '../config';
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

function submitByMail(request: express.Request, response: express.Response, mailTransporter: nodemailer.Transporter | undefined): void {
  if (mailTransporter && config.MAIL_FROM && config.MAIL_TO) {
    let requestPath = decodeURI(request.url);
    let mail: any = {
      from: config.MAIL_FROM,
      to: config.MAIL_TO,
      subject: 'Slate submission: ' + requestPath,
      text: requestPath,
      attachments: [{
        filename: path.basename(requestPath),
        contentType: 'text/plain',
        contentTransferEncoding: 'quoted-printable',
        content: request
      }]
    };
    mailTransporter.sendMail(mail, (error) => {
      if (error) {
        console.error(error);
        response.sendStatus(503);
      } else {
        response.sendStatus(202);
      }
    });
  } else {
    response.sendStatus(501);
  }
}

function openInVSCode(request: express.Request, response: express.Response, localPath: string): void {
  let requestPath = decodeURI(request.url);
  let fileName = path.join(localPath, requestPath);
  // Use exec instead of spawn to make this work on Windows.
  exec(`code "${fileName}"`);
  response.sendStatus(200);
}

export function apiRouter(rootPath: string): express.Router {
  let router = express.Router();
  let dataPath = path.join(rootPath, 'data');
  let docPath = path.join(rootPath, 'docs');
  let fontPath = path.join(rootPath, 'node_modules', 'mathjax', 'fonts');

  router.use(express.static(dataPath));

  router.use('/docs', express.static(docPath));
  router.use('/fonts', express.static(fontPath));

  let mailTransporter = config.MAIL_TRANSPORT_CONFIG ? nodemailer.createTransport(config.MAIL_TRANSPORT_CONFIG) : undefined;

  router.put('/libraries/*', (request, response) => {
    console.log(`Received PUT request for: ${request.url}`);
    if (config.IS_PRODUCTION) {
      submitByMail(request, response, mailTransporter);
    } else {
      saveLocally(request, response, dataPath);
    }
  });

  if (!config.IS_PRODUCTION) {
    router.report('/docs/*', (request, response) => openInVSCode(request, response, rootPath));
    router.report('/libraries/*', (request, response) => openInVSCode(request, response, dataPath));
  }

  return router;
}
