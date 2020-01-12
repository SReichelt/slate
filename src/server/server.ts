import * as path from 'path';
import * as express from 'express';
import { apiRouter } from './routes/api-router';
import { authRouter } from './routes/auth-router';
import { staticsRouter } from './routes/statics-router';
import { staticsDevRouter } from './routes/statics-dev-router';
import { preloadRouter } from './routes/preload-router';
import * as config from './config';

express.static.mime.define({'text/plain': ['slate']});

let app = express();

let rootPath = path.join(__dirname, '..', '..', '..');

app.use(preloadRouter(rootPath));
app.use(apiRouter(rootPath));
app.use(authRouter());
app.use(config.IS_PRODUCTION ? staticsRouter(rootPath) : staticsDevRouter());

app.listen(config.SERVER_PORT, () => {
  console.log(`App listening on port ${config.SERVER_PORT}.`);
});
