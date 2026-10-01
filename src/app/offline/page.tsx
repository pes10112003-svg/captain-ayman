import { WifiOff } from "lucide-react";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.titles.offline };
}

export default async function OfflinePage() {
  const { t } = await getI18n();
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-xs">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-surface-2 ring-1 ring-line">
          <WifiOff className="size-6 text-ink-2" />
        </div>
        <h1 className="text-xl font-semibold">{t.errors.offlineTitle}</h1>
        <p className="mt-2 text-sm text-muted">{t.errors.offlinePage}</p>
      </div>
    </main>
  );
}
