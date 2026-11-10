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
| Tredjepartskode vendoreres med låst versjon og lisens og endres aldri for hånd | OWASP ASVS 14.2 | `tools/fetch_vendor.py`, `THIRD_PARTY_LICENSES.md`, gjennomgang |
| Alt som forlater appen, gjennomgås i sin helhet: identitetsnumre, e-post og telefon i kolonner, løpende tekst, sidetabeller, originaler, bilders posisjon, grafers kanter, kommentarer og forfattere; behold, pseudonymiser eller fjern i kopien; datasettet endres aldri | Dataminimering (GDPR art. 5) | `review`: *identity numbers, e-mail and phone columns are found; the shared copy is hashed or stripped while the dataset stays*, *running text in a document is found and masked*, *graph edges and node properties are scanned and masked*; `exif`: *strip leaves the picture and removes the text* |
| En pakke tar bare med diagrammer, dashbord og notatbøker for de valgte datasettene; personopplysninger i dem, i maler, skript, lagrede utdata og datasettenes navn og filnavn vises og maskeres i kopien hvis du ikke velger å beholde dem, fjerne utdata eller utelate dem | Dataminimering, GDPR art. 25 | `review`: *a bundle carries charts and notebooks of the chosen datasets only, and their personal data and names are cleaned* |
| OAuth2 mot OpenCDE: authorization code med PKCE S256, `state` og nøyaktig tilbakekallsadresse; feil `state` og nektet samtykke avvises; tokener fornyes og tilbakekalles | RFC 6749, 7636, 9700 | `opencde`: *sign in with a popup, refuse a wrong state, refresh an expiring token, sign out*; den virkelige testen C2, C7–C9 |
| Tilbakekallet fra innloggingsvinduet: via åpneren eller en BroadcastChannel med bekreftelse; et lukket vindu regnes som feil bare når appen ikke er isolert | — | `opencde VI`: *the popup flow hears the callback page through a BroadcastChannel and a storage event* |
| Forespørselsloggen maskerer hoder (Authorization med flere) og lagrer kropper bare på forespørsel, aldri for tokenkall | OWASP ASVS 7.1 | `cde-log`: *paths become APIs and operations, headers are masked, bodies only when asked and never for tokens* |
| Svar fra en grafdatabase bærer ingen lagrede hashverdier: passord-, token-, kode- og hemmelighetshasher fjernes fra noder, relasjoner, tabeller og kart før noe vises eller lagres, og Bolt-økter er alltid lesende | Dataminimering | `ifc graph`: *stored hashes never reach a table or a graph* |
| Token går bare til kildens egen server: rapporten fra serverens IFC-kontroll hentes fra en adresse appen bygger, aldri fra adressen i versjonens metadata | — | `validation`: *metadata and report from the server, the report from the app's own address, and the words in the log* |
| En arkivpakkes filer sammenlignes med kontrollsummene (SHA-256) i `PREMIS.xml` når pakken leses, og en endret eller manglende fil vises; et sted som peker utenfor pakken, kontrolleres ikke og leses aldri | PREMIS 3.0 | `plan files`: *an archive package, as a folder or a ZIP, opens as the plan with its documents and the check of its files* |
| Alle data som vises, escapes; ingen `innerHTML` med brukerdata; dokumenter og publiserte sider escaper | OWASP ASVS 5.3 | `published page`: *everything escaped*; `docgen`: *builders escape and structure the content*; kodekonvensjon |
| Service worker og PWA bare i servermodus; fra file:// avhenger ingenting av dem | — | localhost-steget i testmatrisen |
| Ingen hemmeligheter, personopplysninger eller opphavspersonens identitet i repoet eller historikken | — | utgivelsesskriptenes identitetskontroll før commit, `CONTRIBUTING.md` |
| En AI-leverandør kalles bare etter samtykke for verten dens (formålet ai) og etter policyen: *Bare lokal* avviser enhver vert utenfor egen datamaskin; nøkkelen ligger i api/secrets og følger aldri med i spørsmålet, loggen eller innstillingen | OWASP ASVS 8.3, 2.10 | `ai.test.js`: *providers are saved without their key, the key goes to api/secrets, and the policy Local only refuses a cloud host* |
| AI-en kan bare lese modellen: verktøyene svarer med data fra datasettets tabeller, svarene kappes og merkes som data, aldri som instruksjoner, og løkken har budsjett for steg og token og kan avbrytes | OWASP LLM01, LLM06 | `ai.test.js`: *the agent asks, runs the tool the model called, hands the result back as data and collects the elements* og *a question can be cancelled, and the budget of turns ends a loop that never answers* |
| AI-endringer gjøres aldri av AI-en: skriveverktøyene fyller et endringssett som et menneske forhåndsviser og godkjenner; sletting krever confirm fra AI-en og én bekreftelse til fra mennesket; et endringssett med skjemafeil kan ikke godkjennes; publisering, endringsforslag til serveren og godkjenning der er knapper, aldri verktøy | OWASP LLM01, LLM06, LLM08 | `ai-change.test.js`: *the write tools check each call, fill the change set with refs and refuse what the person has not asked for* og *the panel previews the candidate in 3D, approves it as a recipe step with provenance, undo restores the file exactly, and schema errors block approval*, *a previewed change set goes to Dataregium as a change proposal* |

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

- Ingen Content-Security-Policy enda: appen kjører klassiske skript, blob-workers og WebAssembly, og web-ifc-bygget krever
  `eval`. En meta-CSP uten `'unsafe-eval'` legges til når web-ifc kan lastes uten den.
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
