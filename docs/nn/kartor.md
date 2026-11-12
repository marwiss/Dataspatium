# Kart

Eit datasett med geometri eller koordinatar er eit kart. I Bearbeid blir det opna som eit kart å zoome og panorere i, i
Visualiser blir det ei lagra **kartvising** med fleire lag for dashbord, presentasjonar og publisering, og i
Analyser finst fana **Geo** med geoverktøy utan kode. Karta blir teikna med Leaflet; geometrien blir rekna ut med Turf.
Ingenting blir henta frå nettet før du vel eit bakgrunnskart og gjev samtykket ditt.

## Kva som blir rekna som geodata

| Geodata | Blir kjent att på |
|---|---|
| Geometrikolonne | Ein tekstkolonne med GeoJSON eller WKT, oftast `geometry` (import av GeoJSON, Shapefile, GeoPackage, KML, GPX og TopoJSON gjev han) |
| Koordinatkolonnar | To talkolonnar for lengde- og breiddegrad (`lon`/`lat`, `longitude`/`latitude`, `x`/`y` med fleire) |
| Projiserte koordinatar | Blir rekna om til WGS 84 med koordinatsystemet til fila, eller som SWEREF 99 TM når fila ikkje oppgir noko (sjå [Koordinatsystem](#koordinatsystem)) |

Datasett med ein geometrikolonne eller kolonnar som heiter lengde- og breiddegrad blir opna som kart direkte; for andre
koordinatkolonnar (til dømes `x` og `y`) vel du *Vis som kart* i verktøylinja til tabellen.

Geodata kan òg hentast direkte frå opne tenester: *Legg til geodatakjelde* i Hent gjer ei kjelde av ei WFS-, OGC API
Features- eller ArcGIS-teneste, og kjelda *Geodataportalen* finn tenester i den nasjonale katalogen. Svara får ein
geometrikolonne og blir opna som kart. Sjå [kallor.md](kallor.md#opne-geodata).

Namn er ikkje nok. Appen kontrollerer òg verdiane: ein geometrikolonne må innehalde ein geometri, og koordinatar må liggje i grader eller i eit projisert system. Kolonnar som berre heiter x og y, blir rekna som koordinatar når verdiane er projiserte, sidan små tal under dei namna oftast er noko anna. Ein tabell med koordinatar kan eksporterast som GeoJSON med punkt.

Er koordinatane i eit anna system enn SWEREF 99 TM, vel du det når du importerer, til dømes RT 90 eller ei UTM-sone. Appen legg då til kolonnar i grader og held på originalane.

## Kartet i Bearbeid

Kartet viser objekta i datasettet i fargen til appen. Zoom med hjulet eller knappane, panorer ved å dra (målestokken nede til venstre viser avstanden i meter), og klikk på eit
objekt så viser inspektøren attributta; *Rediger i tabellen* tek deg til rada i tabellen. Verktøylinja har
bakgrunnskart (ingen, OpenStreetMap eller eit [ortofoto](#ortofoto)), *Zoom til alt*, *Lagre som kartvising* (lagrar kartet med lag og gjeldande
vising som eit diagram i Visualiser) og *Vis som tabell*. Alt du gjer i tabellen (filtrere, rette, slette rader) blir vist
på kartet.

Store datasett blir teikna med canvas; 10 000 polygon blir panorerte utan hakk. Fleire enn 50 000 objekt per lag blir ikkje
teikna (grensa kan hevast per lag i kartvisinga).

Biletsamlingar med posisjon har knappen *Vis på kartet*. Klikk på ein stad, så viser inspektøren biletet. Ein tabell der radene namngjev bilete, viser dei på same måte. *Bruk det som blir vist* gjer det kartet viser akkurat no, til eit utval som følgjer med til dei andre modusane. I ei kartvising i Visualiser kan biletsamlingar og planar vere lag.

## Kartvisingar i Visualiser

*Nytt diagram → Kart* lagar ei kartvising med det valde datasettet som første lag. Innstillingane til venstre:

- **Bakgrunnskart**: ingen (standard), OpenStreetMap, eit [ortofoto](#ortofoto) eller ein eigen karttenar med ein adressemal som
  `https://…/{z}/{x}/{y}.png` og kjeldetekst, eller ei **WMS-teneste** (adresse, lag, biletformat og gjennomsikt; *Les lag* hentar laglista
  til tenesta). Bakgrunnskart blir henta frå nettet og spør om samtykke første gongen (føremålet
  *Bakgrunnskart* under Handter → Internettilgang).
- **Lag**: legg til fleire datasett eller grensene som følgjer med (fylke og kommunar i Sverige, Danmark, Noreg og
  Finland) eller eit **WMS-lag** (bilete frå ei kartteneste, teikna under objekta med valfri gjennomsikt; det
  har inga teiknforklaring og følgjer ikkje med i eksport til SVG, PNG og PDF). Kvart lag har namn, synlegheit, rekkjefølgje, farge, fyll, linjebreidd og punktstorleik, geometri- eller
  koordinatkolonnar, farge etter kolonne (kategoriar med paletten til appen eller klassar med ein sekvensiell skala, tal på
  klassar), etikett (blir vist når peikaren kviler på objektet) og høgste tal på objekt.
- **Vising**: *Lagre gjeldande vising* låser midtpunktet og zoomen til kartet; elles blir kartet tilpassa laga.
  Teiknforklaring og høgd kan endrast.

Inspektøren viser teiknforklaringa og objektet du klikka på. Kartvisinga blir eksportert til SVG, PNG og PDF, køyrd i
batch per gruppe, blir PowerPoint og kan leggjast inn i dokumentmalar med `{{diagram "Namn"}}`. Eksporten teiknar laga
utan bakgrunnskart. I dashbord, presentasjonar og publisert HTML er kartet interaktivt; publisert HTML får Leaflet
innebygd og objekta som GeoJSON, og bakgrunnskartet blir då henta av nettlesaren til lesaren.

## Ortofoto

Eit ortofoto er eit flybilete som er retta opp slik at det ligg som eit kart. Tre opne ortofoto finst i valet av bakgrunnskart i
Bearbeid, i kartvisingane i Visualiser, på plankartet og under staden for ein ny bygning (sjå [cad-bim.md](cad-bim.md)):

| Ortofoto | Utgjevar og teneste | Koordinatsystem | Lisens og kjeldetilvising | Nøkkel |
|---|---|---|---|---|
| Danmark: GeoDanmark ortofoto forår | Klimadatastyrelsen, WMS på `wms.datafordeler.dk` | Web Mercator, ETRS89 / UTM 32N (25832) | CC BY 4.0, "GeoDanmark ortofoto forår © Klimadatastyrelsen" | Gratis API-nøkkel frå Datafordeleren: opprett ein brukar med e-post på portal.datafordeler.dk og deretter ein API-nøkkel (gjeld i to år) |
| Finland: Ortokuva | Maanmittauslaitos, WMTS på `avoin-karttakuva.maanmittauslaitos.fi` | Web Mercator | CC BY 4.0, "Ortokuva © Maanmittauslaitos" | Gratis API-nøkkel frå Maanmittauslaitos: opprett ein konto i Oma tili (omatili.maanmittauslaitos.fi) og deretter ein ny API-nøkkel |
| Island: Grunnkort – Loftmynd | Náttúrufræðistofnun, WMS på `gis.natt.is` | Web Mercator, ISN93 (3057) | CC BY 4.0, "Grunnkort – Loftmynd © Náttúrufræðistofnun" | Ingen |

- Kjeldetilvisinga og lisensen står i hjørnet av kartet så lenge ortofotoet blir vist.
- Bileta blir henta først når du vel eit ortofoto, etter samtykke til *Bakgrunnskart*; spørsmålet nemner verten til tenesta.
- Krev ortofotoet ein nøkkel, spør appen etter han når du vel det. Nøkkelen gjeld økta eller blir lagra kryptert med ei passordfrase som
  dei andre nøklane i appen, blir berre send til si eiga teneste i adressene til bileta og blir aldri lagra i kartvisinga. Publisert HTML
  tek berre med ortofoto som ikkje krev nøkkel.
- På plankartet i planen sitt eige koordinatsystem finst dei ortofotoa som tenesta tilbyr i det systemet (Danmark i UTM 32N, Island i ISN93).
- Mosaikken til Island dekkjer enno ikkje heile landet og blir bygd ut kvart år. Den opne tenesta i Finland gjev bileta opp til zoomnivå 16
  og forstørrar dei deretter.
- Sverige og Noreg har ingen opne ortofototenester: Ortofoto Visning frå Lantmäteriet har ei lisensavgift, og Norge i bilder er open
  berre for medlemmene i Norge digitalt. Ortofotoa til Lantmäteriet er opne data (CC BY 4.0) som filer for nedlasting (STAC), men dei
  viser ikkje appen som kart enno.

## Geoverktøy i Analyser

Når eit datasett med geometri er valt, får Analyser fana **Geo** (etter Regex). Alle resultat er tabellar med ein
kolonne `geometry` som kan lagrast som datasett med *Opprett datasett* og opnast som kart.

| Verktøy | Kva det gjer |
|---|---|
| Mål | Areal (km²), lengd (km), midtpunkt (lengde- og breiddegrad) og utstrekning for kvart objekt |
| Punkt i område | Tel punkt per område (og summerer ein verdikolonne), eller gjev kvart punkt attributta til området |
| Nærmaste | For kvart objekt det nærmaste objektet i eit anna datasett med avstanden i km |
| Buffer | Soner i vald avstand i meter rundt kvart objekt |
| Overlagring | Snitt mellom to områdedatasett (eitt objekt per overlappande par med begge attributtsetta og det felles arealet) eller differanse (det som blir att av det første laget) |
| Samanslåing | Slår saman område med same verdi i ein kolonne (eller alle) til eitt objekt med tal og areal |
| Forenkling | Forenklar geometriar med vald toleranse i meter og viser tal på punkt før og etter |

Verktøya arbeider i nettlesaren utan nett og i omgangar slik at sida svarar; svært store datasett (titusenvis av
komplekse polygon) tek tid. Mål og koordinatomrekning finst òg som oppskriftssteg i Bearbeid (gruppa Geodata).

## QGIS-prosjekt

Slepp ei prosjektfil (`.qgs` eller `.qgz`) i Hent, gjerne saman med datafilene (GeoPackage, GeoJSON, Shapefile som
ZIP). Dataspatium les lagrekkjefølgja, synlegheita og symbola (eitt symbol, kategoriar eller klassar med fargane,
linjebreiddene og punktstorleikane) og parar kvart lag mot eit datasett med same filnamn (og lagnamn for
GeoPackage); filer som følgjer med men manglar, blir importerte først. Resultatet er ei kartvising i Visualiser. Rasterlag,
etikettar, effektar og regelbaserte symbol utover den første regelen blir ikkje tekne med.

## Koordinatsystem

Ei GeoPackage-fil, ei shapefil (med `.prj`) og ei GeoJSON-fil med `crs` oppgir koordinatsystemet sitt. Appen brukar det
når kartet blir teikna, når romleg søk leitar etter stader, og når datasettet blir eksportert med geometri; koordinatane
i tabellen blir haldne slik dei står i fila. Oppgir fila ikkje noko system, blir projiserte koordinatar tekne som
SWEREF 99 TM. Appen reknar om desse systema:

| System | EPSG |
|---|---|
| SWEREF 99 TM og dei tolv lokale sonene (SWEREF 99 12 00 til 23 15) | 3006, 3007–3018 |
| RT 90 2,5 gon V, med den direkte projeksjonen til Lantmäteriet | 3021 |
| ETRS89 og WGS 84 / UTM 32–35 (Danmark, Noreg, Finland) | 25832–25835, 32632–32635 |
| ETRS-TM35FIN og dei finske GK-sonene | 3067, 3873–3885 |
| ISN93 / Lambert 1993 (Island) | 3057 |
| Web Mercator | 3857 |
| WGS 84 og ETRS89 i grader | 4326, 4258 |

Omrekninga stemmer med PROJ (som QGIS brukar) innanfor ein millimeter; RT 90 2,5 gon V innanfor to desimeter, fordi den
direkte projeksjonen er ei forenkling. Oppgir ei fil eit anna system, til dømes RT 90 i ei anna sone eller eit eldre lokalt
kommunesystem, seier Hent frå, og kartet teiknar ikkje stadene i staden for å teikne dei feil; rekn om fila til SWEREF 99
først, til dømes i QGIS. Karta her blir teikna i Web Mercator med nord opp; ein plan kan også visast i sitt eige system
(sjå [planer.md](planer.md#koordinatsystem-og-høgder)).

## Avgrensingar

- Bakgrunnskart og publisert HTML med bakgrunnskart krev nett; appen sjølv gjer ingen kall utan samtykke.
- Koordinatsystem: dei som står under [Koordinatsystem](#koordinatsystem). Andre må reknast om før import (til dømes i QGIS);
  appen seier frå og teiknar dei ikkje.
- Eksporten teiknar laga, ikkje bakgrunnskartet eller WMS-lag.
- Bufferar og overlagringar er plane utrekningar på WGS 84-koordinatar via Turf; i kilometerskala i Norden er feilen
  liten, for svært store flater merkbar.
