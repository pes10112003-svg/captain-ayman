import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { OptionalTag } from "./optional-tag";

const field =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink shadow-card outline-none transition placeholder:text-muted/80 hover:border-line-strong focus:border-ring focus:ring-4 focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-crit aria-[invalid=true]:ring-crit/15";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(field, "h-10", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={cn(field, "min-h-20 py-2.5 leading-relaxed", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} aria-invalid={invalid || undefined} className={cn(field, "h-10 appearance-none pe-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
});

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-[13px] font-medium text-ink-2", className)}>
      {children}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
  optional,
}: {
  label?: ReactNode;
  htmlFor?: string;
  error?: string | string[];
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={htmlFor}>
          {label}
          {optional ? <OptionalTag /> : null}
        </Label>
      ) : null}
      {children}
      {msg ? (
        <p className="mt-1.5 text-xs font-medium text-crit-text" role="alert">
          {msg}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Input with a trailing unit label, e.g. "kg". */
export const UnitInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { unit: string; invalid?: boolean }>(
  function UnitInput({ unit, className, invalid, ...props }, ref) {
    return (
      <div className="relative">
        <Input ref={ref} invalid={invalid} className={cn("pe-12 tabular", className)} inputMode="decimal" {...props} />
        <span className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted">{unit}</span>
      </div>
    );
  },
);
