

## E-Mail-Composer 2026: Split-Screen Layout mit Live-PDF-Preview

### Aktuelle Probleme (Diagnose)

1. **Kein Split-Layout** – E-Mail-Editor und PDF sind vertikal gestapelt statt nebeneinander
2. **PDF nur bei Senden** – Nutzer sieht das Ergebnis erst am Ende, kein WYSIWYG-Feeling
3. **Floating Bar rechts** – folgt nicht dem natürlichen F-Schema Lesefluss
4. **Zu viel Whitespace oben** – Header nimmt Platz weg, Editor ist zu klein
5. **Keine Live-Aktualisierung** – Änderungen im Text werden nicht sofort im PDF reflektiert

---

### Optimierungsplan

#### 1. Split-Screen Layout (60/40)

**Neue Struktur in MultiOfferComposer.tsx:**

```text
┌─────────────────────────────────────────────────────────────┐
│ Floating Pill Navigation (zentriert)                        │
├──────────────────────────────────┬──────────────────────────┤
│                                  │                          │
│  E-Mail-Editor (60%)             │   PDF Preview (40%)      │
│  ┌────────────────────────────┐  │   ┌────────────────────┐ │
│  │ Anschreiben bearbeiten     │  │   │                    │ │
│  │                            │  │   │   Quick Look       │ │
│  │ [Textarea - fullscreen]    │  │   │   PDF Viewer       │ │
│  │                            │  │   │                    │ │
│  │                            │  │   │                    │ │
│  └────────────────────────────┘  │   └────────────────────┘ │
│                                  │                          │
├──────────────────────────────────┴──────────────────────────┤
│ Floating Action Bar (links/zentriert)                       │
└─────────────────────────────────────────────────────────────┘
```

**Implementierung:**

```tsx
// Wenn emailDraft vorhanden → Split-Layout aktivieren
{emailDraft ? (
  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-200px)]">
    {/* Editor: 3 of 5 columns = 60% */}
    <div className="lg:col-span-3 flex flex-col">
      <EmailEditorPanel 
        emailDraft={emailDraft}
        onChange={setEmailDraft}
        templates={templates}
      />
    </div>
    
    {/* PDF Preview: 2 of 5 columns = 40% */}
    <div className="lg:col-span-2 flex flex-col">
      <LivePDFPreview
        inquiry={inquiry}
        options={activeOptions}
        emailDraft={emailDraft}
      />
    </div>
  </div>
) : (
  /* Standard Option Cards View */
)}
```

#### 2. Neue Komponente: EmailEditorPanel.tsx

**Fokussierte E-Mail-Bearbeitung ohne Ablenkung:**

```tsx
// src/components/admin/refine/InquiryEditor/MultiOffer/EmailEditorPanel.tsx

interface EmailEditorPanelProps {
  emailDraft: string;
  onChange: (draft: string) => void;
  templates: EmailTemplate[];
  isGenerating: boolean;
  onRegenerate: () => void;
}

export const EmailEditorPanel = ({ ... }) => (
  <Card className="flex-1 flex flex-col overflow-hidden">
    {/* Compact Header */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
      <div className="flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <span className="font-medium">Anschreiben</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onRegenerate}>
          <Sparkles className="h-4 w-4 mr-1.5" />
          Neu generieren
        </Button>
      </div>
    </div>
    
    {/* Full-Height Textarea */}
    <div className="flex-1 p-6">
      <Textarea
        value={emailDraft}
        onChange={(e) => onChange(e.target.value)}
        className="h-full resize-none font-sans text-base leading-relaxed border-0 focus:ring-0 bg-transparent"
        placeholder="Ihr Anschreiben..."
      />
    </div>
    
    {/* Template Snippets - Collapsed */}
    <Collapsible className="border-t border-border/30">
      <CollapsibleTrigger className="w-full px-6 py-3 flex items-center justify-between hover:bg-muted/30">
        <span className="text-sm text-muted-foreground">Textbausteine</span>
        <ChevronDown className="h-4 w-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-6 pb-4">
        {/* Template buttons */}
      </CollapsibleContent>
    </Collapsible>
  </Card>
);
```

#### 3. Neue Komponente: LivePDFPreview.tsx

**Quick Look Style PDF Viewer:**

