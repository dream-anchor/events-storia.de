import { supabase } from "@/integrations/supabase/client";

interface PackageForExport {
  id: string;
  name: string;
  name_en?: string | null;
  description?: string | null;
  price: number;
  price_per_person: boolean;
  min_guests?: number | null;
  max_guests?: number | null;
  package_type?: string | null;
  requires_prepayment?: boolean | null;
  prepayment_percentage?: number | null;
  is_active?: boolean | null;
  includes?: string[] | null;
}

const escapeCsv = (val: unknown): string => {
  const s = val === null || val === undefined ? "" : String(val);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const fmtPrice = (n: number | null | undefined) =>
  ((n ?? 0) as number).toFixed(2).replace(".", ",");

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function exportPackageAsCsv(pkg: PackageForExport): Promise<void> {
  const [menuItems, courseCfg, drinkCfg, pkgLocations] = await Promise.all([
    supabase
      .from("package_menu_items")
      .select("item_source,item_name,item_price,quantity,is_included,sort_order")
      .eq("package_id", pkg.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("package_course_config")
      .select("course_type,course_label,is_required,custom_item_name,sort_order")
      .eq("package_id", pkg.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("package_drink_config")
      .select(
        "drink_group,drink_label,options,quantity_per_person,quantity_label,is_choice,is_included,sort_order",
      )
      .eq("package_id", pkg.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("package_locations")
      .select("location_id, locations(name)")
      .eq("package_id", pkg.id),
  ]);

  const lines: string[] = [];
  const sep = ";";

  // Stammdaten
  lines.push("# Paket-Stammdaten");
  lines.push(["Feld", "Wert"].join(sep));
  const meta: Array<[string, string | number | boolean | null | undefined]> = [
    ["ID", pkg.id],
    ["Name (DE)", pkg.name],
    ["Name (EN)", pkg.name_en ?? ""],
    ["Beschreibung", pkg.description ?? ""],
    ["Paket-Typ", pkg.package_type ?? ""],
    ["Preis (EUR)", fmtPrice(pkg.price)],
    ["Preis pro Person", pkg.price_per_person ? "Ja" : "Nein"],
    ["Min. Gäste", pkg.min_guests ?? ""],
    ["Max. Gäste", pkg.max_guests ?? ""],
    ["Vorauszahlung erforderlich", pkg.requires_prepayment ? "Ja" : "Nein"],
    ["Vorauszahlung (%)", pkg.prepayment_percentage ?? ""],
    ["Aktiv", pkg.is_active ? "Ja" : "Nein"],
  ];
  for (const [k, v] of meta) lines.push([escapeCsv(k), escapeCsv(v)].join(sep));
  lines.push("");

  // Inklusivleistungen
  lines.push("# Inklusivleistungen");
  if (pkg.includes && pkg.includes.length > 0) {
    lines.push("Position;Bezeichnung");
    pkg.includes.forEach((it, i) => lines.push([i + 1, escapeCsv(it)].join(sep)));
  } else {
    lines.push("(keine)");
  }
  lines.push("");

  // Locations
  lines.push("# Zugeordnete Locations");
  const locs = (pkgLocations.data || [])
    .map((l: any) => l.locations?.name)
    .filter(Boolean);
  if (locs.length > 0) {
    lines.push("Location");
    locs.forEach((n) => lines.push(escapeCsv(n)));
  } else {
    lines.push("(keine)");
  }
  lines.push("");

  // Kursstruktur (Menüaufbau)
  lines.push("# Menüaufbau (Gänge)");
  if ((courseCfg.data || []).length > 0) {
    lines.push(["Reihenfolge", "Gang-Typ", "Bezeichnung", "Pflicht", "Fest-Item"].join(sep));
    (courseCfg.data || []).forEach((c: any) =>
      lines.push(
        [
          c.sort_order ?? "",
          escapeCsv(c.course_type),
          escapeCsv(c.course_label),
          c.is_required ? "Ja" : "Nein",
          escapeCsv(c.custom_item_name ?? ""),
        ].join(sep),
      ),
    );
  } else {
    lines.push("(keine)");
  }
  lines.push("");

  // Menü-Items
  lines.push("# Fest hinterlegte Menü-Items");
  if ((menuItems.data || []).length > 0) {
    lines.push(
      ["Reihenfolge", "Quelle", "Bezeichnung", "Menge", "Einzelpreis (EUR)", "Inkludiert"].join(sep),
    );
    (menuItems.data || []).forEach((m: any) =>
      lines.push(
        [
          m.sort_order ?? "",
          escapeCsv(m.item_source),
          escapeCsv(m.item_name),
          m.quantity ?? 1,
          fmtPrice(m.item_price),
          m.is_included ? "Ja" : "Nein",
        ].join(sep),
      ),
    );
  } else {
    lines.push("(keine)");
  }
  lines.push("");

  // Getränke
  lines.push("# Getränke-Konfiguration");
  if ((drinkCfg.data || []).length > 0) {
    lines.push(
      ["Reihenfolge", "Gruppe", "Bezeichnung", "Optionen", "Menge/Person", "Mengen-Label", "Auswahl", "Inkludiert"].join(sep),
    );
    (drinkCfg.data || []).forEach((d: any) => {
      const opts = Array.isArray(d.options) ? d.options.join(", ") : "";
      lines.push(
        [
          d.sort_order ?? "",
          escapeCsv(d.drink_group),
          escapeCsv(d.drink_label),
          escapeCsv(opts),
          d.quantity_per_person ?? "",
          escapeCsv(d.quantity_label ?? ""),
          d.is_choice ? "Ja" : "Nein",
          d.is_included ? "Ja" : "Nein",
        ].join(sep),
      );
    });
  } else {
    lines.push("(keine)");
  }

  const csv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `paket-${slugify(pkg.name) || pkg.id}-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}