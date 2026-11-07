# Vanliga frågor

## Var lagras mina data?

I webbläsarens egen databas (IndexedDB) på den dator och i den webbläsarprofil du använder. Ingenting skickas
någonstans. Rensar du webbplatsdata, byter profil eller avinstallerar webbläsaren försvinner datan. Ta därför
säkerhetskopior under *Hantera → Arbetsyta*, eller använd en portabel mapp i Edge och Chrome så att arbetsytan
även ligger som vanliga filer på disk (se [kom-igang.md](kom-igang.md)).

## Behöver jag internet?

Nej. Internet behövs bara när du hämtar data från ett API, skickar till eller hämtar från GitHub, klickar på *Sök
efter uppdatering* eller använder något som inte följer med i mappen: vissa komponenter (till exempel
bakgrundskartor) och R-paket utanför det inbyggda urvalet hämtas när de behövs och sparas sedan lokalt. Första
gången appen behöver internet för ett ändamål frågar den om lov; svaret kan sparas och ändras under *Hantera →
Arbetsyta → Internetåtkomst*, där också loggen över anrop finns. Allt annat, även R, fungerar utan nätverk.

## Varför tar det tid första gången jag använder R?

R laddas som WebAssembly (ungefär 50 MB) och startar på några sekunder. Paket som ggplot2 installeras i
R-sessionen när du använder dem första gången, vilket tar ytterligare några sekunder. R-sessionen börjar om när du
laddar om sidan, men dina datamängder och skript finns kvar.

Inget av detta laddas när appen startar, bara när det används: R ligger med i appens mapp och packas upp i webbläsaren första
gången fliken R öppnas, Python hämtas som komponenter första gången du trycker Starta Python, och 3D-modeller, PDF och kartor laddas
på samma sätt när de behövs. Under tiden står det i statusraden vad som laddas, och R-konsolen visar vilken fil den väntar på.

