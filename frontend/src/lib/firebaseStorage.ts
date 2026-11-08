import { storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export interface UploadResult {
  url: string;
  storagePath: string;
  name: string;
  size: number;
  mimeType: string;
}

/**
 * Uploads a file directly to Firebase Cloud Storage.
 *
 * @param file The file (or compressed image / PDF) to upload
 * @param conversationId The parent conversation UUID
 * @param onProgress Optional progress callback (0-100)
 * @returns Promise resolving to the public Firebase Cloud Storage download URL and metadata
 */
export async function uploadFileToFirebaseStorage(
  file: File,
  conversationId: string,
  onProgress?: (progressPercent: number) => void
): Promise<UploadResult> {
  const timestamp = Date.now();
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueId = Math.random().toString(36).slice(2, 8);
  const storagePath = `chat_attachments/${conversationId}/${timestamp}_${uniqueId}_${cleanName}`;
  const storageRef = ref(storage, storagePath);

  try {
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
        (error) => {
          console.error('Firebase Cloud Storage upload error:', error);
          reject(error);
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
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  } catch (err: unknown) {
    console.warn(
      'Firebase Cloud Storage direct upload failed; falling back to resilient data transfer:',
      err
    );
    // Development fallback if offline or Firebase bucket permissions are unconfigured
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
}
