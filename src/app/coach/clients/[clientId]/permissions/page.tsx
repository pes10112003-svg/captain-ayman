import { redirect } from "next/navigation";

/** Permissions now live on the client's Settings tab. */
export default async function PermissionsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  redirect(`/coach/clients/${encodeURIComponent(clientId)}/settings#permissions`);
}
