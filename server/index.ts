/**
 * Server entry point (excluded from coverage gates).
 *
 * Loads environment config, builds the app, and starts the HTTP listener.
 */
import 'dotenv/config';
import { loadConfig } from './config';
import { createApp } from './app';

const config = loadConfig();
const app = createApp({ config });

app.listen(config.port, () => {
  console.info(`ClearClause server running on port ${config.port}`);
});
