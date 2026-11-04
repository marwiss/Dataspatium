**Svenska** · [Dansk](docs/da/README.md) · [Norsk](docs/nb/README.md) · [Suomi](docs/fi/README.md) · [Íslenska](docs/is/README.md) · [English](docs/en/README.md)

# Dataspatium

Dataspatium är en webbapp för data från källa till rapport: hämta in data från filer och öppna API:er, lagra och
hantera datamängder, granska och korrigera värden, analysera med R, visualisera och exportera. Allt körs i din
egen webbläsare. Ingen server, ingen installation, inga konton. Din data lämnar aldrig datorn om du inte själv
exporterar den.

![Dataspatium i läget Bearbeta med en tabell över Sveriges kommuner](docs/images/bearbeta.png)

## Ladda ned och kom igång

1. **Ladda ned.** Gå till [senaste utgåvan](https://github.com/marwiss/Dataspatium/releases/latest) och hämta
   ZIP-filen under *Assets* (`dataspatium-<version>.zip`, ungefär 100 MB; R och alla R-paket ingår).
2. **Packa upp.** Högerklicka på ZIP-filen och välj *Extrahera alla* (Windows) eller dubbelklicka på den (macOS).
   Lägg mappen där du vill ha den, till exempel i Dokument. Appen fungerar inte direkt inifrån ZIP-filen.
3. **Öppna.** Dubbelklicka på `index.html` i mappen, eller dra filen till ett webbläsarfönster. Om Windows frågar
   vilken app som ska användas väljer du Edge, Chrome eller Firefox. Första gången frågar appen vilket språk du
   vill ha (det kan ändras med språkknappen uppe till höger) och startar sedan **Grundkursen**, en interaktiv
   genomgång av alla lägen med exempeldata som tar ungefär tio minuter. Kursen öppnas igen från hjälpen (?).
4. **Importera.** I läget *Inhämta* släpper du en fil på ytan (eller klickar på *Prova med exempeldata*),
   kontrollerar kolumnernas typer och klickar på *Importera*. Datamängden sparas i webbläsaren på din dator.
5. **Arbeta vidare.** Växla läge högst upp: *Hantera* visar dina datamängder och arbetsytan, *Söka* hittar rader
   i dem, *Bearbeta* visar tabellen med sortering, filter och åtgärder, *Analysera* öppnar R- och SQL-konsolen,
   *Visualisera* bygger diagram, *Exportera* laddar ned data, diagram och dokument och *Dela* ger dem till andra.

Data sparas i webbläsarens egen databas. Rensar du webbplatsdata försvinner den, så ta regelbundet en
säkerhetskopia under *Hantera > Arbetsyta*. Säkerhetskopian är en ZIP-fil som kan återställas på samma eller en
annan dator. Steg för steg med fler detaljer: [docs/kom-igang.md](docs/kom-igang.md).

Appen finns också direkt på webben, utan nedladdning: <https://marwiss.github.io/Dataspatium/>. Från en webbserver
kan den installeras som egen app (Edge och Chrome: *Installera* i adressfältet) och fungerar sedan även utan
nätverk. Webbversionen och mappversionen har skilda arbetsytor; flytta data mellan dem med en säkerhetskopia eller
ett paket.

## Vad som krävs

- Windows, macOS eller Linux.
- Microsoft Edge eller Google Chrome (version 120 eller senare), eller Firefox (version 128 eller senare).
  Safari stöds inte.
- Ungefär 300 MB ledigt utrymme för appmappen och minst 4 GB arbetsminne (8 GB rekommenderas för stora
  datamängder). Inga administratörsrättigheter behövs.
- Internet behövs bara när du hämtar data från öppna API:er, skickar till GitHub, söker efter uppdatering eller
  hämtar en komponent eller ett R-paket som inte följer med i mappen; appen frågar om lov först.

## Vad du kan göra

- **Hämta in**: CSV-, Excel-, ODS-, JSON-, JSON-stat-, SDMX-JSON-, GeoJSON-, XML-, SQLite-, GeoPackage- och shapefile-filer,
  tabeller i HTML-, Markdown-, Word- och LaTeX-dokument, kartfiler i KML, KMZ, GPX och TopoJSON, SQL-skript,
  äldre kalkylformat (dBase, Lotus 1-2-3, Quattro Pro, SYLK, DIF), text med fasta kolumnbredder, statistikfiler
  från SPSS, Stata och SAS (med värdeetiketter) och SCB:s PX-format samt Parquet och RDS
  (via R), inklistrad text, filer från webbadresser, och data direkt från öppna API:er hos SCB,
  Folkhälsomyndigheten, Socialstyrelsen, Kolada, Eurostat, SMHI, Naturvårdsverket, Lantmäteriet och Sveriges
  dataportal samt statistikbyråerna och andra myndigheter i Danmark, Norge, Finland, Island, Grönland, Färöarna
  och Åland, Nordic Statistics, ECB och OECD, med landsfilter och sparade hämtningar som uppdateras med ett klick
  och spelar upp sina recept (se [docs/api-konfiguration.md](docs/api-konfiguration.md)). Exempeldata och
  kommun- och regiongränser för Sverige, Danmark, Norge och Finland följer med.
- **Databaser**: Access-filer läses direkt i webbläsaren; databaser på datorn eller i nätverket (SQL Server, ODBC, Excel,
  SQLite) nås genom en lokal brygga, och PostgREST/Supabase, OData, GraphQL, CouchDB, ClickHouse, Elasticsearch,
  SPARQL, InfluxDB, Google Sheets och Airtable blir källor med ett klick. Filer kan länkas och läsas in igen från
  disken (se [docs/kallor.md](docs/kallor.md)).
- **Dokument och bilder**: PDF, Word, OpenDocument, Markdown och text blir dokumentsamlingar som läses i en läsvy, sida för sida
  eller i sin helhet; bilder blir en bildsamling med EXIF-uppgifter och galleri. Verktygen Text (ordfrekvens, nyckelord
  i kontext, samförekomster) och Bilder (översikt, dubbletter) fungerar utan kod (se [docs/dokument.md](docs/dokument.md)).
- **Bearbeta**: bläddra, sortera och filtrera i stora tabeller, redigera celler, rensa, typa, koda om,
  klassindela, rangordna, beräkna andelar, löpande summor och förändringar, pivotera och koppla data,
  kontrollera datakvalitet med profil och regler (bland annat format, nordiska identitetsnummer, referenser till
  andra datamängder och avvikande värden), pseudonymisera personnummer inför delning, slå
  upp kommun och län ur koordinater, med ångra, versioner och recept som kan exporteras som R eller SQL (se
  [docs/bearbeta.md](docs/bearbeta.md)).
- **Analysera**: en inbyggd R-konsol med ggplot2 och tidyverse (se [docs/r-guide.md](docs/r-guide.md)), en
  Python-konsol med pandas och matplotlib som hämtas första gången (se [docs/python.md](docs/python.md)), en
  SQL-konsol där datamängder kopplas ihop med join via sina kortnamn, och anteckningsböcker med text-, R- och
  SQL-celler som blir rapporter i HTML, Word, PDF, Markdown eller LaTeX (se
  [docs/anteckningsbok.md](docs/anteckningsbok.md)), och en Regex-flik där reguljära uttryck prövas på en kolumn
  och används för att filtrera, extrahera, ersätta och dela upp (se [docs/regex.md](docs/regex.md)), helt i
  webbläsaren.
- **Kartor**: geodatamängder öppnas som kartor att zooma i, kartvyer med flera lager och bakgrundskarta efter samtycke
  blir dashboards och publicerad HTML, geoverktygen räknar area, punkter i områden, närmaste, buffert och överlagring
  utan kod, och QGIS-projekt blir kartvyer (se [docs/kartor.md](docs/kartor.md)).
- **Öppna geodata**: WFS-, OGC API Features- och ArcGIS-tjänster blir källor vars lager hämtas som kartor, med
  förinställningar för SCB, SGU, HaV, RAÄ, Skogsstyrelsen, Kartverket, Statistikcentralen och SYKE, sökning i
  Geodataportalen och WMS-tjänster som bakgrundskarta eller lager (se [docs/kallor.md](docs/kallor.md)).
- **Planer**: digitala detaljplaner (nationella specifikationen, Lantmäteriets geodataplattform) öppnas som plankartor
  med Boverkets färger och beteckningar, bestämmelserna slås upp i Boverkets Planbestämmelsekatalog (inbäddad kopia),
  och översiktsplaner (specifikationen eller Boverkets ÖP-modell) visas tema för tema (se [docs/planer.md](docs/planer.md)).
- **Visualisera**: diagram med Vega-Lite (inklusive koropletkartor och punktkartor med medföljande kommun- och
  länsgränser, fasta axelgränser, logaritmisk skala, referenslinjer och trendlinjer), D3-mallar eller R,
  exporterade som SVG, PNG, PDF och PowerPoint, även i batch per grupp, och dashboards med gemensamma filter som
  blir HTML eller PowerPoint (se [docs/visualisera.md](docs/visualisera.md)).
- **Dokumentera**: rapporter och kodböcker ur mallar som HTML, Word, PDF, Markdown eller LaTeX, även ett dokument
  per kommun eller år (se [docs/dokumentmallar.md](docs/dokumentmallar.md)).
- **Exportera och dela**: data till CSV, Excel, ODS, JSON, GeoJSON, XML, SQLite, Parquet, SPSS, Stata och RDS;
  i läget *Dela* paket med valda datamängder och objekt, ett meddelande och en ändringslogg, synk med ett
  GitHub-repo, datorns delningsmeny och publicering av dashboards och dokument som fristående HTML (se
  [docs/dela.md](docs/dela.md)); direkt överföring till telefoner och andra datorer på samma nätverk med QR-kod
  och kontrollkod, och *Dataspatium Mobil* som tar emot, visar och skickar vidare på telefonen (se
  [docs/mobil.md](docs/mobil.md)); granskning av personuppgifter innan något delas; kommentarer på datamängder
  och kolumner, säkerhetskopia av arbetsytan som ZIP och, i Edge och Chrome, en portabel mapp med vanliga filer.
- **Hålla ordning**: mappar och taggar för datamängder, filter och sortering, och batchåtgärder på flera
  datamängder på en gång (ordna, paketera, exportera, hämta igen, köra recept, ta bort).
- **Hitta snabbt**: läget *Söka* letar i alla kolumner i en eller alla datamängder, med fasetter som avgränsar och
  sparade listor (se [docs/soka.md](docs/soka.md)); kommandopaletten (Ctrl+K) växlar läge, öppnar datamängder,
  diagram och dashboards och kör åtgärder från ett enda sökfält.
- **Fråga utan kod**: fliken *Fråga* i Söka kopplar datamängder, väljer kolumner och beräkningar, sätter villkor och
  visar den SQL som skapas; sparade listor avgränsar tabellen i Bearbeta och raderna i diagram.
- **Hjälp i appen och presentation**: hela handboken med sökning öppnas med ? eller F1 vid kapitlet för det läge du
  står i, och **Presentera** visar en dashboard i hela fönstret med ett diagram i taget.
- **Sex språk**: gränssnitt, meddelanden och dokumentation på svenska, danska, norska (bokmål), finska,
  isländska och engelska.
- **Grundkurs**: en interaktiv genomgång av alla åtta lägen med exempeldata, på alla sex språk. Den visas första
  gången appen öppnas och kan öppnas när som helst från hjälpen eller kommandopaletten.

## Lär dig mer

- **Handboken** i appen: samma dokumentation som här, med sökning; öppna den med ? uppe till höger eller F1.
- **Grundkursen** i appen: en interaktiv genomgång av alla lägen med exempeldata; öppna den från hjälpen (?)
  eller med Ctrl+K.
- [Kom igång](docs/kom-igang.md): steg för steg med vanliga frågor.
- [Användarguide](docs/anvandarguide.md): hela arbetsflödet från fil till rapport.
- [Vanliga frågor](docs/faq.md): lagring, säkerhet, R, API:er och uppdateringar.
- [De åtta lägena](docs/lagen.md): vad som finns var och varför.
- [Söka](docs/soka.md) och [Dela](docs/dela.md): hitta utan kod, och ge data till andra.
- [Dataspatium Mobil](docs/mobil.md): telefonen som kurir, mottagare och visare; överföring mellan enheter.
- [Anteckningsbok](docs/anteckningsbok.md): text, R, Python och SQL i celler som blir en rapport.
- [Dokument och bilder](docs/dokument.md): PDF, Word, OpenDocument, Markdown och bilder som datamängder; dokumentvy, galleri och verktygen Text och Bilder.
- [Kartor](docs/kartor.md): kartan i Bearbeta, kartvyer i Visualisera, geoverktygen och QGIS-projekt.
- [R i Dataspatium](docs/r-guide.md) och [Python i Dataspatium](docs/python.md): konsolerna, `dm_read()`,
  `dm_write()`, paketen och diagrammen.
- [Reguljära uttryck](docs/regex.md): mönster för att analysera, rätta och dela upp text i datamängder.
- [Format och import](docs/format.md): filformat, teckenkodning, decimaltecken, datum och kolumntyper.
- [Licenser](docs/licenser.md): vad du får göra med appen och vilka licenser tredjepartskomponenterna har.
- [Utveckling](docs/utveckling.md), [Arkitektur](docs/arkitektur.md) och [Stilguide](docs/stilguide.md) för
  den som vill förstå koden; hur bidrag tas emot står i [CONTRIBUTING.md](CONTRIBUTING.md).
- [Teknisk spik, fas 0](docs/fas0-spik.md): hur det bevisades att allt fungerar utan server.
- [Teknisk spik inför 2.0](docs/fas0-2.md): WebRTC, Python, IFC, grafer och databaser prövade från file://.
- Externa resurser: [WebR](https://docs.r-wasm.org/webr/latest/), [R för nybörjare](https://www.r-project.org/),
  [Vega-Lite](https://vega.github.io/vega-lite/), [SCB:s API](https://www.scb.se/vara-tjanster/oppna-data/api-for-statistikdatabasen/).

## Begränsningar i korthet

- Appen måste öppnas från en uppackad mapp (file://) eller en vanlig webbserver; den fungerar inte direkt inifrån
  en ZIP-fil.
- API:er som saknar CORS-stöd (till exempel Riksbankens) kan inte anropas direkt från webbläsaren.
- En datamängd bör hålla sig under ett par miljoner rader; minnet i webbläsaren sätter gränsen.
- När appen öppnas från en mapp kan R-kod inte avbrytas mitt i en beräkning; använd *Starta om R*. Från en
  webbserver (localhost eller https) finns knappen *Avbryt*.
- Flera flikar fungerar och håller varandra underrättade, men redigera inte samma datamängd i två flikar
  samtidigt: den som sparar sist vinner.
- Den portabla mappen kräver Edge eller Chrome; Firefox saknar mappåtkomst (File System Access). Säkerhetskopia
  som ZIP fungerar överallt.
- Hela appen är gjord för datorer; på telefoner och surfplattor används Dataspatium Mobil
  (<https://marwiss.github.io/Dataspatium/m/>), som tar emot, visar och skickar vidare. Safari stöds inte för
  hela appen. I smala fönster öppnas panelerna som flak över arbetsytan.

## Fel och förslag

Rapportera fel eller önskemål som *Issues* här på GitHub. Beskriv webbläsare, version av Dataspatium (visas under
hjälpknappen) och vad du gjorde. Se [CONTRIBUTING.md](CONTRIBUTING.md).

## Utveckling

- Inget byggsteg, inget node.js. Öppna `index.html` direkt, eller serva mappen med `python -m http.server 8080`.
- Tredjepartskomponenter: `python tools/fetch_vendor.py` följt av `python tools/wrap_assets.py`.
- Tester: `powershell -File tools/run-tests.ps1` (headless Edge och Firefox). Se [docs/utveckling.md](docs/utveckling.md).

## Licens

Dataspatiums egen kod, dokumentation och förinställningar (allt utom `vendor/`) är licensierade under
[PolyForm Strict 1.0.0](LICENSE): fri att ladda ned och använda för icke-kommersiella ändamål, inklusive i
myndigheter och andra offentliga institutioner, men inte att ändra, bygga vidare på eller sprida vidare utan
skriftligt tillstånd. Licensgivare är Dataspatiums upphovsperson, som nås via GitHub-kontot
[marwiss](https://github.com/marwiss); öppna ett ärende för andra villkor. Vad licensen betyder i praktiken
förklaras i [docs/licenser.md](docs/licenser.md).

Tredjepartskomponenter i `vendor/` har sina egna licenser (MIT, BSD, Apache-2.0, ISC, OFL, MPL, LGPL och GPL), se
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md). R och de GPL-licensierade R-paketen distribueras oförändrade;
källkoden finns hos [R-projektet](https://cran.r-project.org/sources.html), [webR](https://github.com/r-wasm/webr)
och [CRAN](https://cran.r-project.org/) i de versioner som anges där.
