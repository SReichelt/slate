import { wrapHandler } from './wrapHandler';
import { handleAuthInfo } from 'slate-server-generic/handlers/authHandler';

export const handler = wrapHandler(handleAuthInfo, 'GET');
