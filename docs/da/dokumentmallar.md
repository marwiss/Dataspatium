# Dokumenter og dokumentskabeloner

Under **Eksportér › Dokumenter** opretter du dokumenter fra et datasæt: rapporter, kodebøger og sammenfatninger pr.
gruppe. En skabelon er almindelig tekst i Markdown med pladsholdere. Samme skabelon giver HTML, Word (DOCX), PDF,
Markdown og LaTeX og kan køres i batch, så hver kommune, hvert år eller hver anden gruppe får sit eget dokument.

Pladsholderne og tabelnøgleordene er svenske ord (`{{datamangd}}`, `kolumner`, `sortera`, …). De er en del af
skabelonsproget og er de samme, uanset hvilket sprog appen vises på; de indbyggede skabeloners tekster følger appens sprog.

## Sådan gør du

1. Vælg et datasæt i objektpanelet, og åbn fanen **Dokumenter** i Eksportér.
2. Vælg en skabelon: **Rapport om et datasæt**, **Kodebog** eller **Sammenfatning pr. gruppe** eller en egen gemt
   skabelon. Skabelonen vises til venstre, og forhåndsvisningen til højre opdateres, mens du skriver.
3. Vælg format, og tryk **Opret dokument**. Filen downloades.
4. **Batch pr. gruppe** opretter ét dokument pr. værdi i en kolonne og pakker dem i en ZIP-fil med manifest.
5. **Gem skabelon** gemmer dine ændringer i arbejdsområdet (indbyggede skabeloner gemmes som kopier). **Eksportér skabelon
   (fil)** giver en `*.doc.json`, som en kollega kan tilføje med **Importér skabelon (fil)**. Egne skabeloner følger med i
   arbejdsområdets backup.

## Skabelonsproget

Skabelonen er Markdown: `#`, `##`, `###` til overskrifter, tomme linjer mellem afsnit, `-` til punktlister, `1.` til
nummererede lister, `**fed**`, `*kursiv*`, `` `kode` ``, `[tekst](https://…)` til links, `---` til en linje og tabeller med
lodrette streger.

En omvendt skråstreg foran `*`, `_`, `` ` ``, `|`, `[`, `]` eller `#` viser tegnet, som det er, også i en tabelcelle.

Pladsholdere skrives med dobbelte krøllede parenteser (Mustache). Tal får formatet for appens sprog (på dansk 1.234,5).

| Pladsholder | Indhold |
|---|---|
| `{{datamangd}}`, `{{beskrivning}}`, `{{kalla}}` | Datasættets navn, beskrivelse og kilde |
| `{{antal_rader}}`, `{{antal_kolumner}}` | Antal rækker (efter filtre) og kolonner |
| `{{datum}}`, `{{tid}}`, `{{app}}` | Dagens dato, klokkeslæt og appversion |
| `{{summor.kolumn}}`, `{{medel.kolumn}}`, `{{minsta.kolumn}}`, `{{storsta.kolumn}}` | Sum, gennemsnit, mindste og største for en talkolonne (erstat `kolumn` med kolonnenavnet) |
| `{{grupp}}`, `{{gruppkolumn}}` | Gruppens værdi og kolonnenavn i batchkørsler |
| `{{#rader}} … {{/rader}}` | Gentages for hver række (højst 1 000); indeni bruges kolonnenavnene, for eksempel `{{kommun}}` |
| `{{#kolumner}} … {{/kolumner}}` | Gentages for hver kolonne med `{{namn}}`, `{{typ}}`, `{{etikett}}`, `{{beskrivning}}`, `{{enhet}}` og `{{vardeetiketter}}` (for eksempel `1 = Mand; 2 = Kvinde`; de tre sidste er tomme, medmindre de er sat under Bearbejd) |
| `{{#beskrivning}} … {{/beskrivning}}` | Vises kun, hvis værdien findes (Mustache-sektion) |

