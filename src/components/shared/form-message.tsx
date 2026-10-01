import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormMessage({ tone = "error", children, className }: { tone?: "error" | "success" | "info"; children: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm",
        tone === "error" ? "bg-crit-soft text-crit-text" : tone === "success" ? "bg-good-soft text-good-text" : "bg-info-soft text-info-text",
        className,
      )}
    >
      {tone === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}
