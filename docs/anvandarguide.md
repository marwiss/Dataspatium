# Användarguide

Den här guiden beskriver hur du arbetar i Dataspatium från första fil till färdig rapport. Den förutsätter att du
har öppnat appen enligt [kom-igang.md](kom-igang.md). Detaljer om varje läge finns i [lagen.md](lagen.md), om
filformat i [format.md](format.md), om API:er i [api-konfiguration.md](api-konfiguration.md), om bearbetning i
[bearbeta.md](bearbeta.md), om R i [r-guide.md](r-guide.md), om diagram i [visualisera.md](visualisera.md) och om
dokument i [dokumentmallar.md](dokumentmallar.md). Vanliga frågor besvaras i [faq.md](faq.md).

## Arbetsytan

Skärmen ser likadan ut i alla lägen. Överst växlar du läge (Inhämta, Hantera, Söka, Bearbeta, Analysera,
Visualisera, Exportera, Dela; Alt+1 till Alt+8 fungerar också) och når kommandopaletten (förstoringsglaset eller
Ctrl+K), språkknappen, tema (ljust eller mörkt) och hjälpknappen med versionsnummer och *Sök efter uppdatering*.
Kommandopaletten är den snabbaste vägen till det mesta: skriv några bokstäver för att växla läge, öppna en
datamängd, ett diagram eller en dashboard, söka i data eller köra en bearbetningsåtgärd på den valda datamängden.
Till vänster finns objekten för läget (datamängder, källor, diagram, mallar), i mitten arbetsytan och till höger
inspektören med egenskaper och statistik. Längst ned ligger statusraden: sparstatus, lagring, den valda
datamängden, R-motorn, pågående internetanrop och knapparna som fäller in panelerna och öppnar loggen, där varje
åtgärd, varning och fel skrivs ut; det är den du läser när något inte blir som du tänkt. Panelernas bredd ändras
genom att dra i kanten mot arbetsytan, och i smala fönster öppnas panelerna som flak över arbetsytan (se
[lagen.md](lagen.md)).

Allt du skapar sparas automatiskt i webbläsarens databas på din dator. Ingenting skickas någonstans utan att du
själv hämtar från ett API, kontrollerar version, skickar till GitHub eller delar. Första gången appen behöver
internet för ett ändamål frågar den om lov, och svaret kan sparas; under *Hantera → Arbetsyta → Internetåtkomst*
ser du vad som är tillåtet och vilka anrop som gjorts. Delar av appen som inte följer med i mappen (vissa
komponenter och R-paket) hämtas på samma sätt när de behövs och sparas sedan lokalt.

## Grundkursen

Grundkursen är ett bra sätt att lära känna appen. Den startar efter språkvalet första gången appen öppnas och
öppnas annars från hjälpen (frågetecknet uppe till höger) eller med kommandot *Öppna Grundkursen* i
kommandopaletten. Kursen visas i en panel nere till höger medan du arbetar i den riktiga appen, och den följer
exemplet *Befolkning per kommun 2024* i nio steg:

1. Välkommen: vad appen gör och hur skärmen är ordnad.
2. Inhämta: importera exempeldata och vad en datamängd är.
3. Hantera: namn och kortnamn, källa, kolumner, versioner och säkerhetskopior.
4. Bearbeta: tabellen, kolumnprofiler och en beräknad kolumn som blir ett steg i receptet.
5. Analysera med SQL: folkmängden per län, och hur kortnamn kopplar ihop datamängder.
6. Analysera med R: `dm_read()`, en sammanfattning och ett histogram med ggplot2.
7. Visualisera: ett liggande stapeldiagram över folkmängden per län.
8. Exportera: data, diagram och dokument.
9. Klart: var du går vidare.

Varje steg förklarar ett begrepp och ger en uppgift. En ram markerar knappen du ska klicka på, och steget bockas av
när appen ser att uppgiften är gjord. *Gör det åt mig* (eller *Visa mig*) utför steget, så att du kan följa med
utan att skriva något. Kursen kan minimeras med pilen och stängas med krysset; nästa gång fortsätter den där du
slutade. Den skapar exempeldatamängden, en kolumn i den och ett diagram, som du tar bort som vanligt när du inte
behöver dem längre.

