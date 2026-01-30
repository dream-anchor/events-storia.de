import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { ReactNode } from "react";
import { Trash2, Archive, CheckCircle2 } from "lucide-react";

interface SwipeableCardProps {
  children: ReactNode;
  onDelete?: () => void;
  onArchive?: () => void;
  deleteThreshold?: number;
  archiveThreshold?: number;
}

export const SwipeableCard = ({ 
  children, 
  onDelete,
  onArchive,
  deleteThreshold = -100,
  archiveThreshold = 100,
}: SwipeableCardProps) => {
  const x = useMotionValue(0);
  
  // Transform for delete action (swipe left)
  const deleteOpacity = useTransform(
    x,
    [deleteThreshold, deleteThreshold / 2, 0],
    [1, 0.5, 0]
  );
  
  // Transform for archive action (swipe right)
  const archiveOpacity = useTransform(
    x,
    [0, archiveThreshold / 2, archiveThreshold],
    [0, 0.5, 1]
  );
  
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < deleteThreshold && onDelete) {
      onDelete();
    } else if (info.offset.x > archiveThreshold && onArchive) {
      onArchive();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete Action Background (left side) */}
      {onDelete && (
        <motion.div 
          className="absolute inset-y-0 left-0 w-24 flex items-center justify-center bg-destructive"
          style={{ opacity: deleteOpacity }}
        >
          <Trash2 className="h-5 w-5 text-destructive-foreground" />
        </motion.div>
      )}
      
      {/* Archive Action Background (right side) */}
      {onArchive && (
        <motion.div 
          className="absolute inset-y-0 right-0 w-24 flex items-center justify-center bg-primary"
          style={{ opacity: archiveOpacity }}
        >
          <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
        </motion.div>
      )}
      
      {/* Swipeable Content */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className="relative z-10 bg-card rounded-2xl touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
};
