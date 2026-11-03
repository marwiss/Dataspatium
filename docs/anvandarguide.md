# Användarguide

Den här guiden beskriver hur du arbetar i Dataspatium från första fil till färdig rapport. Den förutsätter att du
har öppnat appen enligt [kom-igang.md](kom-igang.md). Detaljer om varje läge finns i [lagen.md](lagen.md), om
filformat i [format.md](format.md), om API:er i [api-konfiguration.md](api-konfiguration.md), om bearbetning i
[bearbeta.md](bearbeta.md), om R i [r-guide.md](r-guide.md), om diagram i [visualisera.md](visualisera.md) och om
dokument i [dokumentmallar.md](dokumentmallar.md). Vanliga frågor besvaras i [faq.md](faq.md).

## Arbetsytan

Skärmen ser likadan ut i alla lägen. Överst växlar du läge (Inhämta, Hantera, Bearbeta, Analysera, Visualisera,
Exportera; Alt+1 till Alt+6 fungerar också) och ser arbetsytans status (sparat eller osparat), kommandopaletten
(förstoringsglaset eller Ctrl+K), tema (ljust eller mörkt) och hjälpknappen med versionsnummer och *Sök efter
uppdatering*. Kommandopaletten är den snabbaste vägen till det mesta: skriv några bokstäver för att växla läge,
öppna en datamängd, ett diagram eller en dashboard, eller köra en bearbetningsåtgärd på den valda datamängden. Till vänster finns objekten för läget
(datamängder, källor, diagram, mallar), i mitten arbetsytan och till höger inspektören med egenskaper och
statistik. Längst ned ligger loggen, där varje åtgärd, varning och fel skrivs ut; det är den du läser när något inte
blir som du tänkt.

Allt du skapar sparas automatiskt i webbläsarens databas på din dator. Ingenting skickas någonstans utan att du
själv hämtar från ett API, kontrollerar version eller exporterar.

## Ett arbetsflöde från fil till rapport

### 1. Hämta in data (Inhämta)

Släpp en fil på ytan, klistra in en tabell eller hämta en fil från en webbadress (servern måste tillåta CORS; en
delad Dataspatium-konfiguration läggs till direkt). Kontrollera förhandsgranskningen: teckenkodning, avgränsare,
rubrikrad och decimaltecken gissas men kan ändras. I kolumnsteget får varje kolumn en typ; koder med inledande
nollor (kommunkoder, personnummer) behålls som text. Ge datamängden ett namn och importera. Knapparna under
ytan lägger till data som följer med appen: exempeldatan *Befolkning per kommun 2024* samt SCB:s kommun- och
länsgränser för kartor.

Under *Öppna API:er* finns förinställningar för SCB, Folkhälsomyndigheten, Socialstyrelsen, Kolada, Eurostat,
SMHI, luftkvalitetsdata, Naturvårdsregistret, Lantmäteriets geodatakatalog och Sveriges dataportal, samt Boverket
och Lantmäteriet Direkt för den som har egna nycklar. Bläddra eller sök fram en tabell, välj variabler, förhandsgranska
och hämta till en ny datamängd eller lägg till i en befintlig. En hämtad datamängd kommer ihåg sin fråga, så den kan
hämtas igen från Hantera när källan uppdaterats.

### 2. Granska och rätta (Bearbeta)

Tabellen visar datamängden rad för rad även när den har hundratusentals rader. Klicka på en rubrik för att sortera
och se kolumnens statistik till höger: antal, saknade, unika, minsta, största, medel och vanligaste värden. Filtrera
med sökfältet. Dubbelklicka på en cell för att ändra den.

*Datakvalitet* går igenom alla kolumner och pekar på problem (tal lagrade som text, blandade datumformat, dubbletter,
teckenkodningsfel, avvikande kategorier) med en knapp som utför rätt åtgärd. *Regler* låter dig skriva ned vad som
ska gälla (får inte saknas, unik, intervall, lista, mönster, längd, SQL-villkor), köra kontrollen när som helst,
spara felande rader som egen datamängd och ladda ned en rapport. Alla åtgärder finns också i paletten:
ta bort tomma rader, trimma, skiftläge, sök och ersätt med reguljära uttryck, byt typ, tolka datum och tal, fyll
saknade värden, dubbletter, klustra liknande kategorier och mer. Varje åtgärd loggas som ett receptsteg och kan
ångras. Inför delning kan identifierare som personnummer pseudonymiseras med saltade hashvärden, maskering eller
löpnummer; saltet sparas aldrig i receptet.

### 3. Kombinera och omforma (Bearbeta)

Beräknade kolumner, dela och slå ihop kolumner, filtrera bort rader, byt namn och ordning, pivotera mellan bred och
lång form, gruppera och aggregera, koppla två datamängder på en nyckel och lägg ihop datamängder med samma
kolumner. Aggregeringar, kopplingar och sammanslagningar blir nya datamängder, så ursprunget finns kvar.
Gruppen *Geodata* ger mittpunkt och area ur geometrier, omräkning mellan SWEREF 99 TM och WGS 84 samt kommun
och län ur koordinater med de medföljande gränserna.

Receptet (alla steg i ordning) kan visas, spelas upp på en ny version av datan och exporteras som JSON, R-kod eller
SQL. Versioner tas vid import, före massoperationer och på begäran; två versioner kan jämföras och en äldre
återställas.

