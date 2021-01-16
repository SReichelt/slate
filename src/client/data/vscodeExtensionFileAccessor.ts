import config from '../utils/config';

import { FileAccessor, FileReference, WriteFileResult, FileWatcher } from '../../shared/data/fileAccessor';
import { StandardFileReference, StandardFileWatcher } from '../../shared/data/fileAccessorImpl';
import * as Embedding from '../../envs/web/api/embedding';
import CachedPromise from '../../shared/data/cachedPromise';


export class VSCodeExtensionFileAccessor implements FileAccessor {
  static index = 0;
  static requests = new Map<number, (responseMessage: Embedding.ResponseMessage) => void>();
  static watchers: StandardFileWatcher[] = [];

  constructor(private baseURI: string = '') {
    if (this.baseURI && !this.baseURI.endsWith('/')) {
      this.baseURI += '/';
    }
  }

  openFile(uri: string, createNew: boolean): FileReference {
    return new VSCodeExtensionFileReference(this.baseURI + uri, createNew);
  }

  createChildAccessor(uri: string): FileAccessor {
    return new VSCodeExtensionFileAccessor(this.baseURI + uri);
  }

  messageReceived(message: Embedding.ResponseMessage): void {
    if (message.index !== undefined) {
      let request = VSCodeExtensionFileAccessor.requests.get(message.index);
      if (request) {
        request(message);
      }
    }
    if (message.command === 'UPDATE' && message.text) {
      for (let watcher of VSCodeExtensionFileAccessor.watchers) {
        if (watcher.uri === message.uri) {
          watcher.changed(message.text);
        }
      }
    }
  }
}

export class VSCodeExtensionFileReference extends StandardFileReference implements FileReference {
  constructor(uri: string, private createNew: boolean) {
    super(uri);
  }

  read(): CachedPromise<string> {
    let index = VSCodeExtensionFileAccessor.index++;
    let requestMessage: Embedding.RequestMessage = {
      command: 'GET',
      index: index,
      uri: this.uri
    };
    config.vsCodeAPI!.postMessage(requestMessage);
    let promise = new Promise<string>((resolve, reject) => {
      VSCodeExtensionFileAccessor.requests.set(index, (responseMessage: Embedding.ResponseMessage) => {
        if (responseMessage.command === 'RESPONSE' && responseMessage.text) {
          resolve(responseMessage.text);
        } else {
          reject(new Error(responseMessage.text));
        }
      });
    });
    return new CachedPromise(promise);
  }

  write(contents: string, isPartOfGroup: boolean, prePublish: boolean = false): CachedPromise<WriteFileResult> {
    let index = VSCodeExtensionFileAccessor.index++;
    let requestMessage: Embedding.RequestMessage = {
      command: this.createNew ? 'CREATE' : prePublish ? 'EDIT' : 'PUT',
      index: index,
      uri: this.uri,
      text: contents
    };
    config.vsCodeAPI!.postMessage(requestMessage);
    let promise = new Promise<WriteFileResult>((resolve, reject) => {
      VSCodeExtensionFileAccessor.requests.set(index, (responseMessage: Embedding.ResponseMessage) => {
        if (responseMessage.command === 'RESPONSE') {
          this.createNew = false;
          resolve({});
        } else {
          reject(new Error(responseMessage.text));
        }
      });
    });
    return new CachedPromise(promise);
  }

  prePublish(contents: string, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
    return this.write(contents, isPartOfGroup, true);
  }

  unPrePublish(): CachedPromise<void> {
    let index = VSCodeExtensionFileAccessor.index++;
    let requestMessage: Embedding.RequestMessage = {
      command: 'REVERT',
      index: index,
      uri: this.uri
    };
    config.vsCodeAPI!.postMessage(requestMessage);
    let promise = new Promise<void>((resolve, reject) => {
      VSCodeExtensionFileAccessor.requests.set(index, (responseMessage: Embedding.ResponseMessage) => {
        if (responseMessage.command === 'RESPONSE') {
          resolve();
        } else {
          reject(new Error(responseMessage.text));
        }
      });
    });
    return new CachedPromise(promise);
  }

  watch(onChange: (newContents: string) => void): FileWatcher {
    return new StandardFileWatcher(this.uri, VSCodeExtensionFileAccessor.watchers, onChange);
  }

  view(openLocally: boolean): CachedPromise<void> {
    let index = VSCodeExtensionFileAccessor.index++;
    let requestMessage: Embedding.RequestMessage = {
      command: 'SELECT',
      index: index,
      uri: this.uri
    };
    config.vsCodeAPI!.postMessage(requestMessage);
    let promise = new Promise<void>((resolve, reject) => {
      VSCodeExtensionFileAccessor.requests.set(index, (responseMessage: Embedding.ResponseMessage) => {
        if (responseMessage.command === 'RESPONSE') {
          resolve();
        } else {
          reject(new Error(responseMessage.text));
        }
      });
    });
    return new CachedPromise(promise);
  }
}
