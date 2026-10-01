import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none [&_svg]:shrink-0";

const variants = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover shadow-card",
  brand: "bg-brand text-brand-ink hover:brightness-95 shadow-card",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2 shadow-card",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-crit text-white hover:brightness-95 shadow-card",
  "danger-ghost": "text-crit-text hover:bg-crit-soft",
  link: "text-ink underline-offset-4 hover:underline px-0 h-auto",
} as const;

const sizes = {
  xs: "h-7 px-2.5 text-xs rounded-lg [&_svg]:size-3.5",
  sm: "h-8 px-3 text-[13px] [&_svg]:size-4",
  md: "h-10 px-4 text-sm [&_svg]:size-4",
  lg: "h-12 px-5 text-[15px] [&_svg]:size-5",
  xl: "h-14 px-6 text-base rounded-2xl [&_svg]:size-5",
  icon: "size-10 [&_svg]:size-[18px]",
  "icon-sm": "size-8 rounded-lg [&_svg]:size-4",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };
export function LinkButton({ variant = "primary", size = "md", className, ...props }: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
