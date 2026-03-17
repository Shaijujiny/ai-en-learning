/**
 * AI English — Design System Component Library
 *
 * Import everything from here:
 *   import { Card, Button, Tag, Progress, Avatar, Input } from "@/components/ui";
 *
 * All components use the ds-* CSS classes defined in globals.css.
 * Styling tokens live in :root — no magic Tailwind strings scattered in pages.
 */

"use client";

import Link from "next/link";
import {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
} from "react";

/* ─── Utility ─────────────────────────────────────────────────────── */
function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ═══════════════════════════════════════════════════════════════════
   CARD
   ═══════════════════════════════════════════════════════════════════ */
type CardVariant = "default" | "flat" | "sm" | "primary" | "accent" | "warning" | "danger";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
  children: ReactNode;
}

const CARD_CLASSES: Record<CardVariant, string> = {
  default:  "ds-card",
  flat:     "ds-card-flat",
  sm:       "ds-card-sm",
  primary:  "ds-card-primary",
  accent:   "ds-card-accent",
  warning:  "ds-card-warning",
  danger:   "ds-card-danger",
};

export function Card({
  variant = "default",
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx(CARD_CLASSES[variant], interactive && "ds-card-interactive", className)}
      {...rest}
    >
      {children}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   BUTTON
   ═══════════════════════════════════════════════════════════════════ */
type ButtonVariant = "primary" | "accent" | "warning" | "ghost" | "danger";
type ButtonSize    = "xs" | "sm" | "md" | "lg" | "xl";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  loading?: boolean;
  icon?: boolean;   // icon-only square shape
  children?: ReactNode;
}

const BTN_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "ds-btn-primary",
  accent:  "ds-btn-accent",
  warning: "ds-btn-warning",
  ghost:   "ds-btn-ghost",
  danger:  "ds-btn-danger",
};

const BTN_SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: "ds-btn-xs",
  sm: "ds-btn-sm",
  md: "",
  lg: "ds-btn-lg",
  xl: "ds-btn-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "ghost",
    size = "md",
    pill = false,
    loading = false,
    icon = false,
    className,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        "ds-btn",
        BTN_VARIANT_CLASSES[variant],
        BTN_SIZE_CLASSES[size],
        pill && "ds-btn-pill",
        icon && "ds-btn-icon",
        className,
      )}
      disabled={disabled ?? loading}
      {...rest}
    >
      {loading ? <span className="ds-btn-spinner" aria-hidden /> : children}
    </button>
  );
});


/* ─── LinkButton — same visual as Button but renders an <a> ───────── */
interface LinkButtonProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  icon?: boolean;
  className?: string;
  children?: ReactNode;
  external?: boolean;
}

export function LinkButton({
  href,
  variant = "ghost",
  size = "md",
  pill = false,
  icon = false,
  className,
  children,
  external = false,
}: LinkButtonProps) {
  const cls = cx(
    "ds-btn",
    BTN_VARIANT_CLASSES[variant],
    BTN_SIZE_CLASSES[size],
    pill && "ds-btn-pill",
    icon && "ds-btn-icon",
    className,
  );
  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   TAG / BADGE
   ═══════════════════════════════════════════════════════════════════ */
type TagVariant = "primary" | "accent" | "warning" | "danger" | "neutral"
                | "beginner" | "intermediate" | "advanced";

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariant;
  dot?: boolean;
  children: ReactNode;
}

const TAG_CLASSES: Record<TagVariant, string> = {
  primary:      "ds-tag-primary",
  accent:       "ds-tag-accent",
  warning:      "ds-tag-warning",
  danger:       "ds-tag-danger",
  neutral:      "ds-tag-neutral",
  beginner:     "ds-tag-beginner",
  intermediate: "ds-tag-intermediate",
  advanced:     "ds-tag-advanced",
};

export function Tag({
  variant = "neutral",
  dot = false,
  className,
  children,
  ...rest
}: TagProps) {
  return (
    <span
      className={cx("ds-tag", TAG_CLASSES[variant], dot && "ds-tag-dot", className)}
      {...rest}
    >
      {children}
    </span>
  );
}

