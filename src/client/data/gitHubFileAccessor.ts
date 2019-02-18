import { WebFileAccessor } from './webFileAccessor';
import { FileContents } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';
import * as GitHub from './gitHubAPIHandler';

interface GitHubTarget {
  uriPrefix: string;
  repository: GitHub.Repository;
}

export class GitHubFileAccessor extends WebFileAccessor {
  private targets: GitHubTarget[] = [];
  private apiAccess?: GitHub.APIAccess;

  readFile(uri: string): CachedPromise<FileContents> {
    for (let target of this.targets) {
      if (uri.startsWith(target.uriPrefix)) {
        let path = uri.substring(target.uriPrefix.length);
        uri = GitHub.getDownloadURI(target.repository, path);
      }
    }

    return super.readFile(uri);
  }

  writeFile(uri: string, text: string): CachedPromise<boolean> {
    if (this.apiAccess) {
      for (let target of this.targets) {
        if (uri.startsWith(target.uriPrefix)) {
          let path = uri.substring(target.uriPrefix.length);
          let result = this.apiAccess.updateFile(target.repository, path, text)
            .then(() => !target.repository.isFork);
          return new CachedPromise(result);
        }
      }
    }

    return super.writeFile(uri, text);
  }

  setTarget(uriPrefix: string, repository: GitHub.Repository): void {
    for (let target of this.targets) {
      if (target.uriPrefix === uriPrefix) {
        target.repository = repository;
        return;
      }
    }

    this.targets.push({
      uriPrefix: uriPrefix,
      repository: repository
    });
  }

  setAPIAccess(apiAccess: GitHub.APIAccess | undefined): void {
    this.apiAccess = apiAccess;
  }
}
