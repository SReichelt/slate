import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';
import * as config from '../config';
import { WebFileAccessor } from '../data/webFileAccessor';
import { PhysicalFileAccessor } from '../../fs/data/physicalFileAccessor';
import { LibraryPreloader } from '../preload/preload';

export function preloadRouter(rootPath: string): express.Router {
  let router = express.Router();
  let dataPath = path.join(rootPath, 'data');
  let librariesPath = path.join(dataPath, 'libraries');

  // TODO regularly update data
  try {
    let libraries = JSON.parse(fs.readFileSync(path.join(librariesPath, 'libraries.json'), 'utf8'));
    for (let libraryName of Object.keys(libraries)) {
      console.log(`Preloading library "${libraryName}"...`);
      let repository = libraries[libraryName];
      let fileAccessor = config.IS_PRODUCTION ? new WebFileAccessor(`https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${repository.branch}`) : new PhysicalFileAccessor(path.join(librariesPath, libraryName));
      let preloader = new LibraryPreloader(fileAccessor);
      let uriPrefix = '/libraries/' + libraryName;
      let uriSuffix = '.preload';
      router.get(uriPrefix + '/*' + uriSuffix, (request, response) => {
        let requestURI = request.url;
        if (requestURI.startsWith(uriPrefix) && requestURI.endsWith(uriSuffix)) {
          let preloadedContents = preloader.getPreloadedSection(requestURI.substring(uriPrefix.length, requestURI.length - uriSuffix.length));
          if (preloadedContents) {
            response.send(preloadedContents);
            return;
          }
        }
        response.sendStatus(404);
      });
      preloader.preloadSection('/', 'Library')
        .then(() => console.log(`Finished preloading library "${libraryName}".`))
        .catch((error) => console.error(error));
    }
  } catch (error) {
    console.error(error);
  }

  return router;
}
