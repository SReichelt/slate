import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';
import * as request from 'request';
import * as config from '../config';
import { FileAccessor } from '../../shared/data/fileAccessor';
import { WebFileAccessor } from '../data/webFileAccessor';
import { PhysicalFileAccessor } from '../../fs/data/physicalFileAccessor';
import { LibraryPreloader } from '../preload/preload';
import CachedPromise from '../../shared/data/cachedPromise';

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

  constructor(private repositoryOwner: string, private repositoryName: string, private branch: string, private checkIntervalInMS: number, private delayInMS: number) {
    super();
  }

  protected execute(callback: () => CachedPromise<void>): void {
    console.log(`Checking head of ${this.repositoryName} branch ${this.branch}...`);
    let options: request.CoreOptions = {
      headers: {
        'User-Agent': 'request'
      }
    };
    request.get(`https://api.github.com/repos/${this.repositoryOwner}/${this.repositoryName}/git/refs/heads/${this.branch}`, options, (error, response, body) => {
      if (error) {
        console.error(error);
      } else if (response.statusCode === 200) {
        try {
          let result = JSON.parse(body);
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
        } catch (error) {
          console.error(error);
        }
      }
    });
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
        fileAccessor = new WebFileAccessor(`https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${repository.branch}`);
        updateChecker = new GitHubUpdateChecker(repository.owner, repository.name, repository.branch, 60000, 60000);
      } else {
        fileAccessor = new PhysicalFileAccessor(path.join(librariesPath, libraryName));
        updateChecker = new DummyUpdateChecker;
      }
      let preloader = new LibraryPreloader(fileAccessor);
      updateChecker.register(() => {
        console.log(`Preloading library "${libraryName}"...`);
        return preloader.preloadSection('/', 'Library')
          .then(() => console.log(`Finished preloading library "${libraryName}".`));
      });
      let uriPrefix = '/libraries/' + libraryName;
      let uriSuffix = '.preload';
      router.get(uriPrefix + '/*' + uriSuffix, (req, resp) => {
        let requestURI = req.url;
        if (requestURI.startsWith(uriPrefix) && requestURI.endsWith(uriSuffix)) {
          let preloadedContents = preloader.getPreloadedSection(requestURI.substring(uriPrefix.length, requestURI.length - uriSuffix.length));
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
