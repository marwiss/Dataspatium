# CAD og BIM: bygningsmodeller og tegninger

Dataspatium åbner bygningsmodeller i IFC og tegninger i DXF som en egen type datasæt. Modellen tegnes i 3D,
bygningsdelene bliver en tabel, og egenskaber og mængder kan søges i, beregnes og eksporteres. Alt sker i browseren: filen
forlader aldrig computeren. Originalfilen gemmes i datasættet og følger med i pakker og sikkerhedskopier.

## Åbn en model

Slip en `.ifc`-, `.ifczip`- eller `.dxf`-fil i Hent. Filens oplysninger vises (skema, projekt, program, etager og antal pr.
type), og *Importér* opretter datasættet. IFC2X3, IFC4 og IFC4X3 i STEP-format understøttes. En model på omkring 50 MB
tager cirka et kvarter minut at importere og åbnes derefter på få sekunder.

## Store modeller fra serveren

En model, der er for stor til at læse i browseren, kan hentes fra Dataregium uden IFC-filen. I kildens filliste under *Hent →
OpenCDE* har en model knappen **Stor model**, når serveren har geometri-API'et (`ifc_geometry`). Vælg detaljeniveau: *Hele geometrien*
giver bygningsdelenes net, *Kasser pr. bygningsdel* blot en kasse hver til et hurtigt overblik. Appen henter geometrien som binær glTF,
læser den i en baggrundstråd og laver et modeldatasæt med en række pr. bygningsdel (id, GlobalId, klasse, navn og etage fra serverens
navngivne forespørgsler). Geometrien gemmes med datasættet, så 3D-visningen, markering, udvalg og sager fungerer som for en model fra en
fil. Egenskaber og mængder følger ikke med, og det, der kræver IFC-filen, som kollisionskontrollen i appen og eksport af originalen,
mangler; serverens kollisionstest og forespørgsler fungerer som sædvanligt. Kortet i Håndter viser *Geometri: Fra serveren*.

## Modellen i Bearbejd

