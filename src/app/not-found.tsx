import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="grid min-h-[70dvh] place-items-center px-6 py-16 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-surface-2 ring-1 ring-line">
          <SearchX className="size-6 text-ink-2" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.errors.notFoundTitle}</h1>
        <p className="mt-2 text-sm text-muted">{t.errors.notFoundText}</p>
        <Link href="/" className={buttonClass("primary", "md", "mt-6")}>
          {t.errors.goHome}
        </Link>
      </div>
    </main>
  );
}
