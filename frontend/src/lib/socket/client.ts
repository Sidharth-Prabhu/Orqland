import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentToken: string | null = null;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : 'http://localhost:3001');

/**
 * Initialize or get the shared authenticated Socket.IO instance
 */
export function getChatSocket(token?: string, email?: string): Socket {
  if (socket && socket.connected && (!token || token === currentToken)) {
    return socket;
  }

  if (socket && token && token !== currentToken) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    currentToken = token || null;
    socket = io(SOCKET_URL, {
      auth: {
        token: token || undefined,
        email: email || undefined,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to ORQLAND realtime gateway:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message);
    });
  }

  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}
