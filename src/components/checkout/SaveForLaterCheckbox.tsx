import { useState } from 'react';
import { Info, Shield, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface SaveForLaterCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  isRestored?: boolean;
  onClearSaved?: () => void;
  className?: string;
}

const EXPIRY_DAYS = 30;

const SaveForLaterCheckbox = ({
  checked,
  onChange,
  isRestored = false,
  onClearSaved,
  className,
}: SaveForLaterCheckboxProps) => {
  const { language } = useLanguage();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const texts = {
    de: {
      label: 'Meine Daten für zukünftige Besuche auf diesem Gerät speichern',
      sublabel: 'Verschlüsselt im Browser (30 Tage)',
      restoredBadge: 'Wiederhergestellt',
      clearData: 'Gespeicherte Daten löschen',
      privacyTitle: 'Datenschutz-Information',
      privacyContent: `
        <h3>Was wird gespeichert?</h3>
        <p>Ihre Kontakt- und Lieferdaten werden lokal in Ihrem Browser gespeichert (LocalStorage). Diese Daten verlassen niemals Ihr Gerät und werden nicht an unsere Server übertragen.</p>

        <h3>Wie lange werden die Daten gespeichert?</h3>
        <p>Die Daten werden automatisch nach ${EXPIRY_DAYS} Tagen gelöscht. Sie können die Daten jederzeit manuell löschen.</p>

        <h3>Rechtsgrundlage (DSGVO)</h3>
        <p>Die Speicherung erfolgt auf Grundlage Ihrer ausdrücklichen Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO. Sie können Ihre Einwilligung jederzeit widerrufen.</p>

        <h3>Ihre Rechte</h3>
        <ul>
          <li>Recht auf Auskunft über gespeicherte Daten</li>
          <li>Recht auf Löschung (Checkbox deaktivieren oder "Daten löschen")</li>
          <li>Recht auf Widerruf der Einwilligung</li>
        </ul>
      `,
      close: 'Verstanden',
    },
    en: {
      label: 'Save my data for future visits on this device',
      sublabel: 'Encrypted in browser (30 days)',
      restoredBadge: 'Restored',
      clearData: 'Clear saved data',
      privacyTitle: 'Privacy Information',
      privacyContent: `
        <h3>What is stored?</h3>
        <p>Your contact and delivery data is stored locally in your browser (LocalStorage). This data never leaves your device and is not transmitted to our servers.</p>

        <h3>How long is the data stored?</h3>
        <p>The data is automatically deleted after ${EXPIRY_DAYS} days. You can manually delete the data at any time.</p>

        <h3>Legal basis (GDPR)</h3>
        <p>Storage is based on your explicit consent pursuant to Art. 6(1)(a) GDPR. You can withdraw your consent at any time.</p>

        <h3>Your rights</h3>
        <ul>
          <li>Right to access stored data</li>
          <li>Right to deletion (uncheck or "Clear data")</li>
          <li>Right to withdraw consent</li>
        </ul>
      `,
      close: 'Got it',
    },
  };

  const t = texts[language] || texts.de;

  return (
    <div
      className={cn(
        // Glassmorphism container
        'relative overflow-hidden rounded-2xl',
        'bg-white/60 dark:bg-neutral-900/60',
        'backdrop-blur-xl backdrop-saturate-150',
        'border border-white/20 dark:border-white/10',
        'shadow-[0_8px_32px_rgba(0,0,0,0.08)]',
        'p-4',
        // Subtle gradient overlay
        'before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/40 before:to-transparent before:pointer-events-none',
        className
      )}
    >
      <div className="relative z-10 flex items-start gap-3">
        {/* Squircle Checkbox with Animation */}
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative flex-shrink-0 w-6 h-6',
            // Squircle shape (rounded square)
            'rounded-lg',
            // Base styling
            'border-2 transition-all duration-300 ease-out',
            // Unchecked state
            !checked && 'border-neutral-300 dark:border-neutral-600 bg-white/50 dark:bg-neutral-800/50',
            // Checked state with glow
            checked && [
              'border-primary bg-primary',
              'shadow-[0_0_20px_rgba(var(--primary-rgb,59,130,246),0.4)]',
            ],
            // Focus state
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-transparent',
            // Hover
            'hover:scale-105'
          )}
        >
          {/* Checkmark with animation */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={cn(
              'absolute inset-0 w-full h-full p-1 text-white',
              'transition-all duration-300',
              checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
            )}
          >
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                'transition-all duration-500',
                checked ? 'stroke-dashoffset-0' : ''
              )}
              style={{
                strokeDasharray: 24,
                strokeDashoffset: checked ? 0 : 24,
              }}
            />
          </svg>
        </button>

        {/* Label and Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <label
              onClick={() => onChange(!checked)}
              className="text-sm font-medium text-foreground cursor-pointer select-none"
            >
              {t.label}
            </label>

            {/* Restored Badge */}
            {isRestored && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-700/50">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                {t.restoredBadge}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {t.sublabel}
            </p>

            {/* Info Icon -> Privacy Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="p-1 -m-1 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                  aria-label={language === 'de' ? 'Datenschutz-Info' : 'Privacy info'}
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh] rounded-t-3xl">
                <SheetHeader className="text-left pb-4">
                  <SheetTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    {t.privacyTitle}
                  </SheetTitle>
                </SheetHeader>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none overflow-y-auto pb-6"
                  dangerouslySetInnerHTML={{ __html: t.privacyContent }}
                />
                <div className="flex flex-col gap-2 pt-4 border-t">
                  {onClearSaved && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClearSaved();
                        setIsSheetOpen(false);
                      }}
                      className="w-full text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t.clearData}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => setIsSheetOpen(false)}
                    className="w-full"
                  >
                    {t.close}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveForLaterCheckbox;
