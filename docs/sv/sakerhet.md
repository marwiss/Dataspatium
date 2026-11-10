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
| OAuth2 mot OpenCDE: authorization code med PKCE S256, `state` och exakt återhoppsadress; fel `state` och nekat samtycke vägras; token förnyas och återkallas | RFC 6749, 7636, 9700 | `opencde`: *sign in with a popup, refuse a wrong state, refresh an expiring token, sign out*; riktiga provet C2, C7–C9 |
| Återhoppet från inloggningsfönstret: via öppnaren eller en BroadcastChannel med bekräftelse; ett stängt fönster räknas som fel bara när appen inte är isolerad | — | `opencde VI`: *the popup flow hears the callback page through a BroadcastChannel and a storage event* |
| Begärandeloggen maskerar rubriker (Authorization med flera) och sparar kroppar bara på begäran, aldrig för tokenanrop | OWASP ASVS 7.1 | `cde-log`: *paths become APIs and operations, headers are masked, bodies only when asked and never for tokens* |
| Svar från en grafdatabas bär inga lagrade hashvärden: lösenords-, token-, kod- och hemlighetshashar tas bort ur noder, relationer, tabeller och kartor innan något visas eller sparas, och Bolt-sessioner är alltid läsande | Dataminimering | `ifc graph`: *stored hashes never reach a table or a graph* |
| Ett arkivpakets filer jämförs med kontrollsummorna (SHA-256) i `PREMIS.xml` när paketet läses, och en ändrad eller saknad fil visas; en plats som pekar utanför paketet kontrolleras inte och läses aldrig | PREMIS 3.0 | `plan files`: *an archive package, as a folder or a ZIP, opens as the plan with its documents and the check of its files* |
| All data som renderas escapas; ingen `innerHTML` med användardata; dokument och publicerade sidor escapar | OWASP ASVS 5.3 | `published page`: *everything escaped*; `docgen`: *builders escape and structure the content*; kodkonvention |
| Service worker och PWA bara i serverläge; från file:// beror ingenting på dem | — | localhost-steget i testmatrisen |
| Inga hemligheter, personuppgifter eller upphovspersonens identitet i repot eller dess historik | — | utgåveskriptens identitetskontroll före commit, `CONTRIBUTING.md` |

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

- Ingen Content-Security-Policy ännu: appen kör klassiska skript, blob-workers och WebAssembly, och web-ifc:s bygge kräver
  `eval`. En meta-CSP utan `'unsafe-eval'` läggs till när web-ifc kan laddas utan den.
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
