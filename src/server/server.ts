import * as express from 'express';
import * as path from 'path';
import { authRouter } from './routes/auth-router';
import { prodRouter } from './routes/prod-router';
import { devRouter } from './routes/dev-router';
import { preloadRouter } from './routes/preload-router';
import * as config from './config';

express.static.mime.define({'text/plain': ['slate']});

let app = express();

let rootPath = path.join(__dirname, '..', '..', '..');

app.use(preloadRouter(rootPath));
app.use(authRouter());
app.use(config.IS_PRODUCTION ? prodRouter(rootPath) : devRouter(rootPath));

app.listen(config.SERVER_PORT, () => {
  console.log(`App listening on port ${config.SERVER_PORT}.`);
});