## Ett arbetsflöde från fil till rapport

### 1. Hämta in data (Inhämta)

Släpp en fil på ytan, klistra in en tabell eller hämta en fil från en webbadress (servern måste tillåta CORS; en
delad Dataspatium-konfiguration läggs till direkt). Kontrollera förhandsgranskningen: teckenkodning, avgränsare,
rubrikrad och decimaltecken gissas men kan ändras. I kolumnsteget får varje kolumn en typ; koder med inledande
nollor (kommunkoder, personnummer) behålls som text. Ge datamängden ett namn och importera. Under ytan finns data
som följer med appen: knappen för exempeldatan *Befolkning per kommun 2024* och listan *Gränser för kartor* med
kommun- och regiongränser för Sverige, Danmark, Norge och Finland.

Under *Öppna API:er* finns förinställningar för SCB, Folkhälsomyndigheten, Socialstyrelsen, Kolada, Eurostat,
SMHI, luftkvalitetsdata, Naturvårdsregistret, Lantmäteriets geodatakatalog och Sveriges dataportal, samt Boverket
och Lantmäteriet Direkt för den som har egna nycklar. Därtill statistikbyråerna och flera andra myndigheter i
Danmark, Norge, Finland och Island, de självstyrande områdena och Nordic Statistics; landsknapparna ovanför
listan väljer vilka länders källor som visas. Bläddra eller sök fram en tabell, välj variabler, förhandsgranska
och hämta till en ny datamängd eller lägg till i en befintlig. En hämtad datamängd kommer ihåg sin fråga, så den kan
hämtas igen från Hantera när källan uppdaterats.

Databaser: Access-filer släpps på ytan som andra filer; databaser på datorn (SQL Server, ODBC, Excel, SQLite) nås
genom *Databas via bryggan* och tjänster över HTTP (PostgREST, OData, GraphQL med flera) genom *Lägg till
databaskälla*. I Chrome och Edge kan en fil länkas och läsas in igen från disken. Se [kallor.md](kallor.md).

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

SQL-fliken frågar datamängdens tabell `data` direkt med SQLite. Andra datamängder nås med sina kortnamn (visas
under namnet i objektpanelen), så att en fråga kan göra join över flera datamängder, till exempel
`select ... from befolkning_2024 b join kommungranser k on k.kommunkod = b.kommunkod`. SELECT-frågor visar
resultatet (upp till 5 000 rader) och kan sparas som ny datamängd; UPDATE, DELETE och ALTER loggas som receptsteg.
Knappen *Infoga dm_read()* och R-exemplen i inspektören använder också kortnamnet.

Fliken *Anteckningsbok* samlar text (Markdown), R och SQL i celler som körs i ordning och sparar sina utdata. En
färdig bok exporteras som HTML, Word, PDF, Markdown eller LaTeX, med eller utan koden. Se
[anteckningsbok.md](anteckningsbok.md).

Fliken *Regex* prövar ett reguljärt uttryck på en kolumn medan du skriver: de vanligaste värdena visas med
träffarna markerade och antalet matchande rader räknas. Samma mönster kan sedan filtrera rader, extrahera grupper
till nya kolumner, ersätta, dela upp, markera eller räkna träffar, eller bli en kvalitetsregel. *Mönsterprofil*
visar vilka former värdena har (till exempel `9999-99-99` och `99/99/9999` för datum), och biblioteket till vänster
har färdiga mönster för bland annat personnummer, postnummer och datum. Se [regex.md](regex.md).

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

## Hitta i data (Söka)

