import express from 'express';
import * as path from 'path';
import { authRouter } from './routes/authRouter';
import { prodRouter } from './routes/prodRouter';
import { devRouter } from './routes/devRouter';
import { preloadRouter } from './routes/preloadRouter';
import { config } from 'slate-server-generic/config';

express.static.mime.define({'text/plain': ['slate']});

const app = express();

const rootPath = path.join('..', '..', '..');

app.use(preloadRouter(rootPath));
app.use(authRouter());
app.use(config.IS_PRODUCTION ? prodRouter(rootPath) : devRouter(rootPath));

app.listen(config.SERVER_PORT, () => {
  console.log(`App listening on port ${config.SERVER_PORT}.`);
});
