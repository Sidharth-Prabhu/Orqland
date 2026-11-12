import { app, auth } from './firebase';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

/**
 * Initialize Web Push Notifications & Register Token
 */
export async function initializePushNotifications(userEmail?: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.log('FCM Web Push is not supported in this browser environment.');
      return null;
    }

    // Check permission
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission not granted.');
        return null;
      }
    } else if (Notification.permission !== 'granted') {
      return null;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn(
        '[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set. ' +
        'FCM push tokens cannot be obtained. ' +
        'Set it in .env.local to enable offline push notifications.'
      );
      return null;
    }

    // Retrieve FCM Registration Token
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey,
    });

    if (token) {
      // Register token with backend
      await registerPushTokenWithBackend(token, userEmail);

      // Listen for foreground notifications
      onMessage(messaging, (payload) => {
        if (Notification.permission === 'granted') {
          new Notification(payload.notification?.title || 'New Message', {
            body: payload.notification?.body || 'You received a message.',
            icon: '/icon-192.png',
            data: payload.data,
          });
        }
      });

      return token;
    } else {
      console.warn('[FCM] getToken() returned an empty token. Verify VAPID key and Firebase project configuration.');
    }
  } catch (err) {
    console.warn('[FCM] Failed to initialize push notifications:', err);
  }

  return null;
}

async function registerPushTokenWithBackend(token: string, userEmail?: string) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const currentUser = auth.currentUser;
    if (currentUser) {
      const idToken = await currentUser.getIdToken().catch(() => '');
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      if (currentUser.email) headers['X-User-Email'] = currentUser.email;
    } else if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }

    await fetch('/api/notifications', {
      method: 'POST',
      headers,
      body: JSON.stringify({ token, deviceType: 'web' }),
    });
  } catch (err) {
    console.warn('Failed to register push token with backend:', err);
  }
}
