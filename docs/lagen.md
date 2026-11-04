# De åtta lägena

Dataspatium är uppdelat i åtta lägen som följer arbetets gång, i samma anda som statistikproduktionens
samla in, bearbeta, analysera och sprida: Inhämta, Hantera, Söka, Bearbeta, Analysera, Visualisera, Exportera,
Dela. Alla lägen har samma skelett: lägesväxlaren högst upp, objektpanelen till vänster, arbetsytan i mitten,
inspektören till höger och statusraden längst ned, med loggen infälld ovanför den. Panelerna byter aldrig plats.
Alt+1 till Alt+8 växlar läge. En tom arbetsyta öppnas i Inhämta, en arbetsyta med datamängder i Hantera.
Knapparna uppe till höger öppnar kommandopaletten, byter språk, byter tema (ljust, mörkt, följ systemet) och
öppnar hjälpen.

**Statusraden** visar sparstatus, hur mycket lagring arbetsytan använder, den valda datamängden (namn, rader och
kolumner; ett klick öppnar den i Hantera), R-motorns tillstånd (av, startar, redo, upptagen; ett klick startar
den), pågående internetanrop (ett klick visar loggen över anrop), knapparna som fäller in och ut objektpanelen,
inspektören och loggen samt antalet rader i loggen.

**Panelernas bredd** ändras genom att dra i kanten mellan panel och arbetsyta; dubbelklick återställer, och med
tangentbordet flyttar piltangenterna kanten (Skift för större steg, Home och End för minsta och största bredd).
Bredderna sparas. I smalare fönster (under 1 100 px) visar lägesväxlaren bara ikoner, med text på det aktiva
läget, och inspektören öppnas som ett flak över arbetsytan; under 760 px gör objektpanelen likadant. Ett flak
stängs med Esc eller ett klick i arbetsytan.

**Tips** visas för alla knappar när muspekaren vilar på dem eller när de får fokus med tangentbordet; på
pekskärm genom att hålla fingret på knappen.

Kommandopaletten (Ctrl+K eller förstoringsglaset högst upp) når allt från ett sökfält: växla läge, öppna en
datamängd, ett diagram eller en dashboard, köra en bearbetningsåtgärd på den valda datamängden, exportera, öppna
arbetsytan, söka i data, skapa ett paket, kopiera en länk hit, byta tema eller söka efter uppdatering. Länkar har
formen `index.html#/<läge>/<kortnamn>` (eller ett diagrams namn i Visualisera, en söktext i Söka) och fungerar
också från en mapp. Pil upp och ned väljer, Enter
kör och Esc stänger; de senast körda kommandona ligger överst.

## Inhämta

Här kommer data in: filer som släpps på ytan, inklistrad text, webbadresser och öppna API:er. Filimporten går i
steg: fil, inställningar med förhandsgranskning, kolumner med typer, klart. Format: CSV och annan avgränsad text,
text med fasta kolumnbredder, Excel, ODS, JSON (även JSON-stat och GeoJSON), XML, SQLite, GeoPackage, shapefile
samt via R: SPSS, Stata, SAS, PX, Parquet, RDS och RData (se
[format.md](format.md)); R-formaten importeras i ett steg utan förhandsgranskning. Under Öppna API:er finns förinställningar för
SCB (bläddra i ämnesträdet eller sök tabell), Folkhälsomyndigheten, Socialstyrelsen, Kolada, Eurostat, SMHI,
luftkvalitetsdata, Naturvårdsregistret, Lantmäteriets geodatakatalog och Sveriges dataportal, samt Boverket och
Lantmäteriet Direkt för den som har nycklar, och därtill källor i Danmark, Norge, Finland, Island, Grönland,
Färöarna och Åland samt Nordic Statistics; landsknapparna ovanför listan väljer vilka länders källor som visas.
Egna konfigurationer läggs till från fil och kan delas. *Sparade hämtningar* listar datamängderna som kommit
från ett API och uppdaterar dem med ett klick, en i taget eller alla. Första gången appen ska kontakta internet
för ett ändamål (API:er, webbadresser, GitHub, komponenter) frågar den om lov; svaret kan sparas. Se
[api-konfiguration.md](api-konfiguration.md).

## Hantera

Datamängdernas hem. Objektpanelen är ett träd: datamängder kan ligga i mappar med undermappar (`Ekonomi/2026`)
och ha taggar; ett filterfält söker på namn, kortnamn, tagg och mapp, och listan kan sorteras på ändrad, namn eller
rader. Mappar fälls ihop och ut, och datamängder kan dras till en mapp. Kryssrutorna väljer flera datamängder
(Skift väljer ett spann) och knappen *Åtgärder (n)* öppnar batchåtgärderna: ordna (mapp och taggar), paketera,
exportera som ZIP med CSV-filer, hämta igen från API, köra ett recept och ta bort. Mapp och taggar följer
datamängden i dess fil, i paket och i säkerhetskopior.

Översikten för en datamängd visar metadata, kolumnlista, kommentarer, historik över det som gjorts med
datamängden och versioner, och här byter du namn och kortnamn (kortnamnet används i SQL, R och diagramfiler),
ordnar, tar bort och hämtar igen från API. Under *Arbetsyta* finns hur mycket lagring som används, beständig
lagring, säkerhetskopiering till ZIP och återställning, i Edge och Chrome en portabel mapp (arbetsytan sparas som
vanliga filer i en mapp du väljer, automatiskt efter varje ändring om du vill, och kan läsas in på en annan
dator), *Internetåtkomst* (vilka ändamål som får kontakta internet, med logg över anrop) och *Komponenter* (delar
av appen och R-paket som hämtas när de behövs, med storlek, källa och knappar för att hämta i förväg eller ta
bort). Paket och GitHub har flyttat till läget Dela.