Söka hittar rader utan kod. Skriv ett eller flera ord, välj alla datamängder eller bara den valda och tryck på
*Sök*. Träffarna visas per datamängd; fasetterna (de vanligaste värdena i kolumner med få olika värden) avgränsar
med ett klick, och en rad i tabellen visar hela posten i inspektören. Sökningen kan sparas som lista, bli en ny
datamängd eller öppnas i Bearbeta med datamängden vald. Fliken *Fråga* bygger en fråga över en eller flera
datamängder med kolumner, beräkningar, villkor och sortering utan kod och visar den SQL som skapas; sparade listor
avgränsar tabellen i Bearbeta och raderna i diagram. Se [soka.md](soka.md).

## Hålla ordning (Hantera)

Varje datamängd har en översikt (källa, storlek, beskrivning, mapp och taggar), kolumnlista med typer, etiketter,
beskrivningar och enheter (sätts under Bearbeta med *Etikett, beskrivning och enhet*), kommentarer, en läsbar
historik över allt som gjorts och versioner. Byt namn och kortnamn, ordna, ta bort eller hämta igen från API
(uppdatera med receptet, eller lägg till rader). Under *Arbetsyta* ser du hur mycket lagring som används, begär
beständig lagring, tar säkerhetskopia som ZIP och återställer. Appen påminner vid start när det gått längre än det
valda antalet dagar sedan senaste säkerhetskopian (30 dagar som standard; ändras eller stängs av i samma kort). I
Edge och Chrome kan arbetsytan dessutom speglas till en portabel mapp på disk, automatiskt vid varje ändring.

Objektpanelen i Hantera är ett träd. *Ordna* ger en datamängd en mapp (med undermappar, som `Ekonomi/2026`) och
taggar; mappar kan fällas ihop, och en datamängd kan dras till en annan mapp. Filterfältet söker på namn, kortnamn,
tagg och mapp, och listan kan sorteras på ändrad, namn eller rader. Kryssrutorna väljer flera datamängder (Skift
väljer ett spann), och knappen *Åtgärder (n)* gör samma sak med alla på en gång: ordna, paketera, exportera som ZIP
med CSV-filer, hämta igen från API, köra ett recept eller ta bort. Mapp och taggar sparas i datamängdens fil och
följer med i paket, säkerhetskopior och GitHub; i R visar `dm_list()` mappen och `dm_read("Mapp/Namn")` läser en
datamängd i en mapp.

## Dela med andra

Allt som ska till andra människor finns i läget *Dela* (se [dela.md](dela.md)):

- Ett urval: *Paket* ger en ZIP med valda datamängder, diagram, dashboards, mallar, anteckningsböcker och skript,
  ett meddelande och en ändringslogg: det som gjorts med varje datamängd sedan den senast delades och de
  kommentarer som inte är lösta. Mottagaren öppnar den under *Ta emot*, ser meddelandet och ändringarna och väljer
  för datamängder som redan finns om de ska ersättas med paketets version (den egna sparas under *Versioner*);
  resten hoppas över. Under Hantera gör *Åtgärder* på flera valda datamängder samma sak.
- Kommentarer: varje datamängd har fliken *Kommentarer* i Hantera, och i Bearbeta kommenterar du en kolumn från
  inspektören. Kommentarerna ligger i datamängdens fil och följer med i paket, säkerhetskopior, den portabla mappen och
  GitHub. Namnet som visas anger du själv; det sparas bara i webbläsaren.
- Hela arbetsytan: säkerhetskopian (ZIP) återställs under Hantera på en annan dator.
- Mellan datorer via GitHub: fliken *GitHub* skickar arbetsytan till ett GitHub-repo (helst privat) och hämtar den
  på en annan dator. Det kräver en finkornig åtkomstnyckel (fine-grained personal access token) som bara får läsa
  och skriva innehållet i just det repot. Nyckeln används under sessionen eller sparas krypterad, och ingenting
  skickas förrän du trycker *Skicka till GitHub* eller *Hämta från GitHub*. Bara ändrade filer skickas, i en commit
  med ditt meddelande; vid hämtning väljer du, som för paket, om befintliga datamängder ska ersättas.
