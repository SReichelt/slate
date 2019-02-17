import { WebFileAccessor } from './webFileAccessor';
import { FileContents } from '../../shared/data/fileAccessor';
import CachedPromise from '../../shared/data/cachedPromise';

interface GitHubTarget {
  uriPrefix: string;
  repository: string;
  branch: string;
}

export class GitHubFileAccessor extends WebFileAccessor {
  private targets: GitHubTarget[] = [];

  readFile(uri: string): CachedPromise<FileContents> {
    for (let target of this.targets) {
      if (uri.startsWith(target.uriPrefix)) {
        let path = uri.substring(target.uriPrefix.length);
        uri = `https://raw.githubusercontent.com/${target.repository}/${target.branch}${path}`;
      }
    }

    return super.readFile(uri);
  }

  setTarget(uriPrefix: string, repository: string, branch: string): void {
    for (let target of this.targets) {
      if (target.uriPrefix === uriPrefix) {
        target.repository = repository;
        target.branch = branch;
        return;
      }
    }

    this.targets.push({
      uriPrefix: uriPrefix,
      repository: repository,
      branch: branch
    });
  }
}
