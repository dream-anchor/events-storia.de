import { useState, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  List as ListIcon,
  ListOrdered,
  Link2,
  Send,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MailComposerProps {
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  fromLabel?: string;
  isSending?: boolean;
  onSend: (payload: { to: string; cc?: string; bcc?: string; subject: string; html: string; text: string }) => Promise<void> | void;
  onCancel?: () => void;
}

function ToolbarButton({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "h-8 w-8 inline-flex items-center justify-center rounded-md text-sm transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function MailComposer({
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
  fromLabel,
  isSending = false,
  onSend,
  onCancel,
}: MailComposerProps) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: "text-primary underline" } }),
    ],
    content: defaultBody || "<p></p>",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[180px] px-4 py-3",
      },
    },
  });

  const canSend = useMemo(() => to.trim().length > 0 && !!editor && !isSending, [to, editor, isSending]);

  const handleSend = async () => {
    if (!editor) return;
    const html = editor.getHTML();
    const text = editor.getText();
    if (!text.trim()) return;
    await onSend({
      to: to.trim(),
      cc: cc.trim() || undefined,
      bcc: bcc.trim() || undefined,
      subject: subject.trim(),
      html,
      text,
    });
  };

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link-URL", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-col bg-white rounded-lg border border-border/60 overflow-hidden">
      {/* Header rows */}
      <div className="px-4 pt-3 pb-2 space-y-2 border-b border-border/40 bg-muted/20">
        {fromLabel && (
          <div className="flex items-center gap-2 text-xs">
            <Label className="w-12 text-muted-foreground">Von</Label>
            <span className="text-foreground">{fromLabel}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Label className="w-12 text-xs text-muted-foreground">An</Label>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="empfaenger@example.com"
            className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm"
          />
          <div className="flex gap-1">
            {!showCc && (
              <button type="button" onClick={() => setShowCc(true)} className="text-xs text-muted-foreground hover:text-foreground">CC</button>
            )}
            {!showBcc && (
              <button type="button" onClick={() => setShowBcc(true)} className="text-xs text-muted-foreground hover:text-foreground">BCC</button>
            )}
          </div>
        </div>
        {showCc && (
          <div className="flex items-center gap-2">
            <Label className="w-12 text-xs text-muted-foreground">CC</Label>
            <Input value={cc} onChange={(e) => setCc(e.target.value)} className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm" />
            <button type="button" onClick={() => { setShowCc(false); setCc(""); }} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {showBcc && (
          <div className="flex items-center gap-2">
            <Label className="w-12 text-xs text-muted-foreground">BCC</Label>
            <Input value={bcc} onChange={(e) => setBcc(e.target.value)} className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm" />
            <button type="button" onClick={() => { setShowBcc(false); setBcc(""); }} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Label className="w-12 text-xs text-muted-foreground">Betreff</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="(ohne Betreff)"
            className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm font-medium"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/40 bg-white">
        <ToolbarButton active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} title="Fett"><BoldIcon className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Kursiv"><ItalicIcon className="h-4 w-4" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Liste"><ListIcon className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Nummerierte Liste"><ListOrdered className="h-4 w-4" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton active={editor?.isActive("link")} onClick={setLink} title="Link"><Link2 className="h-4 w-4" /></ToolbarButton>
      </div>

      {/* Editor */}
      <div className="bg-white">
        <EditorContent editor={editor} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/40 bg-muted/10">
        <Button onClick={handleSend} disabled={!canSend} size="sm" className="gap-2">
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isSending ? "Wird gesendet…" : "Senden"}
        </Button>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>Abbrechen</Button>
        )}
      </div>
    </div>
  );
}

export default MailComposer;