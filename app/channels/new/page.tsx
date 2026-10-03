import { AppShell } from "../../../components/app-shell";
import { ConversationCreateForm } from "../../../components/conversation-create-form";

export default function NewChannelPage() { return <AppShell title="کانال جدید" hint="پیام‌ها را با اعضا به اشتراک بگذار"><ConversationCreateForm type="channel" /></AppShell>; }
