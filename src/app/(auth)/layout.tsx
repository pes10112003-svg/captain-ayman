import { AuthShell } from "@/components/shared/auth-shell";
import { AppBridgeSignedOut } from "@/components/client/app-bridge";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <AppBridgeSignedOut />
      {children}
    </AuthShell>
  );
}
