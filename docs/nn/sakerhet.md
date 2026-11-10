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
| Tredjepartskode blir vendora med låst versjon og lisens og aldri endra for hand | OWASP ASVS 14.2 | `tools/fetch_vendor.py`, `THIRD_PARTY_LICENSES.md`, gjennomgang |
| Alt som forlèt appen, blir gått gjennom i sin heilskap: identitetsnummer, e-post og telefon i kolonnar, løpande tekst, sidetabellar, originalar, posisjonen til bilete, kantane til grafar, kommentarar og forfattarar; hald på, pseudonymiser eller fjern i kopien; datasettet blir aldri endra | Dataminimering (GDPR art. 5) | `review`: *identity numbers, e-mail and phone columns are found; the shared copy is hashed or stripped while the dataset stays*, *running text in a document is found and masked*, *graph edges and node properties are scanned and masked*; `exif`: *strip leaves the picture and removes the text* |
| OAuth2 mot OpenCDE: authorization code med PKCE S256, `state` og nøyaktig tilbakekallsadresse; feil `state` og nekta samtykke blir avviste; token blir fornya og kalla tilbake | RFC 6749, 7636, 9700 | `opencde`: *sign in with a popup, refuse a wrong state, refresh an expiring token, sign out*; det verkelege provet C2, C7–C9 |
| Tilbakekallet frå innloggingsvindauget: via opnaren eller ein BroadcastChannel med stadfesting; eit stengt vindauge blir rekna som feil berre når appen ikkje er isolert | — | `opencde VI`: *the popup flow hears the callback page through a BroadcastChannel and a storage event* |
| Førespurnadsloggen maskerer hovud (Authorization med fleire) og lagrar kroppar berre på førespurnad, aldri for tokenkall | OWASP ASVS 7.1 | `cde-log`: *paths become APIs and operations, headers are masked, bodies only when asked and never for tokens* |
| Svar frå ein grafdatabase ber ingen lagra hashverdiar: passord-, token-, kode- og løyndomshashar blir fjerna frå nodar, relasjonar, tabellar og kart før noko blir vist eller lagra, og Bolt-økter er alltid lesande | Dataminimering | `ifc graph`: *stored hashes never reach a table or a graph* |
| Token går berre til den eigne tenaren til kjelda: rapporten frå IFC-kontrollen til tenaren blir henta frå ei adresse appen byggjer, aldri frå adressa i metadataa til versjonen | — | `validation`: *metadata and report from the server, the report from the app's own address, and the words in the log* |
| Filene i ei arkivpakke blir samanlikna med kontrollsummane (SHA-256) i `PREMIS.xml` når pakken blir lesen, og ei endra eller manglande fil blir vist; ein stad som peikar utanfor pakken, blir ikkje kontrollert og aldri lesen | PREMIS 3.0 | `plan files`: *an archive package, as a folder or a ZIP, opens as the plan with its documents and the check of its files* |
| Alle data som blir viste, blir escapa; ingen `innerHTML` med brukardata; dokument og publiserte sider escapar | OWASP ASVS 5.3 | `published page`: *everything escaped*; `docgen`: *builders escape and structure the content*; kodekonvensjon |
| Service worker og PWA berre i tenarmodus; frå file:// er ingenting avhengig av dei | — | localhost-steget i testmatrisa |
| Ingen løyndomar, personopplysningar eller identiteten til opphavspersonen i repoet eller historikken | — | identitetskontrollen i utgjevingsskripta før commit, `CONTRIBUTING.md` |

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
| Det du sender | hos mottakaren | datasett, filer, saker, kommentarar og brukarnamnet ditt hos tenaren | etter vilkåra til mottakaren |

## Kjende hol

- Ingen Content-Security-Policy enno: appen køyrer klassiske skript, blob-workers og WebAssembly, og web-ifc-bygget krev
  `eval`. Ein meta-CSP utan `'unsafe-eval'` blir lagd til når web-ifc kan lastast utan han.
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
