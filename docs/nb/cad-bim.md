# CAD og BIM: bygningsmodeller og tegninger

Dataspatium åpner bygningsmodeller i IFC og tegninger i DXF som en egen type datasett. Modellen tegnes i 3D,
bygningsdelene blir en tabell, og egenskaper og mengder kan søkes i, beregnes og eksporteres. Alt skjer i nettleseren: filen
forlater aldri datamaskinen. Originalfilen lagres i datasettet og følger med i pakker og sikkerhetskopier.

## Åpne en modell

Slipp en `.ifc`-, `.ifczip`- eller `.dxf`-fil i Hent. Filens opplysninger vises (skjema, prosjekt, program, etasjer og antall
per type), og *Importer* lager datasettet. IFC2X3, IFC4 og IFC4X3 i STEP-format støttes. En modell på rundt 50 MB tar omtrent
et kvarter minutt å importere og åpnes deretter på noen sekunder.

## Modellen i Bearbeid

Modellen åpnes som 3D-visning med en tabell over bygningsdelene under. Dra for å dreie, rull for å zoome og dra med høyre
knapp for å flytte. Knappen med rammen viser hele modellen; enkelte objekter langt fra bygningen regnes ikke med.

- **Marker**: klikk på en bygningsdel i modellen eller en rad i tabellen. Markeringen følger med, og inspektøren viser
  type, etasje, materiale, klassifikasjon, egenskaper og mengder samt overflate og volum målt på geometrien.
- **Filtrer**: velg type eller etasje, eller søk på navn, materiale eller egenskap. Tabellen og modellen viser samme utvalg.
- **Vis som tabell**: alle kolonner som en vanlig tabell med alle verktøyene i Bearbeid.
- **Lagre som diagram**: visningen med filter og kameravinkel blir et diagram i Visualiser.

Geometrien beregnes fra originalfilen første gang modellen åpnes i en økt, og brukes bare til å tegne og måle. Tabellene
finnes fortsatt selv om datamaskinen mangler WebGL; da vises en melding i stedet for 3D-visningen.

## Saker fra et CDE

En modell hentet fra en OpenCDE-server, eller hvilken som helst modell når en slik server finnes som kilde, kan vise sakene
sine: knappen *Saker* i modellvisningen åpner et panel i inspektøren med prosjektets BCF-saker. De som peker på
bygningsdeler i denne modellen står først, med status og antall bygningsdeler. Klikk på en sak, så markeres bygningsdelene i
3D-visningen, og panelet viser beskrivelse, øyeblikksbilde og kommentarer. Sakene hentes når du ber om det og lagres ikke i
datasettet; for å regne på dem lagrer du dem som en tabell i Hent. Dette er lesing; å opprette og endre saker kommer i
neste utgave.

Med rettighetene til det kan du også skrive. *Ny sak* oppretter en sak på serveren med tittel, type, status og etiketter fra
prosjektets lister, og visningen følger med som viewpoint: kameraet, et øyeblikksbilde og de markerte bygningsdelene som
komponenter. I en valgt sak kan du skrive en kommentar, bytte status og legge til den aktuelle visningen som et nytt viewpoint.
*Lagre som BCF* gir alle prosjektets saker med kommentarer, viewpoints og øyeblikksbilder som en BCF-fil, som verktøy uten API
kan åpne. En BCF-fil kan også leses inn i Hent: sakene blir en tabell, kommentarer og komponenter tabeller ved siden av.

*Farg etter status* gir bygningsdelene fargen fra sin mest åpne sak: rød for åpne, gul for pågående, grønn for avsluttede, med en
tegnforklaring under listen. *Lagre som tabell* gir prosjektets saker som en tabell med én rad per sak og bygningsdel (type, navn
og etasje følger med), som Håndter kjenner igjen som saker: kortet *Saker* viser status og oppretter dashbordet *Sakstatus* med
status, type, ansvarlig, prioritet og måned bak felles filtre, og knappen *Vis i modellen* går tilbake til panelet. Verktøyet
*Saker* i Analysers fane Mengder teller saker, åpne saker og bygningsdeler per status, type, prioritet, ansvarlig, bygningsdelstype
eller etasje fra en slik tabell, og SQL-startkoden får spørringer for koblingen. *Lagre som diagram* lagrer visningen med fargene
som et modelldiagram, som dashbord, dokumenter og Publiser viser med tegnforklaring.

