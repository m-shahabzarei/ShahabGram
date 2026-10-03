import { AppShell } from "../../../components/app-shell";
import { ConversationCreateForm } from "../../../components/conversation-create-form";

export default function NewGroupPage() { return <AppShell title="گروه جدید" hint="یک فضای مشترک بساز"><ConversationCreateForm type="group" /></AppShell>; }
