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
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  // Play audio alert
  playNotificationChime();

  const notifOptions: NotificationOptions = {
    body,
    icon,
    badge: icon,
    tag: tag || 'openpurpl-chat',
    silent: false,
    data: {
      conversationId,
      url: window.location.href,
    },
  };

  // 1. Try Service Worker showNotification (preferred on macOS/Chrome)
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notifOptions);
        return;
      }
    }
  } catch (err) {
    console.debug('SW notification fallback to standard Notification:', err);
  }

  // 2. Standard fallback Notification constructor
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
