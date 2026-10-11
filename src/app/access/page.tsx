import { redirect } from "next/navigation";

/** The site access code was removed; old links and bookmarks go straight to sign-in. */
export default function AccessPage() {
  redirect("/login");
}
