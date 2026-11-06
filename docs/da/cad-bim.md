# CAD og BIM: bygningsmodeller og tegninger

Dataspatium åbner bygningsmodeller i IFC og tegninger i DXF som en egen type datasæt. Modellen tegnes i 3D,
bygningsdelene bliver en tabel, og egenskaber og mængder kan søges i, beregnes og eksporteres. Alt sker i browseren: filen
forlader aldrig computeren. Originalfilen gemmes i datasættet og følger med i pakker og sikkerhedskopier.

## Åbn en model

Slip en `.ifc`-, `.ifczip`- eller `.dxf`-fil i Hent. Filens oplysninger vises (skema, projekt, program, etager og antal pr.
type), og *Importér* opretter datasættet. IFC2X3, IFC4 og IFC4X3 i STEP-format understøttes. En model på omkring 50 MB
tager cirka et kvarter minut at importere og åbnes derefter på få sekunder.

## Modellen i Bearbejd

Modellen åbnes som 3D-visning med en tabel over bygningsdelene nedenunder. Træk for at dreje, rul for at zoome og træk med
højre knap for at flytte. Knappen med rammen viser hele modellen; enkelte objekter langt fra bygningen tælles ikke med.

- **Markér**: klik på en bygningsdel i modellen eller en række i tabellen. Markeringen følger med, og inspektøren viser
  type, etage, materiale, klassifikation, egenskaber og mængder samt overflade og volumen målt på geometrien.
- **Filtrér**: vælg type eller etage, eller søg på navn, materiale eller egenskab. Tabellen og modellen viser samme udvalg.
- **Vis som tabel**: alle kolonner som en almindelig tabel med alle værktøjer i Bearbejd.
- **Gem som diagram**: visningen med filter og kameravinkel bliver et diagram i Visualisér.

Geometrien beregnes ud fra originalfilen, første gang modellen åbnes i en session, og bruges kun til at tegne og måle.
Tabellerne findes stadig, selv om computeren mangler WebGL; så vises en besked i stedet for 3D-visningen.

## Sager fra et CDE

En model hentet fra en OpenCDE-server, eller en hvilken som helst model, når en sådan server findes som kilde, kan vise
sine sager: knappen *Sager* i modelvisningen åbner et panel i inspektøren med projektets BCF-sager. De, der peger på
bygningsdele i denne model, står først, med status og antal bygningsdele. Klik på en sag, så markeres bygningsdelene i
3D-visningen, og panelet viser beskrivelse, øjebliksbillede og kommentarer. Sagerne hentes, når du beder om det, og gemmes
ikke i datasættet; for at regne på dem gemmer du dem som en tabel i Hent. Dette er læsning; at oprette og ændre sager
kommer i næste udgave.

Med rettighederne til det kan du også skrive. *Ny sag* opretter en sag på serveren med titel, type, status og etiketter fra
projektets lister, og visningen følger med som viewpoint: kameraet, et øjebliksbillede og de markerede bygningsdele som
komponenter. I en valgt sag kan du skrive en kommentar, skifte status og tilføje den aktuelle visning som et nyt viewpoint.
*Gem som BCF* giver alle projektets sager med kommentarer, viewpoints og øjebliksbilleder som en BCF-fil, som værktøjer uden
API kan åbne. En BCF-fil kan også læses ind i Hent: sagerne bliver en tabel, kommentarer og komponenter tabeller ved siden af.

*Farv efter status* giver bygningsdelene farven fra deres mest åbne sag: rød for åbne, gul for igangværende, grøn for afsluttede,
med en signaturforklaring under listen. *Gem som tabel* giver projektets sager som en tabel med en række per sag og bygningsdel
(type, navn og etage følger med), som Håndter genkender som sager: kortet *Sager* viser status og opretter dashboardet *Sagsstatus*
med status, type, ansvarlig, prioritet og måned bag fælles filtre, og knappen *Vis i modellen* går tilbage til panelet. Værktøjet
*Sager* i Analysérs fane Mængder tæller sager, åbne sager og bygningsdele per status, type, prioritet, ansvarlig, bygningsdelstype
eller etage fra en sådan tabel, og SQL-startkoden får forespørgsler til koblingen. *Gem som diagram* gemmer visningen med farverne
som et modeldiagram, som dashboards, dokumenter og Publicér viser med signaturforklaring.

