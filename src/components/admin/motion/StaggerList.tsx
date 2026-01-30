import { motion, AnimatePresence } from "framer-motion";
import { ReactNode, Children, isValidElement, cloneElement } from "react";

interface StaggerListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export const StaggerList = ({ 
  children, 
  className,
  staggerDelay = 0.05 
}: StaggerListProps) => {
  const childArray = Children.toArray(children);

  return (
    <div className={className}>
      <AnimatePresence mode="popLayout">
        {childArray.map((child, index) => (
          <motion.div
            key={isValidElement(child) && child.key ? child.key : index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ 
              delay: index * staggerDelay,
              duration: 0.3,
              ease: [0.25, 0.1, 0.25, 1]
            }}
          >
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
