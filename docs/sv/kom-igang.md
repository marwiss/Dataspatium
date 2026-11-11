# Kom igång med Dataspatium

Den här guiden tar dig från nedladdning till första export. Den förutsätter ingenting mer än en modern webbläsare.

## 1. Ladda ned och packa upp

Hämta senaste utgåvan från <https://github.com/marwiss/Dataspatium/releases/latest>: ZIP-filen
`dataspatium-<version>.zip` under *Assets*. Packa upp den till en mapp du själv väljer, till exempel
`Dokument\Dataspatium`. Mappen innehåller `index.html`, mapparna `src`, `vendor` och `docs` med mera. Flytta eller
byt inte namn på filer inne i mappen; hela mappen kan däremot flyttas fritt, även till ett USB-minne.

## 2. Öppna appen

Dubbelklicka på `index.html`. Webbläsaren öppnar appen från din dator (adressen börjar med `file:///`).
Fungerar inte dubbelklicket, högerklicka och välj *Öppna med* och din webbläsare, eller dra filen till ett öppet
webbläsarfönster.

Första gången frågar appen vilket språk du vill använda: svenska, danska, norska, finska, isländska eller
engelska. Valet sparas i webbläsaren och kan ändras när som helst med språkknappen (ikonen med bokstäver) uppe
till höger eller via kommandopaletten. Typsnitt och ikoner laddas från mappen; det tar någon sekund. Inget hämtas
från internet.

### Grundkursen

Efter språkvalet startar **Grundkursen**, en interaktiv genomgång i en panel nere till höger. Den tar ungefär tio
minuter och följer exemplet *Befolkning per kommun 2024* genom lägena: hämta data, titta på datamängden, söka,
beräkna en kolumn, fråga med SQL, räkna med R, göra ett diagram, exportera och dela. Varje steg förklarar ett begrepp och
ger en uppgift. En ram visar var du ska klicka, och steget bockas av när du har gjort det. *Gör det åt mig* utför
steget åt dig om du hellre vill se hur det går till.

Kursen kan minimeras och stängas, och den öppnas igen när som helst från hjälpen (frågetecknet uppe till höger) eller
från kommandopaletten (Ctrl+K, *Öppna Grundkursen*). Den fortsätter där du slutade.

## 3. Lägena

Längst upp finns nio lägen. Panelen till vänster visar objekt (datamängder och källor), mitten är arbetsytan,
panelen till höger visar egenskaper och statistik, och längst ned finns statusraden med sparstatus, lagring, den
valda datamängden, R-motorn och knapparna som fäller in panelerna och öppnar loggen. Panelernas bredd ändras genom
att dra i kanten mot arbetsytan. Alt+1 till Alt+9 växlar läge med tangentbordet.

| Läge | Vad du gör där |
|---|---|
| Inhämta | Importerar filer, klistrar in tabeller och hämtar från öppna API:er i Sverige och övriga Norden, som SCB, Kolada, Eurostat, Socialstyrelsen, SMHI, Danmarks Statistik, SSB, Tilastokeskus och Hagstofa Íslands ([api-konfiguration.md](api-konfiguration.md)) |
| Hantera | Ser dina datamängder i mappar med taggar, byter namn, tar bort, sparar versioner, kör batchåtgärder på flera datamängder, säkerhetskopierar och återställer arbetsytan |
| Söka | Söker i alla kolumner i en eller alla datamängder, avgränsar med fasetter och sparar sökningar som listor ([soka.md](soka.md)) |
| Bearbeta | Redigerar celler, sorterar och filtrerar, rensar och typar, beräknar kolumner, pivoterar, kopplar datamängder; allt med ångra, versioner och recept ([bearbeta.md](bearbeta.md)) |
| Kontrollera | Prövar en tabell mot enkla regler (typ och tomma värden per kolumn, dubbletter bland raderna) och visar en IFC-modells kontroller: *Validera modellen* och *Jämför versioner* |
| Analysera | R-konsol med ggplot2 och tidyverse, sparade skript och diagramexport; Python-konsol med pandas och matplotlib; SQL-konsol mot den valda datamängden; reguljära uttryck; anteckningsbok som blir rapport |
| Visualisera | Bygger diagram med Vega-Lite, D3-mallar eller R-skript, sparar, exporterar och skapar dem i batch ([visualisera.md](visualisera.md)) |
| Exportera | Laddar ned data som CSV, Excel, JSON eller SQLite, sparade diagram som SVG, PNG eller PDF och dokument ur mallar som HTML, Word, PDF, Markdown eller LaTeX ([dokumentmallar.md](dokumentmallar.md)) |
| Dela | Paketerar datamängder med diagram och mallar för kollegor, skickar dem direkt till telefoner och andra datorer med QR-kod ([mobil.md](mobil.md)), skickar arbetsytan till GitHub, delar via datorns delningsmeny och publicerar dashboards som HTML ([dela.md](dela.md)) |

## 4. Importera en fil

