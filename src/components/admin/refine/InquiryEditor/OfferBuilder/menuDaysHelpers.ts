import type { CourseSelection } from '../MenuComposer/types';
import type { MenuDay, OfferBuilderOption } from './types';

/**
 * Hilfsfunktionen für die Tages-Struktur eines Menüs (`menuSelection.days[]`).
 *
 * Kernprinzip: **Legacy-Kompatibilität**. Wenn `days` nicht gesetzt ist, wird
 * das bestehende `menuSelection.courses`-Array als impliziter Tag „default"
 * behandelt. Erst wenn der Operator explizit mehrere Tage anlegt (z.B. via
 * mehrtägigem Freitext-Import), wird `days[]` materialisiert und alte Renderer
 * (E-Mail, PDF, Public Offer) sehen die aggregierte Kurs-Liste weiterhin in
 * `menuSelection.courses` — bis Session 2 diese Renderer auf `days[]` umstellt.
 */

const DEFAULT_DAY_ID = 'default';

export interface DayView {
  id: string;
  dateLabel: string;
  isoDate?: string | null;
  mealLabel?: string | null;
  guestCount?: number | null;
  courses: CourseSelection[];
  /** true wenn dieser „Tag" nur aus der Legacy-`courses[]`-Liste synthetisiert wurde. */
  isSynthetic: boolean;
}

/**
 * Liefert die anzuzeigende Tages-Liste. Bei fehlenden/leeren `days[]` wird ein
 * einzelner synthetischer Tag aus `menuSelection.courses` gebaut, damit die UI
 * einheitlich `daysView[]` iterieren kann.
 */
export function getDaysView(option: OfferBuilderOption): DayView[] {
  const days = option.menuSelection.days;
  if (Array.isArray(days) && days.length > 0) {
    return days.map((d) => ({
      id: d.id,
      dateLabel: d.dateLabel ?? '',
      isoDate: d.isoDate ?? null,
      mealLabel: d.mealLabel ?? null,
      guestCount: d.guestCount ?? null,
      courses: Array.isArray(d.courses) ? d.courses : [],
      isSynthetic: false,
    }));
  }
  return [
    {
      id: DEFAULT_DAY_ID,
      dateLabel: '',
      isoDate: null,
      mealLabel: null,
      guestCount: null,
      courses: option.menuSelection.courses ?? [],
      isSynthetic: true,
    },
  ];
}

/** Aggregierte Kursliste über alle Tage (für Recalc, E-Mail-Renderer etc.). */
export function flattenCourses(option: OfferBuilderOption): CourseSelection[] {
  const view = getDaysView(option);
  if (view.length === 1 && view[0].isSynthetic) return view[0].courses;
  return view.flatMap((d) => d.courses);
}

/**
 * Kern-Setter: schreibt eine neue Kurs-Liste für den aktiven Tag zurück in
 * `menuSelection`. Hält bei materialisiertem `days[]` sowohl `days[activeDayId]`
 * als auch `menuSelection.courses` (Flatten aller Tage) konsistent, damit
 * bestehende Renderer die aggregierte Liste sehen.
 */
export function withUpdatedDayCourses(
  option: OfferBuilderOption,
  activeDayId: string,
  updater: (courses: CourseSelection[]) => CourseSelection[],
): OfferBuilderOption['menuSelection'] {
  const days = option.menuSelection.days;

  // Legacy-Pfad — nichts materialisiert, direkt `courses` patchen.
  if (!Array.isArray(days) || days.length === 0) {
    return {
      ...option.menuSelection,
      courses: updater(option.menuSelection.courses ?? []),
    };
  }

  // Materialisierter Pfad — den passenden Tag patchen und Flatten mirroren.
  const nextDays = days.map((d) =>
    d.id === activeDayId ? { ...d, courses: updater(d.courses ?? []) } : d,
  );
  return {
    ...option.menuSelection,
    days: nextDays,
    courses: nextDays.flatMap((d) => d.courses ?? []),
  };
}

/** Neuen Tag ans Ende anhängen (materialisiert `days[]` bei Bedarf). */
export function withAddedDay(
  option: OfferBuilderOption,
  label: string,
): { menuSelection: OfferBuilderOption['menuSelection']; newDayId: string } {
  const view = getDaysView(option);
  const materialised: MenuDay[] = view.map((d) => ({
    id: d.isSynthetic ? crypto.randomUUID() : d.id,
    dateLabel: d.dateLabel,
    isoDate: d.isoDate ?? null,
    mealLabel: d.mealLabel ?? null,
    guestCount: d.guestCount ?? null,
    courses: d.courses,
  }));
  const newDay: MenuDay = {
    id: crypto.randomUUID(),
    dateLabel: label,
    isoDate: null,
    mealLabel: null,
    guestCount: null,
    courses: [],
  };
  const nextDays = [...materialised, newDay];
  return {
    menuSelection: {
      ...option.menuSelection,
      days: nextDays,
      courses: nextDays.flatMap((d) => d.courses ?? []),
    },
    newDayId: newDay.id,
  };
}

/** Tag entfernen. Wenn nur noch einer übrig bleibt, `days[]` demateralisieren. */
export function withRemovedDay(
  option: OfferBuilderOption,
  dayId: string,
): OfferBuilderOption['menuSelection'] {
  const days = option.menuSelection.days;
  if (!Array.isArray(days) || days.length === 0) return option.menuSelection;
  const filtered = days.filter((d) => d.id !== dayId);
  if (filtered.length === 0) {
    return { ...option.menuSelection, days: undefined, courses: [] };
  }
  if (filtered.length === 1) {
    // Nur ein Tag übrig → auf Legacy-Pfad zurückfallen (Tabs verschwinden).
    return {
      ...option.menuSelection,
      days: undefined,
      courses: filtered[0].courses ?? [],
    };
  }
  return {
    ...option.menuSelection,
    days: filtered,
    courses: filtered.flatMap((d) => d.courses ?? []),
  };
}

/** Metadaten eines Tages patchen (Label, Datum, Mahlzeit, Gäste). */
export function withUpdatedDayMeta(
  option: OfferBuilderOption,
  dayId: string,
  patch: Partial<Pick<MenuDay, 'dateLabel' | 'isoDate' | 'mealLabel' | 'guestCount'>>,
): OfferBuilderOption['menuSelection'] {
  const days = option.menuSelection.days;
  if (!Array.isArray(days) || days.length === 0) return option.menuSelection;
  return {
    ...option.menuSelection,
    days: days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)),
  };
}