# Raster

Ett raster är en georefererad bild i bildpunkter: ett ortofoto, en drönarbild, en skannad karta eller en höjdmodell i GeoTIFF.
En eller flera GeoTIFF-filer (rutor) blir en datamängd av slaget *raster* med en rad per fil: bredd och höjd, band, datatyp,
upplösning, koordinatsystem, år, källa, licens, filstorlek och filens utbredning som en polygon i WGS 84 (`geometri`). Bilderna
ligger i datamängdens egen fil: originalet när det är litet nog, en förhandsvisning i Web Mercator för kartorna och en miniatyr.
Filerna läses i en egen tråd (en worker) när du väljer dem, och inget hämtas från nätet. Tabellen är alltid en knapp bort.

## Inhämta GeoTIFF

- Släpp en eller flera filer (`.tif`, `.tiff`, `.gtiff`) i Inhämta. Formatet heter *Raster (GeoTIFF, molnoptimerad GeoTIFF)*. Vanliga
  GeoTIFF-filer, molnoptimerade (COG) och BigTIFF läses, med rutor eller remsor, okomprimerade eller med LZW, Deflate, PackBits,
  LERC, JPEG eller WebP.
- Inhämta visar vad filen är, koordinatsystemet, upplösningen, bildpunkterna, banden och datatypen och om originalet sparas, och en
  bild av filen i liten skala när den går att läsa snabbt (en liten fil, eller en med översikter). Det finns inget kolumnsteg: ange
  namnet och tryck *Importera*.
- Flera filer blir ett raster med en rad per fil, högst 16 filer; de andra lämnas utanför och nämns. En fil som inte kan läsas
  lämnas utanför med sitt skäl, och resten importeras. Inhämta nämner de filerna före importen och efter den, och loggen gör det
  också. Två filer med samma namn (samma ruta ur två mappar) hålls isär: den andra får *(2)* efter namnet.
- Förhandsvisningen räknas om bildpunkt för bildpunkt till Web Mercator, så att den ligger rätt på kartorna. Den längsta sidan är
  högst 2 048 bildpunkter (1 024 när rastret har fler än fyra filer) och aldrig finare än filen. Miniatyren är högst 320 bildpunkter.
- Originalfilen sparas byte för byte när den är högst 32 MB och rastrets originalfiler tillsammans högst 40 MB. En större fil får
  bara förhandsvisningen och miniatyren, och det står i rastrets uppgifter.
- En stor fil läses ur den översiktsnivå som passar förhandsvisningen. Nivån som läses får ha högst 300 miljoner bildpunkter, så en
  stor fil utan översikter läses inte.
