# Dokument og dokumentmalar

Under **Eksporter › Dokument** lagar du dokument frå eit datasett: rapportar, kodebøker og samandrag per gruppe. Ein mal
er vanleg tekst i Markdown med plasshaldarar. Same mal gjev HTML, Word (DOCX), PDF, Markdown og LaTeX og kan køyrast i batch,
slik at kvar kommune, kvart år eller kvar annan gruppe får sitt eige dokument.

Plasshaldarane og tabellnøkkelorda er svenske ord (`{{datamangd}}`, `kolumner`, `sortera`, …). Dei er ein del av malspråket
og er dei same uansett kva språk appen blir vist på; tekstane i dei innebygde malane følgjer språket i appen.

## Slik gjer du

1. Vel eit datasett i objektpanelet, og opne fana **Dokument** i Eksporter.
2. Vel ein mal: **Rapport om eit datasett**, **Kodebok** eller **Samandrag per gruppe**, eller ein eigen lagra mal. Malen
   blir vist til venstre, og førehandsvisinga til høgre blir oppdatert medan du skriv.
3. Vel format, og trykk **Lag dokument**. Fila blir lasta ned.
4. **Batch per gruppe** lagar eitt dokument per verdi i ein kolonne og pakkar dei i ei ZIP-fil med manifest.
5. **Lagre mal** lagrar endringane dine i arbeidsområdet (innebygde malar blir lagra som kopiar). **Eksporter mal (fil)** gjev ei
   `*.doc.json` som ein kollega kan leggje til med **Importer mal (fil)**. Eigne malar følgjer med i tryggingskopien
   av arbeidsområdet.

## Malspråket

Malen er Markdown: `#`, `##`, `###` for overskrifter, tomme linjer mellom avsnitt, `-` for punktlister, `1.` for
nummererte lister, `**feit**`, `*kursiv*`, `` `kode` ``, `[tekst](https://…)` for lenkjer, `---` for ei linje og tabellar med
loddrette strekar.

Ei omvend skråstrek framfor `*`, `_`, `` ` ``, `|`, `[`, `]` eller `#` viser teiknet slik det er, også i ei tabellcelle.

Plasshaldarar blir skrivne med doble krøllparentesar (Mustache). Tal får formatet til språket i appen (på norsk 1 234,5).

| Plasshaldar | Innhald |
|---|---|
| `{{datamangd}}`, `{{beskrivning}}`, `{{kalla}}` | Namnet, skildringa og kjelda til datasettet |
| `{{antal_rader}}`, `{{antal_kolumner}}` | Tal på rader (etter filter) og kolonnar |
| `{{datum}}`, `{{tid}}`, `{{app}}` | Dagens dato, klokkeslett og appversjon |
| `{{summor.kolumn}}`, `{{medel.kolumn}}`, `{{minsta.kolumn}}`, `{{storsta.kolumn}}` | Sum, gjennomsnitt, minste og største for ein talkolonne (erstatt `kolumn` med kolonnenamnet) |
| `{{grupp}}`, `{{gruppkolumn}}` | Verdien og kolonnenamnet til gruppa i batchkøyringar |
| `{{#rader}} … {{/rader}}` | Blir gjenteke for kvar rad (høgst 1 000); inni blir kolonnenamna brukte, til dømes `{{kommun}}` |
| `{{#kolumner}} … {{/kolumner}}` | Blir gjenteke for kvar kolonne med `{{namn}}`, `{{typ}}`, `{{etikett}}`, `{{beskrivning}}`, `{{enhet}}` og `{{vardeetiketter}}` (til dømes `1 = Mann; 2 = Kvinne`; dei tre siste er tomme med mindre dei er sette under Bearbeid) |
| `{{#beskrivning}} … {{/beskrivning}}` | Blir berre vist om verdien finst (Mustache-seksjon) |

Kolonnenamn blir skrivne som i tabellen (reinsa namn, til dømes `folkmangd`).

### Tabellar frå datasettet

