import crypto from 'crypto';
import { Conversation, ChatMessage } from '@/types/chat';

// Master key derivation for AES-256-GCM encryption at rest
const ENCRYPTION_SALT = process.env.ENCRYPTION_SALT || 'orqland-storage-salt-v1-2026';
const MASTER_SECRET = process.env.CHAT_STORAGE_ENCRYPTION_KEY;

function getDerivedKey(): Buffer {
  if (!MASTER_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CHAT_STORAGE_ENCRYPTION_KEY environment variable is missing. Failed closed.');
    }
    // Fail closed in production, allow development fallback key with clear warning
    console.warn('[Security Warning] CHAT_STORAGE_ENCRYPTION_KEY not set. Using dev encryption key.');
    return crypto.scryptSync('dev-insecure-key-replace-in-production', ENCRYPTION_SALT, 32);
  }
  return crypto.scryptSync(MASTER_SECRET, ENCRYPTION_SALT, 32);
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const PREFIX = 'enc:gcm:v1:';

/**
 * Encrypt a string at rest using AES-256-GCM with authentication tag.
 * Fails closed if encryption fails; never returns plaintext as fallback.
 */
export function encryptAtRest(plainText: string): string {
  if (!plainText) return plainText;

  try {
    const key = getDerivedKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Encryption at rest error: failing closed.', err);
    throw new Error('Encryption at rest failed. Fail-closed policy enforced.');
  }
}

/**
 * Decrypt a string at rest using AES-256-GCM
 */
export function decryptAtRest(cipherString: string): string {
  if (!cipherString || typeof cipherString !== 'string') return cipherString;

  if (!cipherString.startsWith(PREFIX)) {
    return cipherString;
  }

  try {
    const key = getDerivedKey();
    const raw = cipherString.slice(PREFIX.length);
    const [ivHex, tagHex, encryptedHex] = raw.split(':');

    if (!ivHex || !tagHex || !encryptedHex) {
      throw new Error('Malformed cipher text structure');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('Decryption at rest error: failing closed.', err);
    throw new Error('Decryption at rest failed. Malformed or invalid key.');
  }
}

/**
 * Encrypt sensitive fields of a message at rest
 */
export function encryptMessageAtRest(message: ChatMessage): ChatMessage {
  try {
    return {
      ...message,
      content: encryptAtRest(message.content),
    };
  } catch (err) {
    console.error('Failed to encrypt message at rest:', err);
    throw err;
  }
}

/**
 * Decrypt sensitive fields of a message for display/transmission
 */
export function decryptMessageAtRest(message: ChatMessage): ChatMessage {
  try {
    return {
      ...message,
      content: decryptAtRest(message.content),
    };
  } catch (err) {
    console.error('Failed to decrypt message at rest:', err);
    return message;
  }
}

/**
 * Encrypt all messages within a conversation before persisting to disk
 */
export function encryptConversationAtRest<T extends Conversation | Conversation[]>(target: T): T {
  try {
    if (Array.isArray(target)) {
      return target.map((c) => ({
        ...c,
        lastMessage: encryptAtRest(c.lastMessage),
        messages: c.messages ? c.messages.map(encryptMessageAtRest) : [],
      })) as T;
    }
    return {
      ...target,
      lastMessage: encryptAtRest(target.lastMessage),
      messages: target.messages ? target.messages.map(encryptMessageAtRest) : [],
    } as T;
  } catch (err) {
    console.error('Failed to encrypt conversation at rest:', err);
    throw err;
  }
}

/**
 * Decrypt all messages within a conversation after reading from disk
 */
export function decryptConversationAtRest<T extends Conversation | Conversation[]>(target: T): T {
  try {
    if (Array.isArray(target)) {
      return target.map((c) => ({
        ...c,
        lastMessage: decryptAtRest(c.lastMessage),
        messages: c.messages ? c.messages.map(decryptMessageAtRest) : [],
      })) as T;
    }
    return {
      ...target,
      lastMessage: decryptAtRest(target.lastMessage),
      messages: target.messages ? target.messages.map(decryptMessageAtRest) : [],
    } as T;
  } catch (err) {
    console.error('Failed to decrypt conversation at rest:', err);
    return target;
  }
}