Kolonnenavne skrives som i tabellen (rensede navne, for eksempel `folkmangd`).

### Tabeller fra datasættet

```
{{#tabell}}kolumner: kommun, folkmangd; sortera: folkmangd fallande; topp: 10; filter: lan = Skåne län; rubrik: De største kommuner{{/tabell}}
```

Alle dele er valgfrie: uden `kolumner` tages alle kolonner med, uden `topp` vises 50 rækker (højst 5 000), `sortera` tager
`stigande` (stigende) eller `fallande` (faldende), `filter` tager betingelser med `=`, `!=`, `>`, `>=`, `<`, `<=` eller
`innehåller` (indeholder), der kan kombineres med `och` eller `and`, og `rubrik` er tabellens overskrift. `kalla: kolumner`
giver i stedet en tabel over datasættets kolonner (navn, type, etiket, beskrivelse og enhed samt værdietiketter, når en kolonne har dem). Talkolonner højrestilles.

### Diagrammer

```
{{diagram "Befolkning pr. län" | bredd: 600}}
```

Indsætter et gemt diagram fra Visualisér (Vega-Lite eller D3) som billede, gengivet med samme filtre som dokumentet;
`bredd` er bredden i pixel. I batchkørsler filtreres diagrammet på gruppen. R- og Python-diagrammer tegnes af deres motorer, når dokumentet oprettes (nogle sekunder pr. diagram).

### Sideskift og kodebog

`{{bild "fil.jpg" | bredd: 400}}` indsætter et billede fra en billedsamling (se [dokument.md](dokument.md)): billedet
søges først i skabelonens datasæt og derefter i alle billedsamlinger, forhåndsvisningen bruges og skaleres til den
angivne bredde (standard højst 720 px; `hojd` kan også angives). Tagget virker i alle formater og i batchkørsler som
`{{diagram}}`.
`{{sidbrytning}}` laver sideskift i Word, PDF og LaTeX. Skabelonen **Kodebog** bruger udvidede kolonneoplysninger:
`{{saknade}}`, `{{unika}}`, `{{minsta}}`, `{{storsta}}`, `{{medel}}`, `{{anmarkningar}}` og `{{ar_unik}}` pr. kolonne samt
`{{dubbletter}}`; de findes, når skabelonen er markeret som kodebog (en kopi af den indbyggede skabelon bevarer det).

`{{karta "datasæt"}}`, `{{graf "datasæt"}}`, `{{modell "datasæt"}}` og `{{plan "datasæt"}}` indsætter datasættets eget billede uden et gemt diagram. Datasættet angives med navn eller kortnavn, og bredde og højde som for `{{diagram}}`. En skabelon siger til, hvis datasættet mangler eller ikke kan tegnes på den måde.

## Inspektionsrapport og vedligeholdelsesplan

Fundene fra *Kontrollér med AI* (se [cad-bim.md](cad-bim.md)) bliver til en inspektionsrapport eller en vedligeholdelsesplan med de
indbyggede skabeloner **Inspektionsrapport** og **Vedligeholdelsesplan**. *Lav rapport* og *Lav vedligeholdelsesplan* i AI-panelet, og
kortet *Rapport og vedligeholdelsesplan* i Kontrollér, når en tabel med fund er valgt, åbner fanen Dokumenter med tabellen valgt og
skabelonen klar; i AI-panelet gemmes fundene først som tabel, hvis de ikke allerede er gemt. Øverst står bygningens oplysninger fra
modellen: bygning, projekt, grund, etager, model, fil og IFC-skema, og bygningens id og opførelsesår, når Pset_BuildingCommon har dem.
Derefter kommer fundene efter bygningsdel, bygningens seks lag efter klimaerklæringens regler (elementets IFC-klasse, IsExternal og
LoadBearing), med foto, stand, prioritet og anbefalet tiltag; inden for en bygningsdel kommer det mest presserende først.
Bygningsdelen står i kolonnen `byggdel` (1–6) i tabellen med fund og kan rettes under Bearbejd. Fotoene følger med tabellen uden
deres EXIF-oplysninger, og fotoets position kommer kun med i dokumentet, hvis du selv tilføjer `{{plats}}`.

