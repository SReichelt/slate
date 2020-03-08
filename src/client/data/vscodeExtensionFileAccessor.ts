import config from '../utils/config';
import { FileAccessor, FileContents, WriteFileResult, FileWatcher } from '../../shared/data/fileAccessor';
import { StandardWatchableFileContents, StandardFileWatcher } from '../../shared/data/fileAccessorImpl';
import * as Embedding from '../../shared/data/embedding';
import CachedPromise from '../../shared/data/cachedPromise';

export class VSCodeExtensionFileAccessor implements FileAccessor {
  private static index = 0;
  private requests = new Map<number, (responseMessage: Embedding.ResponseMessage) => void>();
  private watchers: StandardFileWatcher[] = [];

  readFile(uri: string): CachedPromise<FileContents> {
    let index = VSCodeExtensionFileAccessor.index++;
    let requestMessage: Embedding.RequestMessage = {
      command: 'GET',
      index: index,
      uri: uri
    };
    config.vsCodeAPI!.postMessage(requestMessage);
    let promise = new Promise<VSCodeExtensionFileContents>((resolve, reject) => {
      this.requests.set(index, (responseMessage: Embedding.ResponseMessage) => {
        if (responseMessage.command === 'RESPONSE' && responseMessage.text) {
          resolve(new VSCodeExtensionFileContents(uri, responseMessage.text, this.watchers));
        } else {
          reject(new Error(responseMessage.text));
        }
      });
    });
    return new CachedPromise(promise);
  }

  writeFile(uri: string, text: string, createNew: boolean, isPartOfGroup: boolean, prePublish: boolean = false): CachedPromise<WriteFileResult> {
    let index = VSCodeExtensionFileAccessor.index++;
    let requestMessage: Embedding.RequestMessage = {
      command: createNew ? 'CREATE' : prePublish ? 'EDIT' : 'PUT',
      index: index,
      uri: uri,
      text: text
    };
    config.vsCodeAPI!.postMessage(requestMessage);
    let promise = new Promise<WriteFileResult>((resolve, reject) => {
      this.requests.set(index, (responseMessage: Embedding.ResponseMessage) => {
        if (responseMessage.command === 'RESPONSE') {
          resolve({});
        } else {
          reject(new Error(responseMessage.text));
        }
      });
    });
    return new CachedPromise(promise);
  }

  prePublishFile(uri: string, text: string, createNew: boolean, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
    return this.writeFile(uri, text, createNew, isPartOfGroup, true);
  }

  unPrePublishFile(uri: string): CachedPromise<void> {
    let index = VSCodeExtensionFileAccessor.index++;
    let requestMessage: Embedding.RequestMessage = {
      command: 'REVERT',
      index: index,
      uri: uri
    };
    config.vsCodeAPI!.postMessage(requestMessage);
    let promise = new Promise<void>((resolve, reject) => {
      this.requests.set(index, (responseMessage: Embedding.ResponseMessage) => {
        if (responseMessage.command === 'RESPONSE') {
          resolve();
        } else {
          reject(new Error(responseMessage.text));
        }
      });
    });
    return new CachedPromise(promise);
  }

  openFile(uri: string, openLocally: boolean): CachedPromise<void> {
    let index = VSCodeExtensionFileAccessor.index++;
    let requestMessage: Embedding.RequestMessage = {
      command: 'SELECT',
      index: index,
      uri: uri
    };
    config.vsCodeAPI!.postMessage(requestMessage);
    let promise = new Promise<void>((resolve, reject) => {
      this.requests.set(index, (responseMessage: Embedding.ResponseMessage) => {
        if (responseMessage.command === 'RESPONSE') {
          resolve();
        } else {
          reject(new Error(responseMessage.text));
        }
      });
    });
    return new CachedPromise(promise);
  }

  messageReceived(message: Embedding.ResponseMessage): void {
    if (message.index !== undefined) {
      let request = this.requests.get(message.index);
      if (request) {
        request(message);
      }
    }
    if (message.command === 'UPDATE' && message.text) {
      for (let watcher of this.watchers) {
        if ((watcher.contents as VSCodeExtensionFileContents).uri === message.uri) {
          watcher.contents.text = message.text;
          watcher.changed();
        }
      }
    }
  }
}

class VSCodeExtensionFileContents extends StandardWatchableFileContents {
  constructor(public uri: string, text: string, watchers: StandardFileWatcher[]) {
    super(text, watchers);
  }
}
