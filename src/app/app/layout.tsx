import { AppFrame } from "@/components/app-frame";
import { listClients, workspaceContext } from "@/lib/workspace";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { profile, mode, clientId } = await workspaceContext();
  const clients = profile.role === "admin" ? await listClients() : [];
  return (
    <AppFrame profile={profile} clients={clients} mode={mode} clientId={clientId}>
      {children}
    </AppFrame>
  );
}
