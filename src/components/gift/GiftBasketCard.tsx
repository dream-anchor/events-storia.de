import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GIFT_COPY, type GiftLang } from "@/lib/gift/copy";
import { formatEuro, MAX_QTY_PER_LINE } from "@/lib/gift/pricing";
import { qtyLeft, showFewLeft } from "@/lib/gift/stock";
import type { GiftBasket } from "@/lib/gift/types";
import { giftImageProps } from "@/lib/gift/image";
import { GiftLmiv } from "./GiftLmiv";
import { KiBadge } from "@/components/KiBadge";
import { kiAltSuffix } from "@/lib/kiAlt";

interface Props {
  basket: GiftBasket;
  lang: GiftLang;
  onAdd: (variantId: string, qty: number) => void;
}

export const GiftBasketCard = ({ basket, lang, onAdd }: Props) => {
  const t = GIFT_COPY[lang];
  const firstAvailable = basket.variants.find((v) => qtyLeft(v) > 0) ?? basket.variants[0];
  const [variantId, setVariantId] = useState<string>(firstAvailable?.id ?? "");
  const [qty, setQty] = useState(1);
  const variant = basket.variants.find((v) => v.id === variantId);
  const maxQty = Math.max(1, Math.min(MAX_QTY_PER_LINE, variant ? qtyLeft(variant) : 1));
  const soldOut = !variant || qtyLeft(variant) <= 0;
  const img = giftImageProps(variant?.image_url ?? basket.image_url);
  const name = lang === "de" ? basket.name_de : basket.name_en;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid gap-0 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="relative aspect-[4/5] bg-secondary/30">
          {img.src && (
            <img
              src={img.src}
              srcSet={img.srcSet}
              sizes="(min-width: 768px) 320px, 100vw"
              alt={`${name} ${kiAltSuffix(lang)}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
          {img.src && <KiBadge lang={lang} />}
        </div>

        <div className="p-5">
          <h3 className="font-serif text-2xl font-bold">{name}</h3>
          <p className="mt-1 text-lg font-semibold">{formatEuro(basket.price_cents, lang)}</p>
          <p className="text-xs text-muted-foreground">{t.vatNote}</p>
          {(lang === "de" ? basket.description_de : basket.description_en) && (
            <p className="mt-3 text-sm text-muted-foreground">{lang === "de" ? basket.description_de : basket.description_en}</p>
          )}

          <div className="mt-4">
            <p className="mb-1 text-sm font-medium">{t.wine}</p>
            <RadioGroup value={variantId} onValueChange={(v) => { setVariantId(v); setQty(1); }}>
              {basket.variants.map((v) => (
                <div key={v.id} className="flex items-center gap-2">
                  <RadioGroupItem value={v.id} id={`${basket.id}-${v.id}`} disabled={qtyLeft(v) <= 0} />
                  <Label htmlFor={`${basket.id}-${v.id}`} className={qtyLeft(v) <= 0 ? "text-muted-foreground line-through" : ""}>
                    {lang === "de" ? v.label_de : v.label_en}
                    {qtyLeft(v) <= 0 && <span className="ml-2 no-underline">({t.soldOut})</span>}
                    {showFewLeft(v) && <span className="ml-2 text-xs text-primary">({t.onlyFew(v.available as number)})</span>}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2" role="group" aria-label={t.quantity}>
              <Button type="button" variant="outline" size="icon" aria-label="−" disabled={soldOut || qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center tabular-nums" aria-live="polite">{qty}</span>
              <Button type="button" variant="outline" size="icon" aria-label="+" disabled={soldOut || qty >= maxQty} onClick={() => setQty((q) => Math.min(maxQty, q + 1))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button type="button" className="rounded-full" disabled={soldOut} onClick={() => variant && onAdd(variant.id, qty)}>
              {soldOut ? t.soldOut : t.addToCart}
            </Button>
          </div>

          <h4 className="mt-5 text-sm font-semibold">{t.inBasket}</h4>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
            {variant && <li>{lang === "de" ? variant.label_de : variant.label_en}{variant.net_content ? `, ${variant.net_content}` : ""}</li>}
            {basket.components.map((c, i) => (
              <li key={`${c.name_de}-${i}`}>{lang === "de" ? c.name_de : c.name_en}</li>
            ))}
          </ul>
          {(lang === "de" ? basket.packaging_de : basket.packaging_en) && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t.packaging}: {lang === "de" ? basket.packaging_de : basket.packaging_en}
            </p>
          )}

          <GiftLmiv basket={basket} variant={variant} lang={lang} />
        </div>
      </div>
    </article>
  );
};
