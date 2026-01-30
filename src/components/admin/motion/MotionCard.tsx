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
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      whileHover={disableHover ? undefined : { 
        y: -4, 
        scale: 1.02,
        boxShadow: "0 20px 40px -12px rgba(0, 0, 0, 0.15)"
      }}
      whileTap={disableHover ? undefined : { scale: 0.98 }}
      onClick={onClick}
    >
      <Card className={cn("cursor-pointer transition-shadow h-full", className)}>
        {children}
      </Card>
    </motion.div>
  );
};
