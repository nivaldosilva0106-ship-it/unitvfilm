export interface Comment {
    id: string;
    contentId: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    text: string;
    timestamp: number;
}
