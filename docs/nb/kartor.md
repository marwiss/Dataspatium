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
| SWEREF 99 TM | Gjenkjennes på verdiene og regnes om til WGS 84 ved tegningen |

Datasett med en geometrikolonne eller kolonner som heter lengde- og breddegrad åpnes som kart direkte; for andre
koordinatkolonner (for eksempel `x` og `y`) velger du *Vis som kart* i tabellens verktøylinje.

## Kartet i Bearbeid

Kartet viser datasettets objekter i appens farge. Zoom med hjulet eller knappene, panorer ved å dra, og klikk på et
objekt så viser inspektøren attributtene; *Rediger i tabellen* tar deg til raden i tabellen. Verktøylinjen har
bakgrunnskart (ingen eller OpenStreetMap), *Zoom til alt*, *Lagre som kartvisning* (lagrer kartet med lag og gjeldende
visning som et diagram i Visualiser) og *Vis som tabell*. Alt du gjør i tabellen (filtrere, rette, slette rader) vises
på kartet.

Store datasett tegnes med canvas; 10 000 polygoner panoreres uten hakk. Flere enn 50 000 objekter per lag tegnes ikke
(grensen kan heves per lag i kartvisningen).

## Kartvisninger i Visualiser

*Nytt diagram → Kart* lager en kartvisning med det valgte datasettet som første lag. Innstillingene til venstre:

- **Bakgrunnskart**: ingen (standard), OpenStreetMap eller en egen kartserver med en adressemal som
  `https://…/{z}/{x}/{y}.png` og kildetekst. Bakgrunnskart hentes fra nettet og spør om samtykke første gang (formålet
  *Bakgrunnskart* under Håndter → Internettilgang).
- **Lag**: legg til flere datasett eller de medfølgende grensene (fylker og kommuner i Sverige, Danmark, Norge og
  Finland). Hvert lag har navn, synlighet, rekkefølge, farge, fyll, linjebredde og punktstørrelse, geometri- eller
  koordinatkolonner, farge etter kolonne (kategorier med appens palett eller klasser med en sekvensiell skala, antall
  klasser), etikett (vises når pekeren hviler på objektet) og høyeste antall objekter.
- **Visning**: *Lagre gjeldende visning* låser kartets midtpunkt og zoom; ellers tilpasses kartet til lagene.
  Tegnforklaring og høyde kan endres.

Inspektøren viser tegnforklaringen og objektet du klikket på. Kartvisningen eksporteres til SVG, PNG og PDF, kjøres i
batch per gruppe, blir PowerPoint og kan legges inn i dokumentmaler med `{{diagram "Navn"}}`. Eksporten tegner lagene
uten bakgrunnskart. I dashboards, presentasjoner og publisert HTML er kartet interaktivt; publisert HTML får Leaflet
innebygd og objektene som GeoJSON, og bakgrunnskartet hentes da av leserens nettleser.

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

## Begrensninger

- Bakgrunnskart og publisert HTML med bakgrunnskart krever nett; appen selv gjør ingen kall uten samtykke.
- Projeksjoner: WGS 84 og SWEREF 99 TM. Andre referansesystemer må regnes om før import (for eksempel i QGIS).
- Eksporten tegner lagene, ikke bakgrunnskartet.
- Buffere og overlagringer er plane beregninger på WGS 84-koordinater via Turf; i kilometerskala i Norden er feilen
  liten, for svært store flater merkbar.
