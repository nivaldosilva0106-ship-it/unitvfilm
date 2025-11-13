import type { Content } from './content';

export interface UserProfile {
  id: string;
  email: string;
  isPremium: boolean;
  createdAt: string;
}

export interface MyListItem {
  id: string;
  contentId: string;
  content: Content;
  addedAt: string;
}
