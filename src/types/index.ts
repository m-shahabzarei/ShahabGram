export type ConversationType = "direct" | "group" | "channel";
export type MemberRole = "owner" | "admin" | "member";
export type Visibility = "public" | "private";
export type Language = "fa" | "en";

export interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  language: Language;
  lastSeenAt: string | null;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  description: string | null;
  slug: string | null;
  visibility: Visibility;
  ownerId: string;
  avatarUrl: string | null;
  createdAt: string;
  lastMessage?: Message | null;
  unreadCount?: number;
  memberCount?: number;
}

export interface ConversationMember {
  conversationId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  lastReadMessageId: string | null;
  user?: User;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  clientId: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender?: User;
}

export interface SessionUser extends User {
  sessionId: string;
}

export type RealtimeEvent =
  | { type: "message_created"; conversationId: string; message: Message; clientId: string; serverTs: string }
  | { type: "message_updated"; conversationId: string; message: Message; serverTs: string }
  | { type: "message_deleted"; conversationId: string; messageId: string; serverTs: string }
  | { type: "typing"; conversationId: string; userId: string; isTyping: boolean; serverTs: string }
  | { type: "read"; conversationId: string; userId: string; messageId: string; serverTs: string }
  | { type: "presence"; conversationId: string; userId: string; online: boolean; serverTs: string };
