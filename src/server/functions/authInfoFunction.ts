import { wrapHandler } from './wrapHandler';
import { handleAuthInfo } from '../handlers/authHandler';

export const handler = wrapHandler(handleAuthInfo, 'GET');
