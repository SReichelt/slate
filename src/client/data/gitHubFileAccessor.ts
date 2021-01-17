import * as GitHub from './gitHubAPIHandler';
import { fetchHelper } from '../utils/fetchHelper';

import { FileAccessor, WriteFileResult, FileReference } from 'slate-shared/data/fileAccessor';
import { StandardFileAccessor, StandardFileReference } from 'slate-shared/data/fileAccessorImpl';
import CachedPromise from 'slate-shared/data/cachedPromise';

export interface GitHubRepositoryAccess {
  apiAccess?: GitHub.APIAccess;
  repository: GitHub.Repository;
}

export class GitHubFileAccessor extends StandardFileAccessor implements FileAccessor {
  constructor(private repositoryAccess: CachedPromise<GitHubRepositoryAccess>, private fallbackFileAccessor?: FileAccessor, baseURI: string = '') {
    super(baseURI);
  }

  openFile(uri: string, createNew: boolean): FileReference {
    let fallbackFileReference = this.fallbackFileAccessor?.openFile(uri, createNew);
    return new GitHubFileReference(this.repositoryAccess, this.baseURI + uri, createNew, fallbackFileReference);
  }

  preloadFile(uri: string): CachedPromise<FileReference> {
    return this.repositoryAccess.then((repositoryAccess: GitHubRepositoryAccess) => {
      if (this.fallbackFileAccessor?.preloadFile && !repositoryAccess.repository.hasLocalChanges) {
        return this.fallbackFileAccessor.preloadFile(uri);
      } else {
        return CachedPromise.reject();
      }
    });
  }

  createChildAccessor(uri: string): FileAccessor {
    let childFallbackFileAccessor = this.fallbackFileAccessor?.createChildAccessor(uri);
    return new GitHubFileAccessor(this.repositoryAccess, childFallbackFileAccessor, this.baseURI + uri);
  }
}

export class GitHubFileReference extends StandardFileReference {
  constructor(private repositoryAccess: CachedPromise<GitHubRepositoryAccess>, uri: string, private createNew: boolean, private fallbackFileReference: FileReference | undefined) {
    super(uri);
  }

  read(): CachedPromise<string> {
    return this.repositoryAccess.then((repositoryAccess: GitHubRepositoryAccess) => {
      let gitHubUri = GitHub.getDownloadURL(repositoryAccess.repository, this.uri);
      let result = fetchHelper.fetchText(gitHubUri);
      return new CachedPromise(result);
    });
  }

  write(contents: string, isPartOfGroup: boolean): CachedPromise<WriteFileResult> {
    return this.repositoryAccess.then((repositoryAccess: GitHubRepositoryAccess) => {
      if (repositoryAccess.apiAccess) {
        let result = repositoryAccess.apiAccess.writeFile(repositoryAccess.repository, this.uri, contents, this.createNew, isPartOfGroup)
          .then((pullRequestState) => {
            let writeFileResult = new GitHubWriteFileResult;
            writeFileResult.pullRequestState = pullRequestState;
            return writeFileResult;
          });
        return new CachedPromise(result);
      } else if (this.fallbackFileReference?.write) {
        return this.fallbackFileReference.write(contents, isPartOfGroup);
      } else {
        return CachedPromise.reject();
      }
    });
  }

  view(openLocally: boolean): CachedPromise<void> {
    if (openLocally) {
      return CachedPromise.reject();
    } else {
      return this.repositoryAccess.then((repositoryAccess: GitHubRepositoryAccess) => {
        let infoURL = GitHub.getInfoURL(repositoryAccess.repository, this.uri);
        window.open(infoURL, '_blank');
      });
    }
  }
}

export class GitHubWriteFileResult implements WriteFileResult {
  pullRequestState?: GitHub.PullRequestState;
}