### 4. Analysera med R och SQL (Analysera)

R-konsolen kör riktig R (WebR) i webbläsaren. `dm_list()` visar datamängderna, `dm_read("Namn")` läser en som
data.frame med rätt typer, `dm_write(df, "Nytt namn")` skickar en data.frame tillbaka som ny datamängd.
`theme_dataspatium()` och `dm_palette()` ger ggplot2 appens utseende. Diagram visas i panelen och exporteras som
SVG, PNG eller PDF. Paket som ggplot2, dplyr, tidyr, data.table, haven och readxl följer med och installeras i
sessionen första gången de används. Skript kan sparas och köras igen. Första starten tar några sekunder.

SQL-fliken frågar datamängdens tabell `data` direkt med SQLite. SELECT-frågor visar resultatet (upp till 5 000
rader) och kan sparas som ny datamängd; UPDATE, DELETE och ALTER loggas som receptsteg.

Fliken *Anteckningsbok* samlar text (Markdown), R och SQL i celler som körs i ordning och sparar sina utdata. En
färdig bok exporteras som HTML, Word, PDF, Markdown eller LaTeX, med eller utan koden. Se
[anteckningsbok.md](anteckningsbok.md).

### 5. Visualisera (Visualisera)

Diagrambyggaren skapar stapel-, linje-, yt-, punkt-, cirkel- och andra diagram ur en datamängd: välj kolumner för
axlar, färg och fasetter, aggregering, sortering och titlar. D3-mallar ger specialdiagram (lollipop, slopegraph,
befolkningspyramid) och R-diagram kan sparas med sin kod. Alla motorer använder samma färger och typsnitt. Sparade
diagram samlas i galleriet och exporteras som SVG, PNG, PDF eller PowerPoint, enstaka eller ett per grupp (till
exempel per kommun) till en ZIP eller en presentation. Kartor ritas med diagramtypen *Karta* ur en datamängd med
geometri (de medföljande kommun- eller länsgränserna, eller egna från GeoJSON, shapefile och GeoPackage)
kopplad till värden per kommunkod, och med *Punktkarta* ur longitud och latitud med gränserna som bakgrund.
En dashboard samlar flera sparade diagram i ett rutnät med
gemensamma filter, till exempel län eller år, och exporteras som fristående HTML eller PowerPoint.

### 6. Dokument (Exportera, fliken Dokument)

Dokumentmallar skrivs i Markdown med platshållare: `{{datamangd}}`, `{{antal_rader}}`, `{{#tabell}}…{{/tabell}}`
för rader, `{{diagram "Namn"}}` för ett sparat diagram, `{{sidbrytning}}` och nyckeltal som `{{summor.kolumn}}`.
Rapport, kodbok och gruppsammanställning finns inbyggda. Generera som HTML, Word, PDF, Markdown eller LaTeX, enstaka
eller ett dokument per grupp.

### 7. Exportera data (Exportera, fliken Data)

CSV (anpassad för svenskt Excel eller standard), Excel, ODS, JSON, GeoJSON (för datamängder med geometri), XML,
SQLite samt via R: Parquet, SPSS, Stata och RDS. SQLite och Parquet behåller typerna exakt; alla format kan
importeras igen.

## Hålla ordning (Hantera)

Varje datamängd har en översikt (källa, storlek, beskrivning), kolumnlista med typer och etiketter, historik över
allt som gjorts och versioner. Byt namn, ta bort eller hämta igen från API. Under *Arbetsyta* ser du hur mycket
lagring som används, begär beständig lagring, tar säkerhetskopia som ZIP och återställer. Appen påminner vid
start när det gått längre än det valda antalet dagar sedan senaste säkerhetskopian (30 dagar som standard;
ändras eller stängs av i samma kort). I Edge och Chrome kan arbetsytan dessutom speglas till en portabel mapp på
disk, automatiskt vid varje ändring.

## Dela med andra

- Ett urval: *Dela paket* under Hantera ger en ZIP med valda datamängder, diagram, dashboards, mallar och
  anteckningsböcker. Mottagaren läser in den under *Återställ från ZIP*; det som redan finns hoppas över.
- Hela arbetsytan: säkerhetskopian (ZIP) återställs under Hantera på en annan dator.
- En datamängd: exportera som SQLite (allt följer med) eller Parquet.
- API-konfigurationer (`.api.json`), diagram och dokumentmallar (JSON) och recept (JSON, R eller SQL) exporteras
  och läses in som filer. Nycklar följer aldrig med.

## Tangentbord

Alt+1 till Alt+6 växlar läge och Ctrl+K öppnar kommandopaletten. Första Tabb-trycket på sidan visar länken
*Hoppa till innehållet*, som flyttar fokus förbi lägesväxlaren och objektpanelen. Allt nås med Tabb och Enter;
dialoger stängs med Esc. I tabellen flyttar piltangenterna mellan celler och Enter redigerar. Appen följer
systeminställningen för minskad rörelse.

## När något går fel

Läs loggen längst ned: fel som du kan åtgärda beskrivs på svenska med förslag. Om R hänger sig, använd *Starta om
R*; datamängderna påverkas inte. Ta säkerhetskopia innan du rensar webbläsardata. Buggar rapporteras som ärenden på
GitHub, se [CONTRIBUTING.md](../CONTRIBUTING.md).
