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

Loggpanelens höjd ändrar du genom att dra i dess överkant, eller med piltangenterna när kanten har fokus. Dubbelklick återställer höjden, och höjden sparas.

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

Under *Databaser* finns två vägar in: *Databas via bryggan* (Access, Excel, SQL Server, SQLite och ODBC-källor på
datorn genom ett litet lokalt skript) och *Lägg till databaskälla* (PostgREST, OData, GraphQL, CouchDB, ClickHouse,
Elasticsearch, SPARQL, InfluxDB, Google Sheets och Airtable över HTTP). Access-filer läses dessutom direkt som filer,
och i Chrome och Edge kan en fil länkas så att datamängden läses in igen från disken. Se [kallor.md](kallor.md).

QGIS-projekt (.qgs, .qgz) blir kartvyer: lagerordning, synlighet och symboler följer med, lagren kopplas till datamängder med samma filnamn och datafiler som släpps tillsammans med projektet importeras först (se [kartor.md](kartor.md)).

Under *Databaser* finns också *Lägg till geodatakälla*: en WFS-, OGC API Features- eller ArcGIS-tjänst blir en källa vars
lager hämtas som GeoJSON och öppnas som kartor, och källan *Geodataportalen (sök geodata)* söker i den nationella
geodatakatalogen och lägger till tjänster med ett klick. Förinställda geodatakällor finns för SCB, SGU, Havs- och
vattenmyndigheten, Riksantikvarieämbetet, Skogsstyrelsen, Kartverket, Statistikcentralen och SYKE, samt Lantmäteriets
geodataplattform för den som har nyckel. Se [kallor.md](kallor.md#öppna-geodata).

Digitala planer importeras som planer: en detaljplan enligt den nationella specifikationen (GeoJSON) eller
Lantmäteriets referensobjekt, en översiktsplan enligt specifikationen eller Boverkets ÖP-modell (GeoPackage, valet
*Hela översiktsplanen som plan*). Filen känns igen på innehållet, planens uppgifter visas och planen öppnas som
plankarta i Bearbeta med Boverkets färger (se [planer.md](planer.md)).

Grafer (nätverk av noder och kanter) importeras som grafer från GraphML, GEXF, JSON med noder och kanter eller
Cypher-skript; filen känns igen på innehållet, grafens uppgifter visas och grafen öppnas som grafvy i Bearbeta
(se [grafer.md](grafer.md)). Två tabeller blir en graf med knappen *Gör graf av tabeller* i Hantera.

Byggnadsmodeller i IFC och ritningar i DXF blir datamängder av slaget modell. Filens uppgifter visas och modellen öppnas i 3D
eller som ritning i Bearbeta (se [cad-bim.md](cad-bim.md)).

**Insamling i fält** i källistan bygger ett formulär på en datamängds kolumner och regler och skickar det till telefonen. Raderna kommer tillbaka som en ny
version (se [insamling.md](insamling.md)).

Alla källor i listan ser likadana ut, med en symbol för sin typ och en rad under namnet. *Lägg till källa* samlar alla sätt att lägga till en källa: en konfigurationsfil, en databas eller en geodatatjänst.

**Appen säger först vad filen är**, till exempel en tabell med platser, en graf eller en byggnadsmodell, och visar den i sin egen form: en karta, bilderna, en skiss av grafen, ritningen eller första sidan. Är något värt att fråga om frågar den: koordinater som verkar ha bytt plats, vilket koordinatsystem de är i, och om en lista med kopplingar ska läsas som en graf. Inget ändras förrän du svarat, och kartan visar vad svaret gör.

**Flera olika filer** sorteras efter vad de är: bilder blir en samling, dokument en annan, och varje annan fil en egen datamängd. Du ser listan först och kan välja bort något. Du kan också släppa en hel mapp eller välja den med *Välj en mapp*. En fil som inte går att läsa hindrar inte de andra.

**Guider.** Under Guider finns fyra korta vägar från fråga till resultat med riktiga data: jämför kommuner via Kolada, en befolkningspyramid via SCB, väder över lång tid via SMHI och prisutveckling via Europeiska centralbanken. En guide hämtar, rensar och sparar ett diagram. Du får tabellen, diagrammet och stegen att bygga vidare på. Den hämtar från nätet bara när du trycker på *Kör guiden*.

**Datapaket.** En ZIP-fil med `datapackage.json` (Frictionless Data Package) läses in med typerna och titlarna från dess schema, och varje tabell blir en datamängd.

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

En dokumentsamling eller bildsamling visas med antal dokument och sidor respektive bilder, med dokumentlistan eller de
första miniatyrerna på översiktsfliken, och med knappen *Läs* eller *Visa bilder* som öppnar läsvyn respektive
galleriet i Bearbeta (se [dokument.md](dokument.md)).

**Flöden och bevakningar** finns i objektpanelen: sparade kedjor som körs med ett klick eller vid start, och källor som säger till
när de har nya data (se [floden.md](floden.md)).

**Vad appen ser.** Översikten visar vad datamängden också kan användas som: platser på en karta, en tidsserie, regioner som kan färgas, ett nätverk eller löptext. Varje rad säger varför, och du kan stänga av det som inte stämmer eller slå på det appen missat. Valet sparas i datamängden, och lägena följer det. Under det står **Att se över**, med sådant som datamängdens slag behöver: sidor utan text, bilder utan position, kanter som pekar på noder som inte finns, element utan mängder eller rader utan plats.

**Urval.** Knappen *Använd som urval* finns i Söka och i Bearbetas vyer. Det du ser följer sedan med mellan lägena och står i statusraden. I Bearbeta visar du det via listvalet, i Exportera väljer du om bara urvalet ska med, och i paket kan du skicka bara urvalet. Från statusraden sparar du det som en lista, gör det till en datamängd eller rensar det. Ändras raderna i datamängden försvinner urvalet, eftersom det inte längre skulle betyda samma sak.

**Bild.** Översikten visar en bild av datamängden: första sidan, en karta över platserna, en skiss av grafen, ritningen, vad modellen består av, eller en linje över tid. En vanlig tabell har ingen bild.

**Flera datamängder.** Har du valt flera visar *Det här kan de göra tillsammans* vad som går: samma karta när alla har platser, en tabell när alla har samma kolumner, och en samling när alla är bilder eller alla är dokument. De valda ändras inte. Vid export får var och en sin egen form, till exempel bilder som ZIP och grafer som GraphML.

**Versioner** säger vad de innehåller i datamängdens egna enheter, och jämförelsen visar vilka bilder, dokument, noder, kanter eller element som tillkommit och försvunnit.

**Kodlistor.** Kolumner som håller koder ur en känd lista visas på översikten: SNI, SSYK, NACE, ISCED, COFOG, NUTS, de nordiska motsvarigheterna, länder och kommuner. Ett klick lägger till namnen som värdeetiketter, och värdena ändras inte. En kort kod räknas bara när kolumnens namn stämmer. Listorna följer med appen, och deras källor och licenser står i `presets/kodlistor/KALLA.md`.

**Beskrivning.** Fliken Beskrivning håller det en dataportal vill veta enligt DCAT-AP-SE: titel, utgivare, kontakt, tema, licens och period. Beskrivningen följer datamängden, säger vad som saknas och kan sparas som RDF/XML eller läsas in från en sådan fil. Inget skickas härifrån.

## Söka

Hitta och lista utan kod. Fliken *Sök* söker i alla kolumner i en eller alla datamängder; varje ord måste finnas
på raden, oavsett skiftläge. Träffarna visas per datamängd med antal, fasetter (de vanligaste värdena i kolumner
med få olika värden, som avgränsar sökningen med ett klick) och en tabell där en rad öppnar hela posten i
inspektören. En sökning kan sparas som lista, bli en ny datamängd eller öppnas i Bearbeta. Fliken *Fråga* bygger
en fråga över en eller flera datamängder (kolumner, beräkningar, villkor, sortering) utan kod och visar den SQL som
skapas; den kan öppnas i Analysera, sparas som lista eller bli en datamängd. Fliken *Listor* samlar sparade
sökningar och frågor per datamängd och kör dem igen på dagens data; listor avgränsar också tabellen i Bearbeta och
raderna i diagram. Se [soka.md](soka.md).

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

**Dokumentsamlingar** (PDF, Word, OpenDocument, Markdown, text) öppnas som läsvy: välj dokument, bläddra
sida för sida, visa PDF-sidan som bild, sök i hela samlingen och hämta originalet. **Bildsamlingar**
öppnas som galleri med miniatyrer, filter, sortering och bildens EXIF-uppgifter i inspektören, där beskrivningen kan
ändras. *Visa som tabell* ger i båda fallen den vanliga tabellen med alla åtgärder. Se [dokument.md](dokument.md).

Datamängder med geometri eller koordinater öppnas som en **karta** att zooma och panorera i; klick på ett objekt visar attributen, bakgrundskarta efter samtycke, *Spara som kartvy* för Visualisera. *Visa som tabell* ger tabellen (se [kartor.md](kartor.md)).

Ett urval från Söka markeras i 3D-modellen, och kameran riktas mot det.

**Läsa text i bilder.** Sidor i en skannad PDF och bilder i ett galleri kan läsas med textigenkänning, som körs i webbläsaren. Se [dokument.md](dokument.md).

## Analysera

Kod och statistik. Verktygen ligger i fast ordning: R, Python, SQL, Regex och sist Anteckningsboken, som fogar ihop
delar från de andra. Python-konsolen har pandas, matplotlib, seaborn och plotly och hämtas som komponent första gången du startar den
(se [python.md](python.md)). R-konsolen har ggplot2, dplyr, tidyr och
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

När en dokumentsamling är vald finns fliken **Text** (ordfrekvens med stoppord, nyckelord i kontext, samförekomster
och en översikt per dokument) och när en bildsamling är vald fliken **Bilder** (översikt per typ, kamera, år eller
månad och dubbletter via bildhash). Båda ligger efter Regex och före Anteckningsboken, och varje resultat kan sparas
som en ny datamängd. Se [dokument.md](dokument.md).

För datamängder med geometri finns fliken **Geo** (efter Regex): mått, punkter i områden, närmaste, buffert, överlagring, sammanslagning och förenkling, med Turf i webbläsaren; resultaten blir datamängder som öppnas som kartor.

För grafer finns fliken **Cypher** direkt efter SQL (en Cypher-delmängd som översätts till SQL med SQL:en visad) och
fliken **Graf** efter Regex (sammanfattning, grad, komponenter, kortaste väg, delgraf, noder och kanter som tabeller).

Fliken **Statistik** efter Regex gör vanliga analyser med formulär som skriver och visar koden (se [statistik.md](statistik.md)).

Modeller och ritningar får fliken **Mängder** efter Regex (antal, längd, area och volym per typ, våning och material, ur filen
eller mätta på geometrin).

Analysera öppnar i det verktyg som passar datamängden: Text för dokument, Bilder för bildsamlingar, Graf för grafer, Mängder för modeller, Plan för planer, Geo för tabeller med platser och annars Statistik. När du själv väljer en flik stannar du där. R startar först när du öppnar fliken R.

**Kod att börja från.** I R, Python och SQL finns en lista med kod skriven för den valda datamängden: en grafs kanter, en modells mängder, bilder per månad, summa per period eller platserna som punkter. Valet klistrar in koden där markören står. En ny anteckningsbok börjar på samma sätt. I SQL visas sidotabellerna med sina kolumner, och ett klick skriver en fråga om tabellen.

**Trend.** Statistik har verktyget *Trend*, som ger ett värde per period och en rät linje genom dem och säger hur mycket värdet ändras per period. En datamängd som är en tidsserie öppnar där.

**Räkna per område.** Under Geo räknar *Punkter i områden* platser per område, med yta och antal per kvadratkilometer. Platserna kan vara bilder med position, och områdena kan vara en plan, en tabell med ytor eller de kommun- och länsgränser som följer med appen.

## Visualisera

Diagram med tre motorer och ett utseende: diagrambyggaren (Vega-Lite) med staplar, linjer, ytor, punkter,
histogram, värmekartor, låddiagram, cirklar och kartor (koropletkartor ur GeoJSON- eller shapefile-data); D3-mallar
för rangordning, lutningsdiagram och
befolkningspyramid; och R-skript med ggplot2. Sparade diagram kan exporteras som SVG, PNG, PDF och PowerPoint,
delas som viz-filer, visas i ett galleri och skapas i batch per grupp. Dashboards samlar sparade diagram i ett
rutnät med gemensamma filter och exporteras som HTML eller PowerPoint. Se [visualisera.md](visualisera.md).

Diagramslaget **Karta** är en kartvy med flera lager från datamängder med geometri eller koordinater och de medföljande gränserna, färg efter kategori eller klass, etiketter, sparad vy och bakgrundskarta efter samtycke; interaktiv i dashboards, presentationer och publicerad HTML, exporterad till SVG, PNG och PDF utan bakgrundskarta (se [kartor.md](kartor.md)).

## Exportera

Filer till den egna datorn, i tre flikar. **Data**: CSV (Excel-anpassad eller standard), Excel, ODS, JSON, XML,
SQLite samt via R: Parquet, SPSS, Stata och RDS. **Diagram**: sparade diagram och dashboards (även alla diagram
som en PowerPoint) som SVG, PNG och PDF, enstaka eller i batch per grupp till ZIP. **Dokument**: rapporter,
kodböcker och sammanställningar ur mallar i Markdown med platshållare, som HTML, Word, PDF, Markdown eller LaTeX,
enstaka eller i batch per grupp (se [dokumentmallar.md](dokumentmallar.md)). Det som ska till andra människor
finns i Dela.

En datamängd som är mer än en tabell delar upp formaten i **Hela datamängden** och **Bara tabellen**, och säger vad som inte följer med. Dokument kan hämtas som originalfiler eller ren text, bilder som en ZIP och grafer som två CSV-filer.

**Efter datamängdens slag.** Tabeller med platser kan sparas som KML, GPX och GeoPackage, i grader. I GPX blir punkter waypoints, och linjer och ytors konturer blir spår. Bildsamlingar kan bli en kontaktkarta i PDF med bilder och namn. En plan kan bli en plankarta i PDF med teckenförklaring, planbestämmelserna i Word, och originalfilen om planen kom från en fil. En IFC-modell kan ge mängderna i Excel, med summor per typ och alla värden, och geometrin som glTF. En DXF-ritning kan bli PDF. Exporterar du flera datamängder i Hantera får var och en sin egen form.

**Batch per våning eller dokument.** Batch per grupp fungerar med vilken kolumn som helst. En modell delas på kolumnen `vaning`, och bilden av modellen visar då bara den våningen. Ett dokument delas på kolumnen `dokument`.

**Andra verktyg.** *Datapaket* ger en ZIP med CSV-filer och `datapackage.json`, som många verktyg kan läsa. En grafs kanter och en modells egenskaper följer med som egna tabeller. *Kvalitetsdeklaration* ger ett Word-dokument i den form SCB använder, ifyllt ur profil, regler, kommentarer, ändringar och beskrivning, med platser att skriva det bara en människa kan säga.

## Dela

Ge data till andra. **Paket**: en ZIP med valda datamängder, diagram, dashboards, mallar, anteckningsböcker och
skript, ett meddelande och en ändringslogg, som mottagaren öppnar under *Ta emot* och kan ersätta sina versioner
med. **GitHub**: arbetsytan som en mapp i ett repo, skicka och hämta, med en åtkomstnyckel som sparas krypterad.
**Delningsmeny**: datorns eller telefonens egen delningsmeny för en fil eller ett paket (e-post, Teams,
meddelandeappar). **Publicera**: dashboards och dokument som fristående HTML-filer. **Enheter**: direkt överföring till telefoner och andra datorer på samma nätverk med QR-kod, kontrollkod och
parning, och Dataspatium Mobil på telefonen (se [mobil.md](mobil.md)). **Ta emot**: paket från fil eller
webbadress, med avsändare och ändringar synliga innan något tas in. Datamängder som lämnar appen granskas först
för personuppgifter. Se [dela.md](dela.md).
