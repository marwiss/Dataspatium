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
   vilken app som ska användas väljer du Edge, Chrome eller Firefox.
4. **Importera.** I läget *Inhämta* släpper du en fil på ytan (eller klickar på *Prova med exempeldata*),
   kontrollerar kolumnernas typer och klickar på *Importera*. Datamängden sparas i webbläsaren på din dator.
5. **Arbeta vidare.** Växla läge högst upp: *Hantera* visar dina datamängder och arbetsytan, *Bearbeta* visar
   tabellen med sortering, filter och åtgärder, *Analysera* öppnar R- och SQL-konsolen, *Visualisera* bygger
   diagram och *Exportera* laddar ned data, diagram och dokument.

Data sparas i webbläsarens egen databas. Rensar du webbplatsdata försvinner den, så ta regelbundet en
säkerhetskopia under *Hantera > Arbetsyta*. Säkerhetskopian är en ZIP-fil som kan återställas på samma eller en
annan dator. Steg för steg med fler detaljer: [docs/kom-igang.md](docs/kom-igang.md).

## Vad som krävs

- Windows, macOS eller Linux.
- Microsoft Edge eller Google Chrome (version 120 eller senare), eller Firefox (version 128 eller senare).
  Safari stöds inte.
- Ungefär 300 MB ledigt utrymme för appmappen och minst 4 GB arbetsminne (8 GB rekommenderas för stora
  datamängder). Inga administratörsrättigheter behövs.
- Internet behövs bara när du hämtar data från öppna API:er eller söker efter uppdatering.

## Vad du kan göra

- **Hämta in**: CSV-, Excel-, ODS-, JSON-, JSON-stat-, GeoJSON-, XML-, SQLite-, GeoPackage- och shapefile-filer,
  text med fasta kolumnbredder, statistikfiler från SPSS, Stata, SAS och SCB:s PX-format samt Parquet och RDS
  (via R), inklistrad text, filer från webbadresser, och data direkt från öppna API:er hos SCB,
  Folkhälsomyndigheten, Socialstyrelsen, Kolada, Eurostat, SMHI, Naturvårdsverket, Lantmäteriet och Sveriges
  dataportal, med omhämtning av alla API-datamängder på en knapptryckning (se
  [docs/api-konfiguration.md](docs/api-konfiguration.md)).
- **Bearbeta**: bläddra, sortera och filtrera i stora tabeller, redigera celler, rensa, typa, beräkna, pivotera och
  koppla data, kontrollera datakvalitet med profil och regler, pseudonymisera personnummer inför delning, med
  ångra, versioner och recept som kan exporteras som R eller SQL (se [docs/bearbeta.md](docs/bearbeta.md)).
- **Analysera**: en inbyggd R-konsol med ggplot2 och tidyverse (se [docs/r-guide.md](docs/r-guide.md)), en
  SQL-konsol och anteckningsböcker med text-, R- och SQL-celler som blir rapporter i HTML, Word, PDF, Markdown
  eller LaTeX (se [docs/anteckningsbok.md](docs/anteckningsbok.md)), helt i webbläsaren.
- **Visualisera**: diagram med Vega-Lite (inklusive koropletkartor över kommuner och län), D3-mallar eller R,
  exporterade som SVG, PNG, PDF och PowerPoint, även i batch per grupp, och dashboards med gemensamma filter som
  blir HTML eller PowerPoint (se [docs/visualisera.md](docs/visualisera.md)).
- **Dokumentera**: rapporter och kodböcker ur mallar som HTML, Word, PDF, Markdown eller LaTeX, även ett dokument
  per kommun eller år (se [docs/dokumentmallar.md](docs/dokumentmallar.md)).
- **Exportera och dela**: data till CSV, Excel, ODS, JSON, XML, SQLite, Parquet, SPSS, Stata och RDS;
  delningspaket med valda datamängder och objekt, säkerhetskopia av arbetsytan som ZIP och, i Edge och Chrome,
  en portabel mapp med vanliga filer.
- **Hitta snabbt**: kommandopaletten (Ctrl+K) växlar läge, öppnar datamängder, diagram och dashboards och kör
  åtgärder från ett enda sökfält.

## Lär dig mer

- [Kom igång](docs/kom-igang.md): steg för steg med vanliga frågor.
- [Användarguide](docs/anvandarguide.md): hela arbetsflödet från fil till rapport.
- [Vanliga frågor](docs/faq.md): lagring, säkerhet, R, API:er och uppdateringar.
- [De sex lägena](docs/lagen.md): vad som finns var och varför.
- [Anteckningsbok](docs/anteckningsbok.md): text, R och SQL i celler som blir en rapport.
- [Format och import](docs/format.md): filformat, teckenkodning, decimaltecken, datum och kolumntyper.
- [Licenser](docs/licenser.md): vad du får göra med appen och vilka licenser tredjepartskomponenterna har.
- [Utveckling](docs/utveckling.md), [Arkitektur](docs/arkitektur.md) och [Stilguide](docs/stilguide.md) för
  den som vill förstå koden; hur bidrag tas emot står i [CONTRIBUTING.md](CONTRIBUTING.md).
- [Teknisk spik, fas 0](docs/fas0-spik.md): hur det bevisades att allt fungerar utan server.
- Externa resurser: [WebR](https://docs.r-wasm.org/webr/latest/), [R för nybörjare](https://www.r-project.org/),
  [Vega-Lite](https://vega.github.io/vega-lite/), [SCB:s API](https://www.scb.se/vara-tjanster/oppna-data/api-for-statistikdatabasen/).

## Begränsningar i korthet

- Appen måste öppnas från en uppackad mapp (file://) eller en vanlig webbserver; den fungerar inte direkt inifrån
  en ZIP-fil.
- API:er som saknar CORS-stöd (till exempel Riksbankens) kan inte anropas direkt från webbläsaren.
- En datamängd bör hålla sig under ett par miljoner rader; minnet i webbläsaren sätter gränsen.
- R-kod kan inte avbrytas mitt i en beräkning; använd *Starta om R*.
- Flera flikar fungerar och håller varandra underrättade, men redigera inte samma datamängd i två flikar
  samtidigt: den som sparar sist vinner.
- Den portabla mappen kräver Edge eller Chrome; Firefox saknar mappåtkomst (File System Access). Säkerhetskopia
  som ZIP fungerar överallt.
- Safari och mobila webbläsare stöds inte.

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
