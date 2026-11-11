import {
  BUSINESS_EMAIL,
  DEFAULT_BUSINESS_EMAIL,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  ATTACHMENT_RETENTION_MS,
  SENSITIVE_INFO_PATTERNS,
} from './constants';
import { AttachmentType } from '@/types/chat';
import { INITIAL_BUSINESSES } from '@orqland/contracts';

export function isBusinessUser(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();

  // 1. Check environment configured business emails
  const envEmails = (process.env.NEXT_PUBLIC_BUSINESS_EMAILS || process.env.NEXT_PUBLIC_BUSINESS_EMAIL || '')
    .toLowerCase()
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (envEmails.includes(clean)) return true;

  // 2. Check default fallback
  if (clean === BUSINESS_EMAIL.toLowerCase() || clean === DEFAULT_BUSINESS_EMAIL.toLowerCase()) {
    return true;
  }

  // 3. Check known business directory list
  return INITIAL_BUSINESSES.some((b) => b.email.toLowerCase() === clean);
}

export function validateAttachmentFile(file: File): {
  valid: boolean;
  error?: string;
  attachmentType?: AttachmentType;
} {
  // Check file size
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: 'File size exceeds 5 MB limit. Please select a smaller file.',
    };
  }

  const mime = file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  // Prohibited dangerous extensions
  const dangerousExtensions = [
    'exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs', 'msi', 'zip', 'tar', 'gz', 'mp4', 'mov', 'avi', 'mp3',
  ];
  if (dangerousExtensions.includes(extension)) {
    return {
      valid: false,
      error: `Files of type .${extension} are prohibited. Only Images (JPG, JPEG, PNG, WebP) and PDF documents are permitted.`,
    };
  }

  // Check allowed image
  if (
    ALLOWED_IMAGE_MIME_TYPES.includes(mime) ||
    ['jpg', 'jpeg', 'png', 'webp'].includes(extension)
  ) {
    return {
      valid: true,
      attachmentType: 'image',
    };
  }

  // Check allowed document (PDF only)
  if (
    ALLOWED_DOCUMENT_MIME_TYPES.includes(mime) ||
    extension === 'pdf'
  ) {
    return {
      valid: true,
      attachmentType: 'pdf',
    };
  }

  return {
    valid: false,
    error: 'Unsupported format. Only JPG, JPEG, PNG, WebP images and PDF documents are allowed.',
  };
}

export function detectSensitiveContent(text: string): {
  hasSensitiveData: boolean;
  isBlocked?: boolean;
  warning?: string;
  error?: string;
} {
  if (!text) return { hasSensitiveData: false };

  // 1. Check for prohibited confidential financial & authentication info (Strict Block)
  for (const pattern of SENSITIVE_INFO_PATTERNS) {
    if (pattern.test(text)) {
      return {
        hasSensitiveData: true,
        isBlocked: true,
        error:
          'Security Policy Violation: Sharing credit/debit card numbers, OTPs, PINs, bank account details, passwords, or identity documents through chat is strictly prohibited.',
        warning:
          'Prohibited Information Detected: Orqland will never ask for your password, OTP, PIN, or bank details. Do not share credentials or confidential data.',
      };
    }
  }

  // 2. Mobile number & contact safety check (Indian 10-digit or international format)
  const phonePattern = /(?:(?:\+|00)\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?[6-9]\d{9}\b|\b(?:\d{3}[-.\s]?){3}\d\b/;
  if (phonePattern.test(text)) {
    return {
      hasSensitiveData: true,
      isBlocked: false,
      warning:
        'Mobile Number & Contact Safety Reminder: Please avoid sharing personal mobile numbers or private contact information in chat.',
    };
  }

  return { hasSensitiveData: false };
}

export function isAttachmentExpired(uploadedAt: number, expiresAt?: number): boolean {
  const expiry = expiresAt || uploadedAt + ATTACHMENT_RETENTION_MS;
  return Date.now() > expiry;
}

