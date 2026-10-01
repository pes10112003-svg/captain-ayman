import { redirect } from "next/navigation";
import { getCurrentActor } from "@/server/auth/session";
import { homePathFor } from "@/server/auth/guards";

export default async function Home() {
  const actor = await getCurrentActor();
  redirect(actor ? (actor.mustChangePassword ? "/change-password" : homePathFor(actor)) : "/login");
}
