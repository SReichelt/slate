import { WebFileAccessor } from './webFileAccessor';
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

  writeFile(uri: string, text: string, createNew: boolean): CachedPromise<WriteFileResult> {
    return this.config.then((config) => {
      if (config.apiAccess) {
        for (let target of config.targets) {
          if (uri.startsWith(target.uriPrefix)) {
            let path = uri.substring(target.uriPrefix.length);
            let result = config.apiAccess.writeFile(target.repository, path, text, createNew)
              .then((pullRequestState) => {
                let writeFileResult = new GitHubWriteFileResult;
                writeFileResult.pullRequestState = pullRequestState;
                return writeFileResult;
              });
            return new CachedPromise(result);
          }
        }
      }

      return super.writeFile(uri, text, createNew);
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
  pullRequestState?: GitHub.PullRequestState;
}
