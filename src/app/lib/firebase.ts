import { cert, getApps, initializeApp } from 'firebase-admin';
import config from '../../config';
import { getMessaging } from 'firebase-admin/messaging';

const normalizePem = (value?: string) => {
  if (!value) return value;
  let pem = value.trim();
  if (
    (pem.startsWith('"') && (pem.endsWith('"') || pem.endsWith('",'))) ||
    (pem.startsWith("'") && (pem.endsWith("'") || pem.endsWith("',")))
  ) {
    pem = pem.replace(/^['"]/, '').replace(/['"],?$/, '');
  } else if (pem.endsWith(',')) {
    pem = pem.slice(0, -1);
  }
  return pem.replace(/\\n/g, '\n').trim();
};

const firebaseAdminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: config.firebase.project_id,
          clientEmail: normalizePem(config.firebase.client_email),
          privateKey: normalizePem(config.firebase.private_key),
        }),
      });

export const firebaseMessaging = getMessaging(firebaseAdminApp);
