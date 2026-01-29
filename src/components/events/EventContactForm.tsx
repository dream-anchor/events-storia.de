import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  company: z.string().min(2, "Firmenname erforderlich"),
  name: z.string().min(2, "Name erforderlich"),
  email: z.string().email("Ungültige E-Mail-Adresse"),
  phone: z.string().optional(),
  guests: z.string().min(1, "Bitte Gästezahl angeben"),
  eventType: z.string().min(1, "Bitte Event-Art wählen"),
  eventTypeOther: z.string().optional(),
  date: z.date().optional(),
  message: z.string().optional(),
  newsletter: z.boolean().default(true),
  selectedPackage: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EventContactFormProps {
  preselectedPackage?: string;
}

const EventContactForm = ({ preselectedPackage }: EventContactFormProps) => {
  const { language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company: "",
      name: "",
      email: "",
      phone: "",
      guests: "",
      eventType: "",
      eventTypeOther: "",
      message: "",
      newsletter: true,
      selectedPackage: preselectedPackage || "",
    },
  });

  const watchEventType = form.watch("eventType");

  const eventTypes = language === 'de' 
    ? [
        { value: "firmenfeier", label: "Firmenfeier" },
        { value: "team-event", label: "Team-Event" },
        { value: "business-dinner", label: "Business-Dinner" },
        { value: "weihnachtsfeier", label: "Weihnachtsfeier" },
        { value: "geburtstag", label: "Geburtstag / Privat" },
        { value: "sonstiges", label: "Sonstiges" },
      ]
    : [
        { value: "firmenfeier", label: "Corporate Event" },
        { value: "team-event", label: "Team Event" },
        { value: "business-dinner", label: "Business Dinner" },
        { value: "weihnachtsfeier", label: "Christmas Party" },
        { value: "geburtstag", label: "Birthday / Private" },
        { value: "sonstiges", label: "Other" },
      ];

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      // Call the correct receive-event-inquiry Edge Function
      // which saves to event_inquiries AND sends emails
      const { error } = await supabase.functions.invoke('receive-event-inquiry', {
        body: {
          companyName: data.company,
          contactName: data.name,
          email: data.email,
          phone: data.phone || undefined,
          guestCount: data.guests,
          eventType: data.eventType === 'sonstiges' && data.eventTypeOther 
            ? data.eventTypeOther 
            : data.eventType,
          preferredDate: data.date ? data.date.toISOString().split('T')[0] : undefined,
          message: data.message || undefined,
          source: data.selectedPackage ? `website_package_${data.selectedPackage}` : 'website_contact_form',
        }
      });

      if (error) throw error;

      toast.success(
        language === 'de' 
          ? 'Vielen Dank! Wir melden uns innerhalb von 24 Stunden bei Ihnen.' 
          : 'Thank you! We will contact you within 24 hours.'
      );
      
      form.reset();
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(
        language === 'de'
          ? 'Es gab einen Fehler. Bitte versuchen Sie es erneut oder rufen Sie uns an.'
          : 'There was an error. Please try again or give us a call.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="kontaktformular" className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-serif font-medium mb-4">
              {language === 'de' ? 'Jetzt unverbindlich anfragen' : 'Request a Quote'}
            </h2>
            <p className="text-muted-foreground">
              {language === 'de'
                ? 'Füllen Sie das Formular aus und wir melden uns innerhalb von 24 Stunden mit einem individuellen Angebot.'
                : 'Fill out the form and we will get back to you within 24 hours with a customized offer.'}
            </p>
            {/* WhatsApp Alternative */}
            <p className="text-sm text-muted-foreground mt-3">
              {language === 'de' ? 'Schneller per WhatsApp?' : 'Faster via WhatsApp?'}
              <a 
                href="https://wa.me/491636033912?text=Hallo%2C%20ich%20interessiere%20mich%20für%20ein%20Event%20im%20Storia"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:text-green-700 hover:underline ml-1 inline-flex items-center gap-1"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                {language === 'de' ? 'Hier klicken' : 'Click here'}
              </a>
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Company & Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'de' ? 'Firma *' : 'Company *'}</FormLabel>
                      <FormControl>
                        <Input placeholder={language === 'de' ? 'Ihre Firma' : 'Your Company'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'de' ? 'Ansprechpartner *' : 'Contact Person *'}</FormLabel>
                      <FormControl>
                        <Input placeholder={language === 'de' ? 'Ihr Name' : 'Your Name'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-Mail *</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="ihre@email.de" 
                          {...field}
                          onInput={(e) => {
                            // Handle autofill/paste - sync value immediately
                            const target = e.target as HTMLInputElement;
                            if (target.value !== field.value) {
                              field.onChange(target.value);
                            }
                          }}
                          onBlur={(e) => {
                            // Final sync on blur for any missed autofill
                            const currentValue = e.target.value;
                            if (currentValue !== field.value) {
                              field.onChange(currentValue);
                            }
                            field.onBlur();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'de' ? 'Telefon' : 'Phone'}</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+49..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Guests & Event Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="guests"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'de' ? 'Anzahl Gäste *' : 'Number of Guests *'}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={10} 
                          max={200}
                          placeholder={language === 'de' ? 'z.B. 50' : 'e.g. 50'} 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="eventType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'de' ? 'Art des Events *' : 'Event Type *'}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={language === 'de' ? 'Bitte wählen' : 'Please select'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {eventTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Event Type Other - conditional */}
              {watchEventType === 'sonstiges' && (
                <FormField
                  control={form.control}
                  name="eventTypeOther"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'de' ? 'Bitte beschreiben Sie Ihr Event' : 'Please describe your event'}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={language === 'de' ? 'Art Ihres Events...' : 'Type of your event...'} 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Date */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{language === 'de' ? 'Gewünschtes Datum' : 'Preferred Date'}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: language === 'de' ? de : enUS })
                            ) : (
                              <span>{language === 'de' ? 'Datum wählen' : 'Pick a date'}</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Message */}
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === 'de' ? 'Ihre Nachricht' : 'Your Message'}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={language === 'de' 
                          ? 'Erzählen Sie uns von Ihrem Event, besonderen Wünschen oder Fragen...' 
                          : 'Tell us about your event, special requests or questions...'}
                        className="min-h-[120px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Newsletter */}
              <FormField
                control={form.control}
                name="newsletter"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-normal text-muted-foreground">
                        {language === 'de'
                          ? 'Ich möchte über exklusive Angebote und Event-Neuigkeiten informiert werden.'
                          : 'I would like to receive exclusive offers and event news.'}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button 
                type="submit" 
                size="lg" 
                className="w-full gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {language === 'de' ? 'Wird gesendet...' : 'Sending...'}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {language === 'de' ? 'Unverbindlich anfragen' : 'Send Inquiry'}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {language === 'de'
                  ? 'Ihre Daten werden vertraulich behandelt. Wir melden uns Mo-Fr innerhalb von 24 Stunden.'
                  : 'Your data will be treated confidentially. We will contact you Mon-Fri within 24 hours.'}
              </p>
            </form>
          </Form>
        </div>
      </div>
    </section>
  );
};

export default EventContactForm;