## Söka

Hitta och lista utan kod. Fliken *Sök* söker i alla kolumner i en eller alla datamängder; varje ord måste finnas
på raden, oavsett skiftläge. Träffarna visas per datamängd med antal, fasetter (de vanligaste värdena i kolumner
med få olika värden, som avgränsar sökningen med ett klick) och en tabell där en rad öppnar hela posten i
inspektören. En sökning kan sparas som lista, bli en ny datamängd eller öppnas i Bearbeta. Fliken *Listor* samlar
sparade sökningar per datamängd och kör dem igen på dagens data. Se [soka.md](soka.md).

## Bearbeta

Allt man gör med tabellen via knappar och dialoger: redigera celler direkt i tabellen, sortera, filtrera och se
kolumnstatistik; åtgärder för rensning (sök och ersätt med reguljära uttryck, trimma, skiftläge,
teckenkodningsreparation, ersätt värde, fyll saknade, dubbletter, kategorirensning), typer (tal, datum, ja/nej),
struktur (beräknade kolumner, dela och kombinera, ta bort rader, pivotera) och nya datamängder (gruppera och
aggregera, koppla, lägg ihop). Datakvalitetsprofilen pekar på vad som bör rättas, och kvalitetsregler (får inte
saknas, unik, intervall, lista, mönster, längd, SQL-villkor) kontrollerar datan på begäran med rapport och felande
rader som egen datamängd. Allt loggas som recept som
kan ångras, spelas upp på en annan datamängd och exporteras som R- eller SQL-kod. Versioner sparar
ögonblicksbilder att gå tillbaka till. Se [bearbeta.md](bearbeta.md).

## Analysera

Kod och statistik. Verktygen ligger i fast ordning: R, SQL, Regex och sist Anteckningsboken, som fogar ihop
delar från de andra; Python läggs till efter R i en kommande version. R-konsolen har ggplot2, dplyr, tidyr och
andra paket, sparade skript, diagram med export till SVG, PNG och PDF, och `dm_read()`/`dm_write()` för att
flytta data mellan appen och R (se [r-guide.md](r-guide.md)); paket som inte följer med appen hämtas från webR:s
paketförråd när koden behöver dem, efter att du gett lov. SQL-konsolen arbetar mot den valda datamängden
(`data`), där andra datamängder nås med sina kortnamn så att en fråga kan göra join över flera datamängder;
frågor visar resultat som kan sparas som ny datamängd, ändrande satser loggas som receptsteg (se
[bearbeta.md](bearbeta.md)). Fliken Regex prövar reguljära uttryck på en kolumn med träffarna markerade och
använder dem för att filtrera, extrahera, ersätta, dela upp, markera, räkna eller skapa en kvalitetsregel, med en
mönsterprofil och ett bibliotek med nordiska mönster (se [regex.md](regex.md)). Anteckningsboken blandar text
(Markdown), R och SQL i celler som körs i ordning och blir en rapport i HTML, Word, PDF, Markdown eller LaTeX (se
[anteckningsbok.md](anteckningsbok.md)). Senare: statistiska modeller.

## Visualisera

Diagram med tre motorer och ett utseende: diagrambyggaren (Vega-Lite) med staplar, linjer, ytor, punkter,
histogram, värmekartor, låddiagram, cirklar och kartor (koropletkartor ur GeoJSON- eller shapefile-data); D3-mallar
för rangordning, lutningsdiagram och
befolkningspyramid; och R-skript med ggplot2. Sparade diagram kan exporteras som SVG, PNG, PDF och PowerPoint,
delas som viz-filer, visas i ett galleri och skapas i batch per grupp. Dashboards samlar sparade diagram i ett
rutnät med gemensamma filter och exporteras som HTML eller PowerPoint. Se [visualisera.md](visualisera.md).

## Exportera

Filer till den egna datorn, i tre flikar. **Data**: CSV (Excel-anpassad eller standard), Excel, ODS, JSON, XML,
SQLite samt via R: Parquet, SPSS, Stata och RDS. **Diagram**: sparade diagram och dashboards (även alla diagram
som en PowerPoint) som SVG, PNG och PDF, enstaka eller i batch per grupp till ZIP. **Dokument**: rapporter,
kodböcker och sammanställningar ur mallar i Markdown med platshållare, som HTML, Word, PDF, Markdown eller LaTeX,
enstaka eller i batch per grupp (se [dokumentmallar.md](dokumentmallar.md)). Det som ska till andra människor
finns i Dela.

## Dela

Ge data till andra. **Paket**: en ZIP med valda datamängder, diagram, dashboards, mallar, anteckningsböcker och
skript, ett meddelande och en ändringslogg, som mottagaren öppnar under *Ta emot* och kan ersätta sina versioner
med. **GitHub**: arbetsytan som en mapp i ett repo, skicka och hämta, med en åtkomstnyckel som sparas krypterad.
**Delningsmeny**: datorns eller telefonens egen delningsmeny för en fil eller ett paket (e-post, Teams,
meddelandeappar). **Publicera**: dashboards och dokument som fristående HTML-filer. **Enheter**: direkt överföring till telefoner och andra datorer på samma nätverk med QR-kod, kontrollkod och
parning, och Dataspatium Mobil på telefonen (se [mobil.md](mobil.md)). **Ta emot**: paket från fil eller
webbadress, med avsändare och ändringar synliga innan något tas in. Datamängder som lämnar appen granskas först
för personuppgifter. Se [dela.md](dela.md).
