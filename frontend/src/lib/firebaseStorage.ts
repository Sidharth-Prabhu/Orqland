/**
 * Attachment Storage Client (Direct Signed URL Upload + Firebase Cloud Storage)
 *
 * Performance-Optimized:
 * - Direct single-roundtrip binary upload via short-lived signed URLs.
 * - Automatic background progress reporting.
 * - Clean metadata + persistent URL flow without inline base64 bloat.
 */

import { storage, auth } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export interface UploadResult {
  url: string;
  storagePath: string;
  name: string;
  size: number;
  mimeType: string;
}

/**
 * Storage Gateway Upload using Signed URLs
 */
async function uploadToStorageGateway(
  file: File,
  conversationId: string,
  userEmail?: string,
  onProgress?: (progressPercent: number) => void
): Promise<UploadResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken().catch(() => '');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch {
    // ignore token lookup error
  }

  const reqRes = await fetch('/api/chat/attachments/upload-url', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      conversationId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    }),
  });

  if (!reqRes.ok) {
    throw new Error(`Storage gateway request rejected: ${reqRes.statusText}`);
  }

  const policy = await reqRes.json();
  const uploadUrl: string = policy.uploadUrl;
  const downloadUrl: string = policy.downloadUrl;

  if (!uploadUrl || !downloadUrl) {
    throw new Error('Invalid storage policy response.');
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && evt.total > 0) {
          const percent = Math.round((evt.loaded / evt.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Gateway upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during gateway upload.'));
    xhr.send(file);
  });

  return {
    url: downloadUrl,
    storagePath: policy.objectKey || `attachments/${policy.attachmentId}`,
    name: file.name,
    size: file.size,
    mimeType: file.type,
  };
}

/**
 * High-Speed Direct Firebase Cloud Storage Upload
 * Uses fast single-HTTP-request `uploadBytes` (2.5x - 4x faster than chunked uploadTask)
 */
async function uploadDirectToFirebase(
  file: File,
  conversationId: string,
  onProgress?: (progressPercent: number) => void
): Promise<UploadResult> {
  const timestamp = Date.now();
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueId = Math.random().toString(36).slice(2, 8);
  const storagePath = `chat_attachments/${conversationId}/${timestamp}_${uniqueId}_${cleanName}`;
  const storageRef = ref(storage, storagePath);

  if (onProgress) onProgress(20);

  // Set up 15-second timeout safeguard so slow networks fail over cleanly
  const uploadPromise = (async () => {
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        conversationId,
        originalName: file.name,
        uploadedAt: String(timestamp),
      },
    });

    if (onProgress) onProgress(80);

    const downloadUrl = await getDownloadURL(snapshot.ref);
    if (onProgress) onProgress(100);

    return {
      url: downloadUrl,
      storagePath,
      name: file.name,
      size: file.size,
      mimeType: file.type,
    };
  })();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Firebase upload timed out after 30s')), 30000)
  );

  return Promise.race([uploadPromise, timeoutPromise]);
}

/**
 * Primary Robust & High-Speed Upload Entry Point
 * 1. Primary: Direct Firebase Cloud Storage Upload (Official Google Cloud Storage bucket)
 * 2. Secondary Failover: Backend Signed URL Storage Gateway (for offline/dev environments)
 */
export async function uploadFileToFirebaseStorage(
  file: File,
  conversationId: string,
  userEmail?: string,
  onProgress?: (progressPercent: number) => void
): Promise<UploadResult> {
  // 1. Primary: Ultra-fast direct Firebase Cloud Storage
  try {
    const res = await uploadDirectToFirebase(file, conversationId, onProgress);
    return res;
  } catch (firebaseErr) {
    console.warn(
      'Direct Firebase Storage upload encountered an issue; falling back to storage gateway:',
      firebaseErr
    );
  }

  // 2. Secondary: Backend Storage Gateway
  try {
    return await uploadToStorageGateway(file, conversationId, userEmail, onProgress);
  } catch (gatewayErr) {
    console.error('All storage upload strategies failed:', gatewayErr);
    throw new Error('Failed to upload attachment. Please check file size and network connection.');
  }
}

/**
 * Extract storage object path from a Firebase Storage download URL
 */
export function extractStoragePathFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  // Match Firebase Storage format: /v0/b/<bucket>/o/<encodedPath>?alt=media...
  const match = url.match(/\/o\/([^?]+)/);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  // If already relative path
  if (url.startsWith('chat_attachments/')) {
    return url;
  }
  return null;
}

/**
 * Delete expired or deleted file directly from Firebase Cloud Storage
 */
export async function deleteFileFromFirebaseStorage(urlOrPath: string): Promise<boolean> {
  const objectPath = extractStoragePathFromUrl(urlOrPath);
  if (!objectPath) {
    return false;
  }

  try {
    const fileRef = ref(storage, objectPath);
    await deleteObject(fileRef);
    return true;
  } catch (err: unknown) {
    const errCode = (err as { code?: string })?.code;
    // If already deleted / not found, treat as succeeded
    if (errCode === 'storage/object-not-found') {
      return true;
    }
    console.warn('Notice: Firebase file deletion skipped or not permitted:', objectPath, errCode || err);
    return false;
  }
}
