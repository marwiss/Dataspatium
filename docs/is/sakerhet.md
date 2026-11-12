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
| Loftslagsgagnagrunnur Boverket er aðeins sóttur þegar þú ýtir á *Sækja loftslagsgagnagrunninn*, eftir samþykki fyrir vefþjónustur til api.boverket.se; ekkert um líkanið er sent, og gagnagrunnurinn er geymdur í vafranum með útgáfu sinni | OWASP ASVS 8.3 | `climate.test.js`: *the database is fetched only on the person's action, through the preset, with consent for api.boverket.se, and kept with its version* |
| Kóði þriðja aðila er fluttur inn með fastsettri útgáfu og leyfi og aldrei breyttur í höndunum | OWASP ASVS 14.2 | `tools/fetch_vendor.py`, `THIRD_PARTY_LICENSES.md`, yfirferð |
| Allt sem fer úr forritinu er yfirfarið í heild: kennitölur, netföng og símanúmer í dálkum, samfelldur texti, hliðartöflur, upprunaskrár, staðsetningar mynda, brúnir grafa, athugasemdir og höfundar; halda, dulnefna eða fjarlægja í afritinu; gagnasafnið breytist aldrei | Lágmörkun gagna (GDPR 5. gr.) | `review`: *identity numbers, e-mail and phone columns are found; the shared copy is hashed or stripped while the dataset stays*, *running text in a document is found and masked*, *graph edges and node properties are scanned and masked*; `exif`: *strip leaves the picture and removes the text* |
| Pakki tekur aðeins með myndrit, mælaborð og minnisbækur valinna gagnasafna; persónuupplýsingar í þeim, í sniðmátum, skriftum, vistuðum niðurstöðum og heitum og skráarheitum gagnasafnanna eru sýndar og huldar í afritinu nema þú veljir að halda þeim, fjarlægja niðurstöðurnar eða sleppa þeim | Gagnalágmörkun, GDPR 25. gr. | `review`: *a bundle carries charts and notebooks of the chosen datasets only, and their personal data and names are cleaned* |
| IFC-líkan er yfirfarið að innan áður en það fer úr appinu: einstaklingar, heimilisföng stofnana, eigendasaga, höfundur og stofnun í skráarhausnum, gerendur og íbúar og netföng og kennitölur í frjálsum texta; hverjum hluta er haldið, hann dulnefndur eða fjarlægður í afritinu með IfcOpenShell, án Python aðeins halda eða hætta við; þetta gildir um allar leiðir út, og gagnasafninu er aldrei breytt | Gagnalágmörkun, GDPR 25. gr. | `review-ifc.test.js`: *the people, addresses, owner history, header, actors and free text inside a model are found, and only kept without Python*, *the copy is cleaned through the wheel first, its tables are built from the cleaned file, a bundle carries it, and the dataset stays*, *IfcOpenShell removes and pseudonymises every part in the copy, with the codes of dm_hash, and keeps the GlobalIds* |
| OAuth2 gegn OpenCDE: authorization code með PKCE S256, `state` og nákvæmu afturhvarfsvistfangi; rangt `state` og hafnað samþykki er neitað; tókar eru endurnýjaðir og afturkallaðir | RFC 6749, 7636, 9700 | `opencde`: *sign in with a popup, refuse a wrong state, refresh an expiring token, sign out*; raunprófunin C2, C7–C9 |
| Afturhvarfið úr innskráningarglugganum: um opnarann eða BroadcastChannel með staðfestingu; lokaður gluggi telst villa aðeins þegar forritið er ekki einangrað | — | `opencde VI`: *the popup flow hears the callback page through a BroadcastChannel and a storage event* |
| Beiðnaskráin hylur hausa (meðal annars Authorization) og geymir meginmál aðeins sé þess óskað, aldrei fyrir tókaköll | OWASP ASVS 7.1 | `cde-log`: *paths become APIs and operations, headers are masked, bodies only when asked and never for tokens* |
| Svör úr netgagnagrunni bera engin vistuð tætigildi: tætigildi lykilorða, tóka, kóða og leyndarmála eru fjarlægð úr hnútum, venslum, töflum og vörpunum áður en nokkuð er sýnt eða vistað, og Bolt-fundir eru alltaf lesandi | Lágmörkun gagna | `ifc graph`: *stored hashes never reach a table or a graph* |
| Tákn fer aðeins til eigin þjóns uppsprettunnar: skýrsla IFC-prófunar þjónsins er sótt frá vistfangi sem forritið býr til, aldrei frá vistfanginu í lýsigögnum útgáfunnar | — | `validation`: *metadata and report from the server, the report from the app's own address, and the words in the log* |
| Vistföngum sem þjónninn gefur fyrir verk og skýrslur (árekstraprófunin, sameiningin) er aðeins fylgt á sama þjóni, og slóðir úr getuskránni eru aðeins teknar sem slóðir; annars býr forritið vistfangið til sjálft, svo táknið helst hjá þjóni uppsprettunnar | — | `validation`: *the server checks for clashes like the app, makes the topics itself, and brings a building of another model in after its report* |
| Lykill sem þjónustan vill fá í meginmáli beiðninnar (NVDB hjá Trafikverket) er fylltur inn fyrst þegar beiðnin er send, kóðaður eftir sniði meginmálsins og lendir aldrei í vistfanginu, skránni eða upplýsingum um uppsprettuna | OWASP ASVS 8.3 | `geodata`: *NVDB sends its key in the XML body and a box in SWEREF 99 TM, pages with skip and opens as a map in WGS 84* |
| Loftmyndir sem bakgrunnskort eru aðeins sóttar þegar þú velur eina, eftir samþykki fyrir bakgrunnskort með hýsil þjónustunnar í spurningunni (`gis.natt.is`, `wms.datafordeler.dk`, `avoin-karttakuva.maanmittauslaitos.fi`); lykill (Danmörk, Finnland) er geymdur í `api/secrets`, fer aðeins í myndslóðir eigin þjónustu og lendir aldrei í samþykkisspurningunni, vistaðri kortasýn eða birtu HTML | OWASP ASVS 8.3 | `orthophoto.test.js`: *the consent for background maps is asked on first use with the host named, a refusal leaves the map without tiles, and each grid gets its own source*, *a key stays in the session: without it nothing is asked or fetched, with it it goes only into the image addresses, never into the consent, the saved map or published HTML* |
| Loftmyndir Lantmäteriet (Svíþjóð) eru aðeins sóttar þegar þú velur þær eða ýtir á *Sækja loftmynd fyrir sýnina*, eftir samþykki fyrir vefþjónustum með hýslana í spurningunni (`api.lantmateriet.se`, `apimanager.lantmateriet.se`, `dl1.lantmateriet.se`); lykillinn (neytendalykill og neytendaleyndarmál í `api/secrets`) gefur tákn sem er aðeins sent til skráahýsilsins og lendir aldrei í spurningunni, vistuðu kortasýninni eða birtu HTML, og skrárnar eru lesnar með sviðsbeiðnum án vafrakaka, í mesta lagi 1 km² í einu | OWASP ASVS 8.3 | `orthophoto-cog.test.js`: *the overview that fits the output is read, only the window the box needs, with one consent question and the key only to the file host*, *nothing is contacted without the key, after a refused consent, outside Sweden or over 1 km², and a refused file says what the key needs*, *on a map Lantmäteriet's orthophoto is fetched only on the person's action, then lies under the features with its attribution, and the key stays out of the saved map and published HTML* |
| Lykill sem fylgir skrám í leitarniðurstöðu (STAC hjá Lantmäteriet) er aðeins sendur til hýsla sem uppsprettan tilgreinir; skrá á öðrum hýsli er sótt án lykils | OWASP ASVS 8.3 | `geodata`: *Lantmäteriet STAC searches an area with the key, and Filer i källan reads the vector files in, with the key only for the file host* |
| Brúin sem milliliður er sjálfgefið óvirk og sækir aðeins yfir https frá hýslum sem notandinn ræsir hana með, aldrei frá þessari tölvu eða staðarnetinu, með fáa hausa og engar vafrakökur, og skráir aldrei fyrirspurnir, hausa eða meginmál | OWASP ASVS 12.6 (SSRF) | `bridge`: *with the switch on, a service that refuses the browser is fetched through the bridge, and only then*; `tools/db_bridge.py` and `tools/db-bridge.ps1` tried against a real service |
| Efnisstefnan leyfir engar innfelldar skriftur og engar skriftur annars staðar frá; aðeins eigin skrár forritsins, blob-workerar og WebAssembly keyra | OWASP ASVS 14.4 | the whole suite under the policy in Edge and Firefox (`tests/setup.js` writes every breach to the log) |
| Fjarstýring er af við hverja ræsingu, krefst þess að brúin hafi verið ræst með `--allow-commands` og staðfestingar þinnar fyrir setuna; forrit sem þekkja tákn brúarinnar keyra aðeins eigin skipanir forritsins, lesandi strax og skrifandi eftir samþykki þitt í glugga forritsins, og biðröðin er í brúnni á 127.0.0.1 | OWASP ASVS 4.1, 8.3, LLM06 | `remote.test.js`: *with the switch on the page registers its commands with the bridge, runs what is queued, asks before a writing command and runs a plan once* og *a bridge started without --allow-commands is told, and the switch shows the state in Internetåtkomst*; `tools/check_bridge.py` |
| Listi sem þjónninn hefur stytt er lesinn til enda með Link rel="next", en aðeins á sama þjóni, svo að táknið fer aldrei annað | — | `opencde`: *a list the server has capped is read to the end through Link rel="next", and only on the same server* |
| Skrár skjalasafnspakka eru bornar saman við gátsummurnar (SHA-256) í `PREMIS.xml` þegar pakkinn er lesinn, og breytt eða vantandi skrá er sýnd; staður sem vísar út fyrir pakkann er ekki athugaður og aldrei lesinn | PREMIS 3.0 | `plan files`: *an archive package, as a folder or a ZIP, opens as the plan with its documents and the check of its files* |
| Öll gögn sem eru sýnd eru sloppin út; ekkert `innerHTML` með notandagögnum; skjöl og birtar síður sleppa út | OWASP ASVS 5.3 | `published page`: *everything escaped*; `docgen`: *builders escape and structure the content*; kóðaregla |
| Service worker og PWA aðeins í þjónsham; frá file:// er ekkert háð þeim | — | localhost-skref prófunarfylkisins |
| Engin leyndarmál, persónuupplýsingar eða auðkenni höfundar í safninu eða sögu þess | — | auðkennisathugun útgáfuskriftanna fyrir hverja færslu, `CONTRIBUTING.md` |
| Gervigreindarþjónusta er aðeins kölluð eftir samþykki fyrir hýsil hennar (tilgangurinn ai) og samkvæmt stefnunni: *Aðeins staðbundið* hafnar hverjum hýsli utan eigin tölvu; lykillinn er í api/secrets og fylgir aldrei spurningunni, skránni eða stillingunni | OWASP ASVS 8.3, 2.10 | `ai.test.js`: *providers are saved without their key, the key goes to api/secrets, and the policy Local only refuses a cloud host* |
| Gervigreindin getur aðeins lesið líkanið: tólin svara með gögnum úr töflum gagnasafnsins, svörin eru stytt og merkt sem gögn, aldrei sem fyrirmæli, og lykkjan hefur fjárhagsáætlun fyrir skref og tóka og má hætta við | OWASP LLM01, LLM06 | `ai.test.js`: *the agent asks, runs the tool the model called, hands the result back as data and collects the elements* og *a question can be cancelled, and the budget of turns ends a loop that never answers* |
| Gervigreindin gerir aldrei breytingar sjálf: skriftólin fylla breytingasett sem manneskja forskoðar og samþykkir; eyðing krefst confirm frá gervigreindinni og einnar staðfestingar til viðbótar frá manneskjunni; breytingasett með skemavillum er ekki hægt að samþykkja; birting, breytingatillögur til þjónsins og samþykkt þeirra þar eru hnappar, aldrei tól | OWASP LLM01, LLM06, LLM08 | `ai-change.test.js`: *the write tools check each call, fill the change set with refs and refuse what the person has not asked for* og *the panel previews the candidate in 3D, approves it as a recipe step with provenance, undo restores the file exactly, and schema errors block approval*, *a previewed change set goes to Dataregium as a change proposal* |
| Myndir og teikningar fylgja lýsingunni til gervigreindarveitunnar aðeins í hamnum Byggja úr lýsingu, eftir samþykki fyrir hýsil veitunnar og samkvæmt stefnunni; hver mynd er teiknuð upp á nýtt sem JPEG eða send án EXIF, og myndatextinn gefur upp hlið, staðsetningu og tíma aðeins þegar þú hengdir myndina við með þeim | OWASP LLM02, LLM06 | `ai-build.test.js`: *the agent asks the person, builds in groups through the write tools and says the plan; the pictures go with the brief* og *the panel in the mode Bygg ur brief shows the brief, takes attachments, and the question box answers the AI* |
| Lýsingin og myndirnar fara á þjón líkansins aðeins þegar þú ýtir á *Setja efniviðinn á þjóninn* og hefur farið í gegnum yfirferðina fyrir deilingu, sem minnir á að fólk og bílnúmer eru persónuupplýsingar og fjarlægir staðsetningu og tíma myndanna úr afritinu, einnig úr EXIF skránna, nema þú haldir þeim | GDPR art. 5, 25 | `model-material.test.js`: *through the sharing review, positions and times stay out of the copy unless kept, also from the files' EXIF* |
| IFC-skrá sem forritið skrifar fær aðeins nafn einstaklings í hausinn (höfund, stofnun) þegar þú fyllir það sjálf(ur) út í eyðublaðinu *Nýtt byggingarlíkan*; annars eru reitirnir tómir, og skrá sem forritið breytir heldur eigin haus | GDPR art. 5, 25 | `ai-names.test.js`: *Python writes the designations, the Axis context and the header in a new IFC4X3 model*, *… and the header kept* |
| Atriðin úr ham gervigreindarspjaldsins Athuga verða mál á þjóninum aðeins þegar þú ýtir á *Stofna mál á þjóninum* og hefur farið í gegnum yfirferðina fyrir deilingu; myndin fer án EXIF, og staðsetning myndarinnar er í málinu aðeins ef þú heldur henni | GDPR art. 5, 25 | `ai-check.test.js`: *Skapa ärenden på servern makes one topic per finding with a viewpoint on a virtual Dataregium, and sends a failed one again* |
| Gervigreindaraðstoðin keyrir aðeins eigin skipanir forritsins, sem flett er upp eftir nafni og athugaðar á móti skema sínu; skipun sem breytir einhverju er aðeins keyrð eftir að þú hefur samþykkt hana í eigin glugga forritsins, sem sýnir skipunina og viðföngin, og svar við spurningu frá gervigreindinni samþykkir aldrei neitt | OWASP LLM01, LLM06, LLM08 | `commands.test.js`: *an operation needs approval unless the person runs it, is checked against its own schema and can be undone*; `assistant.test.js`: *a refused command is not run and the refusal goes back to the AI; a closed question is an answer too* |
| SQL frá skipun má aðeins lesa: SQLite-workerinn tekur við einni setningu sem les og keyrir hana með gagnagrunninn læstan gegn breytingum | OWASP ASVS 5.3, LLM02 | `commands.test.js`: *SQL that only reads runs; a second statement, WITH … DELETE and DELETE are refused and change nothing* |
| Skilyrði í flæðum og áætlunum eru lesin af forritinu og aldrei keyrð sem kóði, og spurningar frá flæði eða gervigreind birtast aðeins sem texti | OWASP ASVS 5.2, LLM02 | `commands.test.js`: *comparisons, and/or/not, references to earlier answers, fill, and nothing is run as code*; `plans.test.js`: *the question shows text only and answers with the choice or an own text* |

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
| Höfundur og stofnun í haus IFC-skrárinnar | IFC-skrá líkansins í gagnasafninu | það sem þú gafst upp sjálf(ur) þegar líkanið var búið til | fylgir skránni við útflutning, deilingu og birtingu |
| Það sem þú sendir | hjá viðtakanda | gagnasöfn, skrár, mál, athugasemdir og notandanafn þitt hjá þjóninum | samkvæmt skilmálum viðtakanda |

## Þekktar gloppur

- Content-Security-Policy án innfelldra skrifta: síður forritsins, farsímasíðan og prófunarsíðan hlaða aðeins skriftum úr
  eigin skrám forritsins, blob-workerum og WebAssembly. `eval` er enn leyft, því web-ifc-pakkinn og Vega þurfa það; sá hluti
  hverfur þegar bæði geta keyrt án þess.
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
