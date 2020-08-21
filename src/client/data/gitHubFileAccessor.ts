import { fetchText } from '../../shared/utils/fetch';
import { FileAccessor, WriteFileResult, FileReference } from '../../shared/data/fileAccessor';
import { WebFileReference } from '../../shared/data/webFileAccessor';
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

export class GitHubFileAccessor implements FileAccessor {
  constructor(private config: CachedPromise<GitHubConfig>) {}

  openFile(uri: string, createNew: boolean): FileReference {
    return new GitHubFileReference(this.config, uri, createNew);
  }
}

export class GitHubFileReference extends WebFileReference {
  constructor(private config: CachedPromise<GitHubConfig>, uri: string, private createNew: boolean) {
    super(uri);
  }

  read(): CachedPromise<string> {
    return this.config.then((config: GitHubConfig) => {
      for (let target of config.targets) {
        if (this.uri.startsWith(target.uriPrefix)) {
          if (this.uri.endsWith('.preload')) {
            if (target.repository.hasLocalChanges) {
              return CachedPromise.reject();
            }
            break;
          }
          let path = this.uri.substring(target.uriPrefix.length);
          let gitHubUri = GitHub.getDownloadURL(target.repository, path);
          let result = fetchText(gitHubUri);
          return new CachedPromise(result);
        }
      }

      return super.read();
    });
  }

  write(contents: string, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
    return this.config.then((config: GitHubConfig) => {
      if (config.apiAccess) {
        for (let target of config.targets) {
          if (this.uri.startsWith(target.uriPrefix)) {
            let path = this.uri.substring(target.uriPrefix.length);
            let result = config.apiAccess.writeFile(target.repository, path, contents, this.createNew, isPartOfGroup)
              .then((pullRequestState) => {
                let writeFileResult = new GitHubWriteFileResult;
                writeFileResult.pullRequestState = pullRequestState;
                return writeFileResult;
              });
            return new CachedPromise(result);
          }
        }
      }

      return super.write(contents, isPartOfGroup);
    });
  }

  view(openLocally: boolean): CachedPromise<void> {
    return this.config.then((config: GitHubConfig) => {
      if (!openLocally) {
        for (let target of config.targets) {
          if (this.uri.startsWith(target.uriPrefix)) {
            let path = this.uri.substring(target.uriPrefix.length);
            let infoURL = GitHub.getInfoURL(target.repository, path);
            window.open(infoURL, '_blank');
            return;
          }
        }
      }

      return super.view(openLocally);
    });
  }
}

export class GitHubWriteFileResult implements WriteFileResult {
  pullRequestState?: GitHub.PullRequestState;
}
