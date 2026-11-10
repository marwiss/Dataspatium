# Öryggi

Öryggi er fyrsta krafa forritsins. Dataspatium geymir gagnasöfnin þín, API-lykla og tóka í vafranum og talar við þjóna (opin
forritaskil, OpenCDE-þjóna eins og Dataregium) aðeins þegar þú biður um það. Stefnan er sú sama sem Dataregium hefur, því að
verkefnin tvö eru þróuð sem par og gefin út með sömu númerum; helmingur Dataregium er í [README](https://github.com/marwiss/Dataregium/blob/main/docs/is/README.md#persónuupplýsingar)
í því safni. Hvernig veikleiki er tilkynntur stendur í [SECURITY.md](../../SECURITY.md).

## Ógnarlíkan

**Eignir**: gagnasöfnin þín (sem geta innihaldið persónuupplýsingar), API-lyklar og tókar fyrir þjóna, lykilsetningin sem
verndar þau, það sem þú deilir með öðrum (pakkar, skrár til þjóns, birtar síður) og heilleiki vinnusvæðisins.

**Gerendur**: þú sjálf(ur); önnur forrit á sömu tölvu; vefsíður sem þú heimsækir í sama vafra; þjónarnir sem þú sækir frá og
sendir til; sá sem fær skrá sem þú deildir; sá sem getur lesið netið milli þín og þjóns.

**Trúnaðarmörk**: forritið keyrir í sandkassa vafrans og nær aðeins því sem þú sleppir á flötinn eða velur í glugga. Opnað úr
möppu (file://) deilir það geymsluuppruna með öðrum HTML-skrám sem opnaðar eru á sama hátt í Chromium, og því eru leyndarmál
dulrituð. Þjónar eru framandi: allt sem þeir senda er meðhöndlað sem gögn og sleppt út (escaped); allt sem forritið sendir
þeim fer um aðgerð þína og samþykki í hverjum tilgangi. R, Python og web-ifc keyra í WebAssembly-sandkössum í workerum án
aðgangs að tölvunni.

## Stýringar og prófanirnar sem sanna þær

Hver stýring hefur sjálfvirka prófun í `tests/` eða bendir á kóðann sem ber hana.

| Stýring | Staðall | Prófun |
|---|---|---|
| Engin netköll án aðgerðar þinnar og samþykkis í hverjum tilgangi (api, url, github, íhlutir, grunnkort, gagnagrunnar, neo4j, stun, opencde); hafnað samþykki stöðvar kallið | OWASP ASVS 8.3 | `consent.test.js`: *a purpose is asked once, the answer is remembered when wanted, and a denial raises ConsentError* |
| Leyndarmál (API-lyklar, tókar) eru aldrei geymd í hreinum texta: aðeins í setunni eða dulrituð með lykilsetningu (AES-GCM um WebCrypto), með læsingu og aflæsingu | OWASP ASVS 2.10, 6.2 | `api.test.js`: *secrets in session, encrypted persistence, lock and unlock* |
| Uppskrift með leyndu skrefi er ekki keyrð aftur án þín | Lágmörkun gagna | `refresh`: *a recipe with a secret step is refused before anything is fetched* |
| Íhlutir og R-pakkar eru sóttir frá fastsettum vistföngum eftir samþykki, staðfestir með SHA-256 áður en þeir eru notaðir og geymdir í IndexedDB-skyndiminni | OWASP ASVS 14.2 | `components`: *fetched once with consent, verified against SHA-256, served from the cache afterwards, and removable* |
| Kóði þriðja aðila er fluttur inn með fastsettri útgáfu og leyfi og aldrei breyttur í höndunum | OWASP ASVS 14.2 | `tools/fetch_vendor.py`, `THIRD_PARTY_LICENSES.md`, yfirferð |
| Allt sem fer úr forritinu er yfirfarið í heild: kennitölur, netföng og símanúmer í dálkum, samfelldur texti, hliðartöflur, upprunaskrár, staðsetningar mynda, brúnir grafa, athugasemdir og höfundar; halda, dulnefna eða fjarlægja í afritinu; gagnasafnið breytist aldrei | Lágmörkun gagna (GDPR 5. gr.) | `review`: *identity numbers, e-mail and phone columns are found; the shared copy is hashed or stripped while the dataset stays*, *running text in a document is found and masked*, *graph edges and node properties are scanned and masked*; `exif`: *strip leaves the picture and removes the text* |
| Pakki tekur aðeins með myndrit, mælaborð og minnisbækur valinna gagnasafna; persónuupplýsingar í þeim, í sniðmátum, skriftum, vistuðum niðurstöðum og heitum og skráarheitum gagnasafnanna eru sýndar og huldar í afritinu nema þú veljir að halda þeim, fjarlægja niðurstöðurnar eða sleppa þeim | Gagnalágmörkun, GDPR 25. gr. | `review`: *a bundle carries charts and notebooks of the chosen datasets only, and their personal data and names are cleaned* |
| OAuth2 gegn OpenCDE: authorization code með PKCE S256, `state` og nákvæmu afturhvarfsvistfangi; rangt `state` og hafnað samþykki er neitað; tókar eru endurnýjaðir og afturkallaðir | RFC 6749, 7636, 9700 | `opencde`: *sign in with a popup, refuse a wrong state, refresh an expiring token, sign out*; raunprófunin C2, C7–C9 |
| Afturhvarfið úr innskráningarglugganum: um opnarann eða BroadcastChannel með staðfestingu; lokaður gluggi telst villa aðeins þegar forritið er ekki einangrað | — | `opencde VI`: *the popup flow hears the callback page through a BroadcastChannel and a storage event* |
| Beiðnaskráin hylur hausa (meðal annars Authorization) og geymir meginmál aðeins sé þess óskað, aldrei fyrir tókaköll | OWASP ASVS 7.1 | `cde-log`: *paths become APIs and operations, headers are masked, bodies only when asked and never for tokens* |
| Svör úr netgagnagrunni bera engin vistuð tætigildi: tætigildi lykilorða, tóka, kóða og leyndarmála eru fjarlægð úr hnútum, venslum, töflum og vörpunum áður en nokkuð er sýnt eða vistað, og Bolt-fundir eru alltaf lesandi | Lágmörkun gagna | `ifc graph`: *stored hashes never reach a table or a graph* |
| Tákn fer aðeins til eigin þjóns uppsprettunnar: skýrsla IFC-prófunar þjónsins er sótt frá vistfangi sem forritið býr til, aldrei frá vistfanginu í lýsigögnum útgáfunnar | — | `validation`: *metadata and report from the server, the report from the app's own address, and the words in the log* |
| Lykill sem þjónustan vill fá í meginmáli beiðninnar (NVDB hjá Trafikverket) er fylltur inn fyrst þegar beiðnin er send, kóðaður eftir sniði meginmálsins og lendir aldrei í vistfanginu, skránni eða upplýsingum um uppsprettuna | OWASP ASVS 8.3 | `geodata`: *NVDB sends its key in the XML body and a box in SWEREF 99 TM, pages with skip and opens as a map in WGS 84* |
| Lykill sem fylgir skrám í leitarniðurstöðu (STAC hjá Lantmäteriet) er aðeins sendur til hýsla sem uppsprettan tilgreinir; skrá á öðrum hýsli er sótt án lykils | OWASP ASVS 8.3 | `geodata`: *Lantmäteriet STAC searches an area with the key, and Filer i källan reads the vector files in, with the key only for the file host* |
| Listi sem þjónninn hefur stytt er lesinn til enda með Link rel="next", en aðeins á sama þjóni, svo að táknið fer aldrei annað | — | `opencde`: *a list the server has capped is read to the end through Link rel="next", and only on the same server* |
| Skrár skjalasafnspakka eru bornar saman við gátsummurnar (SHA-256) í `PREMIS.xml` þegar pakkinn er lesinn, og breytt eða vantandi skrá er sýnd; staður sem vísar út fyrir pakkann er ekki athugaður og aldrei lesinn | PREMIS 3.0 | `plan files`: *an archive package, as a folder or a ZIP, opens as the plan with its documents and the check of its files* |
| Öll gögn sem eru sýnd eru sloppin út; ekkert `innerHTML` með notandagögnum; skjöl og birtar síður sleppa út | OWASP ASVS 5.3 | `published page`: *everything escaped*; `docgen`: *builders escape and structure the content*; kóðaregla |
| Service worker og PWA aðeins í þjónsham; frá file:// er ekkert háð þeim | — | localhost-skref prófunarfylkisins |
| Engin leyndarmál, persónuupplýsingar eða auðkenni höfundar í safninu eða sögu þess | — | auðkennisathugun útgáfuskriftanna fyrir hverja færslu, `CONTRIBUTING.md` |
| Gervigreindarþjónusta er aðeins kölluð eftir samþykki fyrir hýsil hennar (tilgangurinn ai) og samkvæmt stefnunni: *Aðeins staðbundið* hafnar hverjum hýsli utan eigin tölvu; lykillinn er í api/secrets og fylgir aldrei spurningunni, skránni eða stillingunni | OWASP ASVS 8.3, 2.10 | `ai.test.js`: *providers are saved without their key, the key goes to api/secrets, and the policy Local only refuses a cloud host* |
| Gervigreindin getur aðeins lesið líkanið: tólin svara með gögnum úr töflum gagnasafnsins, svörin eru stytt og merkt sem gögn, aldrei sem fyrirmæli, og lykkjan hefur fjárhagsáætlun fyrir skref og tóka og má hætta við | OWASP LLM01, LLM06 | `ai.test.js`: *the agent asks, runs the tool the model called, hands the result back as data and collects the elements* og *a question can be cancelled, and the budget of turns ends a loop that never answers* |
| Gervigreindin gerir aldrei breytingar sjálf: skriftólin fylla breytingasett sem manneskja forskoðar og samþykkir; eyðing krefst confirm frá gervigreindinni og einnar staðfestingar til viðbótar frá manneskjunni; breytingasett með skemavillum er ekki hægt að samþykkja; birting, breytingatillögur til þjónsins og samþykkt þeirra þar eru hnappar, aldrei tól | OWASP LLM01, LLM06, LLM08 | `ai-change.test.js`: *the write tools check each call, fill the change set with refs and refuse what the person has not asked for* og *the panel previews the candidate in 3D, approves it as a recipe step with provenance, undo restores the file exactly, and schema errors block approval*, *a previewed change set goes to Dataregium as a change proposal* |

## Persónuupplýsingar og geymsla

Hvað forritið geymir, hvar og hve lengi. Allt er á tölvunni þinni; ekkert er sent til höfundar forritsins, og engin
uppfærsluathugun er gerð án aðgerðar þinnar. Helmingur Dataregium (hvað þjónninn geymir um þig) er í
[README](https://github.com/marwiss/Dataregium/blob/main/docs/is/README.md#persónuupplýsingar).

| Gögn | Hvar | Innihald | Geymt |
|---|---|---|---|
| Gagnasöfn | IndexedDB (ein SQLite-skrá fyrir hvert gagnasafn) | það sem þú fluttir inn, með dálkum, athugasemdum og sögu; getur innihaldið persónuupplýsingar | þar til þú eyðir þeim; öryggisafrit og pakkar eru ZIP-skrár þar sem þú setur þær |
| Stillingar | IndexedDB | tungumál, breidd spjalda, viðbættar uppsprettur, samþykki, vistaðar fyrirspurnir | þar til þú hreinsar vefsvæðisgögn |
| Leyndarmál | minni, eða IndexedDB dulritað með lykilsetningu þinni | API-lyklar, tókar; lykilsetningin er aldrei geymd | setan, eða þar til þú fjarlægir uppsprettuna |
| Atvikaskráin | minni | aðgerðir, villur og köll með huldum hausum | þar til síðan er endurhlaðin |
| Nöfn á athugasemdum | skrá gagnasafnsins | nafnið sem þú gafst upp sjálf(ur) | fylgir pökkum, öryggisafritum og GitHub |
| Það sem þú sendir | hjá viðtakanda | gagnasöfn, skrár, mál, athugasemdir og notandanafn þitt hjá þjóninum | samkvæmt skilmálum viðtakanda |

## Þekktar gloppur

- Engin Content-Security-Policy enn: forritið keyrir hefðbundin skriftur, blob-workera og WebAssembly, og web-ifc-pakkinn
  krefst `eval`. Meta-CSP án `'unsafe-eval'` verður bætt við þegar web-ifc getur hlaðist án hennar.
- Frá file:// í Chromium deila allar HTML-skrár sem opnaðar eru á tölvunni geymslu. Leyndarmál eru dulrituð, en viðkvæmt
  vinnusvæði ætti að keyra frá staðbundnum þjóni (`python -m http.server`) eða speglast í færanlega möppu.
- Chromium beitir `form-action` þjónsins einnig á áframsendinguna eftir innskráningu; þjónninn þarf að leyfa afturhvarfsvistfang
  forritsins (Dataregium gerir það).

## Að tilkynna veikleika

Opnaðu ekki opinbert issue. Notaðu hnappinn *Report a vulnerability* undir Security → Advisories í safninu á GitHub, eins og
[SECURITY.md](../../SECURITY.md) lýsir: útgáfa (undir hjálparhnappnum), vafri, hvað þú sást og hvernig það er endurtekið. Þú
fær staðfestingu innan nokkurra daga og lagfæringu eða áætlun um leið og vandinn er skilinn.

## Útgáfur sem fá lagfæringar

Einni útgáfu á hvert aðalnúmer er haldið: aðeins nýjasta útgáfan í 2-röðinni fær lagfæringar. 1.0.0 er haldið til viðmiðunar án
lagfæringa.
