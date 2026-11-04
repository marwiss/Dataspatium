# Planer: digitale lokalplaner og kommuneplaner

Dataspatium åbner digitale planer som planer: en svensk detaljplan (lokalplan) tegnes som plankort med Boverkets
farver og betegnelser, bestemmelserne listes og slås op i Boverkets katalog over planbestemmelser
(Planbestämmelsekatalogen), og en översiktsplan (kommuneplan) vises tema for tema. Planen er et datasæt af typen
*plan*: ét planobjekt pr. række (planområdet og hver bestemmelse eller hvert indholdsobjekt) med geometri i WGS 84,
planens oplysninger i metadata og originalfilen gemt i datasættet. Tabellen er altid ét klik væk.

## Formater der læses

| Format | Genkendes på | Indhold |
|---|---|---|
| National specifikation Detaljplan (Lantmäteriet, version 4) | GeoJSON med `feature:typ` (detaljplan, anvandningsbestammelse, egenskapsbestammelse, administrativBestammelse, beslutsinformation, planbestammelsebeskrivning) eller `feature:mediatyp application/vnd.lm.detaljplan.v4+json` | Planområde, bestemmelser med katalogreference, formulering og værdi, beslutningsoplysninger (påbegyndt, vedtaget, retskraft, gennemførelsestid), begrundelser |
| Referenceobjekter fra den nationale geodataplatform | STAC-objekter med `properties.detaljplan` og `properties.planbestammelse` (svaret fra Lantmäteriets lokalplan-API) | Planens oplysninger, bestemmelsernes formulering, katalogreference, kategori og værdi |
| National specifikation Översiktsplan (testversion 1.0) | GeoJSON med `feature:typ` oversiktsplan, innehallOP, beslutOP | Planens oplysninger og indholdsobjekter med indholdstype, navn, præcisering og planhændelse |
| Boverkets ÖP-model (GeoPackage) | Tabeller `innehall_op_<tema>_<geometritype>` og `oversiktsplan` | Alle indholdslag som én plan med tema pr. lag |

Koordinater i SWEREF 99 TM og de lokale SWEREF 99-zoner (EPSG:3006–3018, læst fra `koordinatsystemPlan`) samt Web
Mercator omregnes til WGS 84. En GeoJSON-fil genkendes på indholdet, ikke på filtypen: slip den i Indsaml, så vises
planens oplysninger og knappen *Importér*. En GeoPackage-fil i ÖP-modellen får valget *Hele kommuneplanen som plan*;
slået fra importeres én tabel ad gangen som før.

Fra Lantmäteriets lokalplan-API (kilden *Lantmäteriet geodataplattformen: detaljplaner*, kræver nøgle fra en
tilsluttet organisation) gemmes et svar som plan med knappen *Gem som plan* i stedet for som tabel.

## Plankortet i Bearbejd

En plan åbnes som plankort: anvendelsesbestemmelserne fyldt med Boverkets farver (boliger gul, centrum brun, industri
blågrå, gade lysegrå, park lysegrøn, vand blå og så videre efter de almindelige råd til BFS 2020:5; nuancerne er
appens), egenskabsbestemmelser som blå stiplede konturer, administrative bestemmelser som lilla punkterede,
plangrænsen i sort og betegnelserne som etiketter. Klik på et objekt, så viser inspektøren dets oplysninger og hvad
kataloget siger om bestemmelsen: kode, type, gyldighed og katalogets formulering. Lagene slås til og fra pr. type,
baggrundskort vises efter samtykke, og knapperne giver *Gem som kortvisning* (til Visualisér, dashboards og
Publicér), *Planbestemmelser* (listen som Markdown) og *Vis som tabel*.

En kommuneplan tegnes pr. tema: areal- og vandanvendelsen fyldt pr. indholdstype, øvrige temaer med én farve pr. tema
og valgbar synlighed. Inspektøren viser arealet pr. areal- og vandanvendelse.

## Fanen Plan i Analysér

En plan får fanen **Plan** efter Regex:

- **Oversigt**: planens oplysninger, antal objekter pr. type, katalogreferencernes status og planens anvendelsesareal.
- **Bestemmelser**: alle bestemmelser som tabel med betegnelse, formulering, kategori, værdi, kode og katalogstatus;
  kan gemmes som datasæt eller downloades som Markdown. For en kommuneplan: indholdet pr. tema.
- **Arealer**: areal pr. anvendelse (sum af fladerne, beregnet i SWEREF 99 TM) og andel af planens anvendelsesareal.
- **Katalogkontrol**: hver katalogreference slås op i kataloget: gældende, erstattet (og af hvad), ophørt, ukendt
  eller manglende, og om formuleringen følger katalogets skabelon.
