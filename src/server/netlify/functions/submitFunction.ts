import { wrapHandler } from './wrapHandler';
import { handleSubmit } from '../../generic/handlers/submitHandler';

export const handler = wrapHandler(handleSubmit, 'PUT');