Grafens model, relationerne og forespørgslerne fra Dataspatiums side findes i Kontrolls [ifcgraph.md](https://github.com/marwiss/Kontroll/blob/main/docs/da/ifcgraph.md).

## Tabellerne

| Tabel | Indhold |
|---|---|
| `data` | Én række pr. bygningsdel, rum og etage: id, guid, typ (type), kategori (byggdel, rum, struktur), namn (navn), beskrivning, objekttyp, tagg, vaning (etage), typnamn, material, klassificering, egenskaper og mangder (mængder) som JSON |
| `_properties` | Én række pr. egenskab: id, uppsattning (sæt), namn, varde (værdi), tal, enhet (enhed), kalla (objekt eller typ) |
| `_quantities` | Én række pr. mængde i SI-enheder: id, uppsattning, namn, varde, slag (langd, area, volym, vikt, tid, antal), enhet |
| `_entities` | Filens ikke-geometriske entiteter med rå attributter: id, typ, attribut |

Egenskaber, der kun findes på bygningsdelens type, regnes med og er mærket `typ`. Mængder omregnes til meter,
kvadratmeter, kubikmeter og kilogram med projektets enheder. Åbninger og tilslutningsporte er ikke bygningsdele og findes
kun i `_entities`.

Tabellerne kan forespørges med SQL i Analysér:

```sql
SELECT d.vaning, d.typ, count(*) AS antal, sum(q.varde) AS volym
FROM data d JOIN _quantities q ON q.id = d.id
WHERE q.namn = 'NetVolume'
GROUP BY 1, 2 ORDER BY 1, 2
```

I R og Python giver `dm_read()` bygningsdelene, `dm_read_properties()` egenskaberne og `dm_read_quantities()` mængderne.

## Fanen Mængder i Analysér

- **Oversigt**: filens oplysninger og indhold.
- **Mængder**: antal, længde, areal, volumen og vægt grupperet efter type, etage, materiale, typenavn eller klassifikation.
  Kilden *Filens mængder* tager én værdi pr. bygningsdel og slags: netto før andre og brutto sidst, så en væg ikke tælles
  to gange. Kilden *Målt på geometrien* regner på trekanterne og virker også, når filen mangler mængder. Overfladen er så
  hele overfladen omkring bygningsdelen, ikke for eksempel en vægs sideareal.
- **Mængdeliste**: hvert mængdenavn i filen pr. type med sum. Her ser du præcis, hvad filen angiver.
- **Egenskaber**: hvilke værdier en egenskab har, og hos hvor mange bygningsdele af hver type.
- **Entiteter**: hvor mange entiteter af hver slags filen består af.

Hvert resultat kan gemmes som datasæt.

## IfcOpenShell i appen

Siden 2.4.0 kan appen læse, kontrollere og ændre IFC-modeller med IfcOpenShell, det samme bibliotek som Kontroll bygger på. Det
kører i Python i browseren, hentes første gang det bruges (cirka 13 MB, efter dit samtykke til komponenter) og gemmes derefter i
browseren. Intet sendes nogen steder; modellen forlader ikke computeren.

**I Analysér, fanen Mængder**, har en IFC-model fem værktøjer mere:

- **Validering** kontrollerer modellen mod sit IFC-skema: attributter, typer og referencer, valgfrit også skemaets regler.
  Fundene kan gemmes som datasæt.
- **Rumlig struktur** viser projekt, grund, bygning, etager og rum som et træ med antal elementer pr. del.
- **Egenskabssæt** giver alle egenskabssæt for en elementtype som en bred tabel: en række pr. element, en kolonne pr.
  egenskab (`Sæt.Egenskab`), valgfrit også mængdesættene.
- **IFC-udvalg** henter elementer med IfcOpenShells udvalgssprog, for eksempel `IfcWall, Pset_WallCommon.FireRating=EI60` eller
  `IfcElement, material=Beton`.
- **Geometrimål** måler volumen, overflade og omsluttende kasse pr. element på geometrien (OpenCASCADE). Langsomt for store
  modeller.
- **IDS-kontrol** (2.5.0) kontrollerer modellen mod en IDS-fil (buildingSMART Information Delivery Specification) med
  ifctester, IfcOpenShells egen kontrollant: vælg .ids-filen, så får du en række pr. krav og element med godkendt, ikke godkendt
  eller ikke relevant og årsagen, samt en optælling. Filen bliver i browseren. ifctester følger med appen uden sin webapp, så intet
  hentes ud over Python selv.

**I Bearbejd** har modellen to handlinger under *Handlinger* (knappen findes i modelvisningen og i tabelvisningen), i gruppen
*Model*:

- **Skriv tabel til modellen** skriver en tabels værdier ind i modellen. Rækkerne matches på GUID; kolonnerne `Name`,
  `Description`, `ObjectType` og `Tag` (eller `namn`, `beskrivning`, `objekttyp`, `tagg`) bliver attributter, og kolonner som
  `Pset_WallCommon.FireRating` bliver egenskaber (sættet oprettes, hvis det mangler). Arbejdsgangen: gem *Egenskabssæt* som
  datasæt, redigér det i Bearbejd og skriv tilbage.
- **Python på modellen** kører en funktion `step(model)` med IfcOpenShells API på hele modellen.

Begge er trin i recepten: den ændrede model bliver datasættets nye indhold (originalfilen udskiftes, og tabellerne bygges om),
trinnet logges og kan fortrydes, og originalfilen er altid den aktuelle version, når du eksporterer modellen eller sender den
til et CDE.

**I Python** (fanen Python i Analysér og kodeceller i notesbogen) åbner `dm_ifc("navn")` modellen som en `ifcopenshell.file`.
Hjælperne `dm_ifc_elements`, `dm_ifc_psets`, `dm_ifc_tree`, `dm_ifc_validate`, `dm_ifc_select` og `dm_ifc_geometry` giver
tabeller, `dm_ifc_set(model, df)` skriver en tabel ind i modellen, og `dm_ifc_write(model, "navn")` sender modellen til appen som
et nyt datasæt; se [Python i Dataspatium](python.md). Værktøjerne i Analysér og Python ændrer aldrig datasættet; kun
handlingerne i Bearbejd giver en ny version.

IfcOpenShell er LGPL-3.0 og hentes uændret som fastlåste wheels fra IfcOpenShells egen fortegnelse, se [Licenser](licenser.md).

## DXF-tegninger

En DXF-fil bliver en tabel med ét tegningsobjekt pr. række (type, lag, farve, længde, areal, tekst og placering) og en
SVG-tegning. Tegningen åbnes i Bearbejd, hvor du zoomer med hjulet og panorerer ved at trække. Lagene tændes og slukkes i
inspektøren, og et klik markerer objektet og dets række. Fanen Mængder giver antal, længde og areal pr. lag og type.

Linjer, polylinjer med buer, cirkler, buer, ellipser, splines, punkter, tekster, solider, 3D-flader, blokke og
målsætningers blokke tegnes. Skravering (HATCH) tegnes ikke.

## Eksport

Eksportér giver originalfilen, egenskaberne og mængderne som CSV (én række pr. værdi) og tegningen som SVG, ud over de
almindelige tabelformater for `data`. Diagrammer af modeller eksporteres som PNG, SVG og PDF; en 3D-model bliver da et billede.

## Begrænsninger

- Modellen kan ikke redigeres, og der skrives ingen ny IFC-fil. Ændringer i tabellerne påvirker ikke originalfilen.
- En model tegnes igen ud fra originalfilen i hver ny session. Modellen på 57 MB, som appen er afprøvet med, tager 4–6 sekunder.
- Den første tegning af en meget stor model kan låse siden et øjeblik, mens grafikkortet modtager trekanterne.
- Mængderne er ikke en mængdeberegning efter noget regelsæt. Kontrollér dem mod kilden, før de bruges.
- DXF læses i to dimensioner. DWG skal først gemmes som DXF.
