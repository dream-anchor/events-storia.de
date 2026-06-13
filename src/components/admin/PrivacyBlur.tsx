import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Kind = "money" | "customer" | "contact";

interface PrivacyBlurProps {
  children: ReactNode;
  kind?: Kind;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}

/**
 * Marks content as sensitive. Visual blurring is driven globally by
 * `body[data-privacy="on"]` (see index.css). When privacy mode is off,
 * the wrapper is a transparent passthrough.
 *
 * Use:
 *  - kind="money"    → all currency amounts
 *  - kind="customer" → customer name, company
 *  - kind="contact"  → email, phone, address
 */
export function PrivacyBlur({ children, kind = "money", as: Tag = "span", className }: PrivacyBlurProps) {
  const Comp = Tag as any;
  return (
    <Comp data-sensitive={kind} className={cn("privacy-blur-target", className)}>
      {children}
    </Comp>
  );
}