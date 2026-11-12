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

Ett omvänt snedstreck före `*`, `_`, `` ` ``, `|`, `[`, `]` eller `#` visar tecknet som det är, också i en tabellcell.

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
dokumentet. I batchkörningar filtreras diagrammet på gruppen. R- och Python-diagram ritas av sina motorer när dokumentet skapas (några sekunder per diagram).

### Sidbrytning och kodbok

`{{bild "fil.jpg" | bredd: 400}}` lägger in en bild ur en bildsamling (se [dokument.md](dokument.md)): bilden söks
först i mallens datamängd och sedan i alla bildsamlingar, förhandsvisningen används och skalas till angiven bredd
(standard högst 720 px; `hojd` kan också anges). Taggen fungerar i alla format och i batchkörningar som `{{diagram}}`.
`{{sidbrytning}}` bryter sida i Word, PDF och LaTeX. Mallen **Kodbok** använder utökade kolumnuppgifter:
`{{saknade}}`, `{{unika}}`, `{{minsta}}`, `{{storsta}}`, `{{medel}}`, `{{anmarkningar}}` och `{{ar_unik}}` per
kolumn samt `{{dubbletter}}`; de finns när mallen är markerad som kodbok (en kopia av den inbyggda mallen behåller
det).

`{{karta "datamängd"}}`, `{{graf "datamängd"}}`, `{{modell "datamängd"}}` och `{{plan "datamängd"}}` lägger in datamängdens egen bild utan att du behöver spara ett diagram. Datamängden anges med namn eller kortnamn, och bredd och höjd anges som för `{{diagram}}`. En mall säger till om datamängden saknas eller inte kan ritas på det sättet.

## Besiktningsrapport och underhållsplan

Fynden från *Kontrollera med AI* (se [cad-bim.md](cad-bim.md)) blir en besiktningsrapport eller en underhållsplan med de inbyggda
mallarna **Besiktningsrapport** och **Underhållsplan**. *Gör rapport* och *Gör underhållsplan* i AI-panelen, och kortet *Rapport och
underhållsplan* i Kontrollera när en fyndtabell är vald, öppnar fliken Dokument med tabellen vald och mallen klar; i AI-panelen sparas
fynden som tabell först om de inte redan är sparade. Överst står byggnadens uppgifter ur modellen: byggnad, projekt, plats, våningar,
modell, fil och IFC-schema, och byggnadens id och byggår när Pset_BuildingCommon har dem. Sedan kommer fynden per byggdel, byggnadens
sex skikt efter klimatdeklarationens regler (elementets IFC-klass, IsExternal och LoadBearing), med foto, skick, prioritet och
rekommenderad åtgärd; inom en byggdel kommer det mest brådskande först. Byggdelen står i fyndtabellens kolumn `byggdel` (1–6) och kan
rättas under Bearbeta. Fotona följer med fyndtabellen utan sina EXIF-uppgifter, och fotots position kommer med i dokumentet bara om du
själv lägger till `{{plats}}`.

Underhållsplanen sätter ett år på varje åtgärd efter regeln i mallen:

```
{{#underhallsregel}}prioritet: urgent 0, high 1, medium 3, low 5; skick: critical 0, poor 1, fair 3, good 10; intervall: 5{{/underhallsregel}}
```

Åtgärdsåret är besiktningens år (fyndets datum) plus det lägsta antalet år som prioriteten och skicket ger, så att ett kritiskt
skick går före en låg prioritet, och nästa kontroll är `intervall` år efter åtgärden. Nivåerna skrivs med koden eller ordet (akut,
hög, medel och låg; kritiskt, dåligt, godtagbart och bra). Ändra talen i en kopia av mallen; taggen syns inte i dokumentet.

| Platshållare | Innehåll |
|---|---|
| `{{#byggdelar}} … {{/byggdelar}}` | En grupp per byggdel med `{{namn}}`, `{{antal}}` och fynden i `{{#fynd}} … {{/fynd}}` |
| `{{#klasser}}`, `{{#plan}}` | Samma slags grupper per IFC-klass och per åtgärdsår |
| `{{#fynd}}`, `{{#tidsplan}}` | Alla fynd i tabellens ordning eller efter åtgärdsår |
| `{{nr}}`, `{{titel}}`, `{{beskrivning}}`, `{{element}}`, `{{ifc_klass}}`, `{{vaning}}`, `{{byggdel}}` | Fyndet och dess element |
| `{{skick}}`, `{{prioritet}}`, `{{atgard}}`, `{{datum}}`, `{{foto}}`, `{{bild}}` | Skick och prioritet i ord, åtgärden, datumet, fotots namn och fotot som bild |
| `{{ar}}`, `{{nasta_kontroll}}` | Åtgärdsåret och året för nästa kontroll |
| `{{#fakta}}`, `{{byggnad.namn}}` | Byggnadens uppgifter, med `{{namn}}` och `{{varde}}` i `{{#fakta}}` |
| `{{antal_fynd}}`, `{{besiktningsdatum}}`, `{{#per_skick}}`, `{{#per_prioritet}}` | Antalet fynd, besiktningens datum och antalet per skick och prioritet (`{{ord}}`, `{{antal}}`) |

Fyndens text kommer med som den står: tecken som `*`, `_` och `|` blir aldrig formatering.

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
