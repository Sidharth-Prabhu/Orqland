/**
 * Rate Limiter and Abuse Protection for Chat APIs
 * Enforces per-identity / per-IP rate limits and payload integrity
 */

interface RateLimitRecord {
  timestamps: number[];
}

const messageLimits = new Map<string, RateLimitRecord>();
const generalLimits = new Map<string, RateLimitRecord>();

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_MESSAGES_PER_WINDOW = 60; // Max 60 messages per minute
const MAX_REQUESTS_PER_WINDOW = 300; // Max 300 general requests per minute

// Maximum payload size for attachments: 5MB
export const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Check if a user/IP is rate limited for sending messages
 */
export function checkMessageRateLimit(identifier: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: string;
} {
  const now = Date.now();
  const id = identifier.trim().toLowerCase();

  let record = messageLimits.get(id);
  if (!record) {
    record = { timestamps: [] };
    messageLimits.set(id, record);
  }

  // Filter timestamps within the current sliding window
  record.timestamps = record.timestamps.filter((t) => now - t < WINDOW_MS);

  if (record.timestamps.length >= MAX_MESSAGES_PER_WINDOW) {
    const oldest = record.timestamps[0];
    const retryAfterSeconds = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
      reason: `Rate limit exceeded. Please wait ${retryAfterSeconds} seconds before sending more messages.`,
    };
  }

  record.timestamps.push(now);
  return { allowed: true };
}

/**
 * Check if a user/IP is rate limited for general API requests
 */
export function checkGeneralRateLimit(identifier: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: string;
} {
  const now = Date.now();
  const id = identifier.trim().toLowerCase();

  let record = generalLimits.get(id);
  if (!record) {
    record = { timestamps: [] };
    generalLimits.set(id, record);
  }

  record.timestamps = record.timestamps.filter((t) => now - t < WINDOW_MS);

  if (record.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = record.timestamps[0];
    const retryAfterSeconds = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
      reason: `Too many requests. Please slow down and try again in ${retryAfterSeconds} seconds.`,
    };
  }

  record.timestamps.push(now);
  return { allowed: true };
}

/**
 * Inspect attachment for malicious signatures or oversized payloads
 */
export function inspectAttachmentSecurity(attachment?: {
  type: string;
  name: string;
  url?: string;
  size?: number;
}): { valid: boolean; error?: string } {
  if (!attachment) return { valid: true };

  // 1. Check file size
  if (attachment.size && attachment.size > MAX_PAYLOAD_BYTES) {
    return {
      valid: false,
      error: 'Oversized upload: Attachments must not exceed 5 MB.',
    };
  }

  // 2. Validate approved types only
  const approvedTypes = ['image', 'pdf', 'location'];
  if (!approvedTypes.includes(attachment.type)) {
    return {
      valid: false,
      error: 'Security Policy Violation: Only Images (JPG, JPEG, PNG, WebP), PDF documents, and Location sharing are permitted.',
    };
  }

  // Fast-path for location sharing (not a file upload, no extensions or binary headers)
  if (attachment.type === 'location') {
    return { valid: true };
  }

  // 3. Dangerous file extension check
  const ext = attachment.name.split('.').pop()?.toLowerCase() || '';
  const prohibitedExts = [
    'exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs', 'msi', 'zip', 'rar', 'tar', 'gz', 'mp4', 'mov', 'avi', 'mp3',
  ];
  if (prohibitedExts.includes(ext)) {
    return {
      valid: false,
      error: `Security Policy Violation: File type .${ext} is prohibited for security reasons.`,
    };
  }

  // 4. Data URL magic byte check for executable payloads disguised as images/PDFs
  if (attachment.url && attachment.url.startsWith('data:')) {
    const headerSlice = attachment.url.slice(0, 80).toLowerCase();

    // Windows PE executable base64 header (MZ header starts with TVqQ)
    if (attachment.url.includes('TVqQAAMAAAAEAAAA')) {
      return {
        valid: false,
        error: 'Security Policy Violation: Executable file disguised as attachment detected and rejected.',
      };
    }

    // ZIP header base64 (PK starts with UEsDB)
    if (attachment.url.includes('UEsDBBQ')) {
      return {
        valid: false,
        error: 'Security Policy Violation: Archive/ZIP file format is not permitted.',
      };
    }

    // HTML / Script injection in data URL
    if (headerSlice.includes('text/html') || headerSlice.includes('javascript') || headerSlice.includes('<script')) {
      return {
        valid: false,
        error: 'Security Policy Violation: Unsafe script format detected.',
      };
    }
  }

  return { valid: true };
}

