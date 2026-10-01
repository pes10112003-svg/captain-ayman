"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** Password field with a show/hide toggle. Always left-to-right (passwords are Latin text). */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean; defaultVisible?: boolean }>(
  function PasswordInput({ className, defaultVisible = false, ...props }, ref) {
    const { t } = useI18n();
    const [show, setShow] = useState(defaultVisible);
    return (
      <div className="relative" dir="ltr">
        <Input ref={ref} type={show ? "text" : "password"} spellCheck={false} autoCapitalize="none" className={cn("pr-11 font-mono", className)} {...props} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
          aria-label={show ? t.auth.hidePassword : t.auth.showPassword}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