- **Søg i kataloget**: fritekstsøgning blandt katalogets 3 700 bestemmelser med filter på type, anvendelsesform og
  gyldighed; resultatet kan gemmes som datasæt.

## Kataloget over planbestemmelser

Appen har en indbygget kopi af Boverkets Planbestämmelsekatalog (åbne data; release 20251201), så opslag, farver og
katalogkontrol virker uden net. Kilden skal angives: Boverket og Planbestämmelsekatalogen. Kataloget findes også som
kilde i Indsaml (*Boverket Planbestämmelsekatalogen*): slå en bestemmelse op på dens UUID, vis releaser, farver,
anvendelsesformer, kategorier og symboler via Boverkets åbne API. Kopien opdateres med `python tools/plan_catalog.py`
før en ny udgave.

## Planer fra de andre nordiske lande

Appen læser også nabolandenes digitale planer og tegner dem som planer med hvert lands kortfarver (nuancerne er appens;
kolonnen `farg` bærer farvenavnet). Boverkets katalog gælder kun svenske planer, så fanen Plan viser oversigt,
bestemmelser og arealer for disse.

| Land | Detailplan / kommuneplan | Sådan får du dem ind |
|---|---|---|
| Danmark | lokalplan (delområder, byggefelter) / kommuneplanrammer | Kilden *Plandata.dk (WFS)*: **Hent plan** med planid eller plannummer henter lokalplanen med delområder og byggefelter; et lag (f.eks. kommuneplanrammer) hentes som kort og gemmes med *Gem som plan*. GeoJSON-filer fra Plandata genkendes på indholdet. Farve pr. generel anvendelse: bolig gul, erhverv lilla, center brun, rekreativt grøn, offentlige formål blå, tekniske anlæg grå, sommerhus orange, landområde lysegrøn. |
| Finland | asemakaava / yleiskaava | En plan i den nationale plandatamodel (Ryhti-JSON med `planObjects` og `planRegulationGroups`) importeres som fil: planobjekternes anvendelsesbestemmelser får kortbetegnelsen (AK, VP …) fra kodelisten RY_Kaavamaarayslaji (indbygget kopi) og det finske plankorts farver; øvrige bestemmelser bliver egenskabsbestemmelser. Kilden *Ryhti kaavatiedot* giver planindekset (gældende og igangværende planer med links til dokumenterne) som tabel og kort; Helsinkis avoindata-WFS har byens planindeks og planenheder. |
| Island | deiliskipulag / aðalskipulag | Kilden *Skipulagsstofnun skipulagsgögn (ArcGIS)*: **Hent plan** med plannummeret henter plangrænse, grunde, byggeretter, servitutter og trafik (fem lag); `ask:` før nummeret henter en kommuneplan med arealanvendelsesklasser (ÍB, M, VÞ …). En GeoPackage efter Skipulagsstofnuns skabelon importeres hel med valget *Hele planen som plan*. |
| Norge | reguleringsplan / kommuneplan | Vektordata kræver Norge digitalt-aftale: download planen som GeoPackage fra Geonorge og importér den hel (tabellerne RpOmråde, RpArealformålOmråde, RpBestemmelseOmråde, hensynszoner med flere); arealformål-koderne får navne fra den indbyggede kodeliste og farve pr. hovedformål (bebyggelse gul, centrum brun, erhverv lilla, trafik lysegrå, grøn struktur grøn, LNFR lysegrøn, hav blå). DiBK's WMS `https://nap.ft.dibk.no/services/wms/reguleringsplaner/` kan lægges som baggrund i kortvisningen. |

Koordinater i ETRS89 UTM 32–35, ETRS-TM35FIN, de finske GK-zoner og ISN93 omregnes til WGS 84. Begrænsninger: Ryhti
indeholder planer godkendt fra 2024 (landsdækkende 2029); islandske planer før 2025 har kun plangrænse; Plandata gemmer
bestemmelser som koder og tal, ikke som løbende tekst.

## Begrænsninger

- Boverkets farver er angivet som navne i forskrifterne; nuancerne i appen er egne. Symbolbetegnelser (prikket mark,
  krydsmark og andre) tegnes som konturer med betegnelse, ikke med Boverkets symboler.
- Bestemmelsesbeskrivelser, planlægningsgrundlag og beslutningsdokumenter følger kun med som tekst (begrundelser)
  eller som oplysninger i planens metadata; dokumenterne hentes ikke.
- Arealer er plane beregninger i SWEREF 99 TM; for planer i lokale zoner er fejlen ubetydelig.
- Lantmäteriets lokalplan-API kræver nøgle; appen er testet mod den dokumenterede model med egne testdata.
