import { useState } from "react";
import { Check, ChevronsUpDown, User, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getAdminDisplayName, getAdminInitials } from "@/lib/adminDisplayNames";

// Team members registry - could be moved to database later
const TEAM_MEMBERS = [
  { email: "monot@hey.com", name: "Antoine Monot", initials: "AM" },
  { email: "mimmo2905@yahoo.de", name: "Domenico Speranza", initials: "DS" },
  { email: "nicola@storia.de", name: "Nicola Speranza", initials: "NS" },
  { email: "madi@events-storia.de", name: "Madina Khader", initials: "MK" },
  { email: "madina.khader@gmail.com", name: "Madina Khader", initials: "MK" },
];

interface AssigneeSelectorProps {
  value: string | null;
  onChange: (email: string | null) => void;
  currentUserEmail?: string;
  disabled?: boolean;
  compact?: boolean;
}

export function AssigneeSelector({
  value,
  onChange,
  currentUserEmail,
  disabled = false,
  compact = false,
}: AssigneeSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedMember = value
    ? TEAM_MEMBERS.find((m) => m.email === value) || {
        email: value,
        name: getAdminDisplayName(value),
        initials: getAdminInitials(value),
      }
    : null;

  const handleSelect = (email: string) => {
    onChange(email === value ? null : email);
    setOpen(false);
  };

  const handleAssignToMe = () => {
    if (currentUserEmail) {
      onChange(currentUserEmail);
      setOpen(false);
    }
  };

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1.5 px-2",
              !value && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            {selectedMember ? (
              <>
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px] bg-primary/10">
                    {selectedMember.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs max-w-[80px] truncate">
                  {selectedMember.name.split(" ")[0]}
                </span>
              </>
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5" />
                <span className="text-xs">Zuweisen</span>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Team-Mitglied suchen..." className="h-9" />
            <CommandList>
              <CommandEmpty>Nicht gefunden.</CommandEmpty>
              {currentUserEmail && (
                <CommandGroup>
                  <CommandItem onSelect={handleAssignToMe}>
                    <User className="mr-2 h-4 w-4" />
                    Mir zuweisen
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading="Team">
                {TEAM_MEMBERS.map((member) => (
                  <CommandItem
                    key={member.email}
                    value={member.email}
                    onSelect={() => handleSelect(member.email)}
                  >
                    <Avatar className="h-6 w-6 mr-2">
                      <AvatarFallback className="text-[10px]">
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    {member.name}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value === member.email ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
              {value && (
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onChange(null)}
                    className="text-muted-foreground"
                  >
                    Zuweisung entfernen
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !value && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          {selectedMember ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-primary/10">
                  {selectedMember.initials}
                </AvatarFallback>
              </Avatar>
              <span>{selectedMember.name}</span>
            </div>
          ) : (
            <span>Nicht zugewiesen</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder="Team-Mitglied suchen..." className="h-9" />
          <CommandList>
            <CommandEmpty>Kein Team-Mitglied gefunden.</CommandEmpty>
            {currentUserEmail && (
              <CommandGroup>
                <CommandItem onSelect={handleAssignToMe}>
                  <User className="mr-2 h-4 w-4" />
                  Mir zuweisen
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Team">
              {TEAM_MEMBERS.map((member) => (
                <CommandItem
                  key={member.email}
                  value={member.email}
                  onSelect={() => handleSelect(member.email)}
                >
                  <Avatar className="h-6 w-6 mr-2">
                    <AvatarFallback className="text-xs">
                      {member.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span>{member.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </div>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === member.email ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            {value && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => onChange(null)}
                  className="text-muted-foreground"
                >
                  Zuweisung entfernen
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Badge component for displaying assignee in lists
export function AssigneeBadge({ email }: { email: string | null }) {
  if (!email) return null;

  const name = getAdminDisplayName(email);
  const initials = getAdminInitials(email);

  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <Avatar className="h-4 w-4">
        <AvatarFallback className="text-[8px] bg-primary/10">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="max-w-[60px] truncate">{name.split(" ")[0]}</span>
    </Badge>
  );
}
