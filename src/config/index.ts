import dotenv from 'dotenv';
import path from 'path';

const nodeEnv =
  process.env.NODE_ENV === 'production' ? 'production' : 'development';

dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({
  path: path.join(process.cwd(), `.env.${nodeEnv}`),
  override: true,
});

const LOCAL_CLIENT_URL = 'http://localhost:4467';
const MAIN_CLIENT_URL = 'https://flexi-chat.junayetalam.me';

/** Origins allowed for HTTP CORS and WebSocket connections. */
export const corsOrigins = [
  ...new Set(
    [LOCAL_CLIENT_URL, MAIN_CLIENT_URL, process.env.BASE_URL_CLIENT].filter(
      (origin): origin is string => Boolean(origin),
    ),
  ),
];

export default {
  env: process.env.NODE_ENV,
  project_name: process.env.PROJECT_NAME || '',
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  super_admin_password: process.env.SUPER_ADMIN_PASSWORD,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  mail: process.env.MAILTRAP_USER,
  mail_password: process.env.MAILTRAP_PASSWORD,
  mail_port: process.env.MAILTRAP_PORT,
  base_url_server: process.env.BASE_URL_SERVER,
  base_url_client: process.env.BASE_URL_CLIENT,
  cors_origins: corsOrigins,
  jwt: {
    access_secret: process.env.JWT_ACCESS_SECRET,
    access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
    refresh_secret: process.env.JWT_REFRESH_SECRET,
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 8596,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  do_space: {
    endpoints: process.env.DO_SPACE_ENDPOINT,
    access_key: process.env.DO_SPACE_ACCESS_KEY,
    secret_key: process.env.DO_SPACE_SECRET_KEY,
    bucket: process.env.DO_SPACE_BUCKET,
  },
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    project_name: process.env.CLOUDINARY_PROJECT_NAME,
  },
  mi_space: {
    endpoints: process.env.MI_SPACE_ENDPOINT,
    access_key: process.env.MI_SPACE_ACCESS_KEY,
    secret_key: process.env.MI_SPACE_SECRET_KEY,
    bucket: process.env.MI_SPACE_BUCKET,
    port: process.env.MI_PORT,
    ssl: process.env.MI_USE_SSL,
  },

  firebase: {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url:
      process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
  },
};
