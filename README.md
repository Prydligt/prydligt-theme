# prydligt-theme

CSS för Prydligts Abicart-butiker (prydligt.se, .com/no, .com/da, .fi, .de, .eu).
En enda fil: `prydligt-master.css`.

## Så laddas den i Abicart

I Abicarts ruta för egen CSS ligger **bara** den här raden (och den måste stå först):

```css
@import url("https://cdn.jsdelivr.net/gh/Prydligt/prydligt-theme@v1.0.0/prydligt-master.css");
```

Filen hämtas från GitHub via jsDelivr. Versionen i länken (`@v1.0.0`) bestämmer vad som är live.

## Leveransnedräkning (prydligt-leveranstimer.js)

Visar "Beställ inom 1 h 34 min 32 s – skickas idag" under lagerstatusen på produktsidan.
Räknar i svensk tid, brytpunkt 16:00, måndag–fredag, hoppar över svenska helgdagar och
jul-, nyårs- och midsommarafton. Inställningarna står överst i filen (`CUTOFF_HOUR`,
`EXTRA_CLOSED` för egna stängda dagar m.m.). Ingen server behövs.

Laddas i Abicart där egen kod kan läggas in före `</body>`:

```html
<script src="https://cdn.jsdelivr.net/gh/Prydligt/prydligt-theme@v1.0.0/prydligt-leveranstimer.js" defer></script>
```

## Antalsknappar i varukorgen

Samma JS-fil ersätter Abicarts sifferfält + ⟳ med  − 1 +. Varukorgen uppdateras
automatiskt efter klick; vid antal 1 blir minus en papperskorg som tar bort varan.

## Släppa en ny version

1. Ändra `prydligt-master.css` och skriv vad som ändrats i `CHANGELOG.md`.
2. Committa och pusha till `main`.
3. Skapa en tagg, t.ex. `v1.0.1`, och pusha taggen.
4. Byt versionsnumret i `@import`-raden i Abicart till den nya taggen.
5. Testa i förhandsgranskningen innan temat publiceras.

**Backa:** byt tillbaka till förra taggen i `@import`-raden. Inget annat behövs.

## Bra att veta

- Använd alltid en tagg i länken, aldrig `@main`. jsDelivr cachar `@main` i upp till ett dygn,
  så ändringar slår inte igenom direkt. En tagg ändras aldrig och laddas om direkt när du byter den.
- Repot är publikt eftersom jsDelivr bara kan läsa publika repon. Lägg aldrig in lösenord,
  nycklar eller kunddata här.
- Specialtecken i texter som CSS:en skriver ut (pilar, bockar, å/ä/ö i `content:`) skrivs som
  koder, t.ex. `\002192` för →. Svenska tecken i kommentarer går bra.

## Struktur i filen

0. Färger, mått och språktexter · 1. Hela sajten · 2. Produktkort · 3. Kategorisidor ·
4. Produktsida · 5. Kassa · 6. Startsida · 7. Informationssidor · 8. Sidfot ·
9. "Lagd i varukorgen"-rutan · 10. Köpknapp i listor · 11. Äldre regler · 12. Leveransnedräkning