Grafens modell, relasjonene og spørringene fra Dataspatiums side finnes i Kontrolls [ifcgraph.md](https://github.com/marwiss/Kontroll/blob/main/docs/nb/ifcgraph.md).

## Tabellene

| Tabell | Innhold |
|---|---|
| `data` | Én rad per bygningsdel, rom og etasje: id, guid, typ (type), kategori (byggdel, rum, struktur), namn (navn), beskrivning, objekttyp, tagg, vaning (etasje), typnamn, material, klassificering, egenskaper og mangder (mengder) som JSON |
| `_properties` | Én rad per egenskap: id, uppsattning (sett), namn, varde (verdi), tal, enhet, kalla (objekt eller typ) |
| `_quantities` | Én rad per mengde i SI-enheter: id, uppsattning, namn, varde, slag (langd, area, volym, vikt, tid, antal), enhet |
| `_entities` | Filens ikke-geometriske entiteter med rå attributter: id, typ, attribut |

Egenskaper som bare finnes på bygningsdelens type, regnes med og er merket `typ`. Mengder regnes om til meter,
kvadratmeter, kubikkmeter og kilogram med prosjektets enheter. Åpninger og tilkoblingsporter er ikke bygningsdeler og finnes
bare i `_entities`.

Tabellene kan spørres med SQL i Analyser:

```sql
SELECT d.vaning, d.typ, count(*) AS antal, sum(q.varde) AS volym
FROM data d JOIN _quantities q ON q.id = d.id
WHERE q.namn = 'NetVolume'
GROUP BY 1, 2 ORDER BY 1, 2
```

I R og Python gir `dm_read()` bygningsdelene, `dm_read_properties()` egenskapene og `dm_read_quantities()` mengdene.

## Fanen Mengder i Analyser

- **Sammendrag**: filens opplysninger og innhold.
- **Mengder**: antall, lengde, areal, volum og vekt gruppert etter type, etasje, materiale, typenavn eller klassifikasjon.
  Kilden *Filens mengder* tar én verdi per bygningsdel og slag: netto før andre og brutto sist, slik at en vegg ikke telles
  to ganger. Kilden *Målt på geometrien* regner på trekantene og virker også når filen mangler mengder. Overflaten er da
  hele overflaten rundt bygningsdelen, ikke for eksempel en veggs sideareal.
- **Mengdeliste**: hvert mengdenavn i filen per type med sum. Her ser du nøyaktig hva filen angir.
- **Egenskaper**: hvilke verdier en egenskap har, og hos hvor mange bygningsdeler av hver type.
- **Entiteter**: hvor mange entiteter av hvert slag filen består av.

Hvert resultat kan lagres som datasett.

## IfcOpenShell i appen

Siden 2.4.0 kan appen lese, kontrollere og endre IFC-modeller med IfcOpenShell, det samme biblioteket som Kontroll bygger på. Det
kjører i Python i nettleseren, hentes første gang det brukes (cirka 13 MB, etter ditt samtykke til komponenter) og lagres
deretter i nettleseren. Ingenting sendes noe sted; modellen forlater ikke datamaskinen.

**I Analyser, fanen Mengder**, har en IFC-modell fem verktøy til:

- **Validering** kontrollerer modellen mot sitt IFC-skjema: attributter, typer og referanser, valgfritt også skjemaets regler.
  Funnene kan lagres som datasett.
- **Romlig struktur** viser prosjekt, tomt, bygning, etasjer og rom som et tre med antall elementer per del.
- **Egenskapssett** gir alle egenskapssett for en elementtype som en bred tabell: en rad per element, en kolonne per
  egenskap (`Sett.Egenskap`), valgfritt også mengdesettene.
- **IFC-utvalg** henter elementer med IfcOpenShells utvalgsspråk, for eksempel `IfcWall, Pset_WallCommon.FireRating=EI60` eller
  `IfcElement, material=Betong`.
- **Geometrimål** måler volum, overflate og omsluttende boks per element på geometrien (OpenCASCADE). Langsomt for store
  modeller.
- **IDS-kontroll** (2.5.0) kontrollerer modellen mot en IDS-fil (buildingSMART Information Delivery Specification) med
  ifctester, IfcOpenShells egen kontrollør: velg .ids-filen, så får du en rad per krav og element med godkjent, ikke godkjent
  eller ikke relevant og årsaken, samt en opptelling. Filen blir i nettleseren. ifctester følger med appen uten webappen sin, så
  ingenting hentes utover Python selv.

**I Bearbeid** har modellen to handlinger under *Handlinger* (knappen finnes i modellvisningen og i tabellvisningen), i gruppen
*Modell*:

- **Skriv tabell til modellen** skriver en tabells verdier inn i modellen. Radene matches på GUID; kolonnene `Name`,
  `Description`, `ObjectType` og `Tag` (eller `namn`, `beskrivning`, `objekttyp`, `tagg`) blir attributter, og kolonner som
  `Pset_WallCommon.FireRating` blir egenskaper (settet opprettes hvis det mangler). Arbeidsmåten: lagre *Egenskapssett* som
  datasett, rediger det i Bearbeid og skriv tilbake.
- **Python på modellen** kjører en funksjon `step(model)` med IfcOpenShells API på hele modellen.

Begge er steg i oppskriften: den endrede modellen blir datasettets nye innhold (originalfilen byttes og tabellene bygges om),
steget logges og kan angres, og originalfilen er alltid den gjeldende versjonen når du eksporterer modellen eller sender den
til et CDE.

**I Python** (fanen Python i Analyser og kodeceller i notatboken) åpner `dm_ifc("navn")` modellen som en `ifcopenshell.file`.
Hjelperne `dm_ifc_elements`, `dm_ifc_psets`, `dm_ifc_tree`, `dm_ifc_validate`, `dm_ifc_select` og `dm_ifc_geometry` gir
tabeller, `dm_ifc_set(model, df)` skriver en tabell inn i modellen, og `dm_ifc_write(model, "navn")` sender modellen til appen som
et nytt datasett; se [Python i Dataspatium](python.md). Verktøyene i Analyser og Python endrer aldri datasettet; bare
handlingene i Bearbeid gir en ny versjon.

IfcOpenShell er LGPL-3.0 og hentes uendret som fastlåste wheels fra IfcOpenShells egen fortegnelse, se [Lisenser](licenser.md).

## DXF-tegninger

En DXF-fil blir en tabell med ett tegningsobjekt per rad (type, lag, farge, lengde, areal, tekst og plassering) og en
SVG-tegning. Tegningen åpnes i Bearbeid, der du zoomer med hjulet og panorerer ved å dra. Lagene slås av og på i inspektøren,
og et klikk markerer objektet og raden. Fanen Mengder gir antall, lengde og areal per lag og type.

Linjer, polylinjer med buer, sirkler, buer, ellipser, splines, punkter, tekster, solider, 3D-flater, blokker og
målsettingers blokker tegnes. Skravering (HATCH) tegnes ikke.

## Eksport

Eksporter gir originalfilen, egenskapene og mengdene som CSV (én rad per verdi) og tegningen som SVG, i tillegg til de
vanlige tabellformatene for `data`. Diagrammer av modeller eksporteres som PNG, SVG og PDF; en 3D-modell blir da et bilde.

## Begrensninger

- Modellen kan ikke redigeres, og ingen ny IFC-fil skrives. Endringer i tabellene påvirker ikke originalfilen.
- En modell tegnes på nytt fra originalfilen i hver ny økt. Modellen på 57 MB som appen er prøvd med, tar 4–6 sekunder.
- Den første tegningen av en svært stor modell kan låse siden et øyeblikk mens grafikkortet tar imot trekantene.
- Mengdene er ikke en mengdeberegning etter noe regelverk. Kontroller dem mot kilden før de brukes.
- DXF leses i to dimensjoner. DWG må først lagres som DXF.
