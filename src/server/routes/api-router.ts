import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';
import { Router } from 'express';
import * as nodemailer from 'nodemailer';
import * as config from '../config';
import { exec } from 'child_process';

export function apiRouter() {
  const router = Router();
  const rootPath = path.join(__dirname, '..', '..', '..');
  const dataPath = path.join(rootPath, 'data');
  const docPath = path.join(rootPath, 'docs');
  const fontPath = path.join(rootPath, 'node_modules', 'mathjax', 'fonts');

  router.use(express.static(dataPath));

  router.use('/docs', express.static(docPath));
  router.use('/fonts', express.static(fontPath));

  let mailTransporter = config.MAIL_TRANSPORT_CONFIG ? nodemailer.createTransport(config.MAIL_TRANSPORT_CONFIG) : undefined;

  router.put('/libraries/*', (request, response) => {
    let requestPath = decodeURI(request.url);
    if (config.IS_PRODUCTION) {
      if (mailTransporter && config.MAIL_FROM && config.MAIL_TO) {
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
        mailTransporter.sendMail(mail, (error: any) => {
          if (error) {
            console.log(error);
            response.sendStatus(503);
          } else {
            response.sendStatus(202);
          }
        });
      } else {
        response.sendStatus(501);
      }
    } else {
      let fileName = path.join(dataPath, requestPath);
      request.pipe(fs.createWriteStream(fileName));
      request.on('end', () => response.sendStatus(200));
    }
  });

  if (!config.IS_PRODUCTION) {
    router.report('/libraries/*', (request, response) => {
      let requestPath = decodeURI(request.url);
      let fileName = path.join(dataPath, requestPath);
      /* Use exec instead of spawn to make this work on Windows. */
      exec(`code "${fileName}"`);
      response.sendStatus(200);
    });
  }

  return router;
}
