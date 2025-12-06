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
      // Send notification email via Edge Function
      const { error } = await supabase.functions.invoke('send-order-notification', {
        body: {
          type: 'event_inquiry',
          data: {
            ...data,
            date: data.date ? format(data.date, 'dd.MM.yyyy') : 'Nicht angegeben',
          }
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
                        <Input type="email" placeholder="ihre@email.de" {...field} />
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