Modellen åbnes som 3D-visning med en tabel over bygningsdelene nedenunder. Træk for at dreje, rul for at zoome mod
markøren, og træk med højre knap eller med Skift for at flytte; på en berøringsskærm drejer én finger, og to kniber og
flytter. Dobbeltklik på en bygningsdel for at dreje om netop det punkt. Knappen med rammen viser alt det viste; enkelte
objekter langt fra bygningen tælles ikke med. Flere måder at se modellen på står under [Visninger og tastaturet](#visninger-og-tastaturet).

- **Markér**: klik på en bygningsdel i modellen eller en række i tabellen. Markeringen følger med, og inspektøren viser
  type, etage, materiale, klassifikation, egenskaber og mængder samt overflade og volumen målt på geometrien.
- **Filtrér**: vælg type eller etage, eller søg på navn, materiale eller egenskab. Tabellen og modellen viser samme udvalg.
- **Vis som tabel**: alle kolonner som en almindelig tabel med alle værktøjer i Bearbejd.
- **Gem som diagram**: visningen med filter og kameravinkel bliver et diagram i Visualisér.

Geometrien beregnes ud fra originalfilen, første gang modellen åbnes i en session, og bruges kun til at tegne og måle.
Tabellerne findes stadig, selv om computeren mangler WebGL; så vises en besked i stedet for 3D-visningen.

### Visninger og tastaturet

- **Visningskuben** i hjørnet drejer med modellen. Klik på en side for at se modellen ovenfra, forfra, fra højre, bagfra, fra
  venstre eller nedefra, og på knappen under kuben for at se den skråt ovenfra. Forfra ser langs modellens Y-akse, det vil sige
  mod nord, når modellen er tegnet med nord opad. Visningerne viser det, filteret viser.
- **Ortografisk visning**: knappen med kvadratet skifter mellem perspektiv og ortografisk visning, hvor bygningsdelene ikke bliver
  mindre med afstanden. Ovenfra bliver så en plantegning og forfra en facade. Et diagram og et viewpoint husker, hvilken visning
  det var.
- **Snit**: knappen med lagene åbner snittet i inspektøren. Træk i skyderne for øst–vest, syd–nord og højde for at skære det væk,
  der ligger uden for en kasse, eller vælg en etage under *Snit ved etage* for at se den fra gulvet op til 1,2 m som en
  plantegning. *Fjern snittet* viser alt igen. Snittet følger med et diagram og et viewpoint, og et viewpoint fra et andet program
  viser sit snit.
- **Zoom til markerede** viser de markerede bygningsdele, og **Vis kun markerede** skjuler alt andet, så du kan dreje rundt om
  dem; klik igen for at vise alt.
- **Tastaturet** virker, når 3D-visningen har fokus: klik i den, eller gå dertil med Tab.

| Tast | Gør |
|---|---|
| Pilene | flytter visningen |
| Ctrl eller Skift og pilene | drejer |
| + og − | zoomer |
| F | zoomer til de markerede |
| Home | viser alt |
| 1–7 | ovenfra, forfra, fra højre, bagfra, fra venstre, nedefra, skråt ovenfra |
| O | skifter ortografisk visning |

## Sager fra et CDE

En model hentet fra en OpenCDE-server, eller en hvilken som helst model, når en sådan server findes som kilde, kan vise
sine sager: knappen *Sager* i modelvisningen åbner et panel i inspektøren med projektets BCF-sager. De, der peger på
bygningsdele i denne model, står først, med status og antal bygningsdele. Klik på en sag, så markeres bygningsdelene i
3D-visningen, og panelet viser beskrivelse, øjebliksbillede og kommentarer. Sagerne hentes, når du beder om det, og gemmes
ikke i datasættet; for at regne på dem gemmer du dem som en tabel i Hent. Har sagen et viewpoint med kamera, går visningen derhen, i perspektiv eller ortografisk og med sit snit.

Med rettighederne til det kan du også skrive. *Ny sag* opretter en sag på serveren med titel, type, status og etiketter fra
projektets lister, og visningen følger med som viewpoint: kameraet (perspektiv eller ortografisk) med snittet, et øjebliksbillede og de markerede bygningsdele som
komponenter. I en valgt sag kan du skrive en kommentar, skifte status og tilføje den aktuelle visning som et nyt viewpoint.
*Gem som BCF* giver alle projektets sager med kommentarer, viewpoints og øjebliksbilleder som en BCF-fil, som værktøjer uden
API kan åbne. En BCF-fil kan også læses ind i Hent: sagerne bliver en tabel, kommentarer og komponenter tabeller ved siden af.

*Farv efter status* giver bygningsdelene farven fra deres mest åbne sag: rød for åbne, gul for igangværende, grøn for afsluttede,
med en signaturforklaring under listen. *Gem som tabel* giver projektets sager som en tabel med en række per sag og bygningsdel
(type, navn og etage følger med), som Håndter genkender som sager: kortet *Sager* viser status og opretter dashboardet *Sagsstatus*
med status, type, ansvarlig, prioritet og måned bag fælles filtre, og knappen *Vis i modellen* går tilbage til panelet. Værktøjet
*Sager* i Analysérs fane Mængder tæller sager, åbne sager og bygningsdele per status, type, prioritet, ansvarlig, bygningsdelstype
eller etage fra en sådan tabel, og SQL-startkoden får forespørgsler til koblingen. *Gem som diagram* gemmer visningen med farverne
som et modeldiagram, som dashboards, dokumenter og Publicér viser med signaturforklaring.

Modellens graf på serveren tegnes og forespørges fra *Hent*, og knappen *IFC-LPG* fører dig dertil, se [grafer.md](grafer.md#ifc-lpg-på-en-dataregium-server).

Grafens model, relationerne og forespørgslerne fra Dataspatiums side findes i Dataregiums [ifc-lpg.md](https://github.com/marwiss/Dataregium/blob/main/docs/da/ifc-lpg.md).

## Tabellerne

| Tabel | Indhold |
|---|---|
| `data` | Én række pr. bygningsdel, rum og etage: id, guid, typ (type), kategori (byggdel, rum, struktur), namn (navn), beskrivning, objekttyp, tagg, vaning (etage), typnamn, material, klassificering, egenskaper og mangder (mængder) som JSON |
| `_properties` | Én række pr. egenskab: id, uppsattning (sæt), namn, varde (værdi), tal, enhet (enhed), kalla (objekt eller typ) |
| `_quantities` | Én række pr. mængde i SI-enheder: id, uppsattning, namn, varde, slag (langd, area, volym, vikt, tid, antal), enhet |
| `_entities` | Filens ikke-geometriske entiteter med rå attributter: id, typ, attribut |

Egenskaber, der kun findes på bygningsdelens type, regnes med og er mærket `typ`. Mængder omregnes til meter,
kvadratmeter, kubikmeter og kilogram med projektets enheder. Åbninger og tilslutningsporte er ikke bygningsdele og findes
kun i `_entities`.

Tabellerne kan forespørges med SQL i Analysér:

```sql
SELECT d.vaning, d.typ, count(*) AS antal, sum(q.varde) AS volym
FROM data d JOIN _quantities q ON q.id = d.id
WHERE q.namn = 'NetVolume'
GROUP BY 1, 2 ORDER BY 1, 2
```

I R og Python giver `dm_read()` bygningsdelene, `dm_read_properties()` egenskaberne og `dm_read_quantities()` mængderne.

## Fanen Mængder i Analysér

- **Oversigt**: filens oplysninger og indhold.
- **Mængder**: antal, længde, areal, volumen og vægt grupperet efter type, etage, materiale, typenavn eller klassifikation.
  Kilden *Filens mængder* tager én værdi pr. bygningsdel og slags: netto før andre og brutto sidst, så en væg ikke tælles
  to gange. Kilden *Målt på geometrien* regner på trekanterne og virker også, når filen mangler mængder. Overfladen er så
  hele overfladen omkring bygningsdelen, ikke for eksempel en vægs sideareal.
- **Mængdeliste**: hvert mængdenavn i filen pr. type med sum. Her ser du præcis, hvad filen angiver.
- **Egenskaber**: hvilke værdier en egenskab har, og hos hvor mange bygningsdele af hver type.
- **Entiteter**: hvor mange entiteter af hver slags filen består af.

Hvert resultat kan gemmes som datasæt.

## IfcOpenShell i appen

Appen kan læse, kontrollere og ændre IFC-modeller med IfcOpenShell, det samme bibliotek som Dataregium bygger på. Det
kører i Python i browseren, hentes første gang det bruges (cirka 13 MB, efter dit samtykke til komponenter) og gemmes derefter i
browseren. Intet sendes nogen steder; modellen forlader ikke computeren.

**I Analysér, fanen Mængder**, har en IFC-model fem værktøjer mere:

- **Validering** kontrollerer modellen mod sit IFC-skema: attributter, typer og referencer, valgfrit også skemaets regler.
  Fundene kan gemmes som datasæt.
- **Rumlig struktur** viser projekt, grund, bygning, etager og rum som et træ med antal elementer pr. del.
- **Egenskabssæt** giver alle egenskabssæt for en elementtype som en bred tabel: en række pr. element, en kolonne pr.
  egenskab (`Sæt.Egenskab`), valgfrit også mængdesættene.
- **IFC-udvalg** henter elementer med IfcOpenShells udvalgssprog, for eksempel `IfcWall, Pset_WallCommon.FireRating=EI60` eller
  `IfcElement, material=Beton`.
- **Geometrimål** måler volumen, overflade og omsluttende kasse pr. element på geometrien (OpenCASCADE). Langsomt for store
  modeller.
- **IDS-kontrol** kontrollerer modellen mod en IDS-fil (buildingSMART Information Delivery Specification) med
  ifctester, IfcOpenShells egen kontrollant: vælg .ids-filen, så får du en række pr. krav og element med godkendt, ikke godkendt
  eller ikke relevant og årsagen, samt en optælling. Filen bliver i browseren. ifctester følger med appen uden sin webapp, så intet
  hentes ud over Python selv.

**I Bearbejd** har modellen to handlinger under *Handlinger* (knappen findes i modelvisningen og i tabelvisningen), i gruppen
*Model*:

- **Skriv tabel til modellen** skriver en tabels værdier ind i modellen. Rækkerne matches på GUID; kolonnerne `Name`,
  `Description`, `ObjectType` og `Tag` (eller `namn`, `beskrivning`, `objekttyp`, `tagg`) bliver attributter, og kolonner som
  `Pset_WallCommon.FireRating` bliver egenskaber (sættet oprettes, hvis det mangler). Arbejdsgangen: gem *Egenskabssæt* som
  datasæt, redigér det i Bearbejd og skriv tilbage.
- **Python på modellen** kører en funktion `step(model)` med IfcOpenShells API på hele modellen.

Begge er trin i recepten: den ændrede model bliver datasættets nye indhold (originalfilen udskiftes, og tabellerne bygges om),
trinnet logges og kan fortrydes, og originalfilen er altid den aktuelle version, når du eksporterer modellen eller sender den
til et CDE.

**I Python** (fanen Python i Analysér og kodeceller i notesbogen) åbner `dm_ifc("navn")` modellen som en `ifcopenshell.file`.
Hjælperne `dm_ifc_elements`, `dm_ifc_psets`, `dm_ifc_tree`, `dm_ifc_validate`, `dm_ifc_select` og `dm_ifc_geometry` giver
tabeller, `dm_ifc_set(model, df)` skriver en tabel ind i modellen, og `dm_ifc_write(model, "navn")` sender modellen til appen som
et nyt datasæt; se [Python i Dataspatium](python.md). Værktøjerne i Analysér og Python ændrer aldrig datasættet; kun
handlingerne i Bearbejd giver en ny version.

IfcOpenShell er LGPL-3.0 og hentes uændret som fastlåste wheels fra IfcOpenShells egen fortegnelse, se [Licenser](licenser.md).

## Valider modellen

Kortet **Valider modellen** i Håndter samler kontrollerne af en IFC-model, med det seneste resultat af hver.

- **Serverens kontrol** findes for en model, der er hentet som dokumentversion fra et CDE. Dataregium (fra 3.0.0) kontrollerer hver
  uploadet IFC-fil mod IFC-skemaet og, når serveren har dem installeret, mod buildingSMARTs regler (ifc-gherkin-rules) og lægger
  resultatet i versionens metadata. *Hent serverens kontrol* læser det: ingen fund, fund der kun er advarsler, fund med fejl, venter på
  kontrol eller kunne ikke kontrolleres, og hvornår og med hvilke regler. Appen spørger først serveren, når du trykker på knappen.
  Er der fund, viser *Vis fundene* serverens rapport: antal fund og fejl, hvilke kontroller der blev lavet, og hvilke regler der ikke
  kunne køres, og hvert fund med sin regel, sin instans (`#123`) og elementets GlobalId. *Markér i modellen* markerer derefter
  elementerne i modelvisningen i Bearbejd, og *Gem som tabel* gemmer fundene som en tabel med kolonnerne `kind`, `rule`, `severity`, `message`, `step_id`, `global_id` og `attribute`.
  Rapporten hentes med samme login fra en adresse, som appen selv bygger på samme server; en adresse fra metadata følges aldrig.
- **Projektets IDS-filer**: kontrollerer serveren også filen mod projektets IDS-dokumenter (den seneste version af hvert dokument, hvis
  navn ender på `.ids`), viser rapporten, hvor mange specifikationer der blev godkendt, ikke godkendt eller ikke gjaldt filen, og hvilke der
  ikke blev godkendt, med dokumentets navn og antal fund. Et IDS-dokument, der ikke kunne læses, står blandt reglerne, der ikke kunne køres.
- **Det, som intet GlobalId når**: finder serverens kontrol graph instanser, som intet med et GlobalId når, viser rapporten
  knappen *Fjern det, som intet GlobalId når*. Serveren foreslår så, efter din bekræftelse, et ændringssæt, der fjerner dem;
  forslaget bliver en sag, der afprøves og godkendes som andre, og versionen beholder alt.
- **Kontroller her** viser den seneste *Validering*, *IDS-kontrol* og kollisionskontrol, der er kørt i appen, og knapperne åbner dem
  i Analysér. Resultaterne gemmes i appens indstillinger, ikke i datasættet.

Fundene gælder filen, som den blev uploadet, og serveren stopper aldrig en fil på grund af dem. En fil, hvis fund kun er advarsler,
regnes for gyldig af buildingSMARTs valideringstjeneste. Har serveren ingen sådan kontrol, siger kortet, at serveren ikke har
kontrolleret versionen.

## Projektprofil

Kortet **Projektprofil** i kildens visning under *Hent → OpenCDE* viser det valgte projekts profil: projektets IDS-dokumenter
(filer med endelsen `.ids` blandt projektets filer) og de bSDD-ordbøger, du har valgt til projektet, gemt i denne browser pr. server og
projekt.

- **Skriv IDS med AI** skriver en Information Delivery Specification ud fra en beskrivelse i ord. Vælg leverandør, den model kravene
  skal prøves mod, og beskriv kravene. AI'en giver filen til appen, som kontrollerer den (først formen, siden med ifctester mod
  modellen, i Python i browseren) og svarer med fejlen, der skal rettes, eller med udfaldet pr. specifikation. Det går omgang for
  omgang, indtil filen kan køres, højst fire omgange, og kravene blødes aldrig op for at gå igennem. Resultatet kan gemmes som
  `.ids`-fil eller uploades til projektet som et dokument.
- **Søg i bSDD** slår klasser op i buildingSMART Data Dictionary efter samtykke til værten `api.bsdd.buildingsmart.org`, i de valgte
  ordbøger eller alle; *Ordbøger* viser ordbøgerne, så du kan føje dem til profilen. I *Ændr med AI* kan AI'en søge med værktøjet
  `search_bsdd` og klassificere bygningsdele med `set_classification`, som skrives som `IfcClassificationReference` i det
  ændringssæt, du godkender.

Serverens buildingSMART-regler vises på kortet *Valider modellen* i Håndter; vælg en regel i listen ved siden af *Markér i modellen* for kun
at markere de bygningsdele, som den regel rammer.

## Kollisionskontrol

Værktøjet **Kollisioner** i Analysér (fanen Mængder) finder bygningsdele, der går ind i hinanden eller kommer for tæt på hinanden. Det
arbejder på de samme trekanter, som 3D-visningen viser, i en egen tråd og kræver hverken Python eller net.

- **Mængde A og mængde B** er alle bygningsdele eller en type, for eksempel kanaler mod bjælker. B kan ligge i samme model eller i en
  anden model i samme projekt, og modellerne skal så dele koordinatsystem. Åbninger tæller ikke.
- **På serveren**: for en model fra Dataregium (fra 3.0.0, når serveren har kollisionskontrollen slået til) vælger *Hvor*, om
  appen regner selv, eller om serveren foretager samme kontrol af versionerne. Serveren arbejder i en kø; appen venter og viser
  rapporten som sin egen med samme tabel, markering og BCF-fil, og *Send som sager* lader serveren lave sagerne med et viewpoint
  hver. Den anden model skal da være en version i samme projekt.
- **Skæring** tæller par, hvor det ene element når dybere ind i det andet end tolerancen (2 mm, medmindre andet er angivet). Dybden
  måles som, hvor langt hjørner og kanter når ind i det andet element, så flader, der kun mødes, tæller ikke. *Indeslutning* er et
  element, der ligger helt inde i et andet.
- **Fri afstand** tæller par, der er tættere på hinanden end afstanden (50 mm, medmindre andet er angivet), skæringer medregnet.

Resultatet er en tabel med begge elementers id, GlobalId, type og navn, slags, dybde eller afstand i millimeter og et punkt i
modellens egne koordinater. Derfra:

- *Markér i modellen* markerer elementerne i modelvisningen i Bearbejd.
- *Gem som BCF* gemmer en sag pr. kollision i en BCF-fil med en visning, der ser på punktet, og begge elementer markeret og farvet.
  Kamera og punkt står i modellens koordinater med Z opad, så andre BCF-værktøjer viser samme sted.
- *Send som sager* opretter sagerne direkte i projektet på serveren gennem BCF API for en model, der er hentet fra et CDE. Der ser alle
  klienter dem, for eksempel Bonsai.
- *Opret datasæt* gemmer tabellen.

Det seneste resultat står på kortet Valider modellen i Håndter, med om det blev gjort i appen eller på serveren. Målingen forudsætter lukkede flader: et element med åbne eller
ødelagte flader kan give usikre dybder. Krumme flader er delt op i trekanter, så en tolerance under en millimeter bliver usikker. Elementer, som 3D-visningen ikke kan tegne, er ikke med, og resultatet siger, hvor mange de er; i en prøvemodel fra Tekla gjaldt det alle armeringsjern.

## DXF-tegninger

En DXF-fil bliver en tabel med ét tegningsobjekt pr. række (type, lag, farve, længde, areal, tekst og placering) og en
SVG-tegning. Tegningen åbnes i Bearbejd, hvor du zoomer med hjulet eller ved at knibe og panorerer ved at trække; når tegningen har fokus, flytter pilene, + og − zoomer, Home viser alt, og F zoomer til det markerede objekt. En række i tabellen zoomer til sit objekt. Lagene tændes og slukkes i
inspektøren, og et klik markerer objektet og dets række. Fanen Mængder giver antal, længde og areal pr. lag og type.

Linjer, polylinjer med buer, cirkler, buer, ellipser, splines, punkter, tekster, solider, 3D-flader, blokke og
målsætningers blokke tegnes. Skravering (HATCH) tegnes ikke.

## Eksport

Eksportér giver originalfilen, egenskaberne og mængderne som CSV (én række pr. værdi) og tegningen som SVG, ud over de
almindelige tabelformater for `data`. Diagrammer af modeller eksporteres som PNG, SVG og PDF; en 3D-model bliver da et billede.

## Begrænsninger

- Tabellerne kan ikke redigeres direkte. Modellen ændres med opskriftstrinnene for IfcOpenShell og med *Ændr med AI*, der skriver
  en ny version af IFC-filen.
- En model tegnes igen ud fra originalfilen i hver ny session. Modellen på 57 MB, som appen er afprøvet med, tager 4–6 sekunder.
- Den første tegning af en meget stor model kan låse siden et øjeblik, mens grafikkortet modtager trekanterne.
- Mængderne er ikke en mængdeberegning efter noget regelsæt. Kontrollér dem mod kilden, før de bruges.
- DXF læses i to dimensioner. DWG skal først gemmes som DXF.

## Ny model

En ny, tom model oprettes i Hent med *Ny bygningsmodel*. Vælg skema (IFC4X3_ADD2 er standard; IFC4 og IFC2X3 findes til programmer,
der ikke læser det nyeste) og navne på projekt, grund, bygning og første etage. Appen skriver modellen med IfcOpenShell i appens
Python, i meter og med modellens kontekster, og modellen består skemakontrollen. Første gang hentes Python og IfcOpenShell efter
samtykke.

Modellen bliver et almindeligt modeldatasæt. Åbn det i Bearbejd og byg i det med *Ændr med AI*, for eksempel "to etager og et
gitter på 6×4 m med ydervægge langs gitteret". Det kan eksporteres som IFC og publiceres på en Dataregium som andre modeller.

## En ny bygning ud fra en brief

Skriv en brief i formularen *Ny bygningsmodel* ("et toetagers hus 12 × 8 m med sadeltag, teglfacade, entré mod syd …"), og vælg *Byg ud
fra briefen med AI*, når modellen er oprettet: modellen åbnes i Bearbejd med AI-panelet i tilstanden **Byg ud fra brief**. Der kan du
vedhæfte fotos og skannede tegninger (JPEG, PNG eller PDF; en plantegning giver de rigtige mål, et foto udseende, materialer og
hvordan delene hænger sammen) eller tilføje billederne fra en billedsamling, for eksempel dem du har taget med Dataspatium Mobil.
AI'en læser den tomme model, siger sin plan, spørger i panelet, når briefen lader noget væsentligt stå åbent (fodaftryk, antal etager,
etagehøjde, vægtykkelser, materialer), og bygger derefter i grupper med samme værktøjer som *Ændr*: etager og net, vægge pr. etage,
dæk, åbninger, egenskaber og materialer, med forhåndsvisning og rettelser efter hver gruppe. Intet skrives i modellen, før du
forhåndsviser og godkender ændringssættet som sædvanligt, og du kan supplere med en ny brief i samme tilstand. Billederne sendes til
leverandøren sammen med briefen efter samtykket til leverandørens vært; en lokal model, der ser billeder, beholder alt på computeren.
Med *Oplysninger fra et datasæt* lægges rækker fra en tabel i briefen som tekst: en bygningsflade hentet fra kortet (Åbne geodata) bliver
hjørner i meter fra det sydvestlige hjørne, så væggene får rigtige mål, og mål og noter fra en feltformular i Dataspatium Mobil bliver
rækker; en runde med telefonen kan derefter give flere billeder og mål, og briefen suppleres i samme tilstand.
Øverst i panelet står *Bygningens oplysninger* (hvilken bygning, etager, længde, bredde, højde, fundering, tag) og *Detaljeringsgrad*
(skitse, hovedtræk eller detaljeret): udfyld det du ved, så indleder det briefen, og AI'en spørger om resten. Ordene er almindelige,
men bag dem ligger ISO 19650's informationskrav og level of information need, og modellen er tænkt som bygningens driftsmodel. Hvert
billede vedhæftes som foto, facade mod nord, øst, syd eller vest, indvendigt eller tegning, og et foto med position og tidspunkt i
filen (EXIF) får dem med i sin billedtekst, så AI'en ved, hvad den ser.

## Spørg AI om modellen

Knappen *Spørg AI* i modelvisningen åbner et panel i inspektøren, hvor du stiller et spørgsmål om den åbne IFC-model, for eksempel
"hvilke døre mangler brandklasse på etage 2?". AI-modellen læser med værktøjer (modellens oversigt, etagerne, elementer efter klasse, etage,
navn og egenskab, ét element med alle egenskaber, det du har markeret i 3D-visningen og, for en model hentet fra Dataregium, serverens
navngivne forespørgsler) og svarer med de elementer, den bygger på.
*Markér n elementer* lægger svarets elementer i udvalget, som 3D-visningen, tabellen og de andre tilstande følger. Panelet viser hvert
værktøjskald og de brugte tokens. AI'en kan kun læse: intet ændres, gemmes eller publiceres, og det næste spørgsmål fortsætter samtalen.

*Udbydere* tilføjer en cloudtjeneste eller en lokal model: Anthropic Messages eller et OpenAI-kompatibelt API (OpenAI, Gemini, Ollama,
vLLM, llama.cpp med flere), med adresse, model og API-nøgle. Nøglen holdes i sessionen eller krypteret med din adgangssætning, aldrig i
klartekst og aldrig i spørgsmålet. *Politik* afgør, hvad der må kaldes: *Spørg* beder om samtykke pr. udbyder første gang, *Cloud* tillader
cloudtjenester, og *Kun lokal* tillader kun modeller på din egen computer. Det, der sendes, er dit spørgsmål og de værktøjssvar, modellen
beder om; værktøjssvarene er data fra modellen, aldrig instruktioner, og kappes, når de er store.

## Ændr med AI

Tilstanden *Ændr* i samme panel lader AI'en foreslå ændringer i modellen, for eksempel "opret to etager og et net på 6×4 m, ydervægge
langs nettet, et dæk per etage og en dør i hver væg på etage 1". AI'en læser modellen med de samme værktøjer som i Spørg og skriver med
værktøjer til etager og net, vægge, dæk, åbninger med dør eller vindue, egenskaber, materialer, flytning og sletning. Værktøjet
`set_site` angiver modellens sted på jorden: grundens breddegrad, længdegrad og højde, og med en EPSG-kode som 3006 for SWEREF 99 TM også
kortkonverteringen, det vil sige modellens origo i øst- og nordkoordinater og dens drejning (ikke i IFC2X3, som mangler den). Værktøjerne
ændrer ingenting: de fylder et ændringssæt, som panelet lister trin for trin (mål i meter; nye elementer får referencerne new-1, new-2 …,
indtil filen har givet dem id).

*Forhåndsvis* kører ændringssættet på en kopi af modellen med IfcOpenShell i appens Python (komponenterne hentes efter samtykke første
gang), tegner resultatet i 3D med nyt grønt og ændret gult og viser, hvad der oprettes, ændres og slettes, samt skemakontrollens fund.
*Godkend* gør ændringerne til opskriftstrinnet *AI-ændring*: modellen får en ny version i arbejdsområdet, tabellerne bygges om, og trinnet
kan fortrydes præcist. Trinnet bærer proveniensen (udbyder, model og spørgsmålene). Et ændringssæt med skemafejl kan ikke godkendes,
sletninger bekræftes en gang til, og *Afvis* kasserer ændringssættet uden at røre modellen. AI'en kan aldrig gemme eller publicere: det
gør du med knapperne.

Forhåndsvisningen kontrollerer også modellens relationer: en åbning uden væg, en dør eller et vindue uden åbning, en bygningsdel uden
for etagerne og en relation uden indhold tæller som fejl, men kun når ændringssættet har forårsaget dem; det, der allerede var i
modellen, spærrer ikke for noget. Slettes en væg, følger dens døre og vinduer med. Når appens Python allerede kører, forhåndsviser
AI'en selv sit ændringssæt, før du ser det, og retter det, hjulet finder, højst to gange; godkendelsen er stadig din.

En model hentet fra Dataregium publiceres som ny version i Del med dokumentets basisversion, den version du hentede. Har dokumentet
fået en nyere version i mellemtiden, afviser serveren publiceringen (412 version_conflict); hent da den nyeste version, gentag
ændringerne og publicer igen. For en model hentet fra Dataregium spørger *Forhåndsvis* også serverens forhåndskontrol af kandidaten
(skema, buildingSMART-regler og projektets IDS), når kilden er logget ind, og et projekt, der ikke tager imod filer med valideringsfejl,
afviser publiceringen (422) med serverens fund i meddelelsen og på kortet Validér modellen.

*Foreslå på serveren* sender et forhåndsvist ændringssæt til Dataregium som et ændringsforslag i stedet for at publicere: en BCF-sag
i projektet med ændringerne vedhæftet i serverens form (snippet-typen DataregiumIfcChangeSet, som serveren holder op mod sit skema).
Formen angiver ændringer af eksisterende instanser, én pr. attribut: egenskabsværdier, placeringer, tilhørsforhold til etage og lignende,
med dokumentets basisversion, dit navn på serveren og AI-modellen som proveniens. Nye elementer, sletninger og nye relationer kan endnu
ikke angives i formen; panelet tæller dem, og de står i sagens beskrivelse. Knappen findes for en model hentet fra Dataregium, når
serveren angiver kapabiliteten `ifc_changes`, og modellen ændres ikke af forslaget. Afprøver serveren forslag (Dataregium med
IFC-LPG-modulet slået til), viser panelet afprøvningens udfald under sagen: hvor mange ændringer der kunne anvendes på basisversionen,
nye fund mod basen, og hver ændring, der ikke kunne anvendes, med årsagen (et fund af arten proposal), for eksempel at en værdi ikke
længere er den, forslaget gik ud fra. Er afprøvningen ren, kan en *manager* i projektet trykke *Godkend på serveren*: serveren gør
forslaget til dokumentets næste version (med basisversion, forslagsstiller og godkender i versionens metadata) og lukker sagen.
Modellen i appen ændres ikke af det; hent den nye version fra Dataregium for at arbejde videre på den. Har dokumentet fået nyere
versioner siden basen, afprøver serveren forslaget igen mod den nyeste i samme trin og godkender mod den, når afprøvningen er ren;
kolliderer ændringerne med det, der er kommet imellem, afviser serveren (412), og panelet viser de kolliderende nøgler (instans og
attribut) eller siger, at alt kan være ændret, når en hel fil er uploadet imellem. Hent da den nyeste version, gentag ændringerne og
foreslå igen.
Kortet *Ændringsforslag på serveren* i modelvisningen viser, for en model hentet fra Dataregium, alle forslag mod dokumentet, når
serveren angiver kapabiliteten `ifc_proposals_url`: titel, tilstand, hvem der foreslog, hvor mange ændringer og mod hvilken version;
*Godkend* gør et afprøvet forslag til næste version for den, der må godkende, så flere personer med hver sin klient kan arbejde på
samme model.

Har projektet teams (kortet *Projektets medlemmer* i Håndtér), viser panelet, hvilke teams ændringen rører. Rører den kun et teams
del, godkender teamets ansvarlige, også med rollen redaktør, og serveren afviser (403) en projektansvarlig; rører den flere teams dele,
eller ingen, godkender en projektansvarlig som før. Når et IDS-dokument får en ny version, kontrollerer serveren projektets seneste
IFC-versioner igen, og deres rapporter står som ventende imens.

Angiver serveren værdierne pr. kollision, viser panelet for hver kollision værdien i basen, det der kom imellem, og dit forslag, og
du vælger pr. kollision at beholde dit forslag eller tage det, der kom imellem. *Foreslå igen med mine valg* sender forslaget mod den
nyeste version med de beholdte ændringer og uden de strøgne, og serveren afprøver det igen, før det kan godkendes. Sammenfletningen
sker på serveren; browseren håndterer kun selve kollisionerne.

## Sammenlign versioner

Knappen *Sammenlign* i modelvisningen sammenligner den åbne model med en gemt version af samme datasæt (Versioner i Bearbejd) eller med
en anden IFC-model i arbejdsområdet, for eksempel en nyere version hentet fra et CDE. Elementerne matches på GlobalId; panelet lister,
hvad der kun findes her, kun i den anden og hvad der er ændret, attribut for attribut og egenskab for egenskab. I 3D farves det, der kun
findes her, grønt og det ændrede gult; *Vis den anden version* tegner i stedet den anden fil med det, der kun findes der, rødt. *Markér*
lægger forskellene i udvalget. Intet ændres; samme sammenligning får senere Dataregiums diff-API som kilde.

For en model hentet fra Dataregium viser panelet også *Serverens ændringssæt*: ændringerne, der gav den hentede version på serveren,
når den blev godkendt fra et ændringsforslag, med sagen, hvem der foreslog og godkendte, basisversionen (den version forslaget blev
afprøvet mod) og hver ændring med instans, attribut, gammel og ny værdi. *Markér* markerer instanserne i modellen. En version uploadet
som hel fil har intet ændringssæt. Det er en tredje kilde ved siden af øjebliksbillederne og de andre modeller.

Med *Serverens versioner* hentes dokumentets øvrige versioner på Dataregium som valg i listen *Sammenlign med*. Vælger du en af dem,
beregnes sammenligningen af serveren (dens diff mellem versioner, efter GlobalId og attribut, med placering, form, beholder og type
som egne felter) og vises som de samme lister og farver her, men uden den anden version i 3D; hent den version, hvis du vil se den.