När något hämtas över nätet, det vill säga appens egna filer när den körs från en webbserver och komponenter som Python, IfcOpenShell
och OCR, visar statusraden hur mycket som hämtats av det hela, hastigheten och ungefär hur lång tid som är kvar i den takten, med en
knapp för att avbryta. Det som väntade på hämtningen får då ett meddelande om att den avbröts och kan startas om senare. Från mappen
(file://) hämtas ingenting; filerna ligger på disken.

## Kan jag avbryta R-kod som fastnat?

Ja, när appen körs från en webbserver (till exempel `python -m http.server 8080` på den egna datorn, eller https på
ett intranät): då finns knappen *Avbryt* bredvid *Kör* i R-fliken, och R-sessionen med sina objekt finns kvar. När
appen öppnas från en mapp (file://) tillåter webbläsaren inte den mekanism som krävs; använd då *Starta om R* i
Analysera. Datamängderna påverkas inte.

## Hur fungerar Python i appen?

Python (Pyodide) följer inte med i mappen. Första gången du trycker *Starta Python* eller *Kör* i fliken Python frågar
appen om lov att hämta komponenter och laddar ned Python med numpy och pandas (cirka 22 MB) från jsDelivr, kontrollerat
mot kända kontrollsummor. Sedan sparas allt i webbläsaren och Python startar utan internet. Paket som koden importerar
(matplotlib, scipy, scikit-learn och de övriga i Pyodides utbud) hämtas på samma sätt när de behövs. Se
[python.md](python.md).

## Varför fungerar inte ett API?

Oftast saknar API:et CORS-stöd, det vill säga webbläsaren får inte läsa svaret. Då kan Dataspatium bara nå det
via en proxy som du själv driver (inställning under Inhämta). Vissa API:er kräver dessutom en nyckel, till exempel
Boverket och Lantmäteriet Direkt. Se [api-konfiguration.md](api-konfiguration.md), som också beskriver hur du
skaffar nycklar.

## Hur sparas API-nycklar?

Antingen bara i minnet under sessionen eller krypterade med en lösenfras du väljer. Aldrig i klartext, och de följer
aldrig med när du delar en konfiguration.

## Hur stora datamängder klarar appen?

Ett par miljoner rader i Edge och Chrome, något mindre i Firefox; minnet i webbläsaren sätter gränsen. Uppmätta
tider för en miljon rader finns i [utveckling.md](utveckling.md). Textfiler på 64 MB eller mer läses in i
omgångar, så att själva inläsningen inte kräver att hela filen ryms i minnet som text.

## Vad skiljer Firefox från Edge och Chrome?

Utseende och funktioner är desamma, men Firefox saknar mappåtkomst, så den portabla mappen finns inte där.
Säkerhetskopia som ZIP fungerar överallt.

## Kan appen köras från en webbserver eller ett intranät?

Ja. Lägg mappen oförändrad på valfri statisk webbserver; inga serverfunktioner behövs. Över https, och på den egna
datorn över `http://localhost`, registrerar appen en service worker (`sw-coi.js`) som gör sidan *cross-origin
isolated*, och då kan R-kod avbrytas. Första gången laddas sidan om en gång när den tar över. Över vanlig http på ett
intranät tillåter webbläsaren inga service workers, men en server som själv skickar huvudena
`Cross-Origin-Opener-Policy: same-origin` och `Cross-Origin-Embedder-Policy: credentialless` ger samma sak. Allt annat
fungerar som från mappen. Webbläsaren lagrar data per adress, så arbetsytan i mappen och den på servern är skilda åt;
flytta mellan dem med säkerhetskopia eller paket.

Från en webbserver, även <https://marwiss.github.io/Dataspatium/>, kan appen installeras som en egen app: i Edge och
Chrome via ikonen *Installera* i adressfältet eller webbläsarens meny. Den får då ett eget fönster och en egen ikon,
filerna sparas i webbläsaren så att den fungerar utan nätverk, och lagringen blir beständig. Nya versioner hämtas
när appen öppnas igen med nätverk.

## Kan jag öppna index.html direkt i ZIP-filen?

Nej. Packa upp ZIP-filen först (högerklicka och välj *Extrahera alla* i Windows) och öppna sedan `index.html` i
den uppackade mappen.

## Hur uppdaterar jag?

Ladda ned den nya versionen och packa upp den i en ny mapp. Dina data ligger i webbläsaren, inte i mappen, så de
finns kvar när du öppnar den nya versionens `index.html` på samma dator och i samma webbläsare. Under hjälpknappen
finns *Sök efter uppdatering*, som jämför din version med den senaste utgåvan på GitHub. Kontrollen görs bara när
du klickar.

## Kan jag byta språk?

Ja. Första gången appen öppnas väljer du språk; därefter öppnar språkknappen uppe till höger (ikonen med
bokstäver) eller kommandot *Språk* i paletten samma val. Svenska, danska, norska (bokmål och nynorsk), finska, isländska och
engelska finns. Appen laddas om på det valda språket när osparade ändringar har sparats. Valet sparas i
webbläsaren, så varje dator och profil har sitt eget. Dokumentationen finns på samma språk i mappen `docs`.

## Hur öppnar jag Grundkursen igen?

Klicka på frågetecknet uppe till höger och välj *Öppna Grundkursen*, eller tryck Ctrl+K och skriv *grundkurs*.
Kursen fortsätter där du slutade; har du gått igenom den börjar den om från början. Den finns på alla sju språk.

## Finns det källor från andra nordiska länder?

Ja. Under *Lägg till källor* → *Öppna API:er* i Inhämta finns statistikbyråerna i Danmark, Norge, Finland, Island, Grönland,
Färöarna och Åland, Nordic Statistics, Folkehelseinstituttet, Enhetsregisteret, Kartverket, MET Norway, THL:s
Sotkanet, PRH:s företagsregister, Digitraffic, Meteorologiska institutet, Veðurstofa Íslands och de danska och
finländska dataportalerna. Landsknapparna ovanför listan väljer vilka länders källor som visas; valet sparas i
webbläsaren. Alla källor är kontrollerade för CORS och kräver ingen nyckel. Se
[api-konfiguration.md](api-konfiguration.md).

## Kan jag ha appen öppen i flera flikar?

Ja. Flikarna delar samma arbetsyta och håller varandra underrättade: sparar eller tar du bort något i en flik
läser de andra om sina listor och loggar vad som hänt. Redigera ändå inte samma datamängd i två flikar samtidigt;
om båda har osparade ändringar vinner den som sparar sist.

## Kan en annan lokal HTML-fil läsa mina data?

I Edge och Chrome delar alla filer som öppnas via file:// samma lagringsutrymme. Öppna därför inte okända
HTML-filer lokalt medan du har känsliga data i appen. Nycklar lagras aldrig i klartext. Firefox håller lokala
filer isär.

## Får jag använda appen på jobbet?

Ja, om arbetsgivaren är en myndighet, kommun, region, skola, ett lärosäte eller en ideell organisation, det vill
säga icke-kommersiell användning. Kommersiell användning kräver tillstånd från licensgivaren. Se
[licenser.md](licenser.md).

## Hur gör jag en karta över kommuner eller län?

Klicka på *Kommungränser (SCB)* eller *Länsgränser (SCB)* i Inhämta; gränserna följer med appen (SCB:s
förenklade gränser för tematiska kartor, CC0). Koppla sedan dina värden till gränserna på kommunkoden eller
länskoden i Bearbeta (*Koppla*), och välj diagramtypen *Karta* i Visualisera. Punkter med longitud och latitud
(till exempel mätstationer) ritas med *Punktkarta*, med gränserna som bakgrund. Egna gränser kan importeras från
GeoJSON, shapefile eller GeoPackage. Se [visualisera.md](visualisera.md).

## Hur får jag fram kommun eller län ur koordinater?

Välj *Geodata > Kommun och län ur koordinater* i Bearbeta (via Åtgärder eller paletten). Åtgärden slår upp
varje punkts kommun och län i SCB:s medföljande gränser och lägger till kolumnerna kommunkod, kommun, lanskod
och lan; koordinater i SWEREF 99 TM känns igen. Gränserna täcker landytan, så punkter i vatten blir tomma.
Samma grupp har mittpunkt och area ur geometri samt omräkning mellan SWEREF 99 TM och WGS 84. Se
[bearbeta.md](bearbeta.md).

## Hur kombinerar jag flera datamängder i en SQL-fråga?

Varje datamängd har ett kortnamn (visas under namnet i objektpanelen, ändras under Hantera > Byt namn). I
SQL-fliken under Analysera heter den valda datamängden `data` men nås också med sitt kortnamn, och alla andra
datamängder nås med sina kortnamn: `select k.kommun, b.folkmangd from befolkning_2024 b join
kommungranser k on k.kommunkod = b.kommunkod`. Resultatet kan sparas som ny datamängd. I R läser
`dm_read("kortnamn")` samma datamängd. Se [bearbeta.md](bearbeta.md).

## Hur kontrollerar jag att datan håller måttet?

*Datakvalitet* i Bearbeta profilerar alla kolumner och föreslår åtgärder. *Regler* låter dig skriva ned krav
(får inte saknas, unik, intervall, lista, mönster, längd eller ett SQL-villkor) och köra dem efter varje import;
felande rader kan sparas som egen datamängd och resultatet laddas ned som rapport. Reglerna sparas i datamängden
och följer med när du delar den. Se [bearbeta.md](bearbeta.md).

## Kan jag ta bort personnummer innan jag delar en datamängd?

Ja. Åtgärden *Pseudonymisera* i Bearbeta ersätter identifierare med saltade hashvärden, maskerade värden eller
löpnummer, och datakvalitetsprofilen föreslår den när en kolumn ser ut att innehålla personnummer. Det är
pseudonymisering, inte anonymisering: andra kolumner kan fortfarande peka ut personer, så gå igenom hela
datamängden innan du delar den. Se [bearbeta.md](bearbeta.md).

## Hur delar jag data med en kollega?

Enklast i läget *Dela*: under *Paket* väljer du datamängder och om diagram, dashboards, mallar, anteckningsböcker
och skript ska följa med, skriver ett meddelande och skickar ZIP-filen, till exempel via fliken *Delningsmeny*
(e-post, Teams och andra appar). Kollegan öppnar den under *Ta emot*, ser ditt meddelande och vad som ändrats och
kan ersätta sina egna versioner. Kommentarer, mappar och taggar följer med. Sitter ni på samma nätverk går paketet direkt mellan datorerna eller via
telefonen (fliken *Enheter*, se [mobil.md](mobil.md)). Arbetar ni med samma arbetsyta kan ni också använda ett
gemensamt GitHub-repo (fliken *GitHub*). Innan något lämnar appen granskas datamängderna för personuppgifter,
som kan pseudonymiseras eller tas bort i kopian. Dashboards och dokument kan publiceras som fristående
HTML-filer (fliken *Publicera*). Du kan också exportera en enskild datamängd som SQLite (behåller typer, etiketter,
kommentarer och historik) eller ta en säkerhetskopia av hela arbetsytan. Diagram och dokumentmallar kan exporteras
som JSON-filer, API-konfigurationer som `.api.json`, och recept som JSON, R eller SQL. Se [dela.md](dela.md).

## Hur håller jag ordning på många datamängder?

Ge dem mappar och taggar: *Ordna* i Hantera, eller dra en datamängd till en mapp i objektpanelen. Mappar kan ha
undermappar (`Ekonomi/2026`), filterfältet söker på namn, tagg och mapp, och kryssrutorna väljer flera datamängder
för batchåtgärder. Mapp och taggar följer med datamängden i paket och säkerhetskopior, och i R visar `dm_list()`
mappen.

## Vad är komponenter?

Delar av appen som inte följer med i mappen, för att hålla den liten: till exempel bakgrundskartor och R-paket
utanför det inbyggda urvalet. De hämtas från en fast adress när något behöver dem, efter att du gett lov, och
kontrolleras mot en känd kontrollsumma där en sådan finns. Sedan sparas de i webbläsaren och behöver inte hämtas
igen. Under *Hantera → Arbetsyta → Komponenter* ser du vilka som finns och hur stora de är, och kan hämta dem i
förväg eller ta bort dem.

## Kan jag använda appen i telefonen?

Hela appen är gjord för datorer, men telefonen kan vara med: Dataspatium Mobil
(<https://marwiss.github.io/Dataspatium/m/>) tar emot paket och filer från datorn över det lokala nätverket, visar
tabellerna, skickar dem vidare och lämnar dem till en annan dator. Öppna *Dela → Enheter* på datorn och skanna
QR-koden; se [mobil.md](mobil.md). På surfplattor i serverläge går hela appen att använda: i smala fönster visar
lägesväxlaren ikoner och panelerna öppnas som flak över arbetsytan.

## Hur för jag över data till en telefon utan internet?

Datorn och telefonen behöver bara samma lokala nätverk; överföringen går direkt mellan dem med WebRTC och passerar
ingen server. Första gången måste telefonen hämta mobilsidan från webben (eller från en egen webbserver på
intranätet); därefter ligger den i cachen. Finns inget gemensamt nätverk: slå på surfdelning i telefonen och anslut
datorn till den. Se [mobil.md](mobil.md).

## Var finns hjälpen?

I appen: knappen **?** uppe till höger eller F1 öppnar handboken vid kapitlet för det läge du står i, med sökning
över alla avsnitt och länkar mellan dokumenten. Samma texter finns i [docs/](anvandarguide.md) på GitHub.
Grundkursen öppnas från handboken eller med Ctrl+K.

## Kan jag visa en dashboard på en stor skärm?

Ja. Öppna dashboarden i Visualisera och klicka på **Presentera**: dashboarden fyller fönstret, piltangenterna går
ett diagram i taget, F ger helskärm och Esc avslutar. De gemensamma filtren finns kvar överst. Se
[visualisera.md](visualisera.md).

## Kan jag läsa en Access-databas eller en SQL Server-tabell?

Ja. Access-filer (mdb, accdb) släpps på ytan i Inhämta och läses direkt i webbläsaren. SQL Server, ODBC-källor,
Excel och Access-frågor nås genom databasbryggan, ett litet skript som du startar på datorn; tjänster som PostgREST,
OData och GraphQL läggs till som källor med en adress. Se [kallor.md](kallor.md).

## Kan jag läsa in PDF-filer, Word-dokument och bilder?

Ja. Släpp dem i Inhämta: dokument (PDF, Word, OpenDocument, Markdown, text) blir en dokumentsamling med ett stycke per rad,
bilder en bildsamling med en rad per bild och EXIF-uppgifter. Flera filer på en gång blir en samling. I Bearbeta visas
de som läsvy respektive galleri, och i Analysera finns verktygen Text och Bilder utan kod. Skannade PDF-filer utan
textlager kan läsas med textigenkänning. Se [dokument.md](dokument.md).

## Kan jag visa kartor och räkna på geodata?

Ja. En datamängd med geometri (GeoJSON, Shapefile, GeoPackage, KML, GPX) eller longitud och latitud öppnas som en karta
i Bearbeta. I Visualisera gör diagramslaget *Karta* kartvyer med flera lager och bakgrundskarta för dashboards och
publicering, och i Analysera räknar fliken *Geo* area, punkter i områden, närmaste, buffert och överlagring utan kod.
QGIS-projekt kan släppas i Inhämta. Bakgrundskartor hämtas bara efter ditt samtycke. Se [kartor.md](kartor.md).

## Hur ser jag vad appen skickar till en OpenCDE-server?

Öppna källan i Inhämta och fäll ut kortet *Logg* längst ned. Där står varje anrop med API, operation, status och tid, och ett klick
visar rubriker, en förklaring och en curl-rad att kopiera. Loggen finns bara i minnet under sessionen och lämnar aldrig datorn om du
inte själv sparar den som JSON eller datamängd. Se [kallor.md](kallor.md).


## Kan jag se en modells IFC-graf och fråga den med Cypher?

Ja, om modellen finns på en Kontroll-server. Öppna källan i Inhämta, kortet *IFC-LPG* eller en Neo4j-källa, och välj modell och vy.
Noder och relationer ritas, du hämtar grannar med ett dubbelklick och skriver egen Cypher i rutan. Se [grafer.md](grafer.md).

## Fungerar appen mot en server som bara har BCF API 2.1?

Ja. Appen väljer den nyaste version som servern erbjuder och klarar sig utan Foundation API, så du lägger till servern som vanligt. Se [kallor.md](kallor.md).

## Hittar jag inte svaret här?

Läs [anvandarguide.md](anvandarguide.md) eller öppna ett ärende på GitHub (se [CONTRIBUTING.md](../CONTRIBUTING.md)).