```
{{#tabell}}kolumner: kommun, folkmangd; sortera: folkmangd fallande; topp: 10; filter: lan = Skåne län; rubrik: Dei største kommunane{{/tabell}}
```

Alle delar er valfrie: utan `kolumner` blir alle kolonnar tekne med, utan `topp` blir 50 rader viste (høgst 5 000), `sortera` tek
`stigande` (stigande) eller `fallande` (fallande), `filter` tek vilkår med `=`, `!=`, `>`, `>=`, `<`, `<=` eller
`innehåller` (inneheld) som kan kombinerast med `och` eller `and`, og `rubrik` er overskrifta til tabellen. `kalla: kolumner`
gjev i staden ein tabell over kolonnane i datasettet (namn, type, etikett, skildring og eining og dessutan verdietikettar når ein kolonne har dei). Talkolonnar blir høgrejusterte.

### Diagram

```
{{diagram "Befolkning per län" | bredd: 600}}
```

Set inn eit lagra diagram frå Visualiser (Vega-Lite eller D3) som bilete, teikna med dei same filtera som dokumentet; `bredd`
er breidda i pikslar. I batchkøyringar blir diagrammet filtrert på gruppa. R- og Python-diagram blir teikna av motorane sine når dokumentet blir laga (nokre sekund per diagram).

### Sideskift og kodebok

`{{bild "fil.jpg" | bredd: 400}}` set inn eit bilete frå ei biletsamling (sjå [dokument.md](dokument.md)): biletet blir søkt
først i datasettet til malen og deretter i alle biletsamlingar, førehandsvisinga blir brukt og skalert til oppgjeven breidd
(standard høgst 720 px; `hojd` kan òg oppgjevast). Taggen verkar i alle format og i batchkøyringar som `{{diagram}}`.
`{{sidbrytning}}` gjev sideskift i Word, PDF og LaTeX. Malen **Kodebok** brukar utvida kolonneopplysningar: `{{saknade}}`,
`{{unika}}`, `{{minsta}}`, `{{storsta}}`, `{{medel}}`, `{{anmarkningar}}` og `{{ar_unik}}` per kolonne og dessutan `{{dubbletter}}`;
dei finst når malen er merkt som kodebok (ein kopi av den innebygde malen held på det).

`{{karta "datasett"}}`, `{{graf "datasett"}}`, `{{modell "datasett"}}` og `{{plan "datasett"}}` set inn det eige biletet til datasettet utan eit lagra diagram. Datasettet blir oppgjeve med namn eller kortnamn, og breidd og høgd som for `{{diagram}}`. Ein mal seier frå om datasettet manglar eller ikkje kan teiknast på den måten.

## Synfaringsrapport og vedlikehaldsplan

Funna frå *Kontroller med AI* (sjå [cad-bim.md](cad-bim.md)) blir ein synfaringsrapport eller ein vedlikehaldsplan med dei innebygde
malane **Synfaringsrapport** og **Vedlikehaldsplan**. *Lag rapport* og *Lag vedlikehaldsplan* i AI-panelet, og kortet *Rapport og
vedlikehaldsplan* i Kontroller når ein tabell med funn er vald, opnar fana Dokument med tabellen vald og malen klar; i AI-panelet
blir funna lagra som tabell først om dei ikkje alt er lagra. Øvst står opplysningane om bygningen frå modellen: bygning, prosjekt,
tomt, etasjar, modell, fil og IFC-skjema, og ID-en og byggeåret til bygningen når Pset_BuildingCommon har dei. Så kjem funna etter
bygningsdel, dei seks laga i bygningen etter reglane for klimaerklæringa (IFC-klassen, IsExternal og LoadBearing til elementet), med
foto, tilstand, prioritet og tilrådd tiltak; innanfor ein bygningsdel kjem det som hastar mest, først. Bygningsdelen står i kolonnen
`byggdel` (1–6) i tabellen med funn og kan rettast under Bearbeid. Bileta følgjer med tabellen utan EXIF-opplysningane sine, og
posisjonen til biletet kjem berre med i dokumentet om du sjølv legg til `{{plats}}`.

