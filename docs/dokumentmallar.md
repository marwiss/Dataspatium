# Dokument och dokumentmallar

Under **Exportera › Dokument** skapar du dokument ur en datamängd: rapporter, kodböcker och
sammanställningar per grupp. En mall är vanlig text i Markdown med platshållare. Samma mall ger HTML, Word
(DOCX), PDF, Markdown och LaTeX, och kan köras i batch så att varje kommun, år eller annan grupp får sitt eget
dokument.

## Så här gör du

1. Välj en datamängd i objektpanelen och öppna fliken **Dokument** i Exportera.
2. Välj en mall: **Rapport om datamängd**, **Kodbok** eller **Sammanställning per grupp**, eller en egen sparad
   mall. Mallen visas till vänster och förhandsgranskningen till höger uppdateras medan du skriver.
3. Välj format och tryck **Skapa dokument**. Filen laddas ned.
4. **Batch per grupp** skapar ett dokument per värde i en kolumn och packar dem i en ZIP-fil med manifest.
5. **Spara mall** sparar dina ändringar i arbetsytan (inbyggda mallar sparas som kopior). **Exportera mall (fil)**
   ger en `*.doc.json` som en kollega kan lägga till med **Importera mall (fil)**. Egna mallar följer med i
   arbetsytans säkerhetskopia.

## Mallspråket

Mallen är Markdown: `#`, `##`, `###` för rubriker, tomma rader mellan stycken, `-` för punktlistor, `1.` för
numrerade listor, `**fet**`, `*kursiv*`, `` `kod` ``, `[text](https://…)` för länkar, `---` för en linje och tabeller
med lodstreck.

Platshållare skrivs med dubbla klammerparenteser (Mustache). Tal får svenskt format med mellanslag som
tusentalsavgränsare och decimalkomma.

| Platshållare | Innehåll |
|---|---|
| `{{datamangd}}`, `{{beskrivning}}`, `{{kalla}}` | Datamängdens namn, beskrivning och källa |
| `{{antal_rader}}`, `{{antal_kolumner}}` | Antal rader (efter filter) och kolumner |
| `{{datum}}`, `{{tid}}`, `{{app}}` | Dagens datum, klockslag och appversion |
| `{{summor.kolumn}}`, `{{medel.kolumn}}`, `{{minsta.kolumn}}`, `{{storsta.kolumn}}` | Summa, medel, minsta och största för en talkolumn |
| `{{grupp}}`, `{{gruppkolumn}}` | Gruppens värde och kolumnnamn i batchkörningar |
| `{{#rader}} … {{/rader}}` | Upprepas för varje rad (högst 1 000); inuti används kolumnnamnen, till exempel `{{kommun}}` |
| `{{#kolumner}} … {{/kolumner}}` | Upprepas för varje kolumn med `{{namn}}`, `{{typ}}`, `{{etikett}}`, `{{beskrivning}}`, `{{enhet}}` och `{{vardeetiketter}}` (till exempel `1 = Man; 2 = Kvinna`; de tre sista är tomma om de inte satts under Bearbeta) |
| `{{#beskrivning}} … {{/beskrivning}}` | Visas bara om värdet finns (Mustache-sektion) |

Kolumnnamn skrivs som i tabellen (städade namn, till exempel `folkmangd`).

### Tabeller ur datamängden

```
{{#tabell}}kolumner: kommun, folkmangd; sortera: folkmangd fallande; topp: 10; filter: lan = Skåne län; rubrik: De största kommunerna{{/tabell}}
```

Alla delar är valfria: utan `kolumner` tas alla kolumner med, utan `topp` visas 50 rader (högst 5 000),
`sortera` tar `stigande` eller `fallande`, `filter` tar villkor med `=`, `!=`, `>`, `>=`, `<`, `<=` eller
`innehåller` som kan kombineras med `och`. `kalla: kolumner` ger i stället en tabell över datamängdens kolumner
(namn, typ, etikett, beskrivning och enhet, och värdeetiketter när någon kolumn har sådana).
Talkolumner högerställs.

### Diagram

```
{{diagram "Folkmängd per län" | bredd: 600}}
```

Lägger in ett sparat diagram från Visualisera (Vega-Lite eller D3) som bild, renderat med samma filter som
dokumentet. I batchkörningar filtreras diagrammet på gruppen. R-diagram kan inte läggas in i dokument.

### Sidbrytning och kodbok

`{{sidbrytning}}` bryter sida i Word, PDF och LaTeX. Mallen **Kodbok** använder utökade kolumnuppgifter:
`{{saknade}}`, `{{unika}}`, `{{minsta}}`, `{{storsta}}`, `{{medel}}`, `{{anmarkningar}}` och `{{ar_unik}}` per
kolumn samt `{{dubbletter}}`; de finns när mallen är markerad som kodbok (en kopia av den inbyggda mallen behåller
det).

## Format

| Format | Vad du får |
|---|---|
| HTML | En fristående sida med inbyggd stil och bilder inbäddade, öppnas i vilken webbläsare som helst och kan skrivas ut |
| Word (DOCX) | Rubriker, stycken, listor, tabeller med rubrikrad och bilder; typsnitt Arial; öppnas i Word och LibreOffice |
| PDF | A4 med sidnummer, tabeller via jsPDF och jspdf-autotable; typsnitt Helvetica |
| Markdown | `.md`; med bilder en ZIP med `figures/` |
| LaTeX | ZIP med `main.tex` (article, booktabs, longtable, graphicx, hyperref, svensk babel) och `figures/`; kompileras med pdflatex, xelatex eller lualatex, eller laddas upp till Overleaf |

Text escapas alltid för målformatet: `&`, `<` och `>` i HTML, `&`, `%`, `_` med flera i LaTeX, XML i DOCX.

## Begränsningar

- Mallar renderas i webbläsaren; mycket stora tabeller i dokument tar tid, särskilt i PDF och Word.
- PDF och Word använder standardtypsnitt (Helvetica respektive Arial) i stället för appens Inter.
- Markdown-stödet är ett urval: inga fotnoter, inga nästlade listor, inga rubriker under nivå fyra.
- LaTeX kompileras inte i webbläsaren.
