# Dokumenter og dokumentmaler

Under **Eksporter › Dokumenter** lager du dokumenter fra et datasett: rapporter, kodebøker og sammendrag per gruppe. En mal
er vanlig tekst i Markdown med plassholdere. Samme mal gir HTML, Word (DOCX), PDF, Markdown og LaTeX og kan kjøres i batch,
slik at hver kommune, hvert år eller hver annen gruppe får sitt eget dokument.

Plassholderne og tabellnøkkelordene er svenske ord (`{{datamangd}}`, `kolumner`, `sortera`, …). De er en del av malspråket
og er de samme uansett hvilket språk appen vises på; de innebygde malenes tekster følger appens språk.

## Slik gjør du

1. Velg et datasett i objektpanelet, og åpne fanen **Dokumenter** i Eksporter.
2. Velg en mal: **Rapport om et datasett**, **Kodebok** eller **Sammendrag per gruppe**, eller en egen lagret mal. Malen
   vises til venstre, og forhåndsvisningen til høyre oppdateres mens du skriver.
3. Velg format, og trykk **Lag dokument**. Filen lastes ned.
4. **Batch per gruppe** lager ett dokument per verdi i en kolonne og pakker dem i en ZIP-fil med manifest.
5. **Lagre mal** lagrer endringene dine i arbeidsområdet (innebygde maler lagres som kopier). **Eksporter mal (fil)** gir en
   `*.doc.json` som en kollega kan legge til med **Importer mal (fil)**. Egne maler følger med i arbeidsområdets
   sikkerhetskopi.

## Malspråket

Malen er Markdown: `#`, `##`, `###` for overskrifter, tomme linjer mellom avsnitt, `-` for punktlister, `1.` for
nummererte lister, `**fet**`, `*kursiv*`, `` `kode` ``, `[tekst](https://…)` for lenker, `---` for en linje og tabeller med
loddrette streker.

Plassholdere skrives med doble krøllparenteser (Mustache). Tall får formatet til appens språk (på norsk 1 234,5).

| Plassholder | Innhold |
|---|---|
| `{{datamangd}}`, `{{beskrivning}}`, `{{kalla}}` | Datasettets navn, beskrivelse og kilde |
| `{{antal_rader}}`, `{{antal_kolumner}}` | Antall rader (etter filtre) og kolonner |
| `{{datum}}`, `{{tid}}`, `{{app}}` | Dagens dato, klokkeslett og appversjon |
| `{{summor.kolumn}}`, `{{medel.kolumn}}`, `{{minsta.kolumn}}`, `{{storsta.kolumn}}` | Sum, gjennomsnitt, minste og største for en tallkolonne (erstatt `kolumn` med kolonnenavnet) |
| `{{grupp}}`, `{{gruppkolumn}}` | Gruppens verdi og kolonnenavn i batchkjøringer |
| `{{#rader}} … {{/rader}}` | Gjentas for hver rad (høyst 1 000); inni brukes kolonnenavnene, for eksempel `{{kommun}}` |
| `{{#kolumner}} … {{/kolumner}}` | Gjentas for hver kolonne med `{{namn}}`, `{{typ}}`, `{{etikett}}`, `{{beskrivning}}`, `{{enhet}}` og `{{vardeetiketter}}` (for eksempel `1 = Mann; 2 = Kvinne`; de tre siste er tomme med mindre de er satt under Bearbeid) |
| `{{#beskrivning}} … {{/beskrivning}}` | Vises bare hvis verdien finnes (Mustache-seksjon) |

Kolonnenavn skrives som i tabellen (rensede navn, for eksempel `folkmangd`).

### Tabeller fra datasettet

```
{{#tabell}}kolumner: kommun, folkmangd; sortera: folkmangd fallande; topp: 10; filter: lan = Skåne län; rubrik: De største kommunene{{/tabell}}
```

Alle deler er valgfrie: uten `kolumner` tas alle kolonner med, uten `topp` vises 50 rader (høyst 5 000), `sortera` tar
`stigande` (stigende) eller `fallande` (fallende), `filter` tar betingelser med `=`, `!=`, `>`, `>=`, `<`, `<=` eller
`innehåller` (inneholder) som kan kombineres med `och` eller `and`, og `rubrik` er tabellens overskrift. `kalla: kolumner`
gir i stedet en tabell over datasettets kolonner (navn, type, etikett, beskrivelse og enhet samt verdietiketter når en kolonne har dem). Tallkolonner høyrejusteres.

### Diagrammer

```
{{diagram "Befolkning per län" | bredd: 600}}
```

Setter inn et lagret diagram fra Visualiser (Vega-Lite eller D3) som bilde, gjengitt med samme filtre som dokumentet; `bredd`
er bredden i piksler. I batchkjøringer filtreres diagrammet på gruppen. R-diagrammer kan ikke settes inn i dokumenter.

### Sideskift og kodebok

`{{sidbrytning}}` gir sideskift i Word, PDF og LaTeX. Malen **Kodebok** bruker utvidede kolonneopplysninger: `{{saknade}}`,
`{{unika}}`, `{{minsta}}`, `{{storsta}}`, `{{medel}}`, `{{anmarkningar}}` og `{{ar_unik}}` per kolonne samt `{{dubbletter}}`;
de finnes når malen er merket som kodebok (en kopi av den innebygde malen beholder det).

## Formater

| Format | Hva du får |
|---|---|
| HTML | En frittstående side med innebygd stil og innebygde bilder, åpnes i enhver nettleser og kan skrives ut |
| Word (DOCX) | Overskrifter, avsnitt, lister, tabeller med overskriftsrad og bilder; skrifttype Arial; åpnes i Word og LibreOffice |
| PDF | A4 med sidetall, tabeller via jsPDF og jspdf-autotable; skrifttype Helvetica |
| Markdown | `.md`; med bilder en ZIP med `figures/` |
| LaTeX | ZIP med `main.tex` (article, booktabs, longtable, graphicx, hyperref, babel på appens språk) og `figures/`; kompileres med pdflatex, xelatex eller lualatex, eller lastes opp til Overleaf |

Tekst escapes alltid for målformatet: `&`, `<` og `>` i HTML, `&`, `%`, `_` med flere i LaTeX, XML i DOCX.

## Begrensninger

- Maler gjengis i nettleseren; svært store tabeller i dokumenter tar tid, særlig i PDF og Word.
- PDF og Word bruker standardskrifttyper (Helvetica og Arial) i stedet for appens Inter.
- Markdown-støtten er et utvalg: ingen fotnoter, ingen nestede lister, ingen overskrifter under nivå fire.
- LaTeX kompileres ikke i nettleseren.