Vedlikehaldsplanen set eit år på kvart tiltak etter regelen i malen:

```
{{#underhallsregel}}prioritet: urgent 0, high 1, medium 3, low 5; skick: critical 0, poor 1, fair 3, good 10; intervall: 5{{/underhallsregel}}
```

Året for tiltaket er året for synfaringa (datoen til funnet) pluss det lågaste talet på år som prioriteten og tilstanden gir, slik at
ein kritisk tilstand går føre ein låg prioritet, og neste kontroll kjem `intervall` år etter tiltaket. Nivåa blir skrivne med koden
eller ordet (akutt, høg, middels og låg; kritisk, dårleg, akseptabel og god). Endre tala i ein kopi av malen; taggen syner ikkje i
dokumentet.

| Plasshaldar | Innhald |
|---|---|
| `{{#byggdelar}} … {{/byggdelar}}` | Ei gruppe per bygningsdel med `{{namn}}`, `{{antal}}` og funna i `{{#fynd}} … {{/fynd}}` |
| `{{#klasser}}`, `{{#plan}}` | Same slags grupper per IFC-klasse og per år for tiltaket |
| `{{#fynd}}`, `{{#tidsplan}}` | Alle funn i rekkjefølgja i tabellen eller etter år for tiltaket |
| `{{nr}}`, `{{titel}}`, `{{beskrivning}}`, `{{element}}`, `{{ifc_klass}}`, `{{vaning}}`, `{{byggdel}}` | Funnet og elementet |
| `{{skick}}`, `{{prioritet}}`, `{{atgard}}`, `{{datum}}`, `{{foto}}`, `{{bild}}` | Tilstand og prioritet i ord, tiltaket, datoen, namnet på biletet og biletet |
| `{{ar}}`, `{{nasta_kontroll}}` | Året for tiltaket og året for neste kontroll |
| `{{#fakta}}`, `{{byggnad.namn}}` | Opplysningane om bygningen, med `{{namn}}` og `{{varde}}` i `{{#fakta}}` |
| `{{antal_fynd}}`, `{{besiktningsdatum}}`, `{{#per_skick}}`, `{{#per_prioritet}}` | Talet på funn, datoane for synfaringa og talet per tilstand og prioritet (`{{ord}}`, `{{antal}}`) |

Teksten i funna kjem med slik han står: teikn som `*`, `_` og `|` blir aldri formatering.

## Format

| Format | Kva du får |
|---|---|
| HTML | Ei frittståande side med innebygd stil og innebygde bilete, blir opna i kva nettlesar som helst og kan skrivast ut |
| Word (DOCX) | Overskrifter, avsnitt, lister, tabellar med overskriftsrad og bilete; skrifttype Arial; blir opna i Word og LibreOffice |
| PDF | A4 med sidetal, tabellar via jsPDF og jspdf-autotable; skrifttype Helvetica |
| Markdown | `.md`; med bilete ei ZIP-fil med `figures/` |
| LaTeX | ZIP med `main.tex` (article, booktabs, longtable, graphicx, hyperref, babel på språket i appen) og `figures/`; blir kompilert med pdflatex, xelatex eller lualatex, eller lasta opp til Overleaf |

Tekst blir alltid escapa for målformatet: `&`, `<` og `>` i HTML, `&`, `%`, `_` med fleire i LaTeX, XML i DOCX.

## Avgrensingar

- Malar blir teikna i nettlesaren; svært store tabellar i dokument tek tid, særleg i PDF og Word.
- PDF og Word brukar standardskrifttypar (Helvetica og Arial) i staden for Inter frå appen.
- Markdown-støtta er eit utval: ingen fotnotar, ingen nøsta lister, ingen overskrifter under nivå fire.
- LaTeX blir ikkje kompilert i nettlesaren.
