import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Apple 2026 Experience: Page Transition with Blur Effect
 * Smooth fade + slide with subtle blur for depth
 */
export const PageTransition = ({ children, className }: PageTransitionProps) => (
  <motion.div
    initial={{
      opacity: 0,
      y: 12,
      filter: "blur(4px)"
    }}
    animate={{
      opacity: 1,
      y: 0,
      filter: "blur(0px)"
    }}
    exit={{
      opacity: 0,
      y: -8,
      filter: "blur(2px)"
    }}
    transition={{
      type: "spring",
      stiffness: 300,
      damping: 30,
      opacity: { duration: 0.2 },
      filter: { duration: 0.25 }
    }}
    className={className}
  >
    {children}
  </motion.div>
);
