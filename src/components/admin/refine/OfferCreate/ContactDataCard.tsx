import { User, Building2, Mail, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ContactDataCardProps {
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  onContactNameChange: (value: string) => void;
  onCompanyNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}

export const ContactDataCard = ({
  contactName,
  companyName,
  email,
  phone,
  onContactNameChange,
  onCompanyNameChange,
  onEmailChange,
  onPhoneChange,
}: ContactDataCardProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4" />
          Kontaktdaten
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="contact_name" className="text-xs">Name *</Label>
            <Input
              id="contact_name"
              value={contactName}
              onChange={(e) => onContactNameChange(e.target.value)}
              placeholder="Max Mustermann"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company_name" className="text-xs flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Firma
            </Label>
            <Input
              id="company_name"
              value={companyName}
              onChange={(e) => onCompanyNameChange(e.target.value)}
              placeholder="ABC GmbH"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs flex items-center gap-1">
              <Mail className="h-3 w-3" />
              E-Mail *
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="kunde@firma.de"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs flex items-center gap-1">
              <Phone className="h-3 w-3" />
              Telefon
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="+49 89 1234567"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
