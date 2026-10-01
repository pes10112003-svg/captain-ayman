import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass } from "./button";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

/** Server-rendered pager (hrefFor is a server-side function). */
export async function Pagination({ page, pages, hrefFor, total, label }: { page: number; pages: number; hrefFor: (p: number) => string; total?: number; label?: string }) {
  const { t, f, fmt } = await getI18n();
  const totalText = total != null ? `${fmt.num(total, 0)}${label ? ` ${label}` : ""}` : "";
  if (pages <= 1) return total != null ? <p className="text-xs text-muted">{totalText}</p> : null;
  return (
    <nav className="flex items-center justify-between gap-3" aria-label={t.common.pagination}>
      <p className="text-xs text-muted">
        {f(t.common.pageOf, { page: fmt.num(page, 0), pages: fmt.num(pages, 0) })}
        {totalText ? ` · ${totalText}` : ""}
      </p>
      <div className="flex gap-1.5">
        <Link
          aria-disabled={page <= 1}
          href={hrefFor(Math.max(1, page - 1))}
          className={cn(buttonClass("secondary", "sm"), page <= 1 && "pointer-events-none opacity-40")}
        >
          <ChevronLeft className="rtl-flip" /> {t.common.prev}
        </Link>
        <Link
          aria-disabled={page >= pages}
          href={hrefFor(Math.min(pages, page + 1))}
          className={cn(buttonClass("secondary", "sm"), page >= pages && "pointer-events-none opacity-40")}
        >
          {t.common.next} <ChevronRight className="rtl-flip" />
        </Link>
      </div>
    </nav>
  );
}
