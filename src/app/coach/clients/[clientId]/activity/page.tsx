import { redirect } from "next/navigation";

/** The per-client activity tab was removed; recent activity is on the overview. */
export default async function ClientActivityPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  redirect(`/coach/clients/${encodeURIComponent(clientId)}`);
}
