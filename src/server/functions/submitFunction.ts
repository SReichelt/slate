import { wrapHandler } from './wrapHandler';
import { handleSubmit } from '../handlers/submitHandler';

export const handler = wrapHandler(handleSubmit, 'PUT');
