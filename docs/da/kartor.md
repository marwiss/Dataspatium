# Kort

Et datasæt med geometri eller koordinater er et kort. I Bearbejd åbnes det som et kort, der kan zoomes og panoreres,
i Visualisér bliver det en gemt **kortvisning** med flere lag til dashboards, præsentationer og publicering, og i
Analysér findes fanen **Geo** med geoværktøjer uden kode. Kortene tegnes med Leaflet; geometrien beregnes med Turf.
Intet hentes fra nettet, før du vælger et baggrundskort og giver dit samtykke.

## Hvad der regnes som geodata

| Geodata | Genkendes på |
|---|---|
| Geometrikolonne | En tekstkolonne med GeoJSON eller WKT, oftest `geometry` (import af GeoJSON, Shapefile, GeoPackage, KML, GPX og TopoJSON giver den) |
| Koordinatkolonner | To talkolonner for længde- og breddegrad (`lon`/`lat`, `longitude`/`latitude`, `x`/`y` med flere) |
| SWEREF 99 TM | Genkendes på værdierne og omregnes til WGS 84 ved tegningen |

Datasæt med en geometrikolonne eller kolonner, der hedder længde- og breddegrad, åbnes som kort direkte; for andre
koordinatkolonner (for eksempel `x` og `y`) vælger du *Vis som kort* i tabellens værktøjslinje.

