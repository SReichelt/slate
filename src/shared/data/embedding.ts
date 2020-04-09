export type RequestCommand = 'GET' | 'CREATE' | 'PUT' | 'EDIT' | 'REVERT' | 'SELECT' | 'TITLE';

export interface RequestMessage {
  command: RequestCommand;
  index?: number;
  uri?: string;
  text?: string;
}

export type ResponseCommand = 'RESPONSE' | 'ERROR' | 'UPDATE' | 'SELECT';

export interface ResponseMessage {
  command: ResponseCommand;
  index?: number;
  uri?: string;
  text?: string;
}
