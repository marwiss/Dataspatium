# Säkerhet

Säkerheten är appens första krav. Dataspatium håller dina datamängder, API-nycklar och token i webbläsaren och talar med
servrar (öppna API:er, OpenCDE-servrar som Dataregium) bara när du ber om det. Policyn är densamma som Dataregiums, eftersom
de två utvecklas som ett par och släpps med samma nummer; Dataregiums halva finns i [README](https://github.com/marwiss/Dataregium/blob/main/README.md#personuppgifter)
i det repot. Hur en sårbarhet rapporteras står i [SECURITY.md](../../SECURITY.md).

## Hotmodell

**Tillgångar**: dina datamängder (som kan innehålla personuppgifter), API-nycklar och token till servrar, lösenfrasen som
skyddar dem, det du delar med andra (paket, filer till en server, publicerade sidor) och arbetsytans integritet.

**Aktörer**: du själv; andra program på samma dator; webbplatser du besöker i samma webbläsare; servrarna du hämtar från och
skickar till; den som får en fil du delat; den som kan läsa nätverket mellan dig och en server.

**Förtroendegränser**: appen körs i webbläsarens sandlåda och når bara det du släpper på ytan eller väljer i en dialog.
Öppnad från en mapp (file://) delar den lagringsursprung med andra lokalt öppnade HTML-filer i Chromium, därför krypteras
hemligheter. Servrar är främmande: allt de skickar behandlas som data och escapas; allt appen skickar till dem går genom din
åtgärd och ditt samtycke per ändamål. R, Python och web-ifc körs i WebAssembly-sandlådor i workers utan åtkomst till datorn.

## Kontroller och proven som visar dem

Varje kontroll har ett automatiskt prov i `tests/` eller en pekare till koden som bär den.

| Kontroll | Standard | Prov |
|---|---|---|
| Inga nätverksanrop utan din åtgärd och ditt samtycke per ändamål (api, url, github, komponenter, bakgrundskartor, databaser, neo4j, stun, opencde); ett nekat samtycke stoppar anropet | OWASP ASVS 8.3 | `consent.test.js`: *a purpose is asked once, the answer is remembered when wanted, and a denial raises ConsentError* |
| Hemligheter (API-nycklar, token) lagras aldrig i klartext: bara i sessionen eller krypterade med lösenfras (AES-GCM via WebCrypto), med låsning och upplåsning | OWASP ASVS 2.10, 6.2 | `api.test.js`: *secrets in session, encrypted persistence, lock and unlock* |
| Ett recept med ett hemligt steg körs inte om utan dig | Dataminimering | `refresh`: *a recipe with a secret step is refused before anything is fetched* |
| Komponenter och R-paket hämtas från pinnade adresser efter samtycke, kontrolleras mot SHA-256 före användning och cachas i IndexedDB | OWASP ASVS 14.2 | `components`: *fetched once with consent, verified against SHA-256, served from the cache afterwards, and removable* |
| Tredjepartskod vendoras med pinnad version och licens och ändras aldrig för hand | OWASP ASVS 14.2 | `tools/fetch_vendor.py`, `THIRD_PARTY_LICENSES.md`, granskning |
| Allt som lämnar appen granskas i sin helhet: identitetsnummer, e-post och telefon i kolumner, löptext, sidotabeller, original, bilders position, grafers kanter, kommentarer och författare; behåll, pseudonymisera eller ta bort i kopian; datamängden ändras aldrig | Dataminimering (GDPR art. 5) | `review`: *identity numbers, e-mail and phone columns are found; the shared copy is hashed or stripped while the dataset stays*, *running text in a document is found and masked*, *graph edges and node properties are scanned and masked*; `exif`: *strip leaves the picture and removes the text* |
| Ett paket tar med diagram, dashboards och anteckningsböcker bara för de valda datamängderna; personuppgifter i dem, i mallar, skript, sparade utdata och datamängdernas namn och filnamn listas och maskeras i kopian om du inte väljer att behålla, ta bort utdata eller lämna utanför | Dataminimering, GDPR art. 25 | `review`: *a bundle carries charts and notebooks of the chosen datasets only, and their personal data and names are cleaned* |
| OAuth2 mot OpenCDE: authorization code med PKCE S256, `state` och exakt återhoppsadress; fel `state` och nekat samtycke vägras; token förnyas och återkallas | RFC 6749, 7636, 9700 | `opencde`: *sign in with a popup, refuse a wrong state, refresh an expiring token, sign out*; riktiga provet C2, C7–C9 |
| Återhoppet från inloggningsfönstret: via öppnaren eller en BroadcastChannel med bekräftelse; ett stängt fönster räknas som fel bara när appen inte är isolerad | — | `opencde VI`: *the popup flow hears the callback page through a BroadcastChannel and a storage event* |
| Begärandeloggen maskerar rubriker (Authorization med flera) och sparar kroppar bara på begäran, aldrig för tokenanrop | OWASP ASVS 7.1 | `cde-log`: *paths become APIs and operations, headers are masked, bodies only when asked and never for tokens* |
| Svar från en grafdatabas bär inga lagrade hashvärden: lösenords-, token-, kod- och hemlighetshashar tas bort ur noder, relationer, tabeller och kartor innan något visas eller sparas, och Bolt-sessioner är alltid läsande | Dataminimering | `ifc graph`: *stored hashes never reach a table or a graph* |
| Token går bara till källans egen server: rapporten från serverns IFC-kontroll hämtas från en adress som appen bygger, aldrig från adressen i versionens metadata | — | `validation`: *metadata and report from the server, the report from the app's own address, and the words in the log* |
| Adresser som servern lämnar ut för jobb och rapporter (kollisionskontrollen, sammanslagningen) följs bara på samma server, och sökvägar ur kapabiliteterna godtas bara som sökvägar; annars bygger appen adressen själv, så token stannar hos källans server | — | `validation`: *the server checks for clashes like the app, makes the topics itself, and brings a building of another model in after its report* |
| En nyckel som tjänsten vill ha i begärans kropp (Trafikverkets NVDB) fylls i först när begäran skickas, escapas för kroppens format och hamnar aldrig i adressen, loggen eller källans uppgifter | OWASP ASVS 8.3 | `geodata`: *NVDB sends its key in the XML body and a box in SWEREF 99 TM, pages with skip and opens as a map in WGS 84* |
| En nyckel som följer med filer i ett sökresultat (Lantmäteriets STAC) skickas bara till de värdar som källan anger; en fil på en annan värd hämtas utan nyckel | OWASP ASVS 8.3 | `geodata`: *Lantmäteriet STAC searches an area with the key, and Filer i källan reads the vector files in, with the key only for the file host* |
| Bryggan som mellanhand är av som förval och hämtar bara över https från de värdar användaren startar den med, aldrig från den egna datorn eller det lokala nätet, med få rubriker och inga kakor, och loggar aldrig frågor, rubriker eller kroppar | OWASP ASVS 12.6 (SSRF) | `bridge`: *with the switch on, a service that refuses the browser is fetched through the bridge, and only then*; `tools/db_bridge.py` och `tools/db-bridge.ps1` provade mot en riktig tjänst |
| Innehållspolicyn tillåter inga inbäddade skript och inga skript utifrån; bara appens egna filer, blob-workers och WebAssembly körs | OWASP ASVS 14.4 | hela sviten under policyn i Edge och Firefox (`tests/setup.js` skriver varje brott i loggen) |
| Styrning utifrån är av vid varje start, kräver att bryggan startats med `--allow-commands` och din bekräftelse för sessionen; program som känner bryggans token kör bara appens egna kommandon, läsande direkt och skrivande efter ditt godkännande i appens dialog, och kön ligger i bryggan på 127.0.0.1 | OWASP ASVS 4.1, 8.3, LLM06 | `remote.test.js`: *with the switch on the page registers its commands with the bridge, runs what is queued, asks before a writing command and runs a plan once* och *a bridge started without --allow-commands is told, and the switch shows the state in Internetåtkomst*; `tools/check_bridge.py` |
| En lista som servern har kapat läses till slut genom Link rel="next", men bara på samma server, så att token aldrig går någon annanstans | — | `opencde`: *a list the server has capped is read to the end through Link rel="next", and only on the same server* |
| Ett arkivpakets filer jämförs med kontrollsummorna (SHA-256) i `PREMIS.xml` när paketet läses, och en ändrad eller saknad fil visas; en plats som pekar utanför paketet kontrolleras inte och läses aldrig | PREMIS 3.0 | `plan files`: *an archive package, as a folder or a ZIP, opens as the plan with its documents and the check of its files* |
| All data som renderas escapas; ingen `innerHTML` med användardata; dokument och publicerade sidor escapar | OWASP ASVS 5.3 | `published page`: *everything escaped*; `docgen`: *builders escape and structure the content*; kodkonvention |
| Service worker och PWA bara i serverläge; från file:// beror ingenting på dem | — | localhost-steget i testmatrisen |
| Inga hemligheter, personuppgifter eller upphovspersonens identitet i repot eller dess historik | — | utgåveskriptens identitetskontroll före commit, `CONTRIBUTING.md` |
| En AI-leverantör anropas bara efter samtycke för dess värd (ändamålet ai) och enligt policyn: *Endast lokal* vägrar varje värd utanför den egna datorn; nyckeln ligger i api/secrets och följer aldrig med i frågan, loggen eller inställningen | OWASP ASVS 8.3, 2.10 | `ai.test.js`: *providers are saved without their key, the key goes to api/secrets, and the policy Local only refuses a cloud host* |
| AI:n kan bara läsa modellen: verktygen svarar med data ur datamängdens tabeller, svaren kapas och märks som data, aldrig som instruktioner, och slingan har budget för steg och token samt avbryt | OWASP LLM01, LLM06 | `ai.test.js`: *the agent asks, runs the tool the model called, hands the result back as data and collects the elements* och *a question can be cancelled, and the budget of turns ends a loop that never answers* |
| AI-ändringar görs aldrig av AI:n: skrivverktygen fyller ett ändringsset som en människa förhandsvisar och godkänner; radering kräver confirm från AI:n och en bekräftelse till från människan; ett ändringsset med schemafel kan inte godkännas; publicering, ändringsförslag till servern och godkännande där är knappar, aldrig verktyg | OWASP LLM01, LLM06, LLM08 | `ai-change.test.js`: *the write tools check each call, fill the change set with refs and refuse what the person has not asked for* och *the panel previews the candidate in 3D, approves it as a recipe step with provenance, undo restores the file exactly, and schema errors block approval*, *a previewed change set goes to Dataregium as a change proposal* |
| Bilder och ritningar följer med briefen till AI-leverantören bara i läget Bygg ur brief, efter samtycket för leverantörens värd och enligt policyn; varje bild ritas om till JPEG eller skickas utan EXIF, och bildtexten anger fasad, position och tid bara när du har bifogat bilden med dem | OWASP LLM02, LLM06 | `ai-build.test.js`: *the agent asks the person, builds in groups through the write tools and says the plan; the pictures go with the brief* och *the panel in the mode Bygg ur brief shows the brief, takes attachments, and the question box answers the AI* |
| Briefen och bilderna läggs på modellens server bara när du trycker på *Lägg underlaget på servern* och har gått igenom granskningen före delning, som påminner om att personer och registreringsskyltar är personuppgifter och tar bort bildernas position och tid ur kopian, även ur filernas EXIF, om du inte behåller dem | Dataminimering, GDPR art. 25 | `model-material.test.js`: *through the sharing review, positions and times stay out of the copy unless kept, also from the files' EXIF* |
| Fynden från AI-panelens läge Kontrollera blir ärenden på servern bara när du trycker på *Skapa ärenden på servern* och har gått igenom granskningen före delning; fotot följer med utan EXIF, och fotots position står i ärendet bara om du behåller den | Dataminimering, GDPR art. 25 | `ai-check.test.js`: *Skapa ärenden på servern makes one topic per finding with a viewpoint on a virtual Dataregium, and sends a failed one again* |
| AI-assistenten kör bara appens egna kommandon, som slås upp efter namn och kontrolleras mot sitt schema; ett kommando som ändrar något körs först när du har godkänt det i appens egen dialog, som visar kommandot och argumenten, och ett svar på en fråga från AI:n godkänner aldrig något | OWASP LLM01, LLM06, LLM08 | `commands.test.js`: *an operation needs approval unless the person runs it, is checked against its own schema and can be undone*; `assistant.test.js`: *a refused command is not run and the refusal goes back to the AI; a closed question is an answer too* |
| SQL från ett kommando får bara läsa: SQLite-workern tar emot en enda sats som läser och kör den med databasen låst mot ändringar | OWASP ASVS 5.3, LLM02 | `commands.test.js`: *SQL that only reads runs; a second statement, WITH … DELETE and DELETE are refused and change nothing* |
| Villkor i flöden och planer tolkas av appen och körs aldrig som kod, och frågor från ett flöde eller en AI visas bara som text | OWASP ASVS 5.2, LLM02 | `commands.test.js`: *comparisons, and/or/not, references to earlier answers, fill, and nothing is run as code*; `plans.test.js`: *the question shows text only and answers with the choice or an own text* |

## Personuppgifter och lagring

Vad appen lagrar, var, och hur länge. Allt ligger på din dator; ingenting skickas till appens upphovsperson, och ingen
uppdateringskontroll görs utan din åtgärd. Dataregiums halva (vad servern lagrar om dig) står i
[README](https://github.com/marwiss/Dataregium/blob/main/README.md#personuppgifter).

| Data | Var | Innehåll | Sparas |
|---|---|---|---|
| Datamängder | IndexedDB (en SQLite-fil per datamängd) | det du importerat, med kolumner, kommentarer och historik; kan innehålla personuppgifter | tills du tar bort dem; säkerhetskopior och paket är ZIP-filer där du lägger dem |
| Inställningar | IndexedDB | språk, panelbredder, tillagda källor, samtycken, sparade frågor | tills du rensar webbplatsdata |
| Hemligheter | minnet, eller IndexedDB krypterat med din lösenfras | API-nycklar, token; lösenfrasen lagras aldrig | sessionen, eller tills du tar bort källan |
| Loggen | minnet | åtgärder, fel och anrop med maskerade rubriker | tills sidan laddas om |
| Kommentarernas namn | datamängdens fil | namnet du själv angett | följer med i paket, säkerhetskopior och GitHub |
| Det du skickar | hos mottagaren | datamängder, filer, ärenden, kommentarer och ditt användarnamn hos servern | enligt mottagarens villkor |

## Kända luckor

- Content-Security-Policy utan inbäddade skript: appens sidor, mobilsidan och provsidan laddar bara skript ur appens egna
  filer, blob-workers och WebAssembly. `eval` tillåts fortfarande, eftersom web-ifc:s bygge och Vega behöver det; den delen
  tas bort när båda kan köras utan den.
- Från file:// i Chromium delar alla lokalt öppnade HTML-filer lagring. Hemligheter är krypterade, men en känslig arbetsyta
  bör köras från en lokal server (`python -m http.server`) eller speglas till en portabel mapp.
- Chromium tillämpar serverns `form-action` även på omdirigeringen efter inloggningen; servern måste tillåta appens
  återhoppsadress (Dataregium gör det).

## Rapportera en sårbarhet

Öppna inget publikt ärende. Använd knappen *Report a vulnerability* under Security → Advisories i repot på GitHub, enligt
[SECURITY.md](../../SECURITY.md): version (under hjälpknappen), webbläsare, vad du såg och hur det återskapas. Du får en
bekräftelse inom några dagar och en rättning eller en plan så snart problemet är förstått.

## Versioner som får rättningar

En utgåva per huvudnummer behålls: bara den senaste utgåvan i 2-serien får rättningar. 1.0.0 behålls för referens utan
rättningar.
