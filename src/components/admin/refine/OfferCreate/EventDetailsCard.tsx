import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, Users, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";

interface EventDetailsCardProps {
  preferredDate: string;
  eventEndDate: string;
  preferredTime: string;
  guestCount: string;
  eventType: string;
  onPreferredDateChange: (value: string) => void;
  onEventEndDateChange: (value: string) => void;
  onPreferredTimeChange: (value: string) => void;
  onGuestCountChange: (value: string) => void;
  onEventTypeChange: (value: string) => void;
}

const EVENT_TYPES = [
  { value: 'gruppenreservierung', label: 'Gruppenreservierung' },
  { value: 'firmendinner', label: 'Firmendinner' },
  { value: 'weihnachtsfeier', label: 'Weihnachtsfeier' },
  { value: 'sommerfest', label: 'Sommerfest' },
  { value: 'networking', label: 'Networking-Event' },
  { value: 'kundenabend', label: 'Kundenabend' },
  { value: 'produktpraesentation', label: 'Produktpräsentation' },
  { value: 'jubilaeum', label: 'Jubiläum' },
  { value: 'geburtstag', label: 'Geburtstag' },
  { value: 'hochzeit', label: 'Hochzeit' },
  { value: 'team-event', label: 'Team-Event' },
  { value: 'catering', label: 'Catering (extern)' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

function toDateObj(iso: string): Date | undefined {
  if (!iso) return undefined;
  const d = parseISO(iso);
  return isNaN(d.getTime()) ? undefined : d;
}

export const EventDetailsCard = ({
  preferredDate,
  eventEndDate,
  preferredTime,
  guestCount,
  eventType,
  onPreferredDateChange,
  onEventEndDateChange,
  onPreferredTimeChange,
  onGuestCountChange,
  onEventTypeChange,
}: EventDetailsCardProps) => {
  const handleStartChange = (date: Date | undefined) => {
    onPreferredDateChange(date ? format(date, 'yyyy-MM-dd') : '');
  };

  const handleEndChange = (date: Date | undefined) => {
    onEventEndDateChange(date ? format(date, 'yyyy-MM-dd') : '');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-4 w-4" />
          Event-Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Von</Label>
            <SmartDatePicker
              value={toDateObj(preferredDate)}
              onChange={handleStartChange}
              language="de"
              minLeadDays={1}
              skipSundays={true}
              quickSelectCount={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Bis (optional)</Label>
            <SmartDatePicker
              value={toDateObj(eventEndDate)}
              onChange={handleEndChange}
              language="de"
              minLeadDays={1}
              skipSundays={false}
              showQuickChips={false}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="preferred_time" className="text-sm flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Uhrzeit
          </Label>
          <Input
            id="preferred_time"
            type="time"
            value={preferredTime}
            onChange={(e) => onPreferredTimeChange(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="guest_count" className="text-sm flex items-center gap-1">
              <Users className="h-3 w-3" />
              Gäste
            </Label>
            <Input
              id="guest_count"
              value={guestCount}
              onChange={(e) => onGuestCountChange(e.target.value)}
              placeholder="z.B. 40"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event_type" className="text-sm flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Event-Art
            </Label>
            <Select value={eventType} onValueChange={onEventTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
