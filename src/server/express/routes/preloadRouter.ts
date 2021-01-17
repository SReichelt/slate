import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch';
import { config } from 'slate-server-generic/config';
import { FileAccessor } from 'slate-shared/data/fileAccessor';
import { WebFileAccessor } from 'slate-env-web/data/webFileAccessor';
import { PhysicalFileAccessor } from 'slate-env-node/data/physicalFileAccessor';
import { LibraryPreloader } from 'slate-server-generic/preload/preload';
import FetchHelper from 'slate-env-web/utils/fetchHelper';
import CachedPromise from 'slate-shared/data/cachedPromise';

abstract class UpdateChecker {
  register(callback: () => CachedPromise<void>): void {
    setImmediate(() => this.execute(callback));
  }

  protected abstract execute(callback: () => CachedPromise<void>): void;
}

class DummyUpdateChecker extends UpdateChecker {
  protected execute(callback: () => CachedPromise<void>): void {
    callback()
      .catch((error) => console.error(error));
  }
}

class GitHubUpdateChecker extends UpdateChecker {
  private currentSHA?: string;

  constructor(private fetchHelper: FetchHelper, private repositoryOwner: string, private repositoryName: string, private branch: string, private checkIntervalInMS: number, private delayInMS: number) {
    super();
  }

  protected execute(callback: () => CachedPromise<void>): void {
    console.log(`Checking head of ${this.repositoryName} branch ${this.branch}...`);
    this.fetchHelper.fetchJSON(`https://api.github.com/repos/${this.repositoryOwner}/${this.repositoryName}/git/refs/heads/${this.branch}`)
      .then((result: any) => {
        try {
          let newSHA = result.object.sha;
          if (this.currentSHA !== newSHA) {
            let executeCallback = () => {
              callback()
                .catch((callbackError) => console.error(callbackError))
                .then(() => setTimeout(() => this.execute(callback), this.checkIntervalInMS));
            };
            if (this.currentSHA) {
              console.log(`New head of ${this.repositoryName} branch ${this.branch}: ${newSHA}`);
              setTimeout(executeCallback, this.delayInMS);
            } else {
              console.log(`Head of ${this.repositoryName} branch ${this.branch}: ${newSHA}`);
              executeCallback();
            }
            this.currentSHA = newSHA;
          } else {
            console.log(`Head of ${this.repositoryName} branch ${this.branch} unchanged: ${newSHA}`);
            setTimeout(() => this.execute(callback), this.checkIntervalInMS);
          }
        } catch (err) {
          console.error(err);
        }
      })
      .catch((error) => console.error(error));
  }
}

export function preloadRouter(rootPath: string): express.Router {
  let router = express.Router();
  let dataPath = path.join(rootPath, 'data');
  let librariesPath = path.join(dataPath, 'libraries');

  try {
    let libraries = JSON.parse(fs.readFileSync(path.join(librariesPath, 'libraries.json'), 'utf8'));
    for (let libraryName of Object.keys(libraries)) {
      let repository = libraries[libraryName];
      let fileAccessor: FileAccessor;
      let updateChecker: UpdateChecker;
      if (config.IS_PRODUCTION) {
        let fetchHelper = new FetchHelper(fetch);
        fileAccessor = new WebFileAccessor(fetchHelper, `https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${repository.branch}`);
        updateChecker = new GitHubUpdateChecker(fetchHelper, repository.owner, repository.name, repository.branch, 60000, 60000);
      } else {
        fileAccessor = new PhysicalFileAccessor(path.join(librariesPath, libraryName));
        updateChecker = new DummyUpdateChecker;
      }
      let preloader = new LibraryPreloader(fileAccessor);
      updateChecker.register(() => {
        console.log(`Preloading library "${libraryName}"...`);
        return preloader.preloadLibrary()
          .then(() => console.log(`Finished preloading library "${libraryName}".`));
      });
      let uriPrefix = `/preload/libraries/${libraryName}/`;
      router.get(uriPrefix + '*', (req, resp) => {
        let requestURI = req.url;
        if (requestURI.startsWith(uriPrefix)) {
          let preloadedContents = preloader.getPreloadedSection(requestURI.substring(uriPrefix.length));
          if (preloadedContents) {
            resp.send(preloadedContents);
            return;
          }
        }
        resp.sendStatus(404);
      });
    }
  } catch (error) {
    console.error(error);
  }

  return router;
}