Vedligeholdelsesplanen sætter et år på hvert tiltag efter reglen i skabelonen:

```
{{#underhallsregel}}prioritet: urgent 0, high 1, medium 3, low 5; skick: critical 0, poor 1, fair 3, good 10; intervall: 5{{/underhallsregel}}
```

Året for tiltaget er inspektionens år (fundets dato) plus det laveste antal år, som prioriteten og standen giver, så en kritisk
stand går forud for en lav prioritet, og næste kontrol kommer `intervall` år efter tiltaget. Niveauerne skrives med koden eller
ordet (akut, høj, middel og lav; kritisk, dårlig, acceptabel og god). Ret tallene i en kopi af skabelonen; tagget ses ikke i
dokumentet.

| Pladsholder | Indhold |
|---|---|
| `{{#byggdelar}} … {{/byggdelar}}` | En gruppe pr. bygningsdel med `{{namn}}`, `{{antal}}` og fundene i `{{#fynd}} … {{/fynd}}` |
| `{{#klasser}}`, `{{#plan}}` | Samme slags grupper pr. IFC-klasse og pr. år for tiltaget |
| `{{#fynd}}`, `{{#tidsplan}}` | Alle fund i tabellens rækkefølge eller efter år for tiltaget |
| `{{nr}}`, `{{titel}}`, `{{beskrivning}}`, `{{element}}`, `{{ifc_klass}}`, `{{vaning}}`, `{{byggdel}}` | Fundet og dets element |
| `{{skick}}`, `{{prioritet}}`, `{{atgard}}`, `{{datum}}`, `{{foto}}`, `{{bild}}` | Stand og prioritet i ord, tiltaget, datoen, fotoets navn og fotoet som billede |
| `{{ar}}`, `{{nasta_kontroll}}` | Året for tiltaget og året for næste kontrol |
| `{{#fakta}}`, `{{byggnad.namn}}` | Bygningens oplysninger, med `{{namn}}` og `{{varde}}` i `{{#fakta}}` |
| `{{antal_fynd}}`, `{{besiktningsdatum}}`, `{{#per_skick}}`, `{{#per_prioritet}}` | Antallet af fund, inspektionens datoer og antallet pr. stand og prioritet (`{{ord}}`, `{{antal}}`) |

Fundenes tekst kommer med, som den står: tegn som `*`, `_` og `|` bliver aldrig til formatering.

## Formater

| Format | Hvad du får |
|---|---|
| HTML | En selvstændig side med indbygget stil og indlejrede billeder, åbnes i enhver browser og kan udskrives |
| Word (DOCX) | Overskrifter, afsnit, lister, tabeller med overskriftsrække og billeder; skrifttype Arial; åbnes i Word og LibreOffice |
| PDF | A4 med sidetal, tabeller via jsPDF og jspdf-autotable; skrifttype Helvetica |
| Markdown | `.md`; med billeder en ZIP med `figures/` |
| LaTeX | ZIP med `main.tex` (article, booktabs, longtable, graphicx, hyperref, babel på appens sprog) og `figures/`; kompileres med pdflatex, xelatex eller lualatex, eller uploades til Overleaf |

Tekst escapes altid for målformatet: `&`, `<` og `>` i HTML, `&`, `%`, `_` med flere i LaTeX, XML i DOCX.

## Begrænsninger

- Skabeloner gengives i browseren; meget store tabeller i dokumenter tager tid, især i PDF og Word.
- PDF og Word bruger standardskrifttyper (Helvetica og Arial) i stedet for appens Inter.
- Markdown-understøttelsen er et udvalg: ingen fodnoter, ingen indlejrede lister, ingen overskrifter under niveau fire.
- LaTeX kompileres ikke i browseren.
