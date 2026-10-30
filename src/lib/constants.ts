export const BUSINESS_EMAIL = 'mailtosidharth.me@gmail.com';

// Supported Attachment MIME types
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
];

export const ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_DOCUMENT_MIME_TYPES,
];

// 48-Hour Retention Window (in milliseconds)
export const ATTACHMENT_RETENTION_MS = 48 * 60 * 60 * 1000; // 48 hours

// Max upload size: 10 MB
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

// Prohibited Sensitive Information regex patterns
export const SENSITIVE_INFO_PATTERNS = [
  // Credit Card numbers (13-19 digits with optional spaces/dashes)
  /\b(?:\d[ -]*?){13,19}\b/,
  // OTPs / PINs patterns
  /\b(?:otp|one[- ]?time[- ]?passcode|pin|cvv|cvc)\s*[:=]?\s*\d{4,8}\b/i,
  // Bank Account Numbers (e.g. 9-18 consecutive digits labeled as account)
  /\b(?:account|acct|iban|routing)\s*(?:no|number|#)?\s*[:=]?\s*[0-9A-Z]{8,24}\b/i,
  // Passwords
  /\b(?:password|passwd|pwd)\s*[:=]?\s*\S{4,}\b/i,
];

// Safety warnings
export const ORQLAND_DISCLAIMER =
  'Orqland Safety Notice: Orqland will never ask for your password, OTP, PIN, bank details, or confidential financial information in chat.';

export const CONTACT_SAFETY_NOTICE =
  'Safety Reminder: Do not share personal phone numbers or confidential personal details through chat.';

export const ATTACHMENT_48H_WARNING =
  'Notice: Shared images and PDF attachments will be automatically and permanently deleted after 48 hours from upload. Do not share files that require long-term storage.';

