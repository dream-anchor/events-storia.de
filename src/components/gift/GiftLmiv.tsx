import { GIFT_TEXTS } from "../../../supabase/functions/_shared/giftLegal";
import { GIFT_COPY, type GiftLang } from "@/lib/gift/copy";
import type { GiftBasket, GiftVariant } from "@/lib/gift/types";

const ALLERGEN_LABELS: Record<string, { de: string; en: string }> = {
  gluten: { de: "Gluten", en: "Gluten" },
  crustaceans: { de: "Krebstiere", en: "Crustaceans" },
  eggs: { de: "Eier", en: "Eggs" },
  fish: { de: "Fisch", en: "Fish" },
  peanuts: { de: "Erdnüsse", en: "Peanuts" },
  soy: { de: "Soja", en: "Soy" },
  milk: { de: "Milch", en: "Milk" },
  nuts: { de: "Schalenfrüchte", en: "Tree nuts" },
  celery: { de: "Sellerie", en: "Celery" },
  mustard: { de: "Senf", en: "Mustard" },
  sesame: { de: "Sesam", en: "Sesame" },
  sulfites: { de: "Schwefeldioxid/Sulfite", en: "Sulphur dioxide/sulphites" },
  lupin: { de: "Lupinen", en: "Lupin" },
  molluscs: { de: "Weichtiere", en: "Molluscs" },
};

interface Props {
  basket: GiftBasket;
  variant: GiftVariant | undefined;
  lang: GiftLang;
}

/** Pflichtangaben (LMIV) je Bestandteil und für den gewählten Wein; offen sichtbar (nichts zugeklappt).
 *  Solange Angaben fehlen: deutlicher interner Hinweis statt stiller Lücke (Livegang erst mit vollständigen Daten). */
export const GiftLmiv = ({ basket, variant, lang }: Props) => {
  const t = GIFT_COPY[lang];
  const name = (de: string, en: string) => (lang === "de" ? de : en);

  return (
    <section aria-label={t.lmivTitle} className="mt-4 rounded-xl border border-border p-4 text-sm">
      <h4 className="mb-2 font-semibold">{t.lmivTitle}</h4>

      {variant && (
        <div className="mb-3">
          <p className="font-medium">{name(variant.label_de, variant.label_en)}</p>
          {variant.lmiv_complete ? (
            <ul className="text-muted-foreground">
              {variant.net_content && <li>{t.lmivNet}: {variant.net_content}</li>}
              {variant.abv_percent !== null && <li>{t.lmivAbv}: {String(variant.abv_percent).replace(".", lang === "de" ? "," : ".")} % vol.</li>}
              {variant.bottler && <li>{t.lmivOperator}: {variant.bottler}</li>}
              {variant.origin && <li>{t.lmivOrigin}: {variant.origin}</li>}
              {variant.contains_sulfites && <li>{t.lmivSulfites}</li>}
            </ul>
          ) : (
            <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 px-2 py-1 text-destructive">
              {GIFT_TEXTS.lmivMissing[lang]}
            </p>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {basket.components.map((c, i) => (
          <li key={`${c.name_de}-${i}`}>
            <p className="font-medium">{name(c.name_de, c.name_en)}{c.quantity ? `, ${c.quantity}` : ""}</p>
            {c.lmiv_complete ? (
              <ul className="text-muted-foreground">
                {(lang === "de" ? c.ingredients_de : c.ingredients_en) && (
                  <li>{t.lmivIngredients}: {lang === "de" ? c.ingredients_de : c.ingredients_en}</li>
                )}
                {c.allergens.length > 0 && (
                  <li>
                    {t.lmivAllergens}: {c.allergens.map((a) => (
                      <strong key={a} className="mr-1 uppercase">{ALLERGEN_LABELS[a]?.[lang] ?? a}</strong>
                    ))}
                  </li>
                )}
                {c.net_content && <li>{t.lmivNet}: {c.net_content}</li>}
                {c.food_business_operator && <li>{t.lmivOperator}: {c.food_business_operator}</li>}
                {c.origin && <li>{t.lmivOrigin}: {c.origin}</li>}
              </ul>
            ) : (
              <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 px-2 py-1 text-destructive">
                {GIFT_TEXTS.lmivMissing[lang]}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