/** XP / reward amount badge */
export function XpBadge({ xp, className }: { xp: number; className?: string }) {
  return (
    <span className={cx("ds-xp-badge", className)}>
      ⚡ +{xp} XP
    </span>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   PROGRESS BAR
   ═══════════════════════════════════════════════════════════════════ */
type ProgressVariant = "primary" | "accent" | "warning" | "danger" | "neutral";
type ProgressSize    = "sm" | "md" | "lg" | "xl" | "default";

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;           // 0–100
  variant?: ProgressVariant;
  size?: ProgressSize;
  scored?: boolean;        // auto-color by score value
  label?: string;          // accessible label
}

const PROG_FILL: Record<ProgressVariant, string> = {
  primary: "ds-progress-fill-primary",
  accent:  "ds-progress-fill-accent",
  warning: "ds-progress-fill-warning",
  danger:  "ds-progress-fill-danger",
  neutral: "ds-progress-fill-neutral",
};

const PROG_SIZE: Record<ProgressSize, string> = {
  default: "",
  sm:  "ds-progress-sm",
  md:  "ds-progress-md",
  lg:  "ds-progress-lg",
  xl:  "ds-progress-xl",
};

function scoreAttr(val: number): "high" | "mid" | "low" {
  return val >= 68 ? "high" : val >= 48 ? "mid" : "low";
}

export function Progress({
  value,
  variant = "primary",
  size = "default",
  scored = false,
  label,
  className,
  ...rest
}: ProgressProps) {
  const pct = Math.max(0, Math.min(value, 100));
  return (
    <div
      className={cx("ds-progress", PROG_SIZE[size], className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      {...rest}
    >
      <div
        className={cx(
          "ds-progress-fill",
          scored ? "ds-progress-fill-scored" : PROG_FILL[variant],
        )}
        data-score={scored ? scoreAttr(pct) : undefined}
        style={{ width: `${Math.max(3, pct)}%` }}
      />
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   AVATAR
   ═══════════════════════════════════════════════════════════════════ */
type AvatarVariant = "primary" | "accent" | "warning" | "neutral";
type AvatarSize    = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  initials?: string;
  emoji?: string;
  variant?: AvatarVariant;
  size?: AvatarSize;
  square?: boolean;
  ring?: boolean;
}

const AVATAR_VARIANT: Record<AvatarVariant, string> = {
  primary: "ds-avatar-primary",
  accent:  "ds-avatar-accent",
  warning: "ds-avatar-warning",
  neutral: "ds-avatar-neutral",
};

const AVATAR_SIZE: Record<AvatarSize, string> = {
  xs:  "ds-avatar-xs",
  sm:  "ds-avatar-sm",
  md:  "ds-avatar-md",
  lg:  "ds-avatar-lg",
  xl:  "ds-avatar-xl",
  "2xl": "ds-avatar-2xl",
};

export function Avatar({
  initials,
  emoji,
  variant = "primary",
  size = "md",
  square = false,
  ring = false,
  className,
  ...rest
}: AvatarProps) {
  return (
    <div
      className={cx(
        "ds-avatar",
        AVATAR_VARIANT[variant],
        AVATAR_SIZE[size],
        square && "ds-avatar-square",
        ring && "ds-avatar-ring",
        className,
      )}
      {...rest}
    >
      {emoji ?? initials}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   INPUT
   ═══════════════════════════════════════════════════════════════════ */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, label, hint, className, id, ...rest },
  ref,
) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="ds-label">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cx("ds-input", error && "ds-input-error", className)}
        {...rest}
      />
      {hint && (
        <p className="text-xs" style={{ color: error ? "var(--danger-text)" : "var(--text-dim)" }}>
          {hint}
        </p>
      )}
    </div>
  );
});

/* ─── Textarea ──────────────────────────────────────────────────── */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  label?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { error, label, hint, className, id, ...rest },
  ref,
) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="ds-label">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={cx("ds-input ds-textarea", error && "ds-input-error", className)}
        {...rest}
      />
      {hint && (
        <p className="text-xs" style={{ color: error ? "var(--danger-text)" : "var(--text-dim)" }}>
          {hint}
        </p>
      )}
    </div>
  );
});

/* ─── Select ────────────────────────────────────────────────────── */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, className, id, children, ...rest },
  ref,
) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="ds-label">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={cx("ds-input ds-select", className)}
        {...rest}
      >
        {children}
      </select>
      {hint && <p className="text-xs" style={{ color: "var(--text-dim)" }}>{hint}</p>}
    </div>
  );
});


/* ═══════════════════════════════════════════════════════════════════
   SECTION LABEL
   ═══════════════════════════════════════════════════════════════════ */
type LabelColor = "default" | "primary" | "accent" | "warning" | "danger";

interface SectionLabelProps extends HTMLAttributes<HTMLParagraphElement> {
  color?: LabelColor;
  children: ReactNode;
}

