"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

type Result = { id: string; fullName: string; email: string; phone: string | null; code: string; status: string; avatarKey: string | null };

/** Global client search: name, email, phone or client ID. Press ⌘K / Ctrl+K or "/" to focus. */
export function GlobalSearch({ className }: { className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) {
          const data = (await res.json()) as { results: Result[] };
          setResults(data.results);
          setActive(0);
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  // Results for an empty query are never shown (derived, not stored).
  const shown = q.trim() ? results : [];

  const go = (r: Result) => {
    setOpen(false);
    setQ("");
    router.push(`/coach/clients/${r.id}`);
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && shown[active]) {
            e.preventDefault();
            go(shown[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder={t.search.placeholder}
        className="h-10 w-full rounded-xl border border-line bg-surface-2 pe-14 ps-9 text-sm text-ink outline-none transition placeholder:text-muted focus:border-ring focus:bg-surface focus:ring-4 focus:ring-ring/15"
        role="combobox"
        aria-expanded={open && q.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={t.search.label}
      />
      <kbd dir="ltr" className="pointer-events-none absolute end-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted sm:block">
        ⌘K
      </kbd>
      {open && q.trim() ? (
        <div className="absolute inset-x-0 top-12 z-40 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop animate-fade-in">
          {loading && !shown.length ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> {t.common.searching}
            </div>
          ) : shown.length ? (
            <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto p-1.5">
              {shown.map((r, i) => (
                <li key={r.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(r)}
                    onMouseEnter={() => setActive(i)}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start", i === active ? "bg-surface-2" : "")}
                  >
                    <Avatar name={r.fullName} clientId={r.id} avatarKey={r.avatarKey} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{r.fullName}</span>
                      <span className="block truncate text-xs text-muted">
                        <span dir="ltr">{r.email}</span>
                        {r.phone ? (
                          <>
                            {" · "}
                            <span dir="ltr">{r.phone}</span>
                          </>
                        ) : null}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-muted" dir="ltr">
                      {r.code}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">{t.search.none}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
