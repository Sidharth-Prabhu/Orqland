import {
  BUSINESS_EMAIL,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  ATTACHMENT_RETENTION_MS,
  SENSITIVE_INFO_PATTERNS,
} from './constants';
import { AttachmentType } from '@/types/chat';

export function isBusinessUser(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === BUSINESS_EMAIL.toLowerCase();
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
      error: 'File size exceeds 10 MB limit. Please select a smaller file.',
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
  warning?: string;
} {
  if (!text) return { hasSensitiveData: false };

  for (const pattern of SENSITIVE_INFO_PATTERNS) {
    if (pattern.test(text)) {
      return {
        hasSensitiveData: true,
        warning:
          'Security Alert: Your message appears to contain sensitive information (such as credit card, OTP, bank account, or password). To protect your privacy and security, sharing confidential financial data or credentials via chat is strictly prohibited.',
      };
    }
  }

  // Phone number pattern check (7+ consecutive digits)
  const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  if (phonePattern.test(text)) {
    return {
      hasSensitiveData: true,
      warning:
        'Privacy Notice: Please avoid sharing personal phone numbers or direct contact numbers in the chat.',
    };
  }

  return { hasSensitiveData: false };
}

export function isAttachmentExpired(uploadedAt: number, expiresAt?: number): boolean {
  const expiry = expiresAt || uploadedAt + ATTACHMENT_RETENTION_MS;
  return Date.now() > expiry;
}

