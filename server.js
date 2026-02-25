/**
 * Project Map server - thin entry point.
 * Delegates to src/server.
 */
const config = require('./src/server/config');
const { createServer } = require('./src/server');
const { DB_PATH } = require('./src/db');

const server = createServer();
const isDev = process.env.NODE_ENV !== 'production';
server.listen(config.PORT, () => {
  console.log(`a-orca server: http://localhost:${config.PORT}`);
  console.log('Database:', DB_PATH);
  const servingReact = config.PUBLIC_DIR.includes('dist');
  if (servingReact) {
    console.log('Serving React app (Run button, Agents, Activity tab) from dist/');
  } else {
    console.log('Serving legacy app from public/ — run "npm run build" then restart to get React UI with Run button');
  }
  if (isDev) {
    console.log('Dev with hot reload: http://localhost:5173');
  }
  console.log('Generate with Cursor: uses cursor-agent (PowerShell or WSL)');
});
