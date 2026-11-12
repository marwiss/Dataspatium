# Tryggleik

Tryggleiken er det første kravet til appen. Dataspatium held datasetta, API-nøklane og tokena dine i nettlesaren og snakkar med
tenarar (opne API-ar, OpenCDE-tenarar som Dataregium) berre når du ber om det. Policyen er den same som Dataregiums, sidan dei to
blir utvikla som eit par og sleppte med same nummer; Dataregiums halvdel ligg i [README](https://github.com/marwiss/Dataregium/blob/main/docs/nn/README.md#personopplysningar)
i det repoet. Korleis ei sårbarheit blir rapportert, står i [SECURITY.md](../../SECURITY.md).

## Trugsmålsmodell

**Verdiar**: datasetta dine (som kan innehalde personopplysningar), API-nøklar og token til tenarar, passfrasen som vernar
dei, det du deler med andre (pakkar, filer til ein tenar, publiserte sider) og integriteten til arbeidsområdet.

**Aktørar**: du sjølv; andre program på same datamaskin; nettstader du besøkjer i same nettlesar; tenarane du hentar frå og
sender til; den som får ei fil du har delt; den som kan lese nettverket mellom deg og ein tenar.

**Tillitsgrenser**: appen køyrer i sandkassa til nettlesaren og når berre det du slepper på flata eller vel i ein dialog. Opna
frå ei mappe (file://) deler han lagringsopphav med andre lokalt opna HTML-filer i Chromium, og difor blir løyndomar krypterte.
Tenarar er framande: alt dei sender, blir handsama som data og escapa; alt appen sender til dei, går gjennom di handling og
ditt samtykke per føremål. R, Python og web-ifc køyrer i WebAssembly-sandkasser i workers utan tilgang til datamaskina.

## Kontrollar og prova som viser dei

Kvar kontroll har eit automatisk prov i `tests/` eller ein peikar til koden som ber han.

| Kontroll | Standard | Prov |
|---|---|---|
| Ingen nettverkskall utan di handling og ditt samtykke per føremål (api, url, github, komponentar, bakgrunnskart, databasar, neo4j, stun, opencde); eit nekta samtykke stoppar kallet | OWASP ASVS 8.3 | `consent.test.js`: *a purpose is asked once, the answer is remembered when wanted, and a denial raises ConsentError* |
| Løyndomar (API-nøklar, token) blir aldri lagra i klartekst: berre i sesjonen eller krypterte med passfrase (AES-GCM via WebCrypto), med låsing og opplåsing | OWASP ASVS 2.10, 6.2 | `api.test.js`: *secrets in session, encrypted persistence, lock and unlock* |
| Ei oppskrift med eit løynd steg blir ikkje køyrd om att utan deg | Dataminimering | `refresh`: *a recipe with a secret step is refused before anything is fetched* |
| Komponentar og R-pakkar blir henta frå låste adresser etter samtykke, kontrollerte mot SHA-256 før bruk og cacha i IndexedDB | OWASP ASVS 14.2 | `components`: *fetched once with consent, verified against SHA-256, served from the cache afterwards, and removable* |
| Klimadatabasen til Boverket blir henta berre når du trykkjer på *Hent klimadatabasen*, etter samtykke til API-henting frå api.boverket.se; ingenting om modellen blir sendt, og databasen blir lagra i nettlesaren med versjonen sin | OWASP ASVS 8.3 | `climate.test.js`: *the database is fetched only on the person's action, through the preset, with consent for api.boverket.se, and kept with its version* |
| Tredjepartskode blir vendora med låst versjon og lisens og aldri endra for hand | OWASP ASVS 14.2 | `tools/fetch_vendor.py`, `THIRD_PARTY_LICENSES.md`, gjennomgang |
| Alt som forlèt appen, blir gått gjennom i sin heilskap: identitetsnummer, e-post og telefon i kolonnar, løpande tekst, sidetabellar, originalar, posisjonen til bilete, kantane til grafar, kommentarar og forfattarar; hald på, pseudonymiser eller fjern i kopien; datasettet blir aldri endra | Dataminimering (GDPR art. 5) | `review`: *identity numbers, e-mail and phone columns are found; the shared copy is hashed or stripped while the dataset stays*, *running text in a document is found and masked*, *graph edges and node properties are scanned and masked*; `exif`: *strip leaves the picture and removes the text* |
| Ein pakke tek berre med diagram, dashbord og notatbøker for dei valde datasetta; personopplysningar i dei, i malar, skript, lagra utdata og namn og filnamn på datasetta blir viste og maskerte i kopien om du ikkje vel å behalde dei, fjerne utdata eller utelate dei | Dataminimering, GDPR art. 25 | `review`: *a bundle carries charts and notebooks of the chosen datasets only, and their personal data and names are cleaned* |
| Ein IFC-modell blir gjennomgått innvendig før han forlèt appen: personar, adressene til organisasjonar, eigarhistorikk, forfattar og organisasjon i filhovudet, aktørar og bebuarar og e-post og identitetsnummer i fritekst; kvar del blir halden på, pseudonymisert eller fjerna i kopien av IfcOpenShell, utan Python berre hald på eller avbryt; det gjeld alle vegar ut, og datasettet blir aldri endra | Dataminimering, GDPR art. 25 | `review-ifc.test.js`: *the people, addresses, owner history, header, actors and free text inside a model are found, and only kept without Python*, *the copy is cleaned through the wheel first, its tables are built from the cleaned file, a bundle carries it, and the dataset stays*, *IfcOpenShell removes and pseudonymises every part in the copy, with the codes of dm_hash, and keeps the GlobalIds* |
| OAuth2 mot OpenCDE: authorization code med PKCE S256, `state` og nøyaktig tilbakekallsadresse; feil `state` og nekta samtykke blir avviste; token blir fornya og kalla tilbake | RFC 6749, 7636, 9700 | `opencde`: *sign in with a popup, refuse a wrong state, refresh an expiring token, sign out*; det verkelege provet C2, C7–C9 |
| Tilbakekallet frå innloggingsvindauget: via opnaren eller ein BroadcastChannel med stadfesting; eit stengt vindauge blir rekna som feil berre når appen ikkje er isolert | — | `opencde VI`: *the popup flow hears the callback page through a BroadcastChannel and a storage event* |
| Førespurnadsloggen maskerer hovud (Authorization med fleire) og lagrar kroppar berre på førespurnad, aldri for tokenkall | OWASP ASVS 7.1 | `cde-log`: *paths become APIs and operations, headers are masked, bodies only when asked and never for tokens* |
| Svar frå ein grafdatabase ber ingen lagra hashverdiar: passord-, token-, kode- og løyndomshashar blir fjerna frå nodar, relasjonar, tabellar og kart før noko blir vist eller lagra, og Bolt-økter er alltid lesande | Dataminimering | `ifc graph`: *stored hashes never reach a table or a graph* |
| Token går berre til den eigne tenaren til kjelda: rapporten frå IFC-kontrollen til tenaren blir henta frå ei adresse appen byggjer, aldri frå adressa i metadataa til versjonen | — | `validation`: *metadata and report from the server, the report from the app's own address, and the words in the log* |
| Adresser tenaren gjev ut for jobbar og rapportar (kollisjonskontrollen, samanslåinga), blir berre følgde på same tenar, og stiar frå kapabilitetane blir berre godtekne som stiar; elles byggjer appen adressa sjølv, slik at token blir verande hos tenaren til kjelda | — | `validation`: *the server checks for clashes like the app, makes the topics itself, and brings a building of another model in after its report* |
| Ein nøkkel som tenesta vil ha i kroppen i førespurnaden (Trafikverkets NVDB), blir fylt inn først når førespurnaden blir send, blir escapa etter formatet til kroppen og hamnar aldri i adressa, loggen eller opplysningane om kjelda | OWASP ASVS 8.3 | `geodata`: *NVDB sends its key in the XML body and a box in SWEREF 99 TM, pages with skip and opens as a map in WGS 84* |
| Ortofoto som bakgrunnskart blir henta først når du vel eitt, etter samtykke til bakgrunnskart med verten til tenesta i spørsmålet (`gis.natt.is`, `wms.datafordeler.dk`, `avoin-karttakuva.maanmittauslaitos.fi`); ein nøkkel (Danmark, Finland) ligg i `api/secrets`, blir berre send i biletadressene til si eiga teneste og hamnar aldri i samtykkespørsmålet, den lagra kartvisinga eller publisert HTML | OWASP ASVS 8.3 | `orthophoto.test.js`: *the consent for background maps is asked on first use with the host named, a refusal leaves the map without tiles, and each grid gets its own source*, *a key stays in the session: without it nothing is asked or fetched, with it it goes only into the image addresses, never into the consent, the saved map or published HTML* |
| Ein nøkkel som følgjer med filene i eit søkjeresultat (Lantmäteriets STAC), blir berre send til vertane kjelda gjev; ei fil på ein annan vert blir henta utan nøkkel | OWASP ASVS 8.3 | `geodata`: *Lantmäteriet STAC searches an area with the key, and Filer i källan reads the vector files in, with the key only for the file host* |
| Brua som mellomledd er av som standard og hentar berre over https frå vertane brukaren startar ho med, aldri frå denne datamaskina eller det lokale nettet, med få headerar og ingen informasjonskapslar, og loggar aldri spørjingar, headerar eller kroppar | OWASP ASVS 12.6 (SSRF) | `bridge`: *with the switch on, a service that refuses the browser is fetched through the bridge, and only then*; `tools/db_bridge.py` and `tools/db-bridge.ps1` tried against a real service |
| Innhaldspolicyen tillèt ingen innebygde skript og ingen skript utanfrå; berre filene til appen, blob-workers og WebAssembly køyrer | OWASP ASVS 14.4 | the whole suite under the policy in Edge and Firefox (`tests/setup.js` writes every breach to the log) |
| Fjernstyring er av ved kvar start, krev at brua er starta med `--allow-commands` og stadfestinga di for sesjonen; program som kjenner tokenet til brua, køyrer berre dei eigne kommandoane i appen, lesande straks og skrivande etter godkjenninga di i dialogen i appen, og køen ligg i brua på 127.0.0.1 | OWASP ASVS 4.1, 8.3, LLM06 | `remote.test.js`: *with the switch on the page registers its commands with the bridge, runs what is queued, asks before a writing command and runs a plan once* og *a bridge started without --allow-commands is told, and the switch shows the state in Internetåtkomst*; `tools/check_bridge.py` |
| Ei liste som tenaren har korta av, blir lesen til endes gjennom Link rel="next", men berre på same tenar, slik at token aldri går andre stader | — | `opencde`: *a list the server has capped is read to the end through Link rel="next", and only on the same server* |
| Filene i ei arkivpakke blir samanlikna med kontrollsummane (SHA-256) i `PREMIS.xml` når pakken blir lesen, og ei endra eller manglande fil blir vist; ein stad som peikar utanfor pakken, blir ikkje kontrollert og aldri lesen | PREMIS 3.0 | `plan files`: *an archive package, as a folder or a ZIP, opens as the plan with its documents and the check of its files* |
| Alle data som blir viste, blir escapa; ingen `innerHTML` med brukardata; dokument og publiserte sider escapar | OWASP ASVS 5.3 | `published page`: *everything escaped*; `docgen`: *builders escape and structure the content*; kodekonvensjon |
| Service worker og PWA berre i tenarmodus; frå file:// er ingenting avhengig av dei | — | localhost-steget i testmatrisa |
| Ingen løyndomar, personopplysningar eller identiteten til opphavspersonen i repoet eller historikken | — | identitetskontrollen i utgjevingsskripta før commit, `CONTRIBUTING.md` |
| Ein AI-leverandør blir berre kalla etter samtykke for verten sin (føremålet ai) og etter policyen: *Berre lokal* avviser kvar vert utanfor eiga datamaskin; nøkkelen ligg i api/secrets og følgjer aldri med i spørsmålet, loggen eller innstillinga | OWASP ASVS 8.3, 2.10 | `ai.test.js`: *providers are saved without their key, the key goes to api/secrets, and the policy Local only refuses a cloud host* |
| AI-en kan berre lese modellen: verktøya svarar med data frå tabellane i datasettet, svara blir kappa og merkte som data, aldri som instruksjonar, og løkka har budsjett for steg og token og kan avbrytast | OWASP LLM01, LLM06 | `ai.test.js`: *the agent asks, runs the tool the model called, hands the result back as data and collects the elements* og *a question can be cancelled, and the budget of turns ends a loop that never answers* |
| AI-endringar vert aldri gjorde av AI-en: skriveverktøya fyller eit endringssett som eit menneske førehandsviser og godkjenner; sletting krev confirm frå AI-en og éi stadfesting til frå mennesket; eit endringssett med skjemafeil kan ikkje godkjennast; publisering, endringsframlegg til tenaren og godkjenning der er knappar, aldri verktøy | OWASP LLM01, LLM06, LLM08 | `ai-change.test.js`: *the write tools check each call, fill the change set with refs and refuse what the person has not asked for* og *the panel previews the candidate in 3D, approves it as a recipe step with provenance, undo restores the file exactly, and schema errors block approval*, *a previewed change set goes to Dataregium as a change proposal* |
| Bilete og teikningar følgjer med oppdragsskildringa til AI-leverandøren berre i modusen Bygg frå skildring, etter samtykke for verten til leverandøren og etter policyen; kvart bilete vert teikna om til JPEG eller sendt utan EXIF, og biletteksten oppgjev fasade, posisjon og tid berre når du har lagt ved biletet med dei | OWASP LLM02, LLM06 | `ai-build.test.js`: *the agent asks the person, builds in groups through the write tools and says the plan; the pictures go with the brief* og *the panel in the mode Bygg ur brief shows the brief, takes attachments, and the question box answers the AI* |
| Oppdragsskildringa og bileta vert lagde på tenaren til modellen berre når du trykkjer på *Legg grunnlaget på tenaren* og har gått gjennom gjennomgangen før deling, som minner om at personar og skilt er personopplysningar og fjernar posisjonen og tida til bileta i kopien, òg frå EXIF i filene, om du ikkje beheld dei | GDPR art. 5, 25 | `model-material.test.js`: *through the sharing review, positions and times stay out of the copy unless kept, also from the files' EXIF* |
| Ei IFC-fil som appen skriv, får eit personnamn i hovudet (forfattar, organisasjon) berre når du sjølv fyller det ut i skjemaet *Ny bygningsmodell*; elles er felta tomme, og ei fil appen endrar, held på sitt eige hovud | GDPR art. 5, 25 | `ai-names.test.js`: *Python writes the designations, the Axis context and the header in a new IFC4X3 model*, *… and the header kept* |
| Funna frå modusen Kontroller i AI-panelet vert saker på tenaren berre når du trykkjer på *Opprett saker på tenaren* og har gått gjennom gjennomgangen før deling; biletet følgjer med utan EXIF, og posisjonen til biletet står i saka berre om du beheld han | GDPR art. 5, 25 | `ai-check.test.js`: *Skapa ärenden på servern makes one topic per finding with a viewpoint on a virtual Dataregium, and sends a failed one again* |
| AI-assistenten køyrer berre dei eigne kommandoane i appen, som vert slått opp etter namn og kontrollerte mot skjemaet sitt; ein kommando som endrar noko, vert køyrd først når du har godkjent han i den eigne dialogen i appen, som viser kommandoen og argumenta, og eit svar på eit spørsmål frå AI-en godkjenner aldri noko | OWASP LLM01, LLM06, LLM08 | `commands.test.js`: *an operation needs approval unless the person runs it, is checked against its own schema and can be undone*; `assistant.test.js`: *a refused command is not run and the refusal goes back to the AI; a closed question is an answer too* |
| SQL frå ein kommando kan berre lese: SQLite-workeren tek imot éi setning som les, og køyrer ho med databasen låst mot endringar | OWASP ASVS 5.3, LLM02 | `commands.test.js`: *SQL that only reads runs; a second statement, WITH … DELETE and DELETE are refused and change nothing* |
| Vilkår i flytar og planar vert lesne av appen og aldri køyrde som kode, og spørsmål frå ein flyt eller ein AI vert viste berre som tekst | OWASP ASVS 5.2, LLM02 | `commands.test.js`: *comparisons, and/or/not, references to earlier answers, fill, and nothing is run as code*; `plans.test.js`: *the question shows text only and answers with the choice or an own text* |

## Personopplysningar og lagring

Kva appen lagrar, kvar, og kor lenge. Alt ligg på datamaskina di; ingenting blir sendt til opphavspersonen til appen, og ingen
oppdateringskontroll blir gjord utan di handling. Dataregiums halvdel (kva tenaren lagrar om deg) står i
[README](https://github.com/marwiss/Dataregium/blob/main/docs/nn/README.md#personopplysningar).

| Data | Kvar | Innhald | Blir lagra |
|---|---|---|---|
| Datasett | IndexedDB (éi SQLite-fil per datasett) | det du har importert, med kolonnar, kommentarar og historikk; kan innehalde personopplysningar | til du slettar dei; tryggingskopiar og pakkar er ZIP-filer der du legg dei |
| Innstillingar | IndexedDB | språk, panelbreidder, tillagde kjelder, samtykke, lagra spørjingar | til du slettar nettstaddata |
| Løyndomar | minnet, eller IndexedDB kryptert med passfrasen din | API-nøklar, token; passfrasen blir aldri lagra | sesjonen, eller til du fjernar kjelda |
| Loggen | minnet | handlingar, feil og kall med maskerte hovud | til sida blir lasta om |
| Namna på kommentarane | fila til datasettet | namnet du sjølv har oppgjeve | følgjer med i pakkar, tryggingskopiar og GitHub |
| Forfattar og organisasjon i hovudet til IFC-fila | IFC-fila til modellen i datasettet | det du sjølv har oppgjeve då modellen vart laga | følgjer med fila ved eksport, deling og publisering |
| Det du sender | hos mottakaren | datasett, filer, saker, kommentarar og brukarnamnet ditt hos tenaren | etter vilkåra til mottakaren |

## Kjende hol

- Content-Security-Policy utan innebygde skript: sidene til appen, mobilsida og testsida lastar berre skript frå filene til
  appen, blob-workers og WebAssembly. `eval` er framleis tillate, fordi web-ifc-bygget og Vega treng det; den delen blir
  fjerna når begge kan køyre utan.
- Frå file:// i Chromium deler alle lokalt opna HTML-filer lagring. Løyndomar er krypterte, men eit sensitivt arbeidsområde bør
  køyrast frå ein lokal tenar (`python -m http.server`) eller speglast til ei portabel mappe.
- Chromium bruker `form-action` frå tenaren òg på omdirigeringa etter innlogginga; tenaren må tillate tilbakekallsadressa til
  appen (Dataregium gjer det).

## Rapporter ei sårbarheit

Ikkje opne eit offentleg issue. Bruk knappen *Report a vulnerability* under Security → Advisories i repoet på GitHub, slik
[SECURITY.md](../../SECURITY.md) skildrar: versjon (under hjelpeknappen), nettlesar, kva du såg og korleis det kan gjerast om
att. Du får ei stadfesting innan få dagar og ei retting eller ein plan så snart problemet er forstått.

## Versjonar som får rettingar

Éi utgjeving per hovudnummer blir halden: berre den siste utgjevinga i 2-serien får rettingar. 1.0.0 blir halden til referanse
utan rettingar.
