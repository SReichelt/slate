import { WebFileAccessor, WebWriteFileResult } from './webFileAccessor';
import { FileContents, WriteFileResult } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';
import * as GitHub from './gitHubAPIHandler';

export interface GitHubTarget {
  uriPrefix: string;
  repository: GitHub.Repository;
}

export interface GitHubConfig {
  targets: GitHubTarget[];
  apiAccess?: GitHub.APIAccess;
}

export class GitHubFileAccessor extends WebFileAccessor {
  constructor(private config: CachedPromise<GitHubConfig>) {
    super();
  }

  readFile(uri: string): CachedPromise<FileContents> {
    return this.config.then((config) => {
      for (let target of config.targets) {
        if (uri.startsWith(target.uriPrefix)) {
          let path = uri.substring(target.uriPrefix.length);
          uri = GitHub.getDownloadURL(target.repository, path);
          break;
        }
      }

      return super.readFile(uri);
    });
  }

  writeFile(uri: string, text: string): CachedPromise<WriteFileResult> {
    return this.config.then((config) => {
      if (config.apiAccess) {
        for (let target of config.targets) {
          if (uri.startsWith(target.uriPrefix)) {
            let path = uri.substring(target.uriPrefix.length);
            let result = config.apiAccess.updateFile(target.repository, path, text)
              .then((createdPullRequestURL) => {
                let writeFileResult = new GitHubWriteFileResult;
                writeFileResult.createdPullRequestURL = createdPullRequestURL;
                return writeFileResult;
              });
            return new CachedPromise(result);
          }
        }
      }

      return super.writeFile(uri, text);
    });
  }

  openFile(uri: string, openLocally: boolean): CachedPromise<void> {
    return this.config.then((config) => {
      if (!openLocally) {
        for (let target of config.targets) {
          if (uri.startsWith(target.uriPrefix)) {
            let path = uri.substring(target.uriPrefix.length);
            let infoURL = GitHub.getInfoURL(target.repository, path);
            window.open(infoURL, '_blank');
            return;
          }
        }
      }

      return super.openFile(uri, openLocally);
    });
  }
}

export class GitHubWriteFileResult implements WriteFileResult {
  createdPullRequestURL?: string;
}
