import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ 
        type: "spring",
        stiffness: 400,
        damping: 30,
        delay: index * 0.05,
      }}
      whileHover={disableHover ? undefined : { 
        y: -2,
        scale: 1.005,
        boxShadow: "0 12px 24px -8px rgba(0, 0, 0, 0.1)"
      }}
      whileTap={disableHover ? undefined : { scale: 0.995 }}
      onClick={onClick}
    >
      <Card className={cn("cursor-pointer transition-shadow h-full", className)}>
        {children}
      </Card>
    </motion.div>
  );
};
