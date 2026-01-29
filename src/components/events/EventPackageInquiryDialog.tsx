import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Users, Building2, User, Mail, Phone, MessageSquare, ArrowRight, ArrowLeft, Loader2, CheckCircle, Send } from "lucide-react";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

interface EventPackageInquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageId: string;
  packageName: string;
  packageNameEn?: string | null;
  initialGuestCount: number;
  pricePerPerson: number;
  minGuests?: number;
}

// Validation schema factory - dynamic based on minGuests
const createStep1Schema = (minGuests: number) => z.object({
  date: z.date({ required_error: "Datum erforderlich" }),
  time: z.string().min(1, "Uhrzeit erforderlich"),
  guestCount: z.number().min(minGuests, `Mindestens ${minGuests} Gäste`),
});

const step2Schema = z.object({
  company: z.string().min(2, "Firmenname erforderlich").max(100),
  name: z.string().min(2, "Name erforderlich").max(100),
  email: z.string().email("Ungültige E-Mail").max(255),
  phone: z.string().max(30).optional().or(z.literal("")),
  message: z.string().max(2000).optional().or(z.literal("")),
});

const EventPackageInquiryDialog = ({
  open,
  onOpenChange,
  packageId,
  packageName,
  packageNameEn,
  initialGuestCount,
  pricePerPerson,
  minGuests = 10,
}: EventPackageInquiryDialogProps) => {
  const { language } = useLanguage();
  const { formatPrice } = usePriceDisplay();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    date: undefined as Date | undefined,
    time: "19:00",
    guestCount: initialGuestCount,
    company: "",
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const displayName = language === "en" && packageNameEn ? packageNameEn : packageName;
  const estimatedTotal = pricePerPerson * formData.guestCount;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateStep1 = () => {
    const step1Schema = createStep1Schema(minGuests);
    const result = step1Schema.safeParse({
      date: formData.date,
      time: formData.time,
      guestCount: formData.guestCount,
    });
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const validateStep2 = () => {
    const result = step2Schema.safeParse({
      company: formData.company,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      message: formData.message,
    });
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    
    setIsSubmitting(true);
    
    try {
      // Insert into event_inquiries
      const { error } = await supabase.from("event_inquiries").insert({
        company_name: formData.company,
        contact_name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        guest_count: formData.guestCount.toString(),
        preferred_date: formData.date ? format(formData.date, "yyyy-MM-dd") : null,
        time_slot: formData.time,
        event_type: displayName,
        message: formData.message || null,
        source: "package_inquiry",
        inquiry_type: "event",
        status: "new",
        selected_packages: [{ id: packageId, name: packageName, price: pricePerPerson }],
      });

      if (error) throw error;

      // Send notification
      await supabase.functions.invoke("receive-event-inquiry", {
        body: {
          companyName: formData.company,
          contactName: formData.name,
          email: formData.email,
          phone: formData.phone,
          guestCount: formData.guestCount,
          preferredDate: formData.date ? format(formData.date, "dd.MM.yyyy") : null,
          timeSlot: formData.time,
          eventType: displayName,
          message: formData.message,
          source: "package_inquiry",
        },
      });

      setIsSuccess(true);
      
      // Reset after delay
      setTimeout(() => {
        onOpenChange(false);
        setIsSuccess(false);
        setStep(1);
        setFormData({
          date: undefined,
          time: "19:00",
          guestCount: initialGuestCount,
          company: "",
          name: "",
          email: "",
          phone: "",
          message: "",
        });
      }, 3000);
    } catch (error) {
      console.error("Inquiry submission error:", error);
      toast.error(
        language === "de"
          ? "Fehler beim Senden. Bitte versuchen Sie es erneut."
          : "Error sending. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-serif font-medium mb-2">
              {language === "de" ? "Anfrage gesendet!" : "Request sent!"}
            </h3>
            <p className="text-muted-foreground">
              {language === "de"
                ? "Wir melden uns schnellstmöglich bei Ihnen."
                : "We will get back to you as soon as possible."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {language === "de" ? "Individuelles Angebot" : "Custom Quote"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === "de"
              ? "Füllen Sie das Formular aus, um ein individuelles Angebot zu erhalten"
              : "Fill out the form to receive a custom quote"}
          </DialogDescription>
        </DialogHeader>

        {/* Package Info */}
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {language === "de" ? "Ausgewähltes Paket" : "Selected package"}
              </p>
              <p className="font-medium">{displayName}</p>
            </div>
            <Badge variant="secondary">{formatPrice(pricePerPerson)} p.P.</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {language === "de"
              ? "(kann im Gespräch noch geändert werden)"
              : "(can still be changed in discussion)"}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
              step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            1
          </div>
          <div className="flex-1 h-0.5 bg-muted">
            <div
              className={cn(
                "h-full bg-primary transition-all",
                step >= 2 ? "w-full" : "w-0"
              )}
            />
          </div>
          <div
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
              step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            2
          </div>
        </div>

        {/* Step 1: Event Details */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {language === "de" ? "Schritt 1/2: Event-Details" : "Step 1/2: Event Details"}
            </p>

            {/* Date Picker */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {language === "de" ? "Gewünschtes Datum *" : "Preferred Date *"}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.date && "text-muted-foreground",
                      errors.date && "border-destructive"
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {formData.date
                      ? format(formData.date, "PPP", { locale: language === "de" ? de : enUS })
                      : language === "de"
                      ? "Datum wählen..."
                      : "Select date..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => {
                      setFormData((prev) => ({ ...prev, date }));
                      if (errors.date) setErrors((prev) => ({ ...prev, date: "" }));
                    }}
                    disabled={(date) => date < new Date()}
                    locale={language === "de" ? de : enUS}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>

            {/* Time Input */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {language === "de" ? "Uhrzeit" : "Time"}
              </Label>
              <Input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleInputChange}
                className={cn(errors.time && "border-destructive")}
              />
              {errors.time && <p className="text-xs text-destructive">{errors.time}</p>}
            </div>

            {/* Guest Count */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {language === "de" ? `Anzahl Gäste * (min. ${minGuests})` : `Number of Guests * (min. ${minGuests})`}
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      guestCount: Math.max(minGuests, prev.guestCount - 1),
                    }))
                  }
                  disabled={formData.guestCount <= minGuests}
                >
                  <span className="text-lg font-medium">−</span>
                </Button>
                <Input
                  type="number"
                  name="guestCount"
                  value={formData.guestCount}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty input for typing
                    if (value === "") {
                      setFormData((prev) => ({ ...prev, guestCount: minGuests }));
                    } else {
                      const num = parseInt(value, 10);
                      if (!isNaN(num)) {
                        setFormData((prev) => ({ ...prev, guestCount: num }));
                      }
                    }
                    if (errors.guestCount) {
                      setErrors((prev) => ({ ...prev, guestCount: "" }));
                    }
                  }}
                  onBlur={() => {
                    // Enforce minimum on blur
                    if (formData.guestCount < minGuests) {
                      setFormData((prev) => ({ ...prev, guestCount: minGuests }));
                    }
                  }}
                  min={minGuests}
                  className={cn(
                    "text-center text-lg font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                    errors.guestCount && "border-destructive"
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      guestCount: prev.guestCount + 1,
                    }))
                  }
                >
                  <span className="text-lg font-medium">+</span>
                </Button>
              </div>
              {errors.guestCount && (
                <p className="text-xs text-destructive">{errors.guestCount}</p>
              )}
            </div>

            {/* Estimated Total */}
            <div className="bg-muted/50 rounded-lg p-3 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {language === "de" ? "Geschätzt:" : "Estimated:"}
                </span>
                <span className="text-lg font-semibold text-primary">
                  {formatPrice(estimatedTotal)}
                </span>
              </div>
            </div>

            <Button onClick={handleNext} className="w-full gap-2" size="lg">
              {language === "de" ? "Weiter" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Contact Details */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {language === "de" ? "Schritt 2/2: Kontaktdaten" : "Step 2/2: Contact Details"}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Company */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {language === "de" ? "Firma *" : "Company *"}
                </Label>
                <Input
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  className={cn(errors.company && "border-destructive")}
                  placeholder={language === "de" ? "Firmenname" : "Company name"}
                />
                {errors.company && (
                  <p className="text-xs text-destructive">{errors.company}</p>
                )}
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {language === "de" ? "Ansprechpartner *" : "Contact Person *"}
                </Label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={cn(errors.name && "border-destructive")}
                  placeholder={language === "de" ? "Vor- und Nachname" : "Full name"}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {language === "de" ? "E-Mail *" : "Email *"}
                </Label>
                <Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={cn(errors.email && "border-destructive")}
                  placeholder="max@example.com"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {language === "de" ? "Telefon" : "Phone"}
                </Label>
                <Input
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+49 89 123456"
                />
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {language === "de" ? "Nachricht (optional)" : "Message (optional)"}
              </Label>
              <Textarea
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                placeholder={
                  language === "de"
                    ? "Besondere Wünsche, Allergien, Fragen..."
                    : "Special requests, allergies, questions..."
                }
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleBack} className="flex-1 gap-2">
                <ArrowLeft className="h-4 w-4" />
                {language === "de" ? "Zurück" : "Back"}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 gap-2"
                size="lg"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {language === "de" ? "Anfrage senden" : "Send Request"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EventPackageInquiryDialog;
