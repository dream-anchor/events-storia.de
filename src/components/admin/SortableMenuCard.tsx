import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ReactNode } from "react";

interface SortableMenuCardProps {
  id: string;
  children: ReactNode;
}

const SortableMenuCard = ({ id, children }: SortableMenuCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Touch-optimized drag handle - 44x44px minimum touch target */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 z-10 cursor-grab active:cursor-grabbing 
                   flex items-center justify-center w-12 md:w-10 
                   touch-manipulation select-none
                   hover:bg-muted/50 active:bg-muted transition-colors
                   rounded-l-lg"
        aria-label="Ziehen zum Sortieren"
        style={{ touchAction: 'none' }}
      >
        <GripVertical className="h-6 w-6 md:h-5 md:w-5 text-muted-foreground" />
      </div>
      <div className="pl-12 md:pl-10">
        {children}
      </div>
    </div>
  );
};

export default SortableMenuCard;