const LABEL_COLOR: Record<LabelColor, string> = {
  default: "",
  primary: "ds-label-primary",
  accent:  "ds-label-accent",
  warning: "ds-label-warning",
  danger:  "ds-label-danger",
};

export function SectionLabel({ color = "default", className, children, ...rest }: SectionLabelProps) {
  return (
    <p className={cx("ds-label", LABEL_COLOR[color], className)} {...rest}>
      {children}
    </p>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   SCORE DISPLAY
   ═══════════════════════════════════════════════════════════════════ */
interface ScoreProps {
  value: number;
  small?: boolean;
  className?: string;
}

export function Score({ value, small = false, className }: ScoreProps) {
  const color = value >= 68 ? "ds-score-high" : value >= 48 ? "ds-score-mid" : "ds-score-low";
  return (
    <span className={cx(small ? "ds-score-sm" : "ds-score", color, className)}>
      {Math.round(value)}
    </span>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   DIVIDER
   ═══════════════════════════════════════════════════════════════════ */
export function Divider({ vertical = false, className }: { vertical?: boolean; className?: string }) {
  return <hr className={cx(vertical ? "ds-divider-vertical" : "ds-divider", className)} />;
}


/* ═══════════════════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════════════════ */
interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "title" | "card" | "circle";
  width?: string;
  height?: string;
}

export function Skeleton({ variant = "text", width, height, className, style, ...rest }: SkeletonProps) {
  const variantClass =
    variant === "title" ? "ds-skeleton-title" :
    variant === "card"  ? "ds-skeleton-card"  :
    variant === "circle" ? "rounded-full" : "ds-skeleton-text";

  return (
    <div
      className={cx("ds-skeleton", variantClass, className)}
      style={{ width, height, ...style }}
      {...rest}
    />
  );
}


/* ═══════════════════════════════════════════════════════════════════
   NAV LINK
   ═══════════════════════════════════════════════════════════════════ */
interface NavLinkProps {
  href: string;
  active?: boolean;
  className?: string;
  children: ReactNode;
}

export function NavLink({ href, active = false, className, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={cx("ds-nav-link", active && "ds-nav-link-active", className)}
    >
      {children}
    </Link>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   TAB BAR
   ═══════════════════════════════════════════════════════════════════ */
interface TabItem {
  key: string;
  label: ReactNode;
}

interface TabBarProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function TabBar({ tabs, active, onChange, className }: TabBarProps) {
  return (
    <div className={cx("ds-tab-bar", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={cx("ds-tab", active === tab.key && "ds-tab-active")}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   MODAL
   ═══════════════════════════════════════════════════════════════════ */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}

export function Modal({ open, onClose, children, className, maxWidth }: ModalProps) {
  if (!open) return null;
  return (
    <div className="ds-overlay" onClick={onClose}>
      <div
        className={cx("ds-modal", className)}
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   ERROR / ALERT BANNERS
   ═══════════════════════════════════════════════════════════════════ */
type AlertVariant = "primary" | "accent" | "warning" | "danger";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  onDismiss?: () => void;
  children: ReactNode;
}

const ALERT_CLASSES: Record<AlertVariant, string> = {
  primary: "ds-card-primary",
  accent:  "ds-card-accent",
  warning: "ds-card-warning",
  danger:  "ds-card-danger",
};

export function Alert({ variant = "danger", onDismiss, className, children, ...rest }: AlertProps) {
  return (
    <div
      className={cx(ALERT_CLASSES[variant], "flex items-start gap-3 text-sm", className)}
      style={{ borderRadius: "var(--r-xl)", padding: "0.875rem 1rem" }}
      role="alert"
      {...rest}
    >
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button
          className="flex-shrink-0 opacity-50 hover:opacity-100 transition text-xs"
          onClick={onDismiss}
          type="button"
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   STAT CARD  (metric display)
   ═══════════════════════════════════════════════════════════════════ */
interface StatCardProps {
  icon: string;
  label: string;
  value: ReactNode;
  sub?: string;
  variant?: CardVariant;
  className?: string;
}

export function StatCard({ icon, label, value, sub, variant = "flat", className }: StatCardProps) {
  return (
    <Card variant={variant} className={className}>
      <p className="text-xl mb-1">{icon}</p>
      <p className="ds-label mb-1">{label}</p>
      <p className="text-2xl font-black" style={{ color: "var(--text)", lineHeight: 1 }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>{sub}</p>}
    </Card>
  );
}
