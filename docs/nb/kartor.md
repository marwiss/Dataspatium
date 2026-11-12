# Kart

Et datasett med geometri eller koordinater er et kart. I Bearbeid åpnes det som et kart å zoome og panorere i, i
Visualiser blir det en lagret **kartvisning** med flere lag for dashboards, presentasjoner og publisering, og i
Analyser finnes fanen **Geo** med geoverktøy uten kode. Kartene tegnes med Leaflet; geometrien beregnes med Turf.
Ingenting hentes fra nettet før du velger et bakgrunnskart og gir ditt samtykke.

## Hva som regnes som geodata

| Geodata | Gjenkjennes på |
|---|---|
| Geometrikolonne | En tekstkolonne med GeoJSON eller WKT, oftest `geometry` (import av GeoJSON, Shapefile, GeoPackage, KML, GPX og TopoJSON gir den) |
| Koordinatkolonner | To tallkolonner for lengde- og breddegrad (`lon`/`lat`, `longitude`/`latitude`, `x`/`y` med flere) |
| Projiserte koordinater | Regnes om til WGS 84 med filens koordinatsystem, eller som SWEREF 99 TM når filen ikke oppgir noe (se [Koordinatsystemer](#koordinatsystemer)) |

Datasett med en geometrikolonne eller kolonner som heter lengde- og breddegrad åpnes som kart direkte; for andre
koordinatkolonner (for eksempel `x` og `y`) velger du *Vis som kart* i tabellens verktøylinje.

Geodata kan også hentes direkte fra åpne tjenester: *Legg til geodatakilde* i Hent inn gjør en kilde av en WFS-, OGC API
Features- eller ArcGIS-tjeneste, og kilden *Geodataportalen* finner tjenester i den nasjonale katalogen. Svarene får en
geometrikolonne og åpnes som kart. Se [kallor.md](kallor.md#åpne-geodata).

Navn er ikke nok. Appen kontrollerer også verdiene: en geometrikolonne må inneholde en geometri, og koordinater må ligge i grader eller i et projisert system. Kolonner som bare heter x og y, regnes som koordinater når verdiene er projiserte, siden små tall under de navnene oftest er noe annet. En tabell med koordinater kan eksporteres som GeoJSON med punkter.

Er koordinatene i et annet system enn SWEREF 99 TM, velger du det når du importerer, for eksempel RT 90 eller en UTM-sone. Appen legger da til kolonner i grader og beholder originalene.

## Kartet i Bearbeid

Kartet viser datasettets objekter i appens farge. Zoom med hjulet eller knappene, panorer ved å dra (målestokken nede til venstre viser avstanden i meter), og klikk på et
objekt så viser inspektøren attributtene; *Rediger i tabellen* tar deg til raden i tabellen. Verktøylinjen har
bakgrunnskart (ingen, OpenStreetMap eller et [ortofoto](#ortofoto)), *Zoom til alt*, *Lagre som kartvisning* (lagrer kartet med lag og gjeldende
visning som et diagram i Visualiser) og *Vis som tabell*. Alt du gjør i tabellen (filtrere, rette, slette rader) vises
på kartet.

Store datasett tegnes med canvas; 10 000 polygoner panoreres uten hakk. Flere enn 50 000 objekter per lag tegnes ikke
(grensen kan heves per lag i kartvisningen).

Bildesamlinger med posisjon har knappen *Vis på kartet*. Klikk på et sted, så viser inspektøren bildet. En tabell der radene navngir bilder, viser dem på samme måte. *Bruk det som vises* gjør det kartet viser akkurat nå, til et utvalg som følger med til de andre modusene. I en kartvisning i Visualiser kan bildesamlinger og planer være lag.

## Kartvisninger i Visualiser

*Nytt diagram → Kart* lager en kartvisning med det valgte datasettet som første lag. Innstillingene til venstre:

- **Bakgrunnskart**: ingen (standard), OpenStreetMap, et [ortofoto](#ortofoto) eller en egen kartserver med en adressemal som
  `https://…/{z}/{x}/{y}.png` og kildetekst, eller en **WMS-tjeneste** (adresse, lag, bildeformat og gjennomsiktighet; *Les lag* henter tjenestens
  lagliste). Bakgrunnskart hentes fra nettet og spør om samtykke første gang (formålet
  *Bakgrunnskart* under Håndter → Internettilgang).
- **Lag**: legg til flere datasett eller de medfølgende grensene (fylker og kommuner i Sverige, Danmark, Norge og
  Finland) eller et **WMS-lag** (bilder fra en karttjeneste, tegnet under objektene med valgfri gjennomsiktighet; det
  har ingen tegnforklaring og følger ikke med i eksport til SVG, PNG og PDF). Hvert lag har navn, synlighet, rekkefølge, farge, fyll, linjebredde og punktstørrelse, geometri- eller
  koordinatkolonner, farge etter kolonne (kategorier med appens palett eller klasser med en sekvensiell skala, antall
  klasser), etikett (vises når pekeren hviler på objektet) og høyeste antall objekter.
- **Visning**: *Lagre gjeldende visning* låser kartets midtpunkt og zoom; ellers tilpasses kartet til lagene.
  Tegnforklaring og høyde kan endres.

Inspektøren viser tegnforklaringen og objektet du klikket på. Kartvisningen eksporteres til SVG, PNG og PDF, kjøres i
batch per gruppe, blir PowerPoint og kan legges inn i dokumentmaler med `{{diagram "Navn"}}`. Eksporten tegner lagene
uten bakgrunnskart. I dashboards, presentasjoner og publisert HTML er kartet interaktivt; publisert HTML får Leaflet
innebygd og objektene som GeoJSON, og bakgrunnskartet hentes da av leserens nettleser.

## Ortofoto

Et ortofoto er et flybilde som er rettet opp slik at det ligger som et kart. Tre åpne ortofoto finnes i valget av bakgrunnskart i
Bearbeid, i kartvisningene i Visualiser, på plankartet og under stedet for en ny bygning (se [cad-bim.md](cad-bim.md)):

| Ortofoto | Utgiver og tjeneste | Koordinatsystemer | Lisens og kildeangivelse | Nøkkel |
|---|---|---|---|---|
| Danmark: GeoDanmark ortofoto forår | Klimadatastyrelsen, WMS på `wms.datafordeler.dk` | Web Mercator, ETRS89 / UTM 32N (25832) | CC BY 4.0, "GeoDanmark ortofoto forår © Klimadatastyrelsen" | Gratis API-nøkkel fra Datafordeleren: opprett en bruker med e-post på portal.datafordeler.dk og deretter en API-nøkkel (gjelder i to år) |
| Finland: Ortokuva | Maanmittauslaitos, WMTS på `avoin-karttakuva.maanmittauslaitos.fi` | Web Mercator | CC BY 4.0, "Ortokuva © Maanmittauslaitos" | Gratis API-nøkkel fra Maanmittauslaitos: opprett en konto i Oma tili (omatili.maanmittauslaitos.fi) og deretter en ny API-nøkkel |
| Island: Grunnkort – Loftmynd | Náttúrufræðistofnun, WMS på `gis.natt.is` | Web Mercator, ISN93 (3057) | CC BY 4.0, "Grunnkort – Loftmynd © Náttúrufræðistofnun" | Ingen |

- Kildeangivelsen og lisensen står i hjørnet av kartet så lenge ortofotoet vises.
- Bildene hentes først når du velger et ortofoto, etter samtykke til *Bakgrunnskart*; spørsmålet nevner tjenestens vert.
- Krever ortofotoet en nøkkel, spør appen etter den når du velger det. Nøkkelen gjelder økten eller lagres kryptert med en passordfrase som
  appens andre nøkler, sendes bare til sin egen tjeneste i bildenes adresser og lagres aldri i kartvisningen. Publisert HTML tar bare med
  ortofoto som ikke krever nøkkel.
- På plankartet i planens eget koordinatsystem finnes de ortofotoene som tjenesten tilbyr i det systemet (Danmark i UTM 32N, Island i ISN93).
- Islands mosaikk dekker ennå ikke hele landet og bygges ut hvert år. Finlands åpne tjeneste gir bildene opp til zoomnivå 16 og
  forstørrer dem deretter.
- Sverige og Norge har ingen åpne ortofototjenester: Lantmäteriets Ortofoto Visning har en lisensavgift, og Norge i bilder er åpen bare
  for medlemmene i Norge digitalt. Lantmäteriets ortofoto er åpne data (CC BY 4.0) som filer for nedlasting (STAC), men dem viser appen
  ikke som kart ennå.

## Geoverktøy i Analyser

Når et datasett med geometri er valgt, får Analyser fanen **Geo** (etter Regex). Alle resultater er tabeller med en
kolonne `geometry` som kan lagres som datasett med *Opprett datasett* og åpnes som kart.

| Verktøy | Hva det gjør |
|---|---|
| Mål | Areal (km²), lengde (km), midtpunkt (lengde- og breddegrad) og utstrekning for hvert objekt |
| Punkter i områder | Teller punkter per område (og summerer en verdikolonne), eller gir hvert punkt områdets attributter |
| Nærmeste | For hvert objekt det nærmeste objektet i et annet datasett med avstanden i km |
| Buffer | Soner i valgt avstand i meter rundt hvert objekt |
| Overlagring | Snitt mellom to områdedatasett (ett objekt per overlappende par med begge attributtsettene og det felles arealet) eller differanse (det som blir igjen av det første laget) |
| Sammenslåing | Slår sammen områder med samme verdi i en kolonne (eller alle) til ett objekt med antall og areal |
| Forenkling | Forenkler geometrier med valgt toleranse i meter og viser antall punkter før og etter |

Verktøyene arbeider i nettleseren uten nett og i omganger slik at siden svarer; svært store datasett (titusenvis av
komplekse polygoner) tar tid. Mål og koordinatomregning finnes også som oppskriftssteg i Bearbeid (gruppen Geodata).

## QGIS-prosjekter

Slipp en prosjektfil (`.qgs` eller `.qgz`) i Hent, gjerne sammen med datafilene (GeoPackage, GeoJSON, Shapefile som
ZIP). Dataspatium leser lagrekkefølgen, synligheten og symbolene (ett symbol, kategorier eller klasser med fargene,
linjebreddene og punktstørrelsene) og matcher hvert lag mot et datasett med samme filnavn (og lagnavn for
GeoPackage); medfølgende filer som mangler importeres først. Resultatet er en kartvisning i Visualiser. Rasterlag,
etiketter, effekter og regelbaserte symboler utover den første regelen tas ikke med.

## Koordinatsystemer

En GeoPackage-fil, en shapefil (med `.prj`) og en GeoJSON-fil med `crs` oppgir koordinatsystemet sitt. Appen bruker det
når kartet tegnes, når romlig søk leter etter steder, og når datasettet eksporteres med geometri; koordinatene i tabellen
beholdes slik de står i filen. Oppgir filen ikke noe system, tas projiserte koordinater som SWEREF 99 TM. Appen regner om
disse systemene:

| System | EPSG |
|---|---|
| SWEREF 99 TM og de tolv lokale sonene (SWEREF 99 12 00 til 23 15) | 3006, 3007–3018 |
| RT 90 2,5 gon V, med Lantmäteriets direkte projeksjon | 3021 |
| ETRS89 og WGS 84 / UTM 32–35 (Danmark, Norge, Finland) | 25832–25835, 32632–32635 |
| ETRS-TM35FIN og de finske GK-sonene | 3067, 3873–3885 |
| ISN93 / Lambert 1993 (Island) | 3057 |
| Web Mercator | 3857 |
| WGS 84 og ETRS89 i grader | 4326, 4258 |

Omregningen stemmer med PROJ (som QGIS bruker) innenfor en millimeter; RT 90 2,5 gon V innenfor to desimeter, fordi den
direkte projeksjonen er en forenkling. Oppgir en fil et annet system, for eksempel RT 90 i en annen sone eller et eldre
lokalt kommunesystem, sier Hent fra, og kartet tegner ikke stedene i stedet for å tegne dem feil; regn filen om til
SWEREF 99 først, for eksempel i QGIS. Kartene her tegnes i Web Mercator med nord opp; en plan kan også vises i sitt eget
system (se [planer.md](planer.md#koordinatsystemer-og-høyder)).

## Begrensninger

- Bakgrunnskart og publisert HTML med bakgrunnskart krever nett; appen selv gjør ingen kall uten samtykke.
- Koordinatsystemer: de som står under [Koordinatsystemer](#koordinatsystemer). Andre må regnes om før import (for eksempel i
  QGIS); appen sier fra og tegner dem ikke.
- Eksporten tegner lagene, ikke bakgrunnskartet eller WMS-lag.
- Buffere og overlagringer er plane beregninger på WGS 84-koordinater via Turf; i kilometerskala i Norden er feilen
  liten, for svært store flater merkbar.
