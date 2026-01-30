import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface DetailPaneProps {
  children?: ReactNode;
  isEmpty?: boolean;
}

/**
 * Container for the detail view in the inbox
 * Shows empty state when no item is selected
 */
export const DetailPane = ({ children, isEmpty = false }: DetailPaneProps) => {
  if (isEmpty || !children) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
        <Inbox className="h-12 w-12 mb-4 opacity-30" />
        <h3 className="text-lg font-medium mb-1">Kein Eintrag ausgewählt</h3>
        <p className="text-sm text-center max-w-xs">
          Wähle einen Eintrag aus der Liste, um Details anzuzeigen
        </p>
        <div className="mt-6 text-xs space-y-1">
          <p><kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">↓</kbd> Navigieren</p>
          <p><kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Enter</kbd> Öffnen</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {children}
    </div>
  );
};

export { DetailHeader } from './DetailHeader';
export { Timeline } from './Timeline';
export { PresenceIndicator } from './PresenceIndicator';
export { DocumentViewer } from './DocumentViewer';
