import { wrapHandler } from './wrapHandler';
import { handleAuthInfo } from '../../generic/handlers/authHandler';

export const handler = wrapHandler(handleAuthInfo, 'GET');
