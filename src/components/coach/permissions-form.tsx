"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Lock, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { updatePermissionsAction } from "@/server/actions/clients";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_PERMISSIONS, PERMISSIONS, type Permissions } from "@/lib/constants";
import { useI18n } from "@/i18n/client";

export function PermissionsForm({ clientId, initial, clientName }: { clientId: string; initial: Permissions; clientName: string }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);
  const groups = [...new Set(PERMISSIONS.map((p) => p.group))];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2/60 p-4 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-ink-2" />
        <p className="leading-relaxed text-ink-2">{f(t.permissionsPage.intro, { name: clientName })}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map((g) => (
          <Card key={g}>
            <CardHeader title={t.permissions.groups[g]} icon={<ShieldCheck />} />
            <CardBody className="pt-3">
              <ul className="divide-y divide-line">
                {PERMISSIONS.filter((p) => p.group === g).map((p) => (
                  <li key={p.key} className="flex items-center justify-between gap-4 py-3">
                    <label htmlFor={`perm-${p.key}`} className="min-w-0 cursor-pointer">
                      <span className="block text-sm font-medium">{t.permissions[p.key].label}</span>
                      <span className="block text-xs text-muted">{t.permissions[p.key].description}</span>
                    </label>
                    <div className="flex items-center gap-2.5">
                      <span className={`min-w-7 text-end text-xs font-semibold ${value[p.key] ? "text-good-text" : "text-muted"}`}>{value[p.key] ? t.common.on : t.common.off}</span>
                      <Switch id={`perm-${p.key}`} checked={value[p.key]} onCheckedChange={(v) => setValue((s) => ({ ...s, [p.key]: v }))} label={t.permissions[p.key].label} />
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={() => setValue(DEFAULT_PERMISSIONS)} disabled={pending}>
          <RotateCcw /> {t.permissionsPage.resetDefaults}
        </Button>
        <div className="flex gap-2">
          {dirty ? (
            <Button variant="secondary" onClick={() => setValue(initial)} disabled={pending}>
              {t.common.discard}
            </Button>
          ) : null}
          <Button
            disabled={!dirty}
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await updatePermissionsAction(clientId, value);
                if (!res.ok) return void toast.error(res.error);
                toast.success(t.permissionsPage.saved);
                router.refresh();
              })
            }
          >
            {!pending ? <Save /> : null} {t.permissionsPage.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