Geodata kan også hentes direkte fra åbne tjenester: *Tilføj geodatakilde* i Indsaml gør en kilde af en WFS-, OGC API
Features- eller ArcGIS-tjeneste, og kilden *Geodataportalen* finder tjenester i det nationale katalog. Svarene får en
geometrikolonne og åbnes som kort. Se [kallor.md](kallor.md#åbne-geodata).

Navne er ikke nok. Appen kontrollerer også værdierne: en geometrikolonne skal indeholde en geometri, og koordinater skal ligge i grader eller i et projiceret system. Kolonner, der kun hedder x og y, tæller som koordinater, når værdierne er projicerede, da små tal under de navne oftest er noget andet. En tabel med koordinater kan eksporteres som GeoJSON med punkter.

Er koordinaterne i et andet system end SWEREF 99 TM, vælger du det, når du importerer, for eksempel RT 90 eller en UTM-zone. Appen tilføjer så kolonner i grader og bevarer originalerne.

## Kortet i Bearbejd

Kortet viser datasættets objekter i appens farve. Zoom med hjulet eller knapperne, panorér ved at trække, og klik på
et objekt, så viser inspektøren dets attributter; *Redigér i tabellen* fører dig til rækken i tabellen.
Værktøjslinjen har baggrundskort (intet eller OpenStreetMap), *Zoom til alt*, *Gem som kortvisning* (gemmer kortet med
lag og aktuel visning som et diagram i Visualisér) og *Vis som tabel*. Alt, hvad du gør i tabellen (filtrere, rette,
slette rækker), ses på kortet.

Store datasæt tegnes med canvas; 10 000 polygoner panoreres uden hak. Flere end 50 000 objekter pr. lag tegnes ikke
(grænsen kan hæves pr. lag i kortvisningen).

Billedsamlinger med position har knappen *Vis på kortet*. Klik på et sted, så viser inspektøren billedet. En tabel, hvis rækker navngiver billeder, viser dem på samme måde. *Brug det, der ses* gør det, kortet viser lige nu, til et udvalg, der følger med til de andre tilstande. I en kortvisning i Visualisér kan billedsamlinger og planer være lag.

## Kortvisninger i Visualisér

*Nyt diagram → Kort* opretter en kortvisning med det valgte datasæt som første lag. Indstillingerne til venstre:

- **Baggrundskort**: intet (standard), OpenStreetMap eller en egen kortserver med en adresseskabelon som
  `https://…/{z}/{x}/{y}.png` og kildetekst, eller en **WMS-tjeneste** (adresse, lag, billedformat og gennemsigtighed; *Læs lag* henter tjenestens
  lagliste). Baggrundskort hentes fra nettet og beder om samtykke første gang
  (formålet *Baggrundskort* under Håndter → Internetadgang).
- **Lag**: tilføj flere datasæt eller de medfølgende grænser (regioner og kommuner i Sverige, Danmark, Norge og
  Finland) eller et **WMS-lag** (billeder fra en korttjeneste, tegnet under objekterne med valgfri gennemsigtighed; det
  har ingen signaturforklaring og følger ikke med i eksport til SVG, PNG og PDF). Hvert lag har navn, synlighed, rækkefølge, farve, udfyldning, linjebredde og punktstørrelse, geometri-
  eller koordinatkolonner, farve efter kolonne (kategorier med appens palet eller klasser med en sekventiel skala,
  antal klasser), etiket (vises, når markøren hviler på objektet) og højeste antal objekter.
- **Visning**: *Gem aktuel visning* låser kortets midte og zoom; ellers tilpasses kortet til lagene. Signaturforklaring
  og højde kan ændres.

Inspektøren viser signaturforklaringen og det objekt, du klikkede på. Kortvisningen eksporteres til SVG, PNG og PDF,
køres i batch pr. gruppe, bliver PowerPoint og kan indsættes i dokumentskabeloner med `{{diagram "Navn"}}`. Eksporten
tegner lagene uden baggrundskort. I dashboards, præsentationer og publiceret HTML er kortet interaktivt; publiceret
HTML får Leaflet indlejret og objekterne som GeoJSON, og baggrundskortet hentes så af læserens browser.

## Geoværktøjer i Analysér

Når et datasæt med geometri er valgt, får Analysér fanen **Geo** (efter Regex). Alle resultater er tabeller med en
kolonne `geometry`, der kan gemmes som datasæt med *Opret datasæt* og åbnes som kort.

| Værktøj | Hvad det gør |
|---|---|
| Mål | Areal (km²), længde (km), midtpunkt (længde- og breddegrad) og udstrækning for hvert objekt |
| Punkter i områder | Tæller punkter pr. område (og summerer en værdikolonne), eller giver hvert punkt områdets attributter |
| Nærmeste | For hvert objekt det nærmeste objekt i et andet datasæt med afstanden i km |
| Buffer | Zoner i valgt afstand i meter omkring hvert objekt |
| Overlejring | Fællesmængde mellem to områdedatasæt (ét objekt pr. overlappende par med begge attributsæt og det fælles areal) eller forskel (det, der bliver tilbage af det første lag) |
| Sammenlægning | Lægger områder med samme værdi i en kolonne (eller alle) sammen til ét objekt med antal og areal |
| Forenkling | Forenkler geometrier med valgt tolerance i meter og viser antal punkter før og efter |

Værktøjerne arbejder i browseren uden net og i omgange, så siden svarer; meget store datasæt (titusindvis af
komplekse polygoner) tager tid. Mål og koordinatomregning findes også som receptskridt i Bearbejd (gruppen Geodata).

## QGIS-projekter

Slip en projektfil (`.qgs` eller `.qgz`) i Hent, gerne sammen med datafilerne (GeoPackage, GeoJSON, Shapefile som
ZIP). Dataspatium læser lagrækkefølgen, synligheden og symbolerne (ét symbol, kategorier eller klasser med deres
farver, linjebredder og punktstørrelser) og matcher hvert lag med et datasæt med samme filnavn (og lagnavn for
GeoPackage); medfølgende filer, der mangler, importeres først. Resultatet er en kortvisning i Visualisér. Rasterlag,
etiketter, effekter og regelbaserede symboler ud over den første regel tages ikke med.

## Begrænsninger

- Baggrundskort og publiceret HTML med baggrundskort kræver net; appen selv laver ingen kald uden samtykke.
- Projektioner: WGS 84 og SWEREF 99 TM. Andre referencesystemer skal omregnes før import (for eksempel i QGIS).
- Eksporten tegner lagene, ikke baggrundskortet eller WMS-lag.
- Buffere og overlejringer er plane beregninger på WGS 84-koordinater via Turf; i kilometerskala i Norden er fejlen
  lille, for meget store flader mærkbar.
