import crypto from 'crypto';
import { Conversation, ChatMessage } from '@/types/chat';

// Master key derivation for AES-256-GCM encryption at rest
const ENCRYPTION_SALT = 'orqland-storage-salt-v1-2026';
const MASTER_SECRET = process.env.CHAT_STORAGE_ENCRYPTION_KEY || 'orqland-secure-enterprise-chat-at-rest-key-32b';

// Derive a fixed 32-byte key for AES-256
const DERIVED_KEY: Buffer = crypto.scryptSync(MASTER_SECRET, ENCRYPTION_SALT, 32);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const PREFIX = 'enc:gcm:v1:';

/**
 * Encrypt a string at rest using AES-256-GCM with authentication tag
 */
export function encryptAtRest(plainText: string): string {
  if (!plainText) return plainText;

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, DERIVED_KEY, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Encryption at rest error:', err);
    return plainText;
  }
}

/**
 * Decrypt a string at rest using AES-256-GCM
 * Returns original text if it was not encrypted (migration support)
 */
export function decryptAtRest(cipherString: string): string {
  if (!cipherString || typeof cipherString !== 'string') return cipherString;

  if (!cipherString.startsWith(PREFIX)) {
    // Unencrypted legacy text
    return cipherString;
  }

  try {
    const raw = cipherString.slice(PREFIX.length);
    const [ivHex, tagHex, encryptedHex] = raw.split(':');

    if (!ivHex || !tagHex || !encryptedHex) {
      return cipherString;
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, DERIVED_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('Decryption at rest error:', err);
    return cipherString;
  }
}

/**
 * Recursively encrypt sensitive fields in a conversation object before writing to disk
 */
export function encryptConversationAtRest<T>(data: T): T {
  if (!data) return data;
  const clone = JSON.parse(JSON.stringify(data));

  if (Array.isArray(clone)) {
    return clone.map((item) => encryptSingleConversation(item)) as unknown as T;
  } else {
    return encryptSingleConversation(clone) as unknown as T;
  }
}

function encryptSingleConversation(conv: Conversation): Conversation {
  if (!conv) return conv;

  if (Array.isArray(conv.messages)) {
    conv.messages = conv.messages.map((m: ChatMessage) => {
      const encryptedMsg = { ...m };
      if (encryptedMsg.content) {
        encryptedMsg.content = encryptAtRest(encryptedMsg.content);
      }
      if (encryptedMsg.attachment && encryptedMsg.attachment.url) {
        encryptedMsg.attachment = {
          ...encryptedMsg.attachment,
          url: encryptAtRest(encryptedMsg.attachment.url),
        };
      }
      return encryptedMsg;
    });
  }

  if (conv.lastMessage) {
    conv.lastMessage = encryptAtRest(conv.lastMessage);
  }

  return conv;
}

/**
 * Recursively decrypt sensitive fields in a conversation object after reading from disk
 */
export function decryptConversationAtRest<T>(data: T): T {
  if (!data) return data;
  const clone = JSON.parse(JSON.stringify(data));

  if (Array.isArray(clone)) {
    return clone.map((item) => decryptSingleConversation(item)) as unknown as T;
  } else {
    return decryptSingleConversation(clone) as unknown as T;
  }
}

function decryptSingleConversation(conv: Conversation): Conversation {
  if (!conv) return conv;

  if (Array.isArray(conv.messages)) {
    conv.messages = conv.messages.map((m: ChatMessage) => {
      const decryptedMsg = { ...m };
      if (decryptedMsg.content) {
        decryptedMsg.content = decryptAtRest(decryptedMsg.content);
      }
      if (decryptedMsg.attachment && decryptedMsg.attachment.url) {
        const decryptedUrl = decryptAtRest(decryptedMsg.attachment.url);
        decryptedMsg.attachment = {
          ...decryptedMsg.attachment,
          url: decryptedUrl,
          locationData: decryptedMsg.attachment.locationData
            ? {
                ...decryptedMsg.attachment.locationData,
                mapUrl: decryptedMsg.attachment.locationData.mapUrl || decryptedUrl,
              }
            : undefined,
        };
      }
      return decryptedMsg;
    });
  }

  if (conv.lastMessage) {
    conv.lastMessage = decryptAtRest(conv.lastMessage);
  }

  return conv;
}
