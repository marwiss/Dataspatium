# Kommun- och regiongränser

Gränser för tematiska kartor i Sverige, Danmark, Norge och Finland, i WGS 84 (longitud, latitud; fem decimaler).
Alla är förenklade och inte avsedda för analyser av exakta gränser.

## Sverige: `lan.geojson`, `kommuner.geojson`

Källa: SCB, *Digitala gränser* (https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/digitala-granser/), arkiv `shape_svenska_260225.zip` (version 260225), koordinatsystem SWEREF 99 TM i originalet.

Licens: CC0 1.0. SCB: "Vi använder licensen CC0 för dessa data, vilket innebär att du får använda och sprida eller tillgängliggöra sådana data utan krav på att ange källa." Gränserna är förenklade för tematiska kartor och inte avsedda för analyser av exakta gränser.

Filerna här är omräknade till WGS 84 (longitud, latitud; fem decimaler) och skrivna som GeoJSON av `tools/build_boundaries.py`. Yttre ringar är medurs som i shapefilen.

## Danmark: `regioner-dk.geojson`, `kommuner-dk.geojson`

Källa: Geodatastyrelsen (nu Klimadatastyrelsen), DAGI (*Danmarks Administrative Geografiske Inddeling*) i skala
1:500 000, uttag 13 februari 2014, i den omräkning till GeoJSON i WGS 84 som finns i
https://github.com/Neogeografen/dagi. Indelningen i 98 kommuner och fem regioner är densamma sedan 2007. Christiansø
ligger utanför den kommunala indelningen men finns med som i DAGI (kod 0411).

Licens: fria geografiska data enligt Geodatastyrelsens villkor (*Vilkår for brug af frie geografiske data*): data får
kopieras, spridas, ändras och användas, även kommersiellt, med källangivelse. Källangivelse: "Indeholder data fra
Geodatastyrelsen (nu Klimadatastyrelsen), DAGI 1:500 000, februar 2014."

Aktuella DAGI-data finns hos Dataforsyningen (https://dataforsyningen.dk), som kräver en kostnadsfri användare för
nedladdning.

## Norge: `fylker-no.geojson`, `kommuner-no.geojson`

Källa: Kartverket, *N1000 Kartdata* (https://kartkatalog.geonorge.no/metadata/aee42bb6-d0e9-4d70-86fe-6ea76c381055),
hämtad i november 2026 via Geonorges nedladdnings-API; indelningen från 2024 med 357 kommuner och 15 fylken. Norska
kommuner sträcker sig ut till territorialgränsen till havs. Här är de klippta längs kustlinjen (*Kystkontur*, och
*HavElvSperre* vid älvmynningar) så att bara land ingår; fylkena är sammanslagna kommuner.

Licens: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Källangivelse: "© Kartverket".

## Finland: `maakunnat-fi.geojson`, `kunnat-fi.geojson`

Källa: Statistikcentralen (Tilastokeskus), kommunbaserade statistiska indelningar i skala 1:1 000 000 för 2026
(`kunta1000k_2026` och `maakunta1000k_2026`) från WFS-tjänsten https://geo.stat.fi/geoserver/tilastointialueet/wfs;
308 kommuner och 19 landskap, med namn på finska och svenska.

Licens: CC BY 4.0. Källangivelse: "Tilastokeskus / Statistikcentralen".

## Bearbetning av de nordiska gränserna

`tools/build_nordic_boundaries.py` hämtar källorna, klipper de norska kommunerna längs kusten, förenklar varje gemensam
gräns en gång (Douglas–Peucker på bågarna mellan knutpunkter, så att grannytor inte får glipor), tar bort små öar utom
den största delen av varje område och skriver GeoJSON med yttre ringar medurs som i SCB-filerna.
