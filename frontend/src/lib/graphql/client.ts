import { auth } from '../firebase';

const MESSAGE_FIELDS = `
  fragment ChatMessageFields on ChatMessageGql {
    id
    conversationId
    senderId
    senderEmail
    senderName
    senderAvatar
    content
    timestamp
    date
    createdAt
    sequenceNumber
    idempotencyKey
    isMe
    status
    deletedByBusiness
    deletedByClient
    deletedForEveryone
    isEdited
    editedAt
    attachment {
      id
      type
      name
      url
      downloadUrl
      thumbnailUrl
      size
      mimeType
      uploadedAt
      expiresAt
      isExpired
      locationData {
        latitude
        longitude
        label
        mapUrl
      }
    }
    attachments {
      id
      type
      name
      url
      downloadUrl
      thumbnailUrl
      size
      mimeType
      uploadedAt
      expiresAt
      isExpired
      locationData {
        latitude
        longitude
        label
        mapUrl
      }
    }
  }
`;

const CONVERSATION_FIELDS = `
  ${MESSAGE_FIELDS}
  fragment ConversationFields on ConversationGql {
    id
    orqspaceId
    clientId
    clientEmail
    clientName
    clientAvatar
    businessId
    businessEmail
    businessName
    businessAvatar
    status
    endedAt
    endedBy
    deletedByBusiness
    businessDeletedAt
    clientDeletedAt
    deletedForClient
    lastMessage
    lastMessageTime
    lastMessageTimestamp
    unreadCount
    unreadByClient
    unreadByBusiness
    participant {
      id
      name
      email
      handle
      avatar
      isOnline
      role
      joinedAt
      lastReadMessageId
      lastReadAt
    }
    workspaceInfo {
      name
      type
      description
    }
    bookingInfo {
      serviceName
      status
    }
    messages {
      ...ChatMessageFields
    }
  }
`;

export const ME_QUERY = `
  query Me {
    me {
      id
      firebaseUid
      name
      handle
      email
      avatar
      role
      wsid
      isOnline
      businessStatus
    }
  }
`;

export const CHAT_DIRECTORY_QUERY = `
  query ChatDirectory {
    chatDirectory {
      id
      orqspaceCode
      name
      logoUrl
      ownerId
      isActive
      category
      description
      email
    }
  }
`;

export const MY_CHAT_CONVERSATIONS_QUERY = `
  ${CONVERSATION_FIELDS}
  query MyChatConversations($orqspaceId: ID) {
    myChatConversations(orqspaceId: $orqspaceId) {
      ...ConversationFields
    }
  }
`;

export const CHAT_MESSAGES_QUERY = `
  ${MESSAGE_FIELDS}
  query ChatMessages($conversationId: ID!, $cursor: String, $limit: Int) {
    chatMessages(conversationId: $conversationId, cursor: $cursor, limit: $limit) {
      messages {
        ...ChatMessageFields
      }
      hasMore
      nextCursor
    }
  }
`;

export const INITIATE_CONVERSATION_MUTATION = `
  ${CONVERSATION_FIELDS}
  mutation InitiateConversation($input: InitiateConversationInputGql!) {
    initiateConversation(input: $input) {
      ...ConversationFields
    }
  }
`;

export const SEND_MESSAGE_MUTATION = `
  ${MESSAGE_FIELDS}
  mutation SendMessage($input: SendMessageInputGql!) {
    sendMessage(input: $input) {
      ...ChatMessageFields
    }
  }
`;

export const EDIT_CHAT_MESSAGE_MUTATION = `
  ${MESSAGE_FIELDS}
  mutation EditChatMessage($input: EditMessageInputGql!) {
    editChatMessage(input: $input) {
      ...ChatMessageFields
    }
  }
`;

export const DELETE_CHAT_MESSAGE_MUTATION = `
  ${MESSAGE_FIELDS}
  mutation DeleteChatMessage($input: DeleteMessageInputGql!) {
    deleteChatMessage(input: $input) {
      ...ChatMessageFields
    }
  }
`;

export const END_CONVERSATION_MUTATION = `
  ${CONVERSATION_FIELDS}
  mutation EndConversation($id: ID!) {
    endConversation(id: $id) {
      ...ConversationFields
    }
  }
`;

export const REOPEN_CONVERSATION_MUTATION = `
  ${CONVERSATION_FIELDS}
  mutation ReopenConversation($id: ID!, $input: ReopenConversationInputGql) {
    reopenConversation(id: $id, input: $input) {
      ...ConversationFields
    }
  }
`;

export const MARK_CONVERSATION_READ_MUTATION = `
  mutation MarkConversationRead($id: ID!) {
    markConversationRead(id: $id)
  }
`;

export const DELETE_CONVERSATION_VIEW_MUTATION = `
  ${CONVERSATION_FIELDS}
  mutation DeleteConversationView($id: ID!) {
    deleteConversationView(id: $id) {
      ...ConversationFields
    }
  }
`;

export const HEARTBEAT_MUTATION = `
  mutation Heartbeat {
    heartbeat {
      success
      timestamp
    }
  }
`;

export function sanitizeAttachmentForGql(att: any) {
  if (!att) return undefined;
  return {
    id: String(att.id || crypto.randomUUID()),
    type: String(att.type || 'document'),
    name: String(att.name || 'attachment'),
    url: String(att.url || ''),
    downloadUrl: att.downloadUrl ? String(att.downloadUrl) : undefined,
    thumbnailUrl: att.thumbnailUrl ? String(att.thumbnailUrl) : undefined,
    size: typeof att.size === 'number' ? Math.round(att.size) : undefined,
    mimeType: att.mimeType ? String(att.mimeType) : undefined,
    uploadedAt: typeof att.uploadedAt === 'number' ? att.uploadedAt : Date.now(),
    expiresAt: typeof att.expiresAt === 'number' ? att.expiresAt : Date.now() + 48 * 60 * 60 * 1000,
    isExpired: typeof att.isExpired === 'boolean' ? att.isExpired : undefined,
    locationData: att.locationData
      ? {
          latitude: Number(att.locationData.latitude ?? att.locationData.lat ?? 0),
          longitude: Number(att.locationData.longitude ?? att.locationData.lng ?? 0),
          label:
            att.locationData.label || att.locationData.address
              ? String(att.locationData.label || att.locationData.address)
              : undefined,
          mapUrl: String(
            att.locationData.mapUrl ||
              `https://maps.google.com/?q=${Number(att.locationData.latitude ?? att.locationData.lat ?? 0)},${Number(att.locationData.longitude ?? att.locationData.lng ?? 0)}`
          ),
        }
      : undefined,
  };
}

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
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

  const res = await fetch('/api/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const errMsg = json?.errors?.[0]?.message || json?.message || `GraphQL request failed (${res.status})`;
    throw new Error(errMsg);
  }
  if (json?.errors?.length) {
    throw new Error(json.errors[0].message || 'GraphQL operation failed');
  }
  if (!json?.data) {
    throw new Error('Empty GraphQL response');
  }

  return json.data as T;
}