```tsx
// src/components/admin/refine/InquiryEditor/MultiOffer/LivePDFPreview.tsx

import { PDFViewer, usePDF } from "@react-pdf/renderer";
import { motion } from "framer-motion";

export const LivePDFPreview = ({ inquiry, options, emailDraft }) => {
  // Generate PDF dynamically based on current state
  const [pdfInstance, updatePdf] = usePDF({
    document: <QuotePDFDocument 
      event={inquiry}
      items={buildLineItems(options)}
      notes={emailDraft}
    />
  });

  // Update PDF when emailDraft changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => updatePdf(), 500);
    return () => clearTimeout(timer);
  }, [emailDraft, options]);

  return (
    <Card className="flex-1 flex flex-col overflow-hidden bg-muted/20">
      {/* Header with Quick Look styling */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Vorschau</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {pdfInstance.loading ? "Aktualisiert..." : "Live"}
        </Badge>
      </div>
      
      {/* PDF Viewer - Full height */}
      <div className="flex-1 relative">
        {pdfInstance.loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        
        <iframe
          src={pdfInstance.url ?? undefined}
          className="w-full h-full border-0"
          title="PDF Preview"
        />
      </div>
      
      {/* Footer with actions */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border/30">
        <Button variant="ghost" size="sm">
          <Download className="h-4 w-4 mr-1.5" />
          Download
        </Button>
        <Button variant="ghost" size="sm">
          <Maximize2 className="h-4 w-4 mr-1.5" />
          Vollbild
        </Button>
      </div>
    </Card>
  );
};
```

#### 4. Floating Bar Neupositionierung

**Von rechts nach links/zentriert - folgt F-Schema:**

```tsx
// Statt fixed bottom-6 left-1/2 → fixed bottom-6 left-6 oder zentriert links
<motion.div
  className={cn(
    // Kompakte Pille, links positioniert
    "fixed bottom-6 left-6",
    // ODER: Zentriert mit leichtem Links-Offset
    // "fixed bottom-6 left-1/2 -translate-x-1/2 -ml-20",
    
    // Glassmorphism Pille
    "px-5 py-3 rounded-full",
    "bg-background/70 backdrop-blur-2xl",
    "border border-white/40",
    "shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
  )}
>
  <div className="flex items-center gap-4">
    {/* Status */}
    <div className="flex items-center gap-2">
      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-sm font-medium">
        {activeOptions.length} Option{activeOptions.length !== 1 ? 'en' : ''}
      </span>
    </div>
    
    <div className="h-4 w-px bg-border/50" />
    
    {/* Primary CTA */}
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="..."
    >
      <Send className="h-4 w-4 mr-2" />
      Angebot senden
    </motion.button>
  </div>
</motion.div>
```

#### 5. Editor-Fläche maximieren

**Reduzierter Header im E-Mail-Modus:**

```tsx
// Wenn emailDraft vorhanden → kompakter Header
{emailDraft && (
  <div className="flex items-center justify-between py-4 border-b border-border/30 mb-6">
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={() => setEmailDraft("")}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <span className="font-medium">Angebot finalisieren</span>
    </div>
    <Badge variant="outline">
      {activeOptions.length} Option{activeOptions.length !== 1 ? 'en' : ''} aktiv
    </Badge>
  </div>
)}
```

#### 6. Visual Polish: Apple Squircle Radii & Typografie

**In den neuen Komponenten:**

```tsx
// Card Container
className="rounded-3xl border border-border/30 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"

// Textarea (breathing typography)
className="text-base leading-relaxed tracking-[-0.01em] font-sans"

// PDF Container
className="rounded-2xl overflow-hidden bg-white shadow-inner"
```

---

### Dateien, die erstellt/geändert werden

| Datei | Änderung |
|-------|----------|
| `MultiOfferComposer.tsx` | Split-Layout wenn emailDraft vorhanden, Floating Bar links/zentriert |
| `EmailEditorPanel.tsx` | **NEU** - Fokussierter E-Mail-Editor mit max. Fläche |
| `LivePDFPreview.tsx` | **NEU** - Quick Look Style PDF Viewer mit Live-Update |

---

### Erwartetes Ergebnis

- **60/40 Split-Layout**: Editor links, PDF rechts – alles auf einen Blick
- **WYSIWYG-Feeling**: Änderungen im Text werden live im PDF reflektiert
- **Quick Look Ästhetik**: PDF-Vorschau wie macOS Quick Look (⌘+Leertaste)
- **Floating Bar folgt F-Schema**: Links oder leicht links-zentriert positioniert
- **Maximierte Editorfläche**: Kein unnötiger Whitespace, voller Fokus auf Inhalt
- **Apple-typische Squircle**: Konsistente `rounded-3xl` Radien für alle Container

