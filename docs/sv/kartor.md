# Kartor

En datamängd med geometri eller koordinater är en karta. I Bearbeta öppnas den som en karta att zooma och panorera
i, i Visualisera blir den en sparad **kartvy** med flera lager för dashboards, presentationer och publicering, och i
Analysera finns fliken **Geo** med geoverktyg utan kod. Kartorna ritas med Leaflet; geometrin räknas med Turf. Inget
hämtas från nätet förrän du väljer en bakgrundskarta och ger ditt samtycke.

## Vad som räknas som geodata

| Geodata | Känns igen på |
|---|---|
| Geometrikolumn | En textkolumn med GeoJSON eller WKT, oftast `geometry` (importer av GeoJSON, Shapefile, GeoPackage, KML, GPX och TopoJSON ger den) |
| Koordinatkolumner | Två talkolumner för longitud och latitud (`lon`/`lat`, `longitud`/`latitud`, `x`/`y` med flera) |
| Projicerade koordinater | Räknas om till WGS 84 med filens koordinatsystem, eller som SWEREF 99 TM när filen inte anger något (se [Koordinatsystem](#koordinatsystem)) |

Datamängder med en geometrikolumn eller kolumner som heter longitud och latitud öppnas som karta direkt; för andra
koordinatkolumner (till exempel `x` och `y`) väljer du *Visa som karta* i tabellens verktygsrad.

Geodata kan också hämtas direkt från öppna tjänster: *Lägg till geodatakälla* i Inhämta gör en källa av en WFS-, OGC API
Features- eller ArcGIS-tjänst, och källan *Geodataportalen* söker fram tjänster i den nationella katalogen. Svaren får en
geometrikolumn och öppnas som karta. Se [kallor.md](kallor.md#öppna-geodata).

Namnen räcker inte. Appen kontrollerar också värdena: en geometrikolumn måste innehålla en geometri, och koordinater måste ligga i grader eller i ett projicerat system. Kolumner som bara heter x och y räknas som koordinater när värdena är projicerade, eftersom små tal under de namnen oftast är något annat. En tabell med koordinater kan exporteras som GeoJSON med punkter.

Är koordinaterna i ett annat system än SWEREF 99 TM väljer du det när du importerar, till exempel RT 90 eller en UTM-zon. Appen lägger då till kolumner i grader och behåller originalen.

## Kartan i Bearbeta

Kartan visar datamängdens objekt i appens färg. Zooma med hjulet eller knapparna, panorera genom att dra (skalstocken nere till vänster visar avståndet i meter), och klicka
på ett objekt så visar inspektören dess attribut; *Redigera i tabellen* tar dig till raden i tabellen. Verktygsraden
har bakgrundskarta (ingen eller OpenStreetMap), *Zooma till allt*, *Spara som kartvy* (sparar kartan med lager och
aktuell vy som ett diagram i Visualisera) och *Visa som tabell*. Allt du gör i tabellen (filtrera, rätta, ta bort
rader) syns på kartan.

Stora datamängder ritas med canvas; 10 000 polygoner panoreras utan hack. Fler än 50 000 objekt per lager ritas
inte (gränsen kan höjas per lager i kartvyn).

Bildsamlingar med position har knappen *Visa på kartan*. Klicka på en plats så visar inspektören bilden. En tabell vars rader namnger bilder visar dem på samma sätt. *Använd det som syns* gör det kartan visar just nu till ett urval som följer med till de andra lägena. I en kartvy i Visualisera kan bildsamlingar och planer vara lager.

## Kartvyer i Visualisera

*Nytt diagram → Karta* skapar en kartvy med den valda datamängden som första lager. Inställningarna till vänster:

- **Bakgrundskarta**: ingen (standard), OpenStreetMap, eller en egen kartserver med en adressmall som
  `https://…/{z}/{x}/{y}.png` och källtext, eller en **WMS-tjänst** (adress, lager, bildformat och genomskinlighet; *Läs lager* hämtar tjänstens
  lagerlista). Bakgrundskartor hämtas från nätet och frågar efter samtycke första
  gången (ändamålet *Bakgrundskartor* under Hantera → Internetåtkomst).
- **Lager**: lägg till fler datamängder eller de medföljande gränserna (län och kommuner i Sverige, Danmark, Norge och
  Finland) eller ett **WMS-lager** (bilder från en karttjänst som ritas under objekten med valbar genomskinlighet; det har
  ingen teckenförklaring och följer inte med i export till SVG, PNG och PDF). Varje lager har namn, synlighet, ordning, färg, fyllning, linjebredd och punktstorlek, geometri- eller
  koordinatkolumner, färg efter kolumn (kategorier med appens palett eller klasser med en sekventiell skala, antal
  klasser), etikett (visas när pekaren vilar på objektet) och högsta antal objekt.
- **Vy**: *Spara aktuell vy* låser kartans mitt och zoom; annars anpassas kartan till lagren. Teckenförklaring och
  höjd kan ändras.

Inspektören visar teckenförklaringen och det objekt du klickat på. Kartvyn exporteras till SVG, PNG och PDF, körs i
batch per grupp, blir PowerPoint och kan läggas in i dokumentmallar med `{{diagram "Namn"}}`. Exporten ritar lagren
utan bakgrundskarta. I dashboards, presentationer och publicerad HTML är kartan interaktiv; publicerad HTML får
Leaflet inbäddat och objekten som GeoJSON, och bakgrundskartan hämtas då av läsarens webbläsare.

## Geoverktyg i Analysera

När en datamängd med geometri är vald får Analysera fliken **Geo** (efter Regex). Alla resultat är tabeller med en
kolumn `geometry` som kan sparas som datamängd med *Skapa datamängd* och öppnas som karta.

| Verktyg | Vad det gör |
|---|---|
| Mått | Area (km²), längd (km), mittpunkt (longitud, latitud) och utbredning för varje objekt |
| Punkter i områden | Räknar punkter per område (och summerar en värdekolumn), eller ger varje punkt områdets attribut |
| Närmaste | För varje objekt det närmaste objektet i en annan datamängd med avståndet i km |
| Buffert | Zoner på valt avstånd i meter runt varje objekt |
| Överlagring | Snitt mellan två områdesdatamängder (ett objekt per överlappande par med båda attributuppsättningarna och den gemensamma arean) eller skillnad (det som blir kvar av det första lagret) |
| Sammanslagning | Slår ihop områden med samma värde i en kolumn (eller alla) till ett objekt med antal och area |
| Förenkling | Förenklar geometrier med vald tolerans i meter och visar antal punkter före och efter |

Verktygen arbetar i webbläsaren utan nät och i omgångar så att sidan svarar; mycket stora datamängder (tiotusentals
komplexa polygoner) tar tid. Mått och koordinatomräkning finns också som receptsteg i Bearbeta (gruppen Geodata).

## QGIS-projekt

Släpp en projektfil (`.qgs` eller `.qgz`) i Inhämta, gärna tillsammans med datafilerna (GeoPackage, GeoJSON,
Shapefile som ZIP). Dataspatium läser lagerordningen, synligheten och symbolerna (en symbol, kategorier eller klasser
med deras färger, linjebredder och punktstorlekar) och matchar varje lager mot en datamängd med samma filnamn (och
lagernamn för GeoPackage); medföljande filer som saknas importeras först. Resultatet är en kartvy i Visualisera.
Rasterlager, etiketter, effekter och regelbaserade symboler utöver den första regeln tas inte med.

## Koordinatsystem

En GeoPackage-fil, en shapefil (med `.prj`) och en GeoJSON-fil med `crs` anger sitt koordinatsystem. Appen använder det
när kartan ritas, när rumslig sökning letar efter platser och när datamängden exporteras med geometri; koordinaterna i
tabellen behålls som de står i filen. Anger filen inget system tas projicerade koordinater som SWEREF 99 TM. Appen räknar
om dessa system:

| System | EPSG |
|---|---|
| SWEREF 99 TM och de tolv lokala zonerna (SWEREF 99 12 00 till 23 15) | 3006, 3007–3018 |
| RT 90 2,5 gon V, med Lantmäteriets direktprojektion | 3021 |
| ETRS89 och WGS 84 / UTM 32–35 (Danmark, Norge, Finland) | 25832–25835, 32632–32635 |
| ETRS-TM35FIN och de finska GK-zonerna | 3067, 3873–3885 |
| ISN93 / Lambert 1993 (Island) | 3057 |
| Web Mercator | 3857 |
| WGS 84 och ETRS89 i grader | 4326, 4258 |

Omräkningen stämmer med PROJ (som QGIS använder) inom en millimeter; RT 90 2,5 gon V inom två decimeter, eftersom
direktprojektionen är en förenkling. Anger en fil ett annat system, till exempel RT 90 i en annan zon eller ett äldre
lokalt kommunsystem, säger Inhämta till och kartan ritar inte platserna, i stället för att rita dem fel; räkna om filen
till SWEREF 99 först, till exempel i QGIS. Kartorna här ritas i Web Mercator med norr uppåt; en plan kan också visas i sitt
eget system (se [planer.md](planer.md#koordinatsystem-och-höjder)).

## Begränsningar

- Bakgrundskartor och publicerad HTML med bakgrundskarta kräver nät; appen själv gör inga anrop utan samtycke.
- Koordinatsystem: de som står under [Koordinatsystem](#koordinatsystem). Andra måste räknas om före import (till exempel i QGIS);
  appen säger till och ritar dem inte.
- Exporten ritar lagren, inte bakgrundskartan eller WMS-lager.
- Buffertar och överlagringar är planära beräkningar på WGS 84-koordinater via Turf; för kilometerskala i Norden är
  felet litet, för mycket stora ytor märkbart.