1. Gå till *Inhämta* och släpp en fil på den streckade ytan (eller klicka och välj fil). Filformat som stöds:
   CSV, TSV och andra textfiler med avgränsare, Excel (xlsx, xls, xlsm, xlsb), ODS, JSON, NDJSON, JSON-stat,
   GeoJSON, XML, SQLite, GeoPackage, shapefile (ZIP med shp och dbf), text med fasta kolumnbredder samt
   statistikfiler från SPSS (sav), Stata (dta), SAS (sas7bdat, xpt), SCB:s PX-format, Parquet och R (rds, RData).
   Filer kan också hämtas direkt från en webbadress under *Från webbadress*. De sista läses av R och importeras i ett steg utan förhandsgranskning; första
   gången tar det några sekunder medan R startar. Se [format.md](format.md).
2. Kontrollera inställningarna. Dataspatium gissar teckenkodning (UTF-8 eller Windows-1252), avgränsare, om första
   raden är rubriker och om decimaltecknet är komma eller punkt. Förhandsgranskningen visar de första 100 raderna.
3. Kontrollera kolumnerna. Varje kolumn får en typ: text, heltal, decimaltal, datum, datum och tid eller ja/nej.
   Koder med inledande nollor (kommunkoder, postnummer) behålls som text. Ändra namn eller typ vid behov och
   avmarkera kolumner du inte vill ha med.
4. Ge datamängden ett namn och klicka på *Importera*. Du kan sedan öppna den direkt i *Bearbeta*.

Tips: du kan också klistra in en tabell från Excel eller en webbsida via *Klistra in* i panelen till vänster.

## 5. Bläddra och granska

I *Bearbeta* visas tabellen. Klicka på en kolumnrubrik för att sortera (stigande, fallande, osorterat) och för att
se kolumnens statistik till höger: antal, saknade, unika, minsta, största, medel, summa och vanligaste värden.
Skriv i filterfältet för att bara visa rader som innehåller texten. Stora tabeller visas rad för rad allt eftersom
du rullar, så även hundratusentals rader går att bläddra i.

## 6. Exportera

I *Exportera* väljer du format och filnamn och klickar på *Exportera och ladda ned*.

- CSV med profilen *Excel i Sverige* använder semikolon, decimalkomma och UTF-8 med BOM så att Excel öppnar filen
  rätt direkt. Profilen *Standard* ger komma och decimalpunkt.
- Excel (xlsx) och ODS behåller tal, datum och ja/nej som riktiga typer.
- JSON ger en lista med objekt, XML en fil med ett element per rad.
- SQLite ger datamängdens egen fil, som också kan läsas i R, DB Browser for SQLite och många andra verktyg.
- Parquet, SPSS (sav), Stata (dta) och RDS skrivs av R och startar R-sessionen vid behov.

Alla format kan importeras igen i Dataspatium.

## 7. Säkerhetskopiera

Datamängderna ligger i webbläsarens databas på den här datorn. De försvinner om du rensar webbplatsdata, byter
webbläsarprofil eller avinstallerar webbläsaren. Gå till *Hantera*, välj *Arbetsyta* och klicka på
*Säkerhetskopiera arbetsytan*. Du får en ZIP-fil med alla datamängder. Återställ genom att släppa ZIP-filen på
ytan *Återställ från ZIP*.

I Edge och Chrome kan du dessutom välja en *portabel mapp*: arbetsytan sparas som vanliga filer (en SQLite-fil
per datamängd samt diagram och mallar) i en mapp du väljer, till exempel på en USB-sticka eller i en synkroniserad
mapp. Slå på *Spara automatiskt vid ändringar* så hålls mappen uppdaterad. På en annan dator väljer du samma mapp
och klickar på *Läs in från mappen*. Efter en omstart av webbläsaren frågar den en gång om lov att använda mappen
igen; klicka på *Återanslut*.

Vill du skicka ett urval till en kollega, gå till läget *Dela* och fliken *Paket*: välj datamängder och om diagram,
dashboards, mallar, anteckningsböcker och skript ska följa med. Kollegan öppnar paketet under *Ta emot* i samma läge;
det som redan finns i hens arbetsyta hoppas över.

## Vanliga frågor

**Sidan är tom eller visar bara "Dataspatium startar".** Kontrollera att hela mappen packats upp (inte bara
`index.html`) och att du använder Edge, Chrome eller Firefox i en aktuell version. Öppna webbläsarens konsol
(F12) och leta efter röda fel; rapportera dem gärna som ett ärende.

**Mina å, ä och ö blev konstiga tecken.** Byt teckenkodning i importsteget *Inställningar*, oftast mellan UTF-8
och Windows-1252.

**Tal blev text.** Kolumnen innehöll något värde som inte kunde tolkas som tal, eller tal med inledande nollor.
Ändra typen i steget *Kolumner* om du vill tvinga en tolkning; värden som inte går att tolka blir tomma.

**Går det att dela data med en kollega?** Ja, exportera datamängden (SQLite eller CSV) eller ta en
säkerhetskopia av arbetsytan och skicka ZIP-filen. Kollegan importerar eller återställer i sin Dataspatium.

**Varför ingen server eller molntjänst?** För att din data ska stanna hos dig och för att appen ska fungera utan
installation, konton och internet.

Fler frågor och svar finns i [faq.md](faq.md). När du vill gå vidare från de första stegen beskriver
[anvandarguide.md](anvandarguide.md) hela arbetsflödet från fil till rapport.
