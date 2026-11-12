// Browser notification utility with audio alert and focus handlers

/**
 * Register service worker for reliable desktop notifications
 */
export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch (err) {
    console.debug('Service worker registration failed:', err);
    return null;
  }
}

/**
 * Play a gentle, crisp audio notification chime using Web Audio API
 */
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Resume context if suspended (common in modern browsers)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    
    // Primary chime note (Eb5 -> G5, pleasant high alert tone)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.36);

    // Second bell harmonic
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1318.5, now + 0.08); // E6

    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.08);
    osc2.stop(now + 0.46);
  } catch (err) {
    console.debug('Notification chime suppressed:', err);
  }
}

/**
 * Prompt browser for notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Also register SW
      registerNotificationServiceWorker().catch(() => {});
    }
    return permission;
  } catch {
    return 'default';
  }
}

/**
 * Check if the document / window is currently not focused or backgrounded
 */
export function isPageInBackground(): boolean {
  if (typeof document === 'undefined') return false;
  return document.hidden || !document.hasFocus();
}

let titleBlinkInterval: ReturnType<typeof setInterval> | null = null;
let originalTitle = '';

/**
 * Flash page title to alert user in background tabs
 */
export function startTitleAlert(previewText?: string) {
  if (typeof document === 'undefined') return;
  if (!originalTitle) {
    originalTitle = document.title || 'OpenPurpl';
  }
  if (titleBlinkInterval) clearInterval(titleBlinkInterval);

  let toggle = false;
  const cleanPreview = (previewText || 'New Message').slice(0, 24);
  titleBlinkInterval = setInterval(() => {
    document.title = toggle ? '💬 (1) New message!' : `📩 ${cleanPreview}`;
    toggle = !toggle;
  }, 1000);

  const clearAlert = () => {
    if (titleBlinkInterval) {
      clearInterval(titleBlinkInterval);
      titleBlinkInterval = null;
    }
    document.title = originalTitle || 'OpenPurpl';
    window.removeEventListener('focus', clearAlert);
    document.removeEventListener('visibilitychange', clearAlert);
  };

  window.addEventListener('focus', clearAlert);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clearAlert();
    }
  });
}

export interface SendBrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  conversationId?: string;
  onClick?: () => void;
}

/**
 * Dispatch a browser notification (supports Service Worker showNotification with fallback to new Notification)
 */
export async function sendBrowserNotification({
  title,
  body,
  icon = '/favicon.ico',
  tag,
  conversationId,
  onClick,
}: SendBrowserNotificationOptions): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  // Play audio alert and flash tab title regardless of notification permission
  playNotificationChime();
  startTitleAlert(body);

  if (!('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const notifOptions: NotificationOptions = {
    body,
    icon,
    badge: icon,
    tag: tag || `chat-${Date.now()}`,
    silent: false,
    data: {
      conversationId,
      url: window.location.href,
    },
  };

  // 1. Try Service Worker showNotification via getRegistration with a strict 200ms timeout
  let swNotified = false;
  try {
    if ('serviceWorker' in navigator) {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          options: notifOptions,
        });
        swNotified = true;
      }

      const reg = await Promise.race([
        navigator.serviceWorker.getRegistration(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 200)),
      ]);

      if (reg && reg.active && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, notifOptions);
        swNotified = true;
      }
    }
  } catch (err) {
    console.debug('SW notification fallback to standard Notification:', err);
  }

  // 2. Standard instant Notification constructor fallback
  if (!swNotified) {
    try {
      const notification = new Notification(title, notifOptions);

      notification.onclick = (e) => {
        e.preventDefault();
        try {
          window.focus();
        } catch {}
        if (onClick) {
          onClick();
        }
        notification.close();
      };
    } catch (err) {
      console.error('Failed to dispatch browser notification:', err);
    }
  }
}

