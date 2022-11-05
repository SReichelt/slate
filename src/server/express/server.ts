import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { preloadRouter } from './routes/preloadRouter';
import { authRouter } from './routes/authRouter';
import { prodRouter } from './routes/prodRouter';
import { devRouter } from './routes/devRouter';
import { appRouter } from './routes/appRouter';
import { config } from 'slate-server-generic/config';

express.static.mime.define({'text/plain': ['slate']});

const app = express();

const rootPath = fs.realpathSync(path.join('..', '..', '..'));

app.use(preloadRouter(rootPath));
app.use(authRouter());
app.use(config.IS_PRODUCTION ? prodRouter() : devRouter(rootPath));
app.use(appRouter(rootPath));

app.listen(config.SERVER_PORT, () => {
  console.log(`App listening on port ${config.SERVER_PORT}.`);
});
