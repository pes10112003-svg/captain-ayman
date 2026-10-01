import { cn, hueFor, initials } from "@/lib/utils";

const sizes = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg", xl: "size-20 text-2xl" };

/** Client avatar. Photos are private and served through an authorized route — never a public URL. */
export function Avatar({
  name,
  clientId,
  avatarKey,
  size = "md",
  className,
}: {
  name: string;
  clientId?: string;
  avatarKey?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const hue = hueFor(name);
  if (clientId && avatarKey) {
    const v = avatarKey.split("avatar-")[1]?.replace(".webp", "") ?? "1";
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/media/avatars/${clientId}?v=${v}`}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("shrink-0 rounded-full bg-surface-2 object-cover ring-1 ring-line", sizes[size], className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold tracking-tight ring-1 ring-black/5", sizes[size], className)}
      style={{ background: `oklch(0.92 0.05 ${hue})`, color: `oklch(0.35 0.08 ${hue})` }}
    >
      {initials(name)}
    </span>
  );
}
