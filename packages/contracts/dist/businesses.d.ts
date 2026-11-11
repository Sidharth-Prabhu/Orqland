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
}
export declare const INITIAL_BUSINESSES: BusinessDirectoryItem[];
//# sourceMappingURL=businesses.d.ts.map