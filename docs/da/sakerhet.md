# Sikkerhed

Sikkerheden er appens første krav. Dataspatium holder dine datasæt, API-nøgler og tokens i browseren og taler med servere
(åbne API'er, OpenCDE-servere som Dataregium) kun, når du beder om det. Politikken er den samme som Dataregiums, fordi de to
udvikles som et par og udgives med samme numre; Dataregiums halvdel findes i [README](https://github.com/marwiss/Dataregium/blob/main/docs/da/README.md#personoplysninger)
i det repo. Hvordan en sårbarhed rapporteres, står i [SECURITY.md](../../SECURITY.md).

## Trusselsmodel

**Aktiver**: dine datasæt (som kan indeholde personoplysninger), API-nøgler og tokens til servere, den adgangssætning, der
beskytter dem, det du deler med andre (pakker, filer til en server, publicerede sider) og arbejdsområdets integritet.

**Aktører**: dig selv; andre programmer på samme computer; websteder, du besøger i samme browser; de servere, du henter fra og
sender til; den, der modtager en fil, du har delt; den, der kan læse netværket mellem dig og en server.

**Tillidsgrænser**: appen kører i browserens sandkasse og når kun det, du slipper på fladen eller vælger i en dialog. Åbnet fra
en mappe (file://) deler den lagringsoprindelse med andre lokalt åbnede HTML-filer i Chromium, og derfor krypteres hemmeligheder.
Servere er fremmede: alt, de sender, behandles som data og escapes; alt, appen sender til dem, går gennem din handling og dit
samtykke pr. formål. R, Python og web-ifc kører i WebAssembly-sandkasser i workers uden adgang til computeren.

## Kontroller og de test, der viser dem

Hver kontrol har en automatisk test i `tests/` eller en henvisning til den kode, der bærer den.

| Kontrol | Standard | Test |
|---|---|---|
| Ingen netværkskald uden din handling og dit samtykke pr. formål (api, url, github, komponenter, baggrundskort, databaser, neo4j, stun, opencde); et nægtet samtykke stopper kaldet | OWASP ASVS 8.3 | `consent.test.js`: *a purpose is asked once, the answer is remembered when wanted, and a denial raises ConsentError* |
| Hemmeligheder (API-nøgler, tokens) gemmes aldrig i klartekst: kun i sessionen eller krypteret med adgangssætning (AES-GCM via WebCrypto), med låsning og oplåsning | OWASP ASVS 2.10, 6.2 | `api.test.js`: *secrets in session, encrypted persistence, lock and unlock* |
| En recept med et hemmeligt trin køres ikke igen uden dig | Dataminimering | `refresh`: *a recipe with a secret step is refused before anything is fetched* |
| Komponenter og R-pakker hentes fra fastlåste adresser efter samtykke, kontrolleres mod SHA-256 før brug og caches i IndexedDB | OWASP ASVS 14.2 | `components`: *fetched once with consent, verified against SHA-256, served from the cache afterwards, and removable* |
| Boverkets klimadatabase hentes kun, når du trykker på *Hent klimadatabasen*, efter samtykke til API-hentning fra api.boverket.se; intet om modellen sendes, og databasen gemmes i browseren med sin version | OWASP ASVS 8.3 | `climate.test.js`: *the database is fetched only on the person's action, through the preset, with consent for api.boverket.se, and kept with its version* |
| Tredjepartskode vendoreres med fastlåst version og licens og ændres aldrig i hånden | OWASP ASVS 14.2 | `tools/fetch_vendor.py`, `THIRD_PARTY_LICENSES.md`, gennemgang |
| Alt, der forlader appen, gennemgås i sin helhed: identitetsnumre, e-mail og telefon i kolonner, løbende tekst, sidetabeller, originaler, billeders position, grafers kanter, kommentarer og forfattere; behold, pseudonymisér eller fjern i kopien; datasættet ændres aldrig | Dataminimering (GDPR art. 5) | `review`: *identity numbers, e-mail and phone columns are found; the shared copy is hashed or stripped while the dataset stays*, *running text in a document is found and masked*, *graph edges and node properties are scanned and masked*; `exif`: *strip leaves the picture and removes the text* |
| En pakke tager kun diagrammer, dashboards og notesbøger med for de valgte datasæt; personoplysninger i dem, i skabeloner, scripts, gemte output og datasættenes navne og filnavne vises og maskeres i kopien, medmindre du vælger at beholde dem, fjerne output eller udelade dem | Dataminimering, GDPR art. 25 | `review`: *a bundle carries charts and notebooks of the chosen datasets only, and their personal data and names are cleaned* |
| En IFC-model gennemgås indvendigt, før den forlader appen: personer, organisationers adresser, ejerhistorik, filhovedets forfatter og organisation, aktører og beboere samt e-mail og identitetsnumre i fritekst; hver del beholdes, pseudonymiseres eller fjernes i kopien af IfcOpenShell, uden Python kun behold eller afbryd; det gælder alle veje ud, og datasættet ændres aldrig | Dataminimering, GDPR art. 25 | `review-ifc.test.js`: *the people, addresses, owner history, header, actors and free text inside a model are found, and only kept without Python*, *the copy is cleaned through the wheel first, its tables are built from the cleaned file, a bundle carries it, and the dataset stays*, *IfcOpenShell removes and pseudonymises every part in the copy, with the codes of dm_hash, and keeps the GlobalIds* |
| OAuth2 mod OpenCDE: authorization code med PKCE S256, `state` og nøjagtig tilbagekaldsadresse; forkert `state` og nægtet samtykke afvises; tokens fornys og tilbagekaldes | RFC 6749, 7636, 9700 | `opencde`: *sign in with a popup, refuse a wrong state, refresh an expiring token, sign out*; den rigtige test C2, C7–C9 |
| Tilbagekaldet fra loginvinduet: via åbneren eller en BroadcastChannel med bekræftelse; et lukket vindue regnes som fejl kun, når appen ikke er isoleret | — | `opencde VI`: *the popup flow hears the callback page through a BroadcastChannel and a storage event* |
| Forespørgselsloggen maskerer headere (Authorization med flere) og gemmer kroppe kun på anmodning, aldrig for tokenkald | OWASP ASVS 7.1 | `cde-log`: *paths become APIs and operations, headers are masked, bodies only when asked and never for tokens* |
| Svar fra en grafdatabase bærer ingen lagrede hashværdier: adgangskode-, token-, kode- og hemmelighedshashes fjernes fra knuder, relationer, tabeller og kort, før noget vises eller gemmes, og Bolt-sessioner er altid læsende | Dataminimering | `ifc graph`: *stored hashes never reach a table or a graph* |
| Token sendes kun til kildens egen server: rapporten fra serverens IFC-kontrol hentes fra en adresse, appen bygger, aldrig fra adressen i versionens metadata | — | `validation`: *metadata and report from the server, the report from the app's own address, and the words in the log* |
| Adresser, som serveren udleverer for job og rapporter (kollisionskontrollen, sammenlægningen), følges kun på samme server, og stier fra kapabiliteterne godtages kun som stier; ellers bygger appen adressen selv, så token bliver hos kildens server | — | `validation`: *the server checks for clashes like the app, makes the topics itself, and brings a building of another model in after its report* |
| En nøgle, som tjenesten vil have i forespørgslens krop (Trafikverkets NVDB), udfyldes først, når forespørgslen sendes, escapes efter kroppens format og havner aldrig i adressen, loggen eller kildens oplysninger | OWASP ASVS 8.3 | `geodata`: *NVDB sends its key in the XML body and a box in SWEREF 99 TM, pages with skip and opens as a map in WGS 84* |
| Ortofotos som baggrundskort hentes først, når du vælger et, efter samtykke til baggrundskort med tjenestens vært i spørgsmålet (`gis.natt.is`, `wms.datafordeler.dk`, `avoin-karttakuva.maanmittauslaitos.fi`); en nøgle (Danmark, Finland) ligger i `api/secrets`, sendes kun i billedadresserne til sin egen tjeneste og havner aldrig i samtykkespørgsmålet, den gemte kortvisning eller publiceret HTML | OWASP ASVS 8.3 | `orthophoto.test.js`: *the consent for background maps is asked on first use with the host named, a refusal leaves the map without tiles, and each grid gets its own source*, *a key stays in the session: without it nothing is asked or fetched, with it it goes only into the image addresses, never into the consent, the saved map or published HTML* |
| En nøgle, der følger med filerne i et søgeresultat (Lantmäteriets STAC), sendes kun til de værter, kilden angiver; en fil på en anden vært hentes uden nøgle | OWASP ASVS 8.3 | `geodata`: *Lantmäteriet STAC searches an area with the key, and Filer i källan reads the vector files in, with the key only for the file host* |
| Broen som mellemled er slået fra som standard og henter kun over https fra de værter, brugeren starter den med, aldrig fra denne computer eller det lokale net, med få headere og ingen cookies, og logger aldrig forespørgsler, headere eller kroppe | OWASP ASVS 12.6 (SSRF) | `bridge`: *with the switch on, a service that refuses the browser is fetched through the bridge, and only then*; `tools/db_bridge.py` and `tools/db-bridge.ps1` tried against a real service |
| Indholdspolitikken tillader ingen indlejrede scripts og ingen scripts udefra; kun appens egne filer, blob-workers og WebAssembly kører | OWASP ASVS 14.4 | the whole suite under the policy in Edge and Firefox (`tests/setup.js` writes every breach to the log) |
| Fjernstyring er slået fra ved hver start, kræver, at broen er startet med `--allow-commands`, og din bekræftelse for sessionen; programmer, der kender broens token, kører kun appens egne kommandoer, læsende straks og skrivende efter din godkendelse i appens dialog, og køen ligger i broen på 127.0.0.1 | OWASP ASVS 4.1, 8.3, LLM06 | `remote.test.js`: *with the switch on the page registers its commands with the bridge, runs what is queued, asks before a writing command and runs a plan once* og *a bridge started without --allow-commands is told, and the switch shows the state in Internetåtkomst*; `tools/check_bridge.py` |
| En liste, som serveren har afkortet, læses til ende gennem Link rel="next", men kun på samme server, så token aldrig sendes andre steder hen | — | `opencde`: *a list the server has capped is read to the end through Link rel="next", and only on the same server* |
| En arkivpakkes filer sammenlignes med kontrolsummerne (SHA-256) i `PREMIS.xml`, når pakken læses, og en ændret eller manglende fil vises; et sted der peger uden for pakken, kontrolleres ikke og læses aldrig | PREMIS 3.0 | `plan files`: *an archive package, as a folder or a ZIP, opens as the plan with its documents and the check of its files* |
| Alle data, der vises, escapes; ingen `innerHTML` med brugerdata; dokumenter og publicerede sider escaper | OWASP ASVS 5.3 | `published page`: *everything escaped*; `docgen`: *builders escape and structure the content*; kodekonvention |
| Service worker og PWA kun i servertilstand; fra file:// afhænger intet af dem | — | localhost-trinnet i testmatricen |
| Ingen hemmeligheder, personoplysninger eller ophavspersonens identitet i repoet eller dets historik | — | udgivelsesscriptenes identitetskontrol før commit, `CONTRIBUTING.md` |
| En AI-udbyder kaldes kun efter samtykke til dens vært (formålet ai) og efter politikken: *Kun lokal* afviser enhver vært uden for egen computer; nøglen ligger i api/secrets og følger aldrig med i spørgsmålet, loggen eller indstillingen | OWASP ASVS 8.3, 2.10 | `ai.test.js`: *providers are saved without their key, the key goes to api/secrets, and the policy Local only refuses a cloud host* |
| AI'en kan kun læse modellen: værktøjerne svarer med data fra datasættets tabeller, svarene kappes og mærkes som data, aldrig som instruktioner, og løkken har budget for trin og tokens og kan afbrydes | OWASP LLM01, LLM06 | `ai.test.js`: *the agent asks, runs the tool the model called, hands the result back as data and collects the elements* og *a question can be cancelled, and the budget of turns ends a loop that never answers* |
| AI-ændringer udføres aldrig af AI'en: skriveværktøjerne fylder et ændringssæt, som et menneske forhåndsviser og godkender; sletning kræver confirm fra AI'en og endnu en bekræftelse fra mennesket; et ændringssæt med skemafejl kan ikke godkendes; publicering, ændringsforslag til serveren og godkendelse dér er knapper, aldrig værktøjer | OWASP LLM01, LLM06, LLM08 | `ai-change.test.js`: *the write tools check each call, fill the change set with refs and refuse what the person has not asked for* og *the panel previews the candidate in 3D, approves it as a recipe step with provenance, undo restores the file exactly, and schema errors block approval*, *a previewed change set goes to Dataregium as a change proposal* |
| Billeder og tegninger følger med opgavebeskrivelsen til AI-leverandøren kun i tilstanden Byg ud fra beskrivelse, efter samtykke for leverandørens vært og efter politikken; hvert billede tegnes om til JPEG eller sendes uden EXIF, og billedteksten angiver facade, position og tid kun når du har vedhæftet billedet med dem | OWASP LLM02, LLM06 | `ai-build.test.js`: *the agent asks the person, builds in groups through the write tools and says the plan; the pictures go with the brief* og *the panel in the mode Bygg ur brief shows the brief, takes attachments, and the question box answers the AI* |
| Opgavebeskrivelsen og billederne lægges på modellens server kun når du trykker på *Læg grundlaget på serveren* og har været igennem gennemgangen før deling, som minder om at personer og nummerplader er personoplysninger og fjerner billedernes position og tid i kopien, også fra filernes EXIF, medmindre du beholder dem | GDPR art. 5, 25 | `model-material.test.js`: *through the sharing review, positions and times stay out of the copy unless kept, also from the files' EXIF* |
| En IFC-fil, som appen skriver, får kun et personnavn i hovedet (forfatter, organisation), når du selv udfylder det i formularen *Ny bygningsmodel*; ellers er felterne tomme, og en fil, appen ændrer, beholder sit eget hoved | GDPR art. 5, 25 | `ai-names.test.js`: *Python writes the designations, the Axis context and the header in a new IFC4X3 model*, *… and the header kept* |
| Fundene fra AI-panelets tilstand Kontrollér bliver sager på serveren kun når du trykker på *Opret sager på serveren* og har været igennem gennemgangen før deling; fotoet følger med uden EXIF, og fotoets position står i sagen kun hvis du beholder den | GDPR art. 5, 25 | `ai-check.test.js`: *Skapa ärenden på servern makes one topic per finding with a viewpoint on a virtual Dataregium, and sends a failed one again* |
| AI-assistenten kører kun appens egne kommandoer, som slås op efter navn og kontrolleres mod deres skema; en kommando, der ændrer noget, køres først, når du har godkendt den i appens egen dialog, som viser kommandoen og argumenterne, og et svar på et spørgsmål fra AI'en godkender aldrig noget | OWASP LLM01, LLM06, LLM08 | `commands.test.js`: *an operation needs approval unless the person runs it, is checked against its own schema and can be undone*; `assistant.test.js`: *a refused command is not run and the refusal goes back to the AI; a closed question is an answer too* |
| SQL fra en kommando må kun læse: SQLite-workeren tager imod én sætning, der læser, og kører den med databasen låst mod ændringer | OWASP ASVS 5.3, LLM02 | `commands.test.js`: *SQL that only reads runs; a second statement, WITH … DELETE and DELETE are refused and change nothing* |
| Betingelser i flows og planer læses af appen og køres aldrig som kode, og spørgsmål fra et flow eller en AI vises kun som tekst | OWASP ASVS 5.2, LLM02 | `commands.test.js`: *comparisons, and/or/not, references to earlier answers, fill, and nothing is run as code*; `plans.test.js`: *the question shows text only and answers with the choice or an own text* |

## Personoplysninger og opbevaring

Hvad appen gemmer, hvor, og hvor længe. Alt ligger på din computer; intet sendes til appens ophavsperson, og ingen
opdateringskontrol sker uden din handling. Dataregiums halvdel (hvad serveren gemmer om dig) står i
[README](https://github.com/marwiss/Dataregium/blob/main/docs/da/README.md#personoplysninger).

| Data | Hvor | Indhold | Gemmes |
|---|---|---|---|
| Datasæt | IndexedDB (en SQLite-fil pr. datasæt) | det, du har importeret, med kolonner, kommentarer og historik; kan indeholde personoplysninger | indtil du sletter dem; sikkerhedskopier og pakker er ZIP-filer, hvor du lægger dem |
| Indstillinger | IndexedDB | sprog, panelbredder, tilføjede kilder, samtykker, gemte forespørgsler | indtil du rydder webstedsdata |
| Hemmeligheder | hukommelsen, eller IndexedDB krypteret med din adgangssætning | API-nøgler, tokens; adgangssætningen gemmes aldrig | sessionen, eller indtil du fjerner kilden |
| Loggen | hukommelsen | handlinger, fejl og kald med maskerede headere | indtil siden genindlæses |
| Kommentarernes navne | datasættets fil | det navn, du selv har angivet | følger med i pakker, sikkerhedskopier og GitHub |
| Forfatter og organisation i IFC-filens hoved | modellens IFC-fil i datasættet | det, du selv har angivet, da modellen blev oprettet | følger med filen ved eksport, deling og publicering |
| Det, du sender | hos modtageren | datasæt, filer, sager, kommentarer og dit brugernavn hos serveren | efter modtagerens vilkår |

## Kendte huller

- Content-Security-Policy uden indlejrede scripts: appens sider, mobilsiden og testsiden indlæser kun scripts fra appens egne
  filer, blob-workers og WebAssembly. `eval` tillades stadig, fordi web-ifc’s bygning og Vega har brug for det; den del
  fjernes, når begge kan køre uden.
- Fra file:// i Chromium deler alle lokalt åbnede HTML-filer lagring. Hemmeligheder er krypteret, men et følsomt arbejdsområde
  bør køres fra en lokal server (`python -m http.server`) eller spejles til en portabel mappe.
- Chromium anvender serverens `form-action` også på omdirigeringen efter login; serveren skal tillade appens tilbagekaldsadresse
  (Dataregium gør det).

## Rapportér en sårbarhed

Åbn intet offentligt issue. Brug knappen *Report a vulnerability* under Security → Advisories i repoet på GitHub, som
[SECURITY.md](../../SECURITY.md) beskriver: version (under hjælpeknappen), browser, hvad du så, og hvordan det genskabes. Du får
en bekræftelse inden for få dage og en rettelse eller en plan, så snart problemet er forstået.

## Versioner, der får rettelser

Én udgivelse pr. hovednummer beholdes: kun den seneste udgivelse i 2-serien får rettelser. 1.0.0 beholdes til reference
uden rettelser.
