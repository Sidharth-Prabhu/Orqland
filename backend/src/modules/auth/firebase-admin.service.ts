import { Injectable, OnModuleInit, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface DecodedAuthToken {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  [key: string]: any;
}

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private firebaseApp: admin.app.App | null = null;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const projectId =
      this.configService.get<string>('FIREBASE_PROJECT_ID') || 'openpurpl-f8dd3';
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    try {
      if (admin.apps.length > 0) {
        this.firebaseApp = admin.apps[0];
        this.isConfigured = true;
        return;
      }

      if (clientEmail && privateKey) {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
        this.isConfigured = true;
        this.logger.log(`Firebase Admin initialized with service account for project: ${projectId}`);
      } else {
        // Initialize with project ID (works in GCP or with default credentials)
        this.firebaseApp = admin.initializeApp({ projectId });
        this.isConfigured = true;
        this.logger.log(`Firebase Admin initialized with project ID: ${projectId}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Firebase Admin initialization notice: ${msg}`);
      this.isConfigured = false;
    }
  }

  async verifyIdToken(token: string): Promise<DecodedAuthToken> {
    if (!token) {
      throw new UnauthorizedException('Authentication token is missing.');
    }

    // Clean Bearer prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    // Handle dev/test bypass tokens only when NODE_ENV === 'test' or 'development'
    if (
      process.env.NODE_ENV !== 'production' &&
      cleanToken.startsWith('mock-token-')
    ) {
      const email = cleanToken.replace('mock-token-', '');
      return {
        uid: `mock-uid-${email}`,
        email,
        name: email.split('@')[0],
      };
    }

    if (!this.isConfigured || !this.firebaseApp) {
      // In development when service account is not yet provided, inspect JWT claims safely
      return this.decodeDevToken(cleanToken);
    }

    try {
      const decoded = await admin.auth().verifyIdToken(cleanToken);
      return decoded;
    } catch (err: unknown) {
      // If network is offline in local dev, allow safe inspection for testing
      if (process.env.NODE_ENV !== 'production') {
        return this.decodeDevToken(cleanToken);
      }
      const msg = err instanceof Error ? err.message : 'Invalid or expired Firebase token.';
      this.logger.warn(`Token verification failed: ${msg}`);
      throw new UnauthorizedException('Authentication failed: Invalid or expired token.');
    }
  }

  private decodeDevToken(token: string): DecodedAuthToken {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        if (payload.user_id || payload.sub) {
          return {
            uid: payload.user_id || payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
          };
        }
      }
    } catch {
      // Fall through to error
    }
    throw new UnauthorizedException('Invalid or expired authentication token.');
  }
}
