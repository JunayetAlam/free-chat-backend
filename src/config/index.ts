import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export default {
  env: process.env.NODE_ENV,
  project_name: process.env.PROJECT_NAME || '',
  port: process.env.PORT,
  super_admin_password: process.env.SUPER_ADMIN_PASSWORD,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  mail: process.env.MAILTRAP_USER,
  mail_password: process.env.MAILTRAP_PASSWORD,
  mail_port: process.env.MAILTRAP_PORT,
  base_url_server: process.env.BASE_URL_SERVER,
  base_url_client: process.env.BASE_URL_CLIENT,
  jwt: {
    access_secret: process.env.JWT_ACCESS_SECRET,
    access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
    refresh_secret: process.env.JWT_REFRESH_SECRET,
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  },
  do_space: {
    endpoints: process.env.DO_SPACE_ENDPOINT,
    access_key: process.env.DO_SPACE_ACCESS_KEY,
    secret_key: process.env.DO_SPACE_SECRET_KEY,
    bucket: process.env.DO_SPACE_BUCKET,
  },
  stripe: {
    published_key: process.env.STRIPE_PUBLISHED_KEY,
    stripe_secret_key: process.env.STRIPE_SECRET_KEY,
    stripe_webhook: process.env.STRIPE_WEBHOOK,
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
};
