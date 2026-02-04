import { motion, type Transition } from "framer-motion";
import { Card } from "@/components/ui/card";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Apple 2026 Experience: Spring Configuration
 * Natural, bouncy feel with controlled overshoot
 */
const appleSpring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};

const hoverSpring: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 25,
};

interface MotionCardProps {
  index?: number;
  children: ReactNode;
  disableHover?: boolean;
  className?: string;
  onClick?: () => void;
}

export const MotionCard = ({
  className,
  index = 0,
  children,
  disableHover = false,
  onClick
}: MotionCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      transition={{
        ...appleSpring,
        delay: index * 0.04,
        opacity: { duration: 0.2 }
      }}
      whileHover={disableHover ? undefined : {
        y: -4,
        scale: 1.008,
        boxShadow: "0 16px 32px -12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        transition: hoverSpring
      }}
      whileTap={disableHover ? undefined : {
        scale: 0.98,
        transition: { duration: 0.1 }
      }}
      onClick={onClick}
    >
      <Card className={cn("cursor-pointer transition-shadow h-full", className)}>
        {children}
      </Card>
    </motion.div>
  );
};
