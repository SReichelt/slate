import { Request, Response } from './types';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import * as config from '../config';

const mailTransporter = config.MAIL_TRANSPORT_CONFIG ? nodemailer.createTransport(config.MAIL_TRANSPORT_CONFIG) : undefined;

export function handleSubmit(req: Request, res: Response): void {
  if (mailTransporter && config.MAIL_FROM && config.MAIL_TO) {
    let requestPath = decodeURI(req.url);
    let mail: nodemailer.SendMailOptions = {
      from: config.MAIL_FROM,
      to: config.MAIL_TO,
      subject: 'Slate submission: ' + requestPath,
      text: requestPath,
      attachments: [{
        filename: path.basename(requestPath),
        contentType: 'text/plain',
        contentTransferEncoding: 'quoted-printable',
        content: req
      }]
    };
    mailTransporter.sendMail(mail, (error) => {
      if (error) {
        console.error(error);
        res.sendStatus(503);
      } else {
        res.sendStatus(202);
      }
    });
  } else {
    res.sendStatus(501);
  }
}
