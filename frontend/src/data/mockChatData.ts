import { UserProfile, Conversation } from '@/types/chat';

export const mockClientUser: UserProfile = {
  id: 'client-1',
  name: 'Maria susen',
  handle: 'orqa12v57697',
  avatar: '/avatars/maria.jpg',
  role: 'client',
  location: 'Anna nager, Chennai',
  isOnline: true,
};

export const mockBusinessUser: UserProfile = {
  id: 'business-1',
  name: 'Sj softwares',
  handle: 'sj_softwares',
  avatar: '/avatars/business-vr.jpg',
  role: 'business',
  wsid: 'ABC#12345678#',
  businessStatus: 'Closed',
  isOnline: true,
};

const sampleMessage =
  "Here is the preliminary report for the Q3 closing. I've highlighted the marketing spend anomalies in red. Let me know if we need to adjust the projections.";

export const mockConversations: Conversation[] = [
  {
    id: 'conv-shaju',
    participant: {
      id: 'shaju-david',
      name: 'Shaju David',
      avatar: '/avatars/shaju.jpg',
      isOnline: true,
      role: 'client',
    },
    lastMessage: sampleMessage,
    lastMessageTime: '10:42 AM',
    unreadCount: 1,
    workspaceInfo: {
      name: 'SJ TECH SOLUTIONS',
      type: 'Orqspace Info',
      description:
        'Discussion for quarterly financial reporting, audits, and budget adjustments.',
    },
    bookingInfo: {
      serviceName: 'Financial Governance & Reporting Service',
      status: 'Processing',
    },
    messages: [
      {
        id: 'msg-1',
        conversationId: 'conv-shaju',
        senderId: 'shaju-david',
        senderName: 'Shaju David',
        senderAvatar: '/avatars/shaju.jpg',
        content: sampleMessage,
        timestamp: '10:42 AM',
        date: 'Today, October 22',
      },
      {
        id: 'msg-2',
        conversationId: 'conv-shaju',
        senderId: 'sam-altman',
        senderName: 'Sam Altman',
        senderAvatar: '/avatars/sam.jpg',
        content: sampleMessage,
        timestamp: '10:42 AM',
        date: 'Today, October 22',
      },
      {
        id: 'msg-3',
        conversationId: 'conv-shaju',
        senderId: 'shaju-david',
        senderName: 'Shaju David',
        senderAvatar: '/avatars/shaju.jpg',
        content: sampleMessage,
        timestamp: '10:42 AM',
        date: 'Today, October 22',
      },
      {
        id: 'msg-4',
        conversationId: 'conv-shaju',
        senderId: 'sam-altman',
        senderName: 'Sam Altman',
        senderAvatar: '/avatars/sam.jpg',
        content: `${sampleMessage}\n\n${sampleMessage}\n\n${sampleMessage}`,
        timestamp: '10:42 AM',
        date: 'Today, October 22',
      },
      {
        id: 'msg-5',
        conversationId: 'conv-shaju',
        senderId: 'shaju-david',
        senderName: 'Shaju David',
        senderAvatar: '/avatars/shaju.jpg',
        content: sampleMessage,
        timestamp: '10:42 AM',
        date: 'Today, October 22',
      },
      {
        id: 'msg-6',
        conversationId: 'conv-shaju',
        senderId: 'sam-altman',
        senderName: 'Sam Altman',
        senderAvatar: '/avatars/sam.jpg',
        content: sampleMessage,
        timestamp: '10:42 AM',
        date: 'Today, October 22',
      },
    ],
  },
  {
    id: 'conv-sam-1',
    participant: {
      id: 'sam-1',
      name: 'Sam Altman',
      avatar: '/avatars/sam.jpg',
      isOnline: false,
      role: 'client',
    },
    lastMessage: sampleMessage,
    lastMessageTime: '10:42 AM',
    unreadCount: 0,
    workspaceInfo: {
      name: 'HYPERLOOP VENTURES',
      type: 'Orqspace Info',
      description:
        'Infrastructure scaling consultations and AI compute resource allocation roadmap.',
    },
    bookingInfo: {
      serviceName: 'Enterprise AI Architecture Review',
      status: 'Confirmed',
    },
    messages: [
      {
        id: 'msg-sam1-1',
        conversationId: 'conv-sam-1',
        senderId: 'sam-1',
        senderName: 'Sam Altman',
        senderAvatar: '/avatars/sam.jpg',
        content: sampleMessage,
        timestamp: '10:42 AM',
        date: 'Today, October 22',
      },
    ],
  },
  {
    id: 'conv-sam-2',
    participant: {
      id: 'sam-2',
      name: 'Sam Altman',
      avatar: '/avatars/sam.jpg',
      isOnline: true,
      role: 'client',
    },
    lastMessage: sampleMessage,
    lastMessageTime: '10:42 AM',
    unreadCount: 0,
    workspaceInfo: {
      name: 'SJ TECH SOLUTIONS',
      type: 'Orqspace Info',
      description:
        'Discussion for quarterly financial reporting, audits, and budget adjustments.',
    },
    bookingInfo: {
      serviceName: 'Financial Governance & Reporting Service',
      status: 'Processing',
    },
    messages: [
      {
        id: 'msg-sam2-1',
        conversationId: 'conv-sam-2',
        senderId: 'sam-2',
        senderName: 'Sam Altman',
        senderAvatar: '/avatars/sam.jpg',
        content: sampleMessage,
        timestamp: '10:42 AM',
        date: 'Today, October 22',
      },
    ],
  },
  {
    id: 'conv-sam-3',
    participant: {
      id: 'sam-3',
      name: 'Sam Altman',
      avatar: '/avatars/sam.jpg',
      isOnline: false,
      role: 'client',
    },
    lastMessage: sampleMessage,
    lastMessageTime: '10:42 AM',
    unreadCount: 0,
    workspaceInfo: {
      name: 'QUANTUM SYSTEMS',
      type: 'Orqspace Info',
      description:
        'Client onboarding and technical documentation sync meeting.',
    },
    bookingInfo: {
      serviceName: 'Technical Architecture Strategy',
      status: 'Processing',
    },
    messages: [
      {
        id: 'msg-sam3-1',
        conversationId: 'conv-sam-3',
        senderId: 'sam-3',
        senderName: 'Sam Altman',
        senderAvatar: '/avatars/sam.jpg',
        content: sampleMessage,
        timestamp: '10:42 AM',
        date: 'Today, October 22',
      },
    ],
  },
  {
    id: 'conv-sam-4',
    participant: {
      id: 'sam-4',
      name: 'Sam Altman',
      avatar: '/avatars/sam.jpg',
      isOnline: false,
      role: 'client',
    },
    lastMessage: sampleMessage,
    lastMessageTime: '10:42 AM',
    unreadCount: 0,
    workspaceInfo: {
      name: 'SJ TECH SOLUTIONS',
      type: 'Orqspace Info',
      description:
        'Discussion for quarterly financial reporting, audits, and budget adjustments.',
    },
    bookingInfo: {
      serviceName: 'Financial Governance & Reporting Service',
      status: 'Processing',
    },
    messages: [
      {
        id: 'msg-sam4-1',
        conversationId: 'conv-sam-4',
        senderId: 'sam-4',
        senderName: 'Sam Altman',
        senderAvatar: '/avatars/sam.jpg',
        content: sampleMessage,
        timestamp: '10:42 AM',
        date: 'Today, October 22',
      },
    ],
  },
];
