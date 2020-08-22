import { wrapHandler } from './wrapHandler';
import { handleAuth } from '../handlers/authHandler';

export const handler = wrapHandler(handleAuth, 'GET');
