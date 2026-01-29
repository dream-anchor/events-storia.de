import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, Users, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";

interface EventDetailsCardProps {
  preferredDate: string;
  preferredTime: string;
  guestCount: string;
  eventType: string;
  onPreferredDateChange: (value: string) => void;
  onPreferredTimeChange: (value: string) => void;
  onGuestCountChange: (value: string) => void;
  onEventTypeChange: (value: string) => void;
}

const EVENT_TYPES = [
  { value: 'firmendinner', label: 'Firmendinner' },
  { value: 'weihnachtsfeier', label: 'Weihnachtsfeier' },
  { value: 'sommerfest', label: 'Sommerfest' },
  { value: 'networking', label: 'Networking-Event' },
  { value: 'kundenabend', label: 'Kundenabend' },
  { value: 'produktpraesentation', label: 'Produktpräsentation' },
  { value: 'jubilaeum', label: 'Jubiläum' },
  { value: 'team-event', label: 'Team-Event' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

export const EventDetailsCard = ({
  preferredDate,
  preferredTime,
  guestCount,
  eventType,
  onPreferredDateChange,
  onPreferredTimeChange,
  onGuestCountChange,
  onEventTypeChange,
}: EventDetailsCardProps) => {
  // Convert string date to Date object for SmartDatePicker
  const dateValue = preferredDate ? parseISO(preferredDate) : undefined;
  
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      onPreferredDateChange(format(date, 'yyyy-MM-dd'));
    } else {
      onPreferredDateChange('');
    }
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
        <div className="space-y-1.5">
          <Label className="text-sm">Datum</Label>
          <SmartDatePicker
            value={dateValue}
            onChange={handleDateChange}
            language="de"
            minLeadDays={1}
            skipSundays={true}
            quickSelectCount={3}
          />
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