- Koordinatsystemet läses ur filens GeoKeys, som EPSG-kod eller som namn. Appen räknar om de system som står i
  [kartor.md](kartor.md#koordinatsystem). Anger filen inget system tas den som grader när utbredningen ryms i grader, annars som
  SWEREF 99 TM, som för andra filer. Ett system som appen inte kan räkna om sägs före importen: filen sparas med sin bild men utan
  läge och visas inte på kartan.
- Färgbilder visas som de är, också med 16 bitar per band, med palett eller i CMYK. Ett band med 8 bitar visas i gråskala, och tre
  eller fler band med 8 bitar utan färgtolkning visas som de tre första. Annars, till exempel för en höjdmodell med decimaltal, visas
  det första bandet i gråskala från 2 till 98 procent av värdena, och filens tomma värde (GDAL_NODATA) blir genomskinligt. Ett extra
  band är genomskinlighet bara när filen säger det, så infrarött i Lantmäteriets fyrbandsfiler blir inte genomskinlighet.
- Året kommer ur filens datum, och källan och krediteringen ur dess Copyright-tagg, vars text följer med bilden. Värdena i taggar som
  kan namnge en person (Artist, HostComputer, ImageDescription, DocumentName, XMP, Exif, IPTC, Photoshop och GDAL_METADATA) läses
  aldrig ut. Appen noterar bara vilka av dem som finns, för granskningen före delning.

Kan en fil inte läsas säger appen varför och vad du kan göra:

| Filen | Vad du kan göra |
|---|---|
| Är ingen TIFF-fil | Kontrollera filen; den kan vara en annan sorts bild med fel filändelse |
| Saknar läge | Spara den som PNG eller JPEG för en bildsamling, eller georeferera den i ett GIS-program och spara den som GeoTIFF |
| Är vriden i sitt rutnät | Skriv om den utan vridning, till exempel med `gdalwarp`, och importera den igen |
| Är komprimerad på ett sätt som appen inte kan läsa (till exempel gammal JPEG eller ZSTD) | Spara den med LZW, Deflate eller JPEG |
| Är för stor att läsa utan översikter | Gör den till en molnoptimerad GeoTIFF (`gdal_translate -of COG`) eller lägg till översikter (`gdaladdo`) |

## Rastret på kartan

- I Bearbeta öppnas rastret som karta: varje fils förhandsvisning på sin plats, med filernas konturer ovanpå och filnamnet som
  etikett. Inspektören visar rastrets uppgifter, *Täckning (0–1)*, som gäller direkt, och hur många filer som saknar läge.
  *Visa som tabell* ger tabellen över filerna.
- Tabellen är listan över filerna. Tar du bort en rad försvinner filens bild från kartorna, ur exporten och ur kopior som delas, och
  antalet filer räknas efter raderna.
- Bilderna ligger över bakgrundskartan och tjänsternas lager och under objekten. Krediteringen står i kartans hörn som text, med
  licensen länkad.
- Bilderna kommer ur datamängdens egen fil. Kartan frågar inte om samtycke och hämtar ingenting, utom bakgrundskartan om du väljer en.
- Hantera visar den första filen i liten skala, rastrets uppgifter, filer utan läge och filer utan original, och knappen *Visa på
  kartan*.
- I Söka hittas filerna med fritext och efter plats, och en träff öppnar filen på kartan med *Visa filen på kartan*.
- Kontrollera prövar tabellen över filerna som en tabell. Analysera öppnar i SQL med frågan *Filerna efter upplösning*, som också
  finns för R och Python.

## Spara ortofotot

- När Lantmäteriets ortofoto är bakgrundskarta finns *Spara ortofotot* bredvid *Hämta ortofoto för vyn*: i Bearbeta, i kartvyerna i
  Visualisera och under platsen för en ny byggnad.
- Knappen sparar bilden som kartan visar som en datamängd av slaget raster, med bilden som förhandsvisning och en miniatyr. Namnet
  föreslås som *Ortofoto* med året. Det är bilden i Web Mercator som appen redan har läst för vyn (högst 1 km², längsta sidan högst
  2 048 bildpunkter), inte Lantmäteriets filer, så det finns ingen originalfil.
- Krediteringen följer Lantmäteriets villkor: "Ortofoto © Lantmäteriet (år), bearbetad för kartan", med licensen CC BY 4.0. Den står i
  rastrets uppgifter, i kartans hörn, på mobilen och i `kreditering.txt` vid export.
- Inget hämtas igen, och datamängden bär varken nyckeln, token, inloggningen eller filernas adresser. Källan anger Lantmäteriet,
  bildernas id och samlingar, området och tidpunkten.
- Ett sparat ortofoto visas sedan utan nät och utan nyckel, under platsen för en ny byggnad eller som lager i en kartvy.
- Bara Lantmäteriets bild i Web Mercator sparas. Knappen finns inte på plankartan, där bilden kan ligga i filernas eget rutnät.
  Danmarks, Finlands och Islands ortofoton kommer som rutor från tjänsterna och sparas inte, och Norge saknar öppet ortofoto.

## Under platsen för en ny byggnad

I läget *Bygg från beskrivning* visar *Platsen på kartan* byggnadsytan (se
[cad-bim.md](cad-bim.md#ny-byggnad-från-en-uppdragsbeskrivning)). I valet av bakgrund står de raster i arbetsytan som täcker platsen,
under *Raster i arbetsytan*. Väljer du ett ritas det under byggnadsytan direkt ur datamängden, utan nät, nyckel eller samtyckesfråga,
och raden under kartan namnger rastret med dess kreditering. Har du läst Lantmäteriets ortofoto för platsen finns *Spara ortofotot*
bredvid valet, så att platsen kan visas utan nät nästa gång.

## Kartvyer i Visualisera

- Ett raster läggs till som lager under *Lägg till lager*, i listan över datamängder, och läggs under de lager som redan finns.
  Lagrets kort har *Täckning (0–1)*, som gäller direkt, och synlighet, och ordningen ändras som för andra lager.
- Förslaget för ett raster i Visualisera är dess egen karta: bilderna och filernas konturer.
- En sparad kartvy hittar sitt raster på namnet, också i en annan arbetsyta, som en tabells lager gör.
- Rastret ritas i Web Mercator. I en kartvy i ett eget koordinatsystem (en plan i sitt eget system) ritas det inte.

## Exportera och dela

- Exportera har *GeoTIFF: originalfilen* (en fil som den kom, flera i en ZIP) när originalen sparades, och *GeoTIFF i Web Mercator:
  bilden på kartan (ZIP)*: varje fils förhandsvisning som GeoTIFF i Web Mercator (EPSG:3857, 8 bitar per band med genomskinlighet),
  med `kreditering.txt` bredvid (krediteringen, licensen med adress och källan). Tabellformaten ger tabellen över filerna, utan
  bilderna.
- Granskningen före delning (se [dela.md](dela.md#granskning-före-delning)) gäller rastrets originalfiler. Har en fil taggar som kan
  namnge en person står taggarnas namn vid filen, och då är förvalet att ta bort originalen i kopian. Kopian behåller
  förhandsvisningarna och miniatyrerna, och dess uppgifter säger att originalen lämnades utanför när datamängden delades.
- Krediteringen är samma text som kolumnen *kalla*. Den maskeras när kolumnen maskeras och tas bort när kolumnen pseudonymiseras
  eller tas bort, och har bara krediteringen personuppgifter får den ett eget val.
- Paket, GitHub och enheter tar med datamängden med bilderna. Gränserna för originalen håller ett raster under GitHubs gräns på 100 MB
  per fil.
- Dataspatium Mobil visar miniatyrerna med kreditering och licens.

## Nivåer

Rastrets karta och kartlager hör till nivå 2, **BIM och GIS**. I **Dokument** läses GeoTIFF-filer ändå, som IFC-filer, och rastret
är sin tabell över filerna. Hantera behåller bilden och uppgifterna men inte *Visa på kartan*, Bearbeta öppnar tabellen och säger
vilken nivå kartan hör till, Analysera öppnar i Statistik, en träff i Söka öppnar raden, Kontrollera prövar tabellen, Exportera har
originalfilen och tabellformaten men inte bilden på kartan, och Dela tar med datamängden som den är. *Spara ortofotot* finns i
kartvyerna, som hör till BIM och GIS. En högre nivå visar allt igen på en gång (se
[anvandarguide.md](anvandarguide.md#nivåer)).

## Begränsningar

- En vriden fil läses inte. En världsfil (`.tfw`) bredvid filen läses inte heller, så en TIFF som bara har en världsfil saknar läge.
- GDAL:s masker, i filen eller i en `.msk`-fil, används inte.
- 16 bitar per band visas med de åtta högsta bitarna, så en mörk bild förblir mörk. Ett ensamt band visas i gråskala från 2 till 98
  procent, utan färgskala eller skuggning.
- Appen räknar inte på värdena i en höjdmodell eller ett annat band med mätvärden (lutning, volymer, profiler); de visas som bild.
- Rastret följer inte med i exporterade kartbilder (SVG, PNG, PDF), dokumentmallar eller publicerad HTML.
- Söka räknar en fil efter mitten av dess utbredning, inte efter överlapp.
- Rastret visas inte på plankartan eller i en karta i ett eget koordinatsystem.
- Kartorna slutar vid 85 grader nord och syd, där Web Mercator slutar, så en fil som når polerna visas utan dem.
- En version av rastret är en hel kopia av filen med bilderna, som för modeller.
- Drönarbilder kan visa människor, registreringsskyltar och hem. Granskningen före delning ser inte det, så det bedömer du själv.
- Att sprida flyg- och drönarbilder kan kräva tillstånd, i Sverige enligt lagen om skydd för geografisk information. Det ansvarar du
  själv för.
