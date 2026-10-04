import { AppShell } from "../../../components/app-shell";
import { ChatScreen } from "../../../components/chat-screen";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell mode="telegram" title="گفت‌وگو" hint="پیام‌رسانی ساده و متمرکز"><ChatScreen conversationId={id} /></AppShell>;
}
