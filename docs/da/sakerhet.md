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
| Tredjepartskode vendoreres med fastlåst version og licens og ændres aldrig i hånden | OWASP ASVS 14.2 | `tools/fetch_vendor.py`, `THIRD_PARTY_LICENSES.md`, gennemgang |
| Alt, der forlader appen, gennemgås i sin helhed: identitetsnumre, e-mail og telefon i kolonner, løbende tekst, sidetabeller, originaler, billeders position, grafers kanter, kommentarer og forfattere; behold, pseudonymisér eller fjern i kopien; datasættet ændres aldrig | Dataminimering (GDPR art. 5) | `review`: *identity numbers, e-mail and phone columns are found; the shared copy is hashed or stripped while the dataset stays*, *running text in a document is found and masked*, *graph edges and node properties are scanned and masked*; `exif`: *strip leaves the picture and removes the text* |
| En pakke tager kun diagrammer, dashboards og notesbøger med for de valgte datasæt; personoplysninger i dem, i skabeloner, scripts, gemte output og datasættenes navne og filnavne vises og maskeres i kopien, medmindre du vælger at beholde dem, fjerne output eller udelade dem | Dataminimering, GDPR art. 25 | `review`: *a bundle carries charts and notebooks of the chosen datasets only, and their personal data and names are cleaned* |
| OAuth2 mod OpenCDE: authorization code med PKCE S256, `state` og nøjagtig tilbagekaldsadresse; forkert `state` og nægtet samtykke afvises; tokens fornys og tilbagekaldes | RFC 6749, 7636, 9700 | `opencde`: *sign in with a popup, refuse a wrong state, refresh an expiring token, sign out*; den rigtige test C2, C7–C9 |
| Tilbagekaldet fra loginvinduet: via åbneren eller en BroadcastChannel med bekræftelse; et lukket vindue regnes som fejl kun, når appen ikke er isoleret | — | `opencde VI`: *the popup flow hears the callback page through a BroadcastChannel and a storage event* |
| Forespørgselsloggen maskerer headere (Authorization med flere) og gemmer kroppe kun på anmodning, aldrig for tokenkald | OWASP ASVS 7.1 | `cde-log`: *paths become APIs and operations, headers are masked, bodies only when asked and never for tokens* |
| Svar fra en grafdatabase bærer ingen lagrede hashværdier: adgangskode-, token-, kode- og hemmelighedshashes fjernes fra knuder, relationer, tabeller og kort, før noget vises eller gemmes, og Bolt-sessioner er altid læsende | Dataminimering | `ifc graph`: *stored hashes never reach a table or a graph* |
| En arkivpakkes filer sammenlignes med kontrolsummerne (SHA-256) i `PREMIS.xml`, når pakken læses, og en ændret eller manglende fil vises; et sted der peger uden for pakken, kontrolleres ikke og læses aldrig | PREMIS 3.0 | `plan files`: *an archive package, as a folder or a ZIP, opens as the plan with its documents and the check of its files* |
| Alle data, der vises, escapes; ingen `innerHTML` med brugerdata; dokumenter og publicerede sider escaper | OWASP ASVS 5.3 | `published page`: *everything escaped*; `docgen`: *builders escape and structure the content*; kodekonvention |
| Service worker og PWA kun i servertilstand; fra file:// afhænger intet af dem | — | localhost-trinnet i testmatricen |
| Ingen hemmeligheder, personoplysninger eller ophavspersonens identitet i repoet eller dets historik | — | udgivelsesscriptenes identitetskontrol før commit, `CONTRIBUTING.md` |

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
| Det, du sender | hos modtageren | datasæt, filer, sager, kommentarer og dit brugernavn hos serveren | efter modtagerens vilkår |

## Kendte huller

- Ingen Content-Security-Policy endnu: appen kører klassiske scripts, blob-workers og WebAssembly, og web-ifc's bygning kræver
  `eval`. En meta-CSP uden `'unsafe-eval'` tilføjes, når web-ifc kan indlæses uden den.
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
