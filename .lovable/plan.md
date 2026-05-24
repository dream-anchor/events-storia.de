## Ziel
`/mnt/documents/vorschau-rigshospitalet-restzahlung.html` so überarbeiten, dass:
1. **Ganz oben** (vor dem DE-Block) ein dezenter englischer Hinweis steht: *"You'll find the English version below."*
2. Zwischen DE- und EN-Block ein **deutlich sichtbarer Trenner** sitzt (horizontale Linie + Label "English version below / Deutsche Version oben").

## Umsetzung

### 1. EN-Hinweis ganz oben
Direkt nach dem öffnenden Container, vor der DE-Anrede:
```
<p style="font-size:13px; color:#888; font-style:italic; margin:0 0 24px 0; text-align:right;">
  → English version below
</p>
```

### 2. Trenner zwischen DE und EN
Bestehenden Übergang ersetzen durch:
```
<div style="margin:48px 0; border-top:2px solid #e5e5e5; position:relative; text-align:center;">
  <span style="background:#ffffff; padding:0 16px; position:relative; top:-12px;
               font-size:12px; letter-spacing:2px; color:#888; text-transform:uppercase;">
    English Version
  </span>
</div>
```

### 3. Footer
Bleibt **einmalig** am Ende (gemäß Memory-Regel "Footer once at end").

## Inhalt (unverändert, 1:1 aus Maestro)
- 70,00 €/Person
- 70 Personen (Stand, final 10 Tage vor Event)
- Anzahlung 490,00 €
- Restbetrag 4.410,00 €
- Stripe-Link: `https://buy.stripe.com/9B65kCfvE1GG2eZf0z43S04`

## Output
Neue Version: `/mnt/documents/vorschau-rigshospitalet-restzahlung_v2.html` + QA-Screenshot.
