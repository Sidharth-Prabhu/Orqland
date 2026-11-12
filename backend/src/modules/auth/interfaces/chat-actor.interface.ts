export interface ChatActor {
  userId: string; // UUID matching orq_users.id
  roles: string[]; // e.g. ['WEB_USER']
  email?: string;
  name?: string;
  avatar?: string;
}
