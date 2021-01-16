import { wrapHandler } from './wrapHandler';
import { handleAuth } from '../../generic/handlers/authHandler';

export const handler = wrapHandler(handleAuth, 'GET');
