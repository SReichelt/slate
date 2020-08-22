import { wrapHandler } from './wrapHandler';
import { handleGetClientID } from '../handlers/authHandler';

export const handler = wrapHandler(handleGetClientID, 'GET');
