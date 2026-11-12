# Sikkerhet

Sikkerheten er appens første krav. Dataspatium holder datasettene, API-nøklene og tokenene dine i nettleseren og snakker med
servere (åpne API-er, OpenCDE-servere som Dataregium) bare når du ber om det. Policyen er den samme som Dataregiums, siden de to
utvikles som et par og slippes med samme numre; Dataregiums halvdel ligger i [README](https://github.com/marwiss/Dataregium/blob/main/docs/nb/README.md#personopplysninger)
i det repoet. Hvordan en sårbarhet rapporteres, står i [SECURITY.md](../../SECURITY.md).

## Trusselmodell

**Verdier**: datasettene dine (som kan inneholde personopplysninger), API-nøkler og tokener til servere, passfrasen som
beskytter dem, det du deler med andre (pakker, filer til en server, publiserte sider) og arbeidsområdets integritet.

**Aktører**: du selv; andre programmer på samme datamaskin; nettsteder du besøker i samme nettleser; serverne du henter fra og
sender til; den som mottar en fil du har delt; den som kan lese nettverket mellom deg og en server.

**Tillitsgrenser**: appen kjører i nettleserens sandkasse og når bare det du slipper på flaten eller velger i en dialog. Åpnet
fra en mappe (file://) deler den lagringsopprinnelse med andre lokalt åpnede HTML-filer i Chromium, og derfor krypteres
hemmeligheter. Servere er fremmede: alt de sender, behandles som data og escapes; alt appen sender til dem, går gjennom din
handling og ditt samtykke per formål. R, Python og web-ifc kjører i WebAssembly-sandkasser i workers uten tilgang til datamaskinen.

## Kontroller og testene som viser dem

Hver kontroll har en automatisk test i `tests/` eller en peker til koden som bærer den.

| Kontroll | Standard | Test |
|---|---|---|
| Ingen nettverkskall uten din handling og ditt samtykke per formål (api, url, github, komponenter, bakgrunnskart, databaser, neo4j, stun, opencde); et nektet samtykke stopper kallet | OWASP ASVS 8.3 | `consent.test.js`: *a purpose is asked once, the answer is remembered when wanted, and a denial raises ConsentError* |
| Hemmeligheter (API-nøkler, tokener) lagres aldri i klartekst: bare i sesjonen eller kryptert med passfrase (AES-GCM via WebCrypto), med låsing og opplåsing | OWASP ASVS 2.10, 6.2 | `api.test.js`: *secrets in session, encrypted persistence, lock and unlock* |
| En oppskrift med et hemmelig steg kjøres ikke om igjen uten deg | Dataminimering | `refresh`: *a recipe with a secret step is refused before anything is fetched* |
| Komponenter og R-pakker hentes fra låste adresser etter samtykke, kontrolleres mot SHA-256 før bruk og caches i IndexedDB | OWASP ASVS 14.2 | `components`: *fetched once with consent, verified against SHA-256, served from the cache afterwards, and removable* |
| Boverkets klimadatabase hentes bare når du trykker på *Hent klimadatabasen*, etter samtykke til API-henting fra api.boverket.se; ingenting om modellen sendes, og databasen lagres i nettleseren med sin versjon | OWASP ASVS 8.3 | `climate.test.js`: *the database is fetched only on the person's action, through the preset, with consent for api.boverket.se, and kept with its version* |
| Tredjepartskode vendoreres med låst versjon og lisens og endres aldri for hånd | OWASP ASVS 14.2 | `tools/fetch_vendor.py`, `THIRD_PARTY_LICENSES.md`, gjennomgang |
| Alt som forlater appen, gjennomgås i sin helhet: identitetsnumre, e-post og telefon i kolonner, løpende tekst, sidetabeller, originaler, bilders posisjon, grafers kanter, kommentarer og forfattere; behold, pseudonymiser eller fjern i kopien; datasettet endres aldri | Dataminimering (GDPR art. 5) | `review`: *identity numbers, e-mail and phone columns are found; the shared copy is hashed or stripped while the dataset stays*, *running text in a document is found and masked*, *graph edges and node properties are scanned and masked*; `exif`: *strip leaves the picture and removes the text* |
| En pakke tar bare med diagrammer, dashbord og notatbøker for de valgte datasettene; personopplysninger i dem, i maler, skript, lagrede utdata og datasettenes navn og filnavn vises og maskeres i kopien hvis du ikke velger å beholde dem, fjerne utdata eller utelate dem | Dataminimering, GDPR art. 25 | `review`: *a bundle carries charts and notebooks of the chosen datasets only, and their personal data and names are cleaned* |
| OAuth2 mot OpenCDE: authorization code med PKCE S256, `state` og nøyaktig tilbakekallsadresse; feil `state` og nektet samtykke avvises; tokener fornyes og tilbakekalles | RFC 6749, 7636, 9700 | `opencde`: *sign in with a popup, refuse a wrong state, refresh an expiring token, sign out*; den virkelige testen C2, C7–C9 |
| Tilbakekallet fra innloggingsvinduet: via åpneren eller en BroadcastChannel med bekreftelse; et lukket vindu regnes som feil bare når appen ikke er isolert | — | `opencde VI`: *the popup flow hears the callback page through a BroadcastChannel and a storage event* |
| Forespørselsloggen maskerer hoder (Authorization med flere) og lagrer kropper bare på forespørsel, aldri for tokenkall | OWASP ASVS 7.1 | `cde-log`: *paths become APIs and operations, headers are masked, bodies only when asked and never for tokens* |
| Svar fra en grafdatabase bærer ingen lagrede hashverdier: passord-, token-, kode- og hemmelighetshasher fjernes fra noder, relasjoner, tabeller og kart før noe vises eller lagres, og Bolt-økter er alltid lesende | Dataminimering | `ifc graph`: *stored hashes never reach a table or a graph* |
| Token går bare til kildens egen server: rapporten fra serverens IFC-kontroll hentes fra en adresse appen bygger, aldri fra adressen i versjonens metadata | — | `validation`: *metadata and report from the server, the report from the app's own address, and the words in the log* |
| Adresser serveren gir ut for jobber og rapporter (kollisjonskontrollen, sammenslåingen), følges bare på samme server, og stier fra kapabilitetene godtas bare som stier; ellers bygger appen adressen selv, slik at token blir hos kildens server | — | `validation`: *the server checks for clashes like the app, makes the topics itself, and brings a building of another model in after its report* |
| En nøkkel som tjenesten vil ha i forespørselens kropp (Trafikverkets NVDB), fylles inn først når forespørselen sendes, escapes etter kroppens format og havner aldri i adressen, loggen eller kildens opplysninger | OWASP ASVS 8.3 | `geodata`: *NVDB sends its key in the XML body and a box in SWEREF 99 TM, pages with skip and opens as a map in WGS 84* |
| En nøkkel som følger med filene i et søkeresultat (Lantmäteriets STAC), sendes bare til vertene kilden angir; en fil på en annen vert hentes uten nøkkel | OWASP ASVS 8.3 | `geodata`: *Lantmäteriet STAC searches an area with the key, and Filer i källan reads the vector files in, with the key only for the file host* |
| Broen som mellomledd er av som standard og henter bare over https fra vertene brukeren starter den med, aldri fra denne datamaskinen eller det lokale nettet, med få headere og ingen informasjonskapsler, og logger aldri spørringer, headere eller kropper | OWASP ASVS 12.6 (SSRF) | `bridge`: *with the switch on, a service that refuses the browser is fetched through the bridge, and only then*; `tools/db_bridge.py` and `tools/db-bridge.ps1` tried against a real service |
| Innholdspolicyen tillater ingen innebygde skript og ingen skript utenfra; bare appens egne filer, blob-workers og WebAssembly kjører | OWASP ASVS 14.4 | the whole suite under the policy in Edge and Firefox (`tests/setup.js` writes every breach to the log) |
| Fjernstyring er av ved hver start, krever at broen er startet med `--allow-commands` og din bekreftelse for sesjonen; programmer som kjenner broens token, kjører bare appens egne kommandoer, lesende straks og skrivende etter din godkjenning i appens dialog, og køen ligger i broen på 127.0.0.1 | OWASP ASVS 4.1, 8.3, LLM06 | `remote.test.js`: *with the switch on the page registers its commands with the bridge, runs what is queued, asks before a writing command and runs a plan once* og *a bridge started without --allow-commands is told, and the switch shows the state in Internetåtkomst*; `tools/check_bridge.py` |
| En liste som serveren har kuttet, leses til ende gjennom Link rel="next", men bare på samme server, slik at token aldri går andre steder | — | `opencde`: *a list the server has capped is read to the end through Link rel="next", and only on the same server* |
| En arkivpakkes filer sammenlignes med kontrollsummene (SHA-256) i `PREMIS.xml` når pakken leses, og en endret eller manglende fil vises; et sted som peker utenfor pakken, kontrolleres ikke og leses aldri | PREMIS 3.0 | `plan files`: *an archive package, as a folder or a ZIP, opens as the plan with its documents and the check of its files* |
| Alle data som vises, escapes; ingen `innerHTML` med brukerdata; dokumenter og publiserte sider escaper | OWASP ASVS 5.3 | `published page`: *everything escaped*; `docgen`: *builders escape and structure the content*; kodekonvensjon |
| Service worker og PWA bare i servermodus; fra file:// avhenger ingenting av dem | — | localhost-steget i testmatrisen |
| Ingen hemmeligheter, personopplysninger eller opphavspersonens identitet i repoet eller historikken | — | utgivelsesskriptenes identitetskontroll før commit, `CONTRIBUTING.md` |
| En AI-leverandør kalles bare etter samtykke for verten dens (formålet ai) og etter policyen: *Bare lokal* avviser enhver vert utenfor egen datamaskin; nøkkelen ligger i api/secrets og følger aldri med i spørsmålet, loggen eller innstillingen | OWASP ASVS 8.3, 2.10 | `ai.test.js`: *providers are saved without their key, the key goes to api/secrets, and the policy Local only refuses a cloud host* |
| AI-en kan bare lese modellen: verktøyene svarer med data fra datasettets tabeller, svarene kappes og merkes som data, aldri som instruksjoner, og løkken har budsjett for steg og token og kan avbrytes | OWASP LLM01, LLM06 | `ai.test.js`: *the agent asks, runs the tool the model called, hands the result back as data and collects the elements* og *a question can be cancelled, and the budget of turns ends a loop that never answers* |
| AI-endringer gjøres aldri av AI-en: skriveverktøyene fyller et endringssett som et menneske forhåndsviser og godkjenner; sletting krever confirm fra AI-en og én bekreftelse til fra mennesket; et endringssett med skjemafeil kan ikke godkjennes; publisering, endringsforslag til serveren og godkjenning der er knapper, aldri verktøy | OWASP LLM01, LLM06, LLM08 | `ai-change.test.js`: *the write tools check each call, fill the change set with refs and refuse what the person has not asked for* og *the panel previews the candidate in 3D, approves it as a recipe step with provenance, undo restores the file exactly, and schema errors block approval*, *a previewed change set goes to Dataregium as a change proposal* |
| Bilder og tegninger følger med briefen til AI-leverandøren bare i modusen Bygg fra brief, etter samtykke for leverandørens vert og etter policyen; hvert bilde tegnes om til JPEG eller sendes uten EXIF, og bildeteksten oppgir fasade, posisjon og tid bare når du har lagt ved bildet med dem | OWASP LLM02, LLM06 | `ai-build.test.js`: *the agent asks the person, builds in groups through the write tools and says the plan; the pictures go with the brief* og *the panel in the mode Bygg ur brief shows the brief, takes attachments, and the question box answers the AI* |
| Briefen og bildene legges på modellens server bare når du trykker på *Legg grunnlaget på serveren* og har gått gjennom gjennomgangen før deling, som minner om at personer og skilt er personopplysninger og fjerner bildenes posisjon og tid i kopien, også fra filenes EXIF, med mindre du beholder dem | GDPR art. 5, 25 | `model-material.test.js`: *through the sharing review, positions and times stay out of the copy unless kept, also from the files' EXIF* |
| Funnene fra AI-panelets modus Kontroller blir saker på serveren bare når du trykker på *Opprett saker på serveren* og har gått gjennom gjennomgangen før deling; bildet følger med uten EXIF, og bildets posisjon står i saken bare hvis du beholder den | GDPR art. 5, 25 | `ai-check.test.js`: *Skapa ärenden på servern makes one topic per finding with a viewpoint on a virtual Dataregium, and sends a failed one again* |
| AI-assistenten kjører bare appens egne kommandoer, som slås opp etter navn og kontrolleres mot skjemaet sitt; en kommando som endrer noe, kjøres først når du har godkjent den i appens egen dialog, som viser kommandoen og argumentene, og et svar på et spørsmål fra AI-en godkjenner aldri noe | OWASP LLM01, LLM06, LLM08 | `commands.test.js`: *an operation needs approval unless the person runs it, is checked against its own schema and can be undone*; `assistant.test.js`: *a refused command is not run and the refusal goes back to the AI; a closed question is an answer too* |
| SQL fra en kommando kan bare lese: SQLite-workeren tar imot én setning som leser, og kjører den med databasen låst mot endringer | OWASP ASVS 5.3, LLM02 | `commands.test.js`: *SQL that only reads runs; a second statement, WITH … DELETE and DELETE are refused and change nothing* |
| Betingelser i flyter og planer leses av appen og kjøres aldri som kode, og spørsmål fra en flyt eller en AI vises bare som tekst | OWASP ASVS 5.2, LLM02 | `commands.test.js`: *comparisons, and/or/not, references to earlier answers, fill, and nothing is run as code*; `plans.test.js`: *the question shows text only and answers with the choice or an own text* |

## Personopplysninger og lagring

Hva appen lagrer, hvor, og hvor lenge. Alt ligger på datamaskinen din; ingenting sendes til appens opphavsperson, og ingen
oppdateringskontroll gjøres uten din handling. Dataregiums halvdel (hva serveren lagrer om deg) står i
[README](https://github.com/marwiss/Dataregium/blob/main/docs/nb/README.md#personopplysninger).

| Data | Hvor | Innhold | Lagres |
|---|---|---|---|
| Datasett | IndexedDB (én SQLite-fil per datasett) | det du har importert, med kolonner, kommentarer og historikk; kan inneholde personopplysninger | til du sletter dem; sikkerhetskopier og pakker er ZIP-filer der du legger dem |
| Innstillinger | IndexedDB | språk, panelbredder, tillagte kilder, samtykker, lagrede spørringer | til du sletter nettstedsdata |
| Hemmeligheter | minnet, eller IndexedDB kryptert med passfrasen din | API-nøkler, tokener; passfrasen lagres aldri | sesjonen, eller til du fjerner kilden |
| Loggen | minnet | handlinger, feil og kall med maskerte hoder | til siden lastes om |
| Kommentarenes navn | datasettets fil | navnet du selv har oppgitt | følger med i pakker, sikkerhetskopier og GitHub |
| Det du sender | hos mottakeren | datasett, filer, saker, kommentarer og brukernavnet ditt hos serveren | etter mottakerens vilkår |

## Kjente hull

- Content-Security-Policy uten innebygde skript: appens sider, mobilsiden og testsiden laster bare skript fra appens egne
  filer, blob-workers og WebAssembly. `eval` tillates fortsatt, fordi web-ifc-bygget og Vega trenger det; den delen fjernes
  når begge kan kjøre uten.
- Fra file:// i Chromium deler alle lokalt åpnede HTML-filer lagring. Hemmeligheter er kryptert, men et sensitivt arbeidsområde
  bør kjøres fra en lokal server (`python -m http.server`) eller speiles til en portabel mappe.
- Chromium anvender serverens `form-action` også på omdirigeringen etter innloggingen; serveren må tillate appens
  tilbakekallsadresse (Dataregium gjør det).

## Rapporter en sårbarhet

Ikke åpne et offentlig issue. Bruk knappen *Report a vulnerability* under Security → Advisories i repoet på GitHub, slik
[SECURITY.md](../../SECURITY.md) beskriver: versjon (under hjelpeknappen), nettleser, hva du så og hvordan det gjenskapes. Du
får en bekreftelse innen få dager og en rettelse eller en plan så snart problemet er forstått.

## Versjoner som får rettelser

Én utgivelse per hovednummer beholdes: bare den siste utgivelsen i 2-serien får rettelser. 1.0.0 beholdes til referanse
uten rettelser.
