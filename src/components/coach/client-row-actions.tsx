"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Dumbbell, Eye, LineChart, MoreHorizontal, Pencil, Power, ShieldCheck, Utensils } from "lucide-react";
import { setClientStatusAction } from "@/server/actions/clients";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useI18n } from "@/i18n/client";

export function ClientRowActions({ id, name, status }: { id: string; name: string; status: "active" | "inactive" }) {
  const { t, f } = useI18n();
  const m = t.clients.menu;
  const [pending, start] = useTransition();
  const base = `/coach/clients/${id}`;
  return (
    <Menu>
      <MenuTrigger
        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        aria-label={f(m.actionsFor, { name })}
        disabled={pending}
      >
        <MoreHorizontal className="size-4" />
      </MenuTrigger>
      <MenuContent>
        <MenuItem asChild>
          <Link href={base}>
            <Eye /> {m.view}
          </Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href={`${base}/settings`}>
            <Pencil /> {m.edit}
          </Link>
        </MenuItem>
        <MenuSeparator />
        <MenuItem asChild>
          <Link href={`${base}/workouts`}>
            <Dumbbell /> {m.workouts}
          </Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href={`${base}/nutrition`}>
            <Utensils /> {m.nutrition}
          </Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href={`${base}/progress`}>
            <LineChart /> {m.progress}
          </Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href={`${base}/settings#permissions`}>
            <ShieldCheck /> {m.permissions}
          </Link>
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          danger={status === "active"}
          onSelect={() =>
            start(async () => {
              const next = status === "active" ? "inactive" : "active";
              const res = await setClientStatusAction(id, next);
              if (res.ok)
                toast.success(
                  f(next === "inactive" ? m.disabledToast : m.enabledToast, {
                    name,
                  }),
                );
              else toast.error(res.error);
            })
          }
        >
          <Power /> {status === "active" ? m.disable : m.enable}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
