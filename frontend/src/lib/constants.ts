export const DEFAULT_BUSINESS_EMAIL = '';
export const BUSINESS_EMAIL =
  process.env.NEXT_PUBLIC_BUSINESS_EMAIL || DEFAULT_BUSINESS_EMAIL;

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

// Max upload size: 5 MB (if higher, compressed automatically)
export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;

// Prohibited Sensitive Information regex patterns
export const SENSITIVE_INFO_PATTERNS = [
  // Credit / Debit Card numbers (13-19 digits with optional spaces/dashes)
  /\b(?:\d[ -]*?){13,19}\b/,
  // CVV / CVC (3-4 digits labeled as cvv/cvc)
  /\b(?:cvv|cvc|security\s*code)\s*[:=]?\s*\d{3,4}\b/i,
  // OTPs / PINs / Verification Codes (e.g. "otp is 123456", "otp: 1234", "pin is 4321")
  /\b(?:otp|one[- ]?time[- ]?pass(?:code|word)?|pin|verification\s*code|auth\s*code)\b(?:\s*(?:is|was|:|=|-)+)?\s*\d{4,8}\b/i,
  // Bank Account Numbers, IBAN, Routing numbers, IFSC
  /\b(?:account|acct|iban|routing|ifsc|swift|bank\s*a\/c)\s*(?:no|number|#)?\s*(?:is|was|:|=|-)?\s*[0-9A-Z]{6,34}\b/i,
  // Passwords / Credentials (e.g. "password is secret", "password: abc", "pwd = 123")
  /\b(?:password|passwd|pwd|passcode|secret\s*key)\b(?:\s*(?:is|was|:|=|-)+)?\s*\S{4,}\b/i,
  // National Identity Documents (SSN, Aadhaar 12-digit, Passport)
  /\b\d{3}-\d{2}-\d{4}\b/, // US SSN
  /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/, // Indian Aadhaar card
  /\b[A-Z][0-9]{7,8}\b/, // Passport number format
];

// Safety warnings
export const ORQLAND_DISCLAIMER =
  'Orqland Safety Notice: Orqland will never ask for your password, OTP, PIN, bank details, card numbers, or confidential financial/personal information through chat.';

export const CONTACT_SAFETY_NOTICE =
  'Safety & Contact Reminder: Never share personal mobile numbers or confidential private credentials through chat.';

export const ATTACHMENT_48H_WARNING =
  'Security Notice: All image and PDF attachments are encrypted at rest and will be automatically and permanently deleted after 48 hours from upload. Do not share files that require long-term storage.';

export const CALLS_DISABLED_NOTICE =
  'Voice and video calls are not supported for user privacy and security. Communication is restricted to authenticated text messages, approved images/PDFs, and location sharing only.';

