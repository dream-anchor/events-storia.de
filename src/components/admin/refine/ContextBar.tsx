import { ArrowLeft, Calendar, Users, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface ContextBarProps {
  title: string;
  subtitle?: string;
  backPath?: string;
  status?: string;
  date?: string;
  guestCount?: number | string;
  eventType?: string;
}

export const ContextBar = ({
  title,
  subtitle,
  backPath = "/admin/events",
  status,
  date,
  guestCount,
  eventType,
}: ContextBarProps) => {
  const navigate = useNavigate();

  const formattedDate = date 
    ? format(parseISO(date), "dd.MM.yyyy", { locale: de })
    : null;

  return (
    <div className="flex items-center gap-4 py-3 px-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800/60 -mx-4 mb-6 rounded-t-xl">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => navigate(backPath)}
        className="h-8 w-8 shrink-0"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-semibold text-lg truncate">{title}</h1>
          {status && (
            <Badge variant="outline" className="shrink-0">
              {status}
            </Badge>
          )}
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>

      <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
        {formattedDate && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>{formattedDate}</span>
          </div>
        )}
        {guestCount && (
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>{guestCount} Gäste</span>
          </div>
        )}
        {eventType && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            <span>{eventType}</span>
          </div>
        )}
      </div>
    </div>
  );
};