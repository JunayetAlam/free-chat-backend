const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env'), quiet: true });

const nodeEnv =
  process.env.NODE_ENV === 'production' ? 'production' : 'development';

dotenv.config({
  path: path.join(process.cwd(), `.env.${nodeEnv}`),
  override: true,
  quiet: true,
});
