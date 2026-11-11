export interface UserProfile {
  id: string;
  name: string;
  handle: string;
  email?: string;
  avatar: string;
  role: 'client' | 'business';
  location?: string;
  wsid?: string;
  isOnline: boolean;
  businessStatus?: 'Open' | 'Closed';
}

export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type AttachmentType = 'image' | 'pdf' | 'location';

export interface LocationData {
  latitude: number;
  longitude: number;
  label?: string;
  mapUrl: string;
}

export interface ChatAttachment {
  id: string;
  type: AttachmentType;
  name: string;
  url: string;
  objectKey?: string;
  thumbnailUrl?: string; // Rendered first-page thumbnail or preview image
  size?: number; // bytes
  mimeType?: string;
  uploadedAt: number;
  expiresAt: number; // uploadedAt + 48 hours
  isExpired?: boolean;
  locationData?: LocationData;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderEmail?: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: string; // e.g. "10:42 AM"
  date: string; // e.g. "Today"
  createdAt?: number; // millisecond epoch for strict chronological ordering
  idempotencyKey?: string;
  isMe?: boolean;
  status?: MessageDeliveryStatus;
  attachment?: ChatAttachment;
  attachments?: ChatAttachment[];
  deletedByBusiness?: boolean;
  deletedByClient?: boolean;
  deletedForEveryone?: boolean;
  isEdited?: boolean;
  editedAt?: number;
}

export type ConversationLifecycleStatus = 'active' | 'ended';

export interface Conversation {
  id: string;
  clientId?: string;
  clientEmail?: string;
  clientName?: string;
  clientAvatar?: string;
  businessId?: string;
  businessEmail?: string;
  businessName?: string;
  businessAvatar?: string;
  participant: {
    id: string;
    name: string;
    email?: string;
    handle?: string;
    avatar: string;
    isOnline: boolean;
    role: 'client' | 'business';
  };
  status?: ConversationLifecycleStatus;
  endedAt?: number;
  endedBy?: string;
  deletedByBusiness?: boolean;
  businessDeletedAt?: number;
  clientDeletedAt?: number;
  deletedForClient?: boolean;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageTimestamp?: number;
  unreadCount: number;
  unreadByClient?: number;
  unreadByBusiness?: number;
  workspaceInfo: {
    name: string;
    type: string;
    description: string;
  };
  bookingInfo?: {
    serviceName: string;
    status: 'Processing' | 'Confirmed' | 'Completed' | 'Pending';
  };
  businessNotes?: string;
  notesUpdatedAt?: number;
  messages: ChatMessage[];
}
