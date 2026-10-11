import { AuthShell } from "@/components/shared/auth-shell";
import { AppBridgeSignedOut } from "@/components/client/app-bridge";
import { requireAccess } from "@/server/auth/gate";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Sign-in & password pages are only reachable after entering the site access code.
  await requireAccess();
  return (
    <AuthShell>
      <AppBridgeSignedOut />
      {children}
    </AuthShell>
  );
}
