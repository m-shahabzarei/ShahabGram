import type { Conversation, Message, User } from "@/types";

export function mapUser(row: any): User {
  return { id: row.id, username: row.username, displayName: row.display_name ?? row.username, bio: row.bio ?? null, avatarUrl: row.avatar_url ?? null, language: row.language === "en" ? "en" : "fa", lastSeenAt: row.last_seen_at ?? null };
}

export function mapMessage(row: any): Message {
  return { id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, body: row.deleted_at ? "" : row.body, clientId: row.client_id, createdAt: row.created_at, editedAt: row.edited_at ?? null, deletedAt: row.deleted_at ?? null, sender: row.sender ? mapUser(row.sender) : undefined };
}

export function mapConversation(row: any): Conversation {
  return { id: row.id, type: row.type, title: row.title, description: row.description ?? null, slug: row.slug ?? null, visibility: row.visibility, ownerId: row.owner_id, avatarUrl: row.avatar_url ?? null, createdAt: row.created_at, memberCount: row.member_count };
}
