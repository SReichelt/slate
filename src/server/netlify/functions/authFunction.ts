import { wrapHandler } from './wrapHandler';
import { handleAuth } from 'slate-server-generic/handlers/authHandler';

export const handler = wrapHandler(handleAuth, 'GET');
