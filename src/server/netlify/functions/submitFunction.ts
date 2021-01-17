import { wrapHandler } from './wrapHandler';
import { handleSubmit } from 'slate-server-generic/handlers/submitHandler';

export const handler = wrapHandler(handleSubmit, 'PUT');
