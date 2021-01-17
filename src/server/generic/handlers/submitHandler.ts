import { Request, Response } from './types';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import * as SMTPTransport from 'nodemailer/lib/smtp-transport';

const MAIL_TRANSPORT_CONFIG: SMTPTransport.Options | undefined = process.env.MAIL_HOST ? {
  host: process.env.MAIL_HOST,
  port: 465,
  secure: true,
  auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD
  }
} : undefined;
const MAIL_FROM = process.env.MAIL_FROM;
const MAIL_TO = process.env.MAIL_TO;

const mailTransporter = MAIL_TRANSPORT_CONFIG ? nodemailer.createTransport(MAIL_TRANSPORT_CONFIG) : undefined;

export function handleSubmit(req: Request, res: Response): void {
  if (mailTransporter && MAIL_FROM && MAIL_TO) {
    let requestPath = decodeURI(req.url);
    let mail: nodemailer.SendMailOptions = {
      from: MAIL_FROM,
      to: MAIL_TO,
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
