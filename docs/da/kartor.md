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
| Projicerede koordinater | Omregnes til WGS 84 med filens koordinatsystem, eller som SWEREF 99 TM, når filen ikke angiver noget (se [Koordinatsystemer](#koordinatsystemer)) |

Datasæt med en geometrikolonne eller kolonner, der hedder længde- og breddegrad, åbnes som kort direkte; for andre
koordinatkolonner (for eksempel `x` og `y`) vælger du *Vis som kort* i tabellens værktøjslinje.

Geodata kan også hentes direkte fra åbne tjenester: *Tilføj geodatakilde* i Indsaml gør en kilde af en WFS-, OGC API
Features- eller ArcGIS-tjeneste, og kilden *Geodataportalen* finder tjenester i det nationale katalog. Svarene får en
geometrikolonne og åbnes som kort. Se [kallor.md](kallor.md#åbne-geodata).

Navne er ikke nok. Appen kontrollerer også værdierne: en geometrikolonne skal indeholde en geometri, og koordinater skal ligge i grader eller i et projiceret system. Kolonner, der kun hedder x og y, tæller som koordinater, når værdierne er projicerede, da små tal under de navne oftest er noget andet. En tabel med koordinater kan eksporteres som GeoJSON med punkter.

Er koordinaterne i et andet system end SWEREF 99 TM, vælger du det, når du importerer, for eksempel RT 90 eller en UTM-zone. Appen tilføjer så kolonner i grader og bevarer originalerne.

## Kortet i Bearbejd

Kortet viser datasættets objekter i appens farve. Zoom med hjulet eller knapperne, panorér ved at trække (målestokken nederst til venstre viser afstanden i meter), og klik på
et objekt, så viser inspektøren dets attributter; *Redigér i tabellen* fører dig til rækken i tabellen.
Værktøjslinjen har baggrundskort (intet, OpenStreetMap eller et [ortofoto](#ortofotos)), *Zoom til alt*, *Gem som kortvisning* (gemmer kortet med
lag og aktuel visning som et diagram i Visualisér) og *Vis som tabel*. Alt, hvad du gør i tabellen (filtrere, rette,
slette rækker), ses på kortet.

Store datasæt tegnes med canvas; 10 000 polygoner panoreres uden hak. Flere end 50 000 objekter pr. lag tegnes ikke
(grænsen kan hæves pr. lag i kortvisningen).

Billedsamlinger med position har knappen *Vis på kortet*. Klik på et sted, så viser inspektøren billedet. En tabel, hvis rækker navngiver billeder, viser dem på samme måde. *Brug det, der ses* gør det, kortet viser lige nu, til et udvalg, der følger med til de andre tilstande. I en kortvisning i Visualisér kan billedsamlinger og planer være lag.

## Kortvisninger i Visualisér

*Nyt diagram → Kort* opretter en kortvisning med det valgte datasæt som første lag. Indstillingerne til venstre:

- **Baggrundskort**: intet (standard), OpenStreetMap, et [ortofoto](#ortofotos) eller en egen kortserver med en adresseskabelon som
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

## Ortofotos

Et ortofoto er et luftfoto, der er rettet op, så det ligger som et kort. Fire åbne ortofotos findes i valget af baggrundskort i Bearbejd,
i kortvisningerne i Visualisér, på plankortet og under stedet for en ny bygning (se [cad-bim.md](cad-bim.md)):

| Ortofoto | Udgiver og tjeneste | Koordinatsystemer | Licens og kildeangivelse | Nøgle |
|---|---|---|---|---|
| Danmark: GeoDanmark ortofoto forår | Klimadatastyrelsen, WMS på `wms.datafordeler.dk` | Web Mercator, ETRS89 / UTM 32N (25832) | CC BY 4.0, "GeoDanmark ortofoto forår © Klimadatastyrelsen" | Gratis API-nøgle fra Datafordeleren: opret en bruger med e-mail på portal.datafordeler.dk og derefter en API-nøgle (gælder i to år) |
| Finland: Ortokuva | Maanmittauslaitos, WMTS på `avoin-karttakuva.maanmittauslaitos.fi` | Web Mercator | CC BY 4.0, "Ortokuva © Maanmittauslaitos" | Gratis API-nøgle fra Maanmittauslaitos: opret en konto i Oma tili (omatili.maanmittauslaitos.fi) og derefter en ny API-nøgle |
| Island: Grunnkort – Loftmynd | Náttúrufræðistofnun, WMS på `gis.natt.is` | Web Mercator, ISN93 (3057) | CC BY 4.0, "Grunnkort – Loftmynd © Náttúrufræðistofnun" | Ingen |
| Sverige: Ortofoto (STAC) | Lantmäteriet, cloud-optimerede GeoTIFF-filer i STAC-kataloget på `api.lantmateriet.se/stac-bild`, filerne på `dl1.lantmateriet.se` | Web Mercator (omregnet), SWEREF 99 TM (3006) | CC BY 4.0, "Ortofoto © Lantmäteriet (år)", bearbejdet til kortet | Forbrugernøgle og forbrugerhemmelighed fra en gratis konto i Geotorget (geotorget.lantmateriet.se), hvor Ortofoto Nedladdning er bestilt; den samme nøgle som til højdemodellen |

- Kildeangivelsen og licensen står i kortets hjørne, så længe ortofotoet vises.
- Billederne hentes først, når du vælger et ortofoto, efter samtykke til *Baggrundskort*; spørgsmålet nævner tjenestens vært.
- Kræver ortofotoet en nøgle, spørger appen efter den, når du vælger det. Nøglen gælder sessionen eller gemmes krypteret med en
  adgangssætning som appens andre nøgler, sendes kun til sin egen tjeneste i billedernes adresser og gemmes aldrig i kortvisningen.
  Publiceret HTML tager kun ortofotos med, der ikke kræver nøgle.
- På plankortet i planens eget koordinatsystem findes de ortofotos, hvis tjeneste tilbyder det system (Danmark i UTM 32N, Island i ISN93).
- Islands mosaik dækker endnu ikke hele landet og udbygges hvert år. Finlands åbne tjeneste giver billederne op til zoomniveau 16 og
  forstørrer dem derefter.
- Norge har ingen åben ortofototjeneste: Norge i bilder er kun åben for medlemmerne af Norge digitalt. Sverige har ingen åben tjeneste
  med fliser (Lantmäteriets Ortofoto Visning har et licensgebyr), men Lantmäteriets ortofotos er åbne data som filer, og dem læser appen
  for én visning ad gangen (nedenfor).

### Sverige: Lantmäteriets ortofotos

- Vælg *Ortofoto – Lantmäteriet (STAC)*. Det findes i valget af baggrundskort i Bearbejd, i kortvisningerne i Visualisér, på plankortet
  (i Web Mercator eller SWEREF 99 TM) og, når stedet ligger i Sverige, under stedet for en ny bygning.
- Appen søger i Lantmäteriets billedkatalog (STAC, samlingerne `orto-<område>-<år>`) efter de nyeste farvebilleder over det, kortet
  viser, og læser kun det udsnit, der skal bruges, fra filerne. Filerne er felter på 2,5 × 2,5 km i SWEREF 99 TM med 16 cm pr. pixel
  siden 2019 (25 eller 50 cm før); en større visning læses fra et grovere oversigtsniveau i filen. Hvor den nyeste flyvning slutter,
  udfylder den næstnyeste.
- Billedet gælder den visning, du hentede det til, højst 1 km² (for stedet for en ny bygning stedet og 250 m omkring det). Den længste
  side er højst 2.048 pixel og aldrig finere end filen. Flytter du kortet, henter knappen *Hent ortofoto for visningen* billedet til den
  nye visning; et kort, der tegnes igen over samme visning, bruger det billede, der allerede er hentet. En større visning giver en
  besked om at zoome ind.
- På et kort i Web Mercator omregnes billedet pixel for pixel fra SWEREF 99 TM, så det ligger rigtigt (mindre end en pixel fra); på
  plankortet i SWEREF 99 TM ligger det som i filen.
- Filerne kræver en nøgle: forbrugernøgle og forbrugerhemmelighed fra en gratis konto i Geotorget, hvor produktet Ortofoto Nedladdning
  er bestilt (Lantmäteriet behandler bestillingen, og vilkårene skal godkendes). Det er den samme nøgle, som kilden *Lantmäteriet
  geodata med nøgle (STAC)* og højdemodellen bruger; mangler den, spørger appen efter den, når du vælger ortofotoet, med et link til
  Geotorget. Med nøglen henter appen et adgangstoken fra `apimanager.lantmateriet.se`, og tokenet sendes kun til `dl1.lantmateriet.se`.
  Søgningen i kataloget kræver ingen nøgle.
- Intet hentes, før du vælger ortofotoet eller trykker på knappen. Så spørger appen én gang om samtykke til *API-hentning* og nævner
  værterne. En gemt kortvisning henter intet, når den åbnes; den viser knappen.
- Kildeangivelsen i kortets hjørne følger Lantmäteriets vilkår: "Ortofoto © Lantmäteriet (år), bearbejdet til kortet (CC BY 4.0)".
  Billedet kommer ikke med i eksport (SVG, PNG, PDF), gemte kortvisninger eller publiceret HTML.
- Filerne læses ét felt ad gangen med en pause imellem, og omregningen sker i omgange, så siden ikke låser; en visning på 1 km² tager
  nogle sekunder.

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

## Koordinatsystemer

En GeoPackage-fil, en shapefil (med `.prj`) og en GeoJSON-fil med `crs` angiver sit koordinatsystem. Appen bruger det,
når kortet tegnes, når rumlig søgning leder efter steder, og når datasættet eksporteres med geometri; koordinaterne i
tabellen bevares, som de står i filen. Angiver filen intet system, tages projicerede koordinater som SWEREF 99 TM. Appen
regner disse systemer om:

| System | EPSG |
|---|---|
| SWEREF 99 TM og de tolv lokale zoner (SWEREF 99 12 00 til 23 15) | 3006, 3007–3018 |
| RT 90 2,5 gon V, med Lantmäteriets direkte projektion | 3021 |
| ETRS89 og WGS 84 / UTM 32–35 (Danmark, Norge, Finland) | 25832–25835, 32632–32635 |
| ETRS-TM35FIN og de finske GK-zoner | 3067, 3873–3885 |
| ISN93 / Lambert 1993 (Island) | 3057 |
| Web Mercator | 3857 |
| WGS 84 og ETRS89 i grader | 4326, 4258 |

Omregningen stemmer med PROJ (som QGIS bruger) inden for en millimeter; RT 90 2,5 gon V inden for to decimeter, fordi den
direkte projektion er en forenkling. Angiver en fil et andet system, for eksempel RT 90 i en anden zone eller et ældre
lokalt kommunesystem, siger Hent til, og kortet tegner ikke stederne i stedet for at tegne dem forkert; regn filen om til
SWEREF 99 først, for eksempel i QGIS. Kortene her tegnes i Web Mercator med nord opad; en plan kan også vises i sit eget
system (se [planer.md](planer.md#koordinatsystemer-og-højder)).

## Begrænsninger

- Baggrundskort og publiceret HTML med baggrundskort kræver net; appen selv laver ingen kald uden samtykke.
- Koordinatsystemer: dem, der står under [Koordinatsystemer](#koordinatsystemer). Andre skal regnes om før import (for eksempel i
  QGIS); appen siger til og tegner dem ikke.
- Eksporten tegner lagene, ikke baggrundskortet eller WMS-lag.
- Buffere og overlejringer er plane beregninger på WGS 84-koordinater via Turf; i kilometerskala i Norden er fejlen
  lille, for meget store flader mærkbar.