- Direkt till en telefon eller en annan dator på samma nätverk: fliken *Enheter* visar en QR-kod som telefonen
  skannar; Dataspatium Mobil tar emot, visar och skickar vidare (se [mobil.md](mobil.md)). Båda enheterna visar
  samma kontrollkod, och efter en parning räcker en skanning.
- Via datorns eller telefonens delningsmeny: fliken *Delningsmeny* skickar en datamängd som CSV, Excel, ODS eller
  JSON, eller alla datamängder som paket, till e-post, Teams och andra appar (Edge och Chrome; Firefox sparar filen).
- Granskning först: när datamängder paketeras eller skickas söker appen efter identitetsnummer, e-post och
  telefonnummer och låter dig pseudonymisera eller ta bort kolumnerna i kopian.
- Som färdig webbsida: fliken *Publicera* gör en dashboard eller ett dokument till en fristående HTML-fil.
- En datamängd: exportera som SQLite (allt följer med) eller Parquet under Exportera.
- API-konfigurationer (`.api.json`), diagram och dokumentmallar (JSON) och recept (JSON, R eller SQL) exporteras
  och läses in som filer. Nycklar följer aldrig med.

## Hjälp i appen

Hela handboken finns i appen: knappen **?** uppe till höger, tangenten **F1** eller kommandot *Hjälp* i
kommandopaletten öppnar den vid kapitlet för det läge du står i. Till vänster finns innehållet, ovanför ett sökfält
som söker i alla avsnitt, och länkar mellan dokumenten följs inne i handboken. Dialoger med en **?**-knapp öppnar
rätt avsnitt direkt. Handboken följer appens språk och behöver inget nätverk; längst ned finns versionen,
*Sök efter uppdatering* och länken till dokumentationen på GitHub.

## Tangentbord

Alt+1 till Alt+8 växlar läge, Ctrl+K öppnar kommandopaletten och F1 öppnar handboken. Kanten mellan en panel och arbetsytan kan få
fokus med Tabb och flyttas med piltangenterna (Skift för större steg, Home och End för minsta och största bredd). Första Tabb-trycket på sidan visar länken
*Hoppa till innehållet*, som flyttar fokus förbi lägesväxlaren och objektpanelen. Allt nås med Tabb och Enter;
dialoger stängs med Esc. I tabellen flyttar piltangenterna mellan celler och Enter redigerar. Appen följer
systeminställningen för minskad rörelse.

Flikar byts med vänster- och högerpil, Home och End. Alla knappar, fält och kodredigerare har namn som skärmläsare
läser upp, dialoger läses upp med sin rubrik och sidan har landmärken för lägesväxlaren, objektpanelen, arbetsytan
och inspektören. Text och fältkanter har kontrast enligt WCAG AA i både ljust och mörkt tema. Diagrammen i
diagrambyggaren beskrivs för skärmläsare av Vega; i R-diagram och D3-mallar finns uppgifterna i tabellen i Bearbeta.

## Språk

Gränssnittet finns på svenska, danska, norska (bokmål), finska, isländska och engelska. Första gången appen
öppnas väljer du språk; språkknappen uppe till höger (eller kommandot *Språk* i paletten) byter det senare. Valet
sparas i webbläsaren, så varje dator och webbläsarprofil har sitt eget. Tal i gränssnittet följer språkets
konventioner; själva datan ändras aldrig. R:s meddelanden följer samma val, medan mallarnas platshållare som
`{{datamangd}}` och tabellnyckelorden `kolumner`, `sortera`, `topp`, `filter` och `rubrik` är en del av
mallspråket och är desamma på alla språk. Dokumentationen finns på alla sex språken under `docs/` (svenska i
`docs/`, övriga i `docs/<språk>/`).

## När något går fel

Läs loggen längst ned: fel som du kan åtgärda beskrivs på ditt språk med förslag. Om R hänger sig, använd *Starta om
R*; datamängderna påverkas inte. Ta säkerhetskopia innan du rensar webbläsardata. Buggar rapporteras som ärenden på
GitHub, se [CONTRIBUTING.md](../CONTRIBUTING.md).
