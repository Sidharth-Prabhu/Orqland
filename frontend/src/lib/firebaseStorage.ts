/**
 * Attachment Storage Client
 * 
 * Supports uploading attachments via:
 * 1. Backend storage gateway (generating real HTTP download URLs e.g. http://localhost:3001/api/v1/attachments/download/...)
 * 2. Firebase Cloud Storage (when configured)
 * 3. Graceful base64 data encoding as a last resort
 */
import { storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export interface UploadResult {
  url: string;
  storagePath: string;
  name: string;
  size: number;
  mimeType: string;
}

function fallbackToFileReader(file: File, cleanName: string): Promise<UploadResult> {
  return new Promise<UploadResult>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: reader.result as string,
        storagePath: `fallback/${cleanName}`,
        name: file.name,
        size: file.size,
        mimeType: file.type,
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a file via the backend direct object storage gateway.
 * Returns a genuine HTTP download URL (e.g. http://localhost:3001/api/v1/attachments/download/:id).
 */
async function uploadToStorageGateway(
  file: File,
  conversationId: string,
  onProgress?: (progressPercent: number) => void
): Promise<UploadResult> {
  // 1. Request an upload policy and presigned URL from the backend
  const reqRes = await fetch('/api/chat/attachments/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    }),
  });

  if (!reqRes.ok) {
    throw new Error(`Failed to obtain upload URL: ${reqRes.statusText}`);
  }

  const policy = await reqRes.json();
  const uploadUrl: string = policy.uploadUrl;
  const downloadUrl: string = policy.downloadUrl;

  if (!uploadUrl || !downloadUrl) {
    throw new Error('Invalid upload policy response from server.');
  }

  // 2. Perform direct binary PUT upload
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
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during file upload.'));
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
 * Primary attachment upload entry point.
 * Prioritizes the dedicated backend storage gateway to guarantee genuine HTTP URL generation.
 */
export async function uploadFileToFirebaseStorage(
  file: File,
  conversationId: string,
  onProgress?: (progressPercent: number) => void
): Promise<UploadResult> {
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Attempt 1: Upload via Backend Storage Gateway (Generates authentic HTTP URL)
  try {
    return await uploadToStorageGateway(file, conversationId, onProgress);
  } catch (gatewayErr) {
    console.warn('Backend storage gateway upload failed, checking Firebase fallback:', gatewayErr);
  }

  // Attempt 2: Firebase Storage (if available)
  try {
    const timestamp = Date.now();
    const uniqueId = Math.random().toString(36).slice(2, 8);
    const storagePath = `chat_attachments/${conversationId}/${timestamp}_${uniqueId}_${cleanName}`;
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        conversationId,
        originalName: file.name,
        uploadedAt: String(timestamp),
      },
    });

    return await new Promise<UploadResult>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            const percent = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            onProgress(percent);
          }
        },
        async (error) => {
          console.warn('Firebase upload error, falling back to local file reader:', error);
          try {
            resolve(await fallbackToFileReader(file, cleanName));
          } catch (readErr) {
            reject(readErr);
          }
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              url: downloadUrl,
              storagePath,
              name: file.name,
              size: file.size,
              mimeType: file.type,
            });
          } catch {
            resolve(await fallbackToFileReader(file, cleanName));
          }
        }
      );
    });
  } catch (err) {
    console.warn('All cloud storage attempts failed; falling back to local data encoding:', err);
    return fallbackToFileReader(file, cleanName);
  }
}
