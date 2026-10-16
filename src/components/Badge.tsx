import type { ReactNode } from "react";

export type BadgeTone = "critical" | "neutral" | "info";
export type BadgeVariant = "label" | "count" | "dot" | "outline";

type Props = {
  children?: ReactNode;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  className?: string;
  title?: string;
};

/** Design System TU Badge (Figma 17:4367). */
export function Badge({
  children,
  tone = "critical",
  variant = "label",
  className = "",
  title,
}: Props) {
  const classes = [
    "ds-badge",
    `ds-badge--${tone}`,
    variant === "dot" ? "ds-badge--dot" : "",
    variant === "count" ? "ds-badge--count" : "",
    variant === "outline" ? "ds-badge--outline" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} title={title} aria-hidden={variant === "dot" && !title ? true : undefined}>
      {variant === "dot" ? null : children}
    </span>
  );
}
