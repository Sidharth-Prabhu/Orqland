export interface BusinessDirectoryItem {
    id: string;
    name: string;
    email: string;
    category: string;
    description: string;
    avatar: string;
    wsid: string;
    isOnline: boolean;
    status: 'Open' | 'Closed';
    verified: boolean;
    services: string[];
    ownerId?: string;
}
//# sourceMappingURL=businesses.d.ts.map