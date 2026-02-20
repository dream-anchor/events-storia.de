import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Clock, Users, MapPin, User, Phone, Mail, Building2, MessageSquare, UserCircle, Flag, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AssigneeSelector } from "@/components/admin/shared/AssigneeSelector";
import { PrioritySelector } from "@/components/admin/shared/PrioritySelector";
import { InquiryPriority } from "@/types/refine";
import { ExtendedInquiry } from "./types";
import { useState } from "react";

interface EventDNACardProps {
  inquiry: ExtendedInquiry;
  onFieldChange: (field: keyof ExtendedInquiry, value: unknown) => void;
  isReadOnly?: boolean;
  currentUserEmail?: string;
  onAssigneeChange?: (email: string | null) => void;
  onPriorityChange?: (priority: InquiryPriority) => void;
}

export const EventDNACard = ({
  inquiry,
  onFieldChange,
  isReadOnly = false,
  currentUserEmail,
  onAssigneeChange,
  onPriorityChange
}: EventDNACardProps) => {
  const [showMessage, setShowMessage] = useState(false);

  return (
    <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-primary text-sm font-bold">DNA</span>
          </div>
          Event DNA
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Event Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Event Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Event-Datum</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={inquiry.preferred_date || ''}
                onChange={(e) => onFieldChange('preferred_date', e.target.value)}
                disabled={isReadOnly}
                className="pl-10 h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg"
              />
            </div>
          </div>

          {/* Time Slot */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Uhrzeit</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={inquiry.time_slot || ''}
                onChange={(e) => onFieldChange('time_slot', e.target.value)}
                disabled={isReadOnly}
                className="pl-10 h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg"
              />
            </div>
          </div>

          {/* Guest Count */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Anzahl Gäste</Label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                value={inquiry.guest_count || ''}
                onChange={(e) => onFieldChange('guest_count', e.target.value)}
                disabled={isReadOnly}
                placeholder="0"
                className="pl-10 h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg"
              />
            </div>
          </div>

          {/* Location - Full Width */}
          <div className="md:col-span-3 space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={inquiry.venue || inquiry.delivery_address || ''}
                onChange={(e) => onFieldChange('venue', e.target.value)}
                disabled={isReadOnly}
                placeholder="Veranstaltungsort oder Adresse"
                className="pl-10 h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="pt-4 border-t border-border/40">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Kontaktinformationen
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Ansprechpartner</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={inquiry.contact_name || ''}
                  onChange={(e) => onFieldChange('contact_name', e.target.value)}
                  disabled={isReadOnly}
                  className="pl-10 h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Telefon</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  value={inquiry.phone || ''}
                  onChange={(e) => onFieldChange('phone', e.target.value)}
                  disabled={isReadOnly}
                  className="pl-10 h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg"
                />
              </div>
            </div>

            {/* Company */}
            {inquiry.company_name && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Firma</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={inquiry.company_name || ''}
                    onChange={(e) => onFieldChange('company_name', e.target.value)}
                    disabled={isReadOnly}
                    className="pl-10 h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* Email - Full Width if no company */}
            <div className={inquiry.company_name ? "space-y-2" : "md:col-span-2 space-y-2"}>
              <Label className="text-sm font-medium text-muted-foreground">E-Mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={inquiry.email || ''}
                  onChange={(e) => onFieldChange('email', e.target.value)}
                  disabled={isReadOnly}
                  className="pl-10 h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Assignee & Priority Section */}
        <div className="pt-4 border-t border-border/40">
          <div className="grid grid-cols-2 gap-4">
            {/* Assignee */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <UserCircle className="h-3.5 w-3.5" />
                Zugewiesen an
              </Label>
              <AssigneeSelector
                value={inquiry.assigned_to || null}
                onChange={(email) => onAssigneeChange?.(email)}
                currentUserEmail={currentUserEmail}
                disabled={!onAssigneeChange}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5" />
                Priorität
              </Label>
              <PrioritySelector
                value={inquiry.priority || 'normal'}
                onChange={(priority) => onPriorityChange?.(priority)}
                disabled={!onPriorityChange}
              />
            </div>
          </div>
        </div>

        {/* Original Customer Message Section */}
        {inquiry.message && (
          <div className="pt-4 border-t border-border/40">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Originale Kundenanfrage
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMessage(!showMessage)}
                className="h-6 px-2 text-xs"
              >
                {showMessage ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Einklappen
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Anzeigen
                  </>
                )}
              </Button>
            </div>
            {showMessage && (
              <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-200/50 dark:border-amber-800/30">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {inquiry.message}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
