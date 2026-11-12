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

Modellens graf på serveren tegnes og forespørges fra *Hent*, og knappen *IFC-DB* (tidligere IFC-LPG) fører dig dertil, se [grafer.md](grafer.md#ifc-db-på-en-dataregium-server).

Grafens model, relationerne og forespørgslerne fra Dataspatiums side findes i Dataregiums [ifc-db.md](https://github.com/marwiss/Dataregium/blob/main/docs/da/ifc-db.md).

### Sagens felter og modelfilen

*Ny sag* tager de felter, som svensk gennemgangspraksis beder om, alle fra projektets egne lister: type og status (altid sat),
prioritet, etiket, ansvarlig part, tildelt, fase og frist. BCF har intet eget felt til den ansvarlige part, så den tilføjes som en
etiket. Øjebliksbilledet er højst 1.500 pixel på den længste side, som BCF angiver. Når serveren tillader det, knytter appen sagen
til modelfilen (BCF API'ets `PUT /topics/{guid}/files`): med projektets egen post for den version, modellen blev hentet fra, og
ellers med filens navn, tidsstempel og IfcProject fra IFC-filens header.

### BCF-filer

Appen skriver BCF-filer som BCF-XML 3.0, buildingSMART's format for sager:

- Hver sag har en type og en status, en titel, en dato og en forfatter. Uden type eller status bliver de Issue og Open. Forfatteren
  er din konto på serveren, når du er logget ind, ellers det navn, du har angivet til kommentarer (*Dit navn*), ellers Dataspatium;
  appen finder aldrig på et navn.
- Kommentarer og viewpoints ligger i sagen, og etiketter, links, dokumentreferencer og relaterede sager ligger i deres lister.
  Filen har `extensions.xml` med de typer, statusser, prioriteter, etiketter, tildelte og faser, den bruger.
- Hver sags header nævner modelfilen: navnet fra IFC-filens header, filens tidsstempel og IfcProjects GlobalId, og adressen for en
  model fra en server.
- Øjebliksbilleder er højst 1.500 pixel på den længste side; et større billede tegnes igen i den størrelse.
- Dokumenter, som AI-kontrollens fotos, ligger i mappen Documents og står i `documents.xml`.

Appen læser BCF 3.0 og 2.1 fra andre programmer og sine egne tidligere filer. Kommentarer, viewpoints med kamera og snit,
øjebliksbilleder, markerede, skjulte og farvede komponenter og dokumenter følger med. Læs en BCF-fil ind i Hent: sagerne bliver en
tabel med kommentarer og komponenter i tabeller ved siden af, og filen gemmes med sagerne, så billederne og visningerne bliver.

### Gennemgang efter svensk praksis

I svensk praksis for gennemgang af modeller med BCF har en sag én af seks statusser. Appen genkender dem i projektets egen
statusliste og giver dem de samme farver som andre statusser:

- *Ny kommentar* (ny kommentar) regnes som åben, som Open.
- *Ska åtgärdas* (skal udbedres) og *Ny granskning* (ny gennemgang) regnes som i gang, som In progress: sagen skal udbedres eller
  tages op i næste gennemgang.
- *Har åtgärdats* (er udbedret), *Avvisad* (afvist) og *Godkänd* (godkendt) regnes som færdige: udbedret som Resolved, de to andre
  som Closed.

Statusserne bruges kun, når projektet på serveren har dem i sin liste; appen foreslår dem ikke selv. Et Dataregium-projekt har Open,
In progress, Resolved og Closed som standard, som svarer til dem som ovenfor. I Dataregium indstiller en administrator projektets
statusliste (`topic_status`) på projektets side under `/admin`. Knappen *Använd Praxis statusar* (brug Praxis-statusser) samme sted
giver listen de seks statusser ovenfor og lader projektets øvrige lister være, som de er. Felterne for en gennemgangssag findes i *Ny
sag* og under *Flere indstillinger* i AI-kontrollen: titel, beskrivelse, status, tildelt, ansvarlig part (som etiket), fase og frist,
og den, der gennemgår, er den, der er logget ind.

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
- **Klimaerklæring**: en foreløbig klimaerklæring ud fra modellen pr. kategori og lag, se *Foreløbig klimaerklæring* nedenfor.
- **Materialeopgørelse**: grundlag for affaldshåndteringsplanen ud fra modellen, med byggevarer der kan genbruges, affaldet pr.
  fraktion og lag og de farlige stoffer modellen angiver, se *Materialeopgørelse til affaldshåndteringsplanen* nedenfor.

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
  Under *IDS i appen* vælger du i stedet en af appens egne IDS-filer, for eksempel *Avfallshantering* (se *Materialeopgørelse til
  affaldshåndteringsplanen*), som afprøves på samme måde; *Gem IDS-filen* gemmer den valgte på computeren.

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
  `search_bsdd` søger kun i frie ordbøger, hvis licens er læst (IFC 4.3, Uniclass 2015 og ETIM 10.1), og svarer med ordbog og licens for
  hver klasse, og `set_classification` skriver systemets udgave, udgiver og adresse på dets `IfcClassification`.

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

## Foreløbig klimaerklæring

Værktøjet **Klimaerklæring** i Analysér (fanen Mængder) beregner en foreløbig klimaerklæring ud fra modellen: klimapåvirkningen for
A1–A3, A4 og A5 i kg CO₂e pr. kategori og pr. lag i bygningen. Det er et grundlag i projekteringen, ikke en erklæring til registrering
hos Boverket.

**Kategori og lag.** Hver bygningsdel får en af Boverkets fire kategorier (bærende konstruktionsdele – fundering, bærende
konstruktionsdele – øvrige, klimaskærm, indervægge) eller *Indgår ikke*, og et af bygningens seks lag fra Boverkets rapport 2024:26:
1 grund og fundering, 2 bærende konstruktion og øvrige bærende dele, 3 klimaskærm, tag og facade, 4 tekniske installationer,
5 lofter, indervægge og overflader indendørs, 6 fast inventar. Reglerne læser kun IFC-klassen, PredefinedType (bygningsdelens eller
typens) og LoadBearing og IsExternal i Pset_*Common; ingen klassifikation læses. De følger Boverkets liste over bygningsdele, der
indgår: pæle, jordarbejder, installationer, fast inventar, flytbare indervægge, indvendige overflader og solafskærmning indgår ikke;
trapper, ramper og rækværk er bærende; lofter, nedhængte lofter og inderdøre hører til indervæggene. Kolonnen *Regel* viser, hvad
der afgjorde.

- **Usikker**: bygningsdelen indgår, men kategorien er usikker, for eksempel en indervæg uden LoadBearing eller en dør uden
  IsExternal. Den tælles i den viste kategori og står under *Skal afgøres*. En ydervæg er klimaskærm uanset LoadBearing.
- **Kan ikke afgøres**: reglerne kan ikke sige, om bygningsdelen indgår, for eksempel et proxyelement eller solceller (som kun indgår,
  når de er integreret i tag eller facade). Den tælles ikke, før du har afgjort den.
- **Udledt IsExternal**: når filen ikke angiver IsExternal, får en dør eller et vindue værdien fra den væg, den sidder i. *Udled
  IsExternal* læser bygningens topologi med appens Python, som starter da (første gang hentes dens komponenter med dit samtykke):
  væggene langs en etages ydre grænse er ydre, og på en lukket etage er rummenes øvrige vægge indre. Reglen siger, når en værdi er
  udledt.
- En sammensat bygningsdel, for eksempel et tag af tagplader, tælles i sine dele, og en del, som reglerne ikke kan afgøre, får
  helhedens kategori.

Under **Skal afgøres** vælger du kategori for en hel gruppe bygningsdele med samme klasse, type og regel. Valget gemmes pr.
bygningsdel (GlobalId) i browseren, indtil du lader reglerne afgøre igen.

**Mængder.** Volumen, areal og vægt tages fra filens mængder, netto før brutto og væggens sideareal. Har filen ingen mængder,
beregnes volumenen ud fra geometrien, når bygningsdelen er en enkel ekstrudering: profilens areal gange dybden (rektangel, cirkel,
I-profil, polylinje med flere), også gennem typens repræsentation og før en klipning. Åbninger trækkes da ikke fra, og kolonnen
*Mængdens kilde* siger det. Døre og vinduer tælles pr. kvadratmeter ud fra deres mål. En bygningsdel med materialelag deles pr.
materiale efter lagenes tykkelse. Ellers har rækken ingen mængde og tælles ikke.

**Klimadata.** *Hent klimadatabasen* henter Boverkets klimadatabase (omkring 0,9 MB) fra api.boverket.se med dit samtykke til
API-hentning og gemmer den i browseren; intet om modellen sendes. Under *Materialer og ressourcer* vælger du en ressource for hvert
materiale. Forslagene bygger først på materialets kategori i IFC (IfcMaterial.Category, for eksempel concrete, steel, wood, glass eller
gypsum) og derefter på navnet; døre og vinduer foreslås ud fra typens navn. *Godkend forslagene* gemmer forslagene som dine valg, der
gælder alle modeller. Klimapåvirkningen er massen (volumenen gange densiteten eller arealet gange vægten pr. kvadratmeter) gange
databasens værdier for A1–A3, A4 og A5 (spild). Boverket oplyser, at klimadata for byggevarer er sat konservativt, omkring 25 procent
over gennemsnittet; værktøjet regner med den konservative værdi og viser den typiske efter ønske.

Hver visning kan gemmes som datasæt. Kilde: Boverket, klimadatabasen (åbne data, se [licenser.md](licenser.md)).

## Materialeopgørelse til affaldshåndteringsplanen

Værktøjet **Materialeopgørelse** i Analysér (fanen Mængder) samler det, modellen ved, som grundlag for affaldshåndteringsplanen
(avfallshanteringsplan). Efter den svenske PBL 10 kap. 8 a §, der gælder siden 1. juli 2026, skal bygherren sørge for, at der findes
en affaldshåndteringsplan med oplysninger om

1. hvilke byggevarer der kan genbruges, og hvordan de tages hånd om, og
2. hvilket affald foranstaltningen kan give anledning til, og hvordan det tages hånd om, særlig hvordan bygherren vil muliggøre a)
   materialegenanvendelse af høj kvalitet og b) sikker håndtering og fjernelse af farlige stoffer.

Planen kræves ikke, når den åbenlyst ikke er nødvendig, og den kontrolansvarlige (kontrollansvarig) har samme opgave for den som for
kontrolplanen. Boverket foreslog planen i rapport 2024:26 under navnet ressourceforvaltningsplan. Værktøjet giver grundlaget; planen
og vurderingerne er bygherrens. Visningerne følger bestemmelsens to punkter.

**1. Byggevarer der kan genbruges.** Bygningsdelene med en type, dem med produktdata først: producent (Manufacturer), model
(ModelLabel) og GTIN (GlobalTradeItemNumber) fra Pset_ManufacturerTypeInformation, helst på typen, og serienummer (SerialNumber) og
stregkode (BarCode) fra Pset_ManufacturerOccurrence på bygningsdelen. GTIN-nummerets kontrolciffer afprøves efter GS1; en fejl
vises, men rettes aldrig. Hver række har laget i bygningen, materialerne, fraktionerne og de farlige stoffer, modellen angiver.
IFC2X3 har intet GTIN.

**2 a. Affald pr. fraktion og pr. lag og fraktion.** Hvert materiale i hver bygningsdel får en affaldsfraktion efter den svenske
affaldsforordning (avfallsförordningen 3 kap. 10 §), som ud over farligt affald kræver, at træ, mineral (beton, tegl, klinker,
keramik og sten), metal, glas, plast og gips sorteres fra. Fraktionen tages først fra materialets kategori i IFC
(IfcMaterial.Category, for eksempel concrete, steel, wood, glass, gypsum eller plastic) og ellers fra materialets navn (beton,
limtræ, gipsplade, termorude og lignende, på de nordiske sprog og engelsk). Mineraluld, glasuld og stenuld hører hverken til mineral
eller glas, og kompositter som glasfiberarmeret plast, navne der angiver flere fraktioner (træ/aluminium) eller ingen, og
bygningsdele uden materiale bliver *Andet / afgøres*. Kolonnen *Regel* viser, hvad der afgjorde. Summerne giver bygningsdele,
rækker, volumen, areal og masse pr. fraktion og pr. lag i bygningen (klimaerklæringens seks lag) og fraktion. Ingen klassifikation
læses.

**2 b. Farlige stoffer.** Kun det, en egenskab i modellen siger: en egenskab hvis navn eller sæt gælder farlige stoffer eller
farligt affald (for eksempel Pset_EnvironmentalImpactValues.HazardousWaste, eller et eget sæt med asbest eller PCB), og hvis værdi
siger ja, på bygningsdelen, typen eller materialet. Appen gætter aldrig. Angiver modellen ingen farlige stoffer, siger værktøjet
det, og en kortlægning af farlige stoffer er stadig nødvendig.

**Alle bygningsdele og materialer** er rækkerne bag summerne: mængden, materialets kategori, tykkelsen, fraktionen med reglen,
laget, densiteten og massen.

**Mængder og masse.** Mængderne er klimaerklæringens: filens mængder, ellers geometrien for enkle ekstruderinger, og en bygningsdel
med materialelag deles efter lagenes tykkelse; døre og vinduer tælles her pr. materiale. Massen er filens vægt, ellers volumen gange
materialets densitet (Pset_MaterialCommon.MassDensity i kg/m³). Mangler densiteten, har rækken ingen masse, og noten siger, hvor
mange rækker det gælder.

**IDS til affaldshåndtering.** *IDS Affaldshåndtering* åbner IDS-kontrol med appens IDS-fil `SE-Dataspatium_Avfallshantering.ids` og
afprøver modellen mod den i appens Python: et materiale med en af IFC's anbefalede kategorier på hver bygningsdel; basismængden for
volumen på vægge, dæk, bjælker, søjler, stænger og plader (IfcMember og IfcPlate), fundamenter og trappeløb og for areal på døre,
vinduer, beklædninger, tage og glasfacader; producent og model på døre, vinduer og installationer og GTIN i rigtig form, når det
findes. Filen gælder IFC4 og IFC4.3, fordi IFC2X3 mangler materialekategori, skabeloner for basismængder og GTIN. ifctester
godkender materialekravet, når mindst ét af bygningsdelens materialer har en kategori, og sammensatte bygningsdele (tage, trapper,
ramper og glasfacader) afprøves i deres dele.

Hver visning kan gemmes som datasæt. Intet hentes fra nettet.

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

### Betegnelser, numre og placering

Under *Betegnelser og id* i formularen udfylder du det, du ved; kun det skrives i filen:
- *Matrikelbetegnelse* bliver grundens navn (IfcSite.Name) og dens matrikel-id (Pset_LandRegistration.LandID); det, du skrev
  under *Grund*, bliver så grundens lange navn.
- *Bygningsnummer* bliver bygningens navn (IfcBuilding.Name) og *Bygningens navn* dens lange navn (LongName).
- *Nationalt bygnings-id* skrives i Pset_BuildingCommon.BuildingID med IsPermanentID, så modellen og registrene taler om samme
  bygning.
- *Første etages beskrivelse* bliver etagens Description, for eksempel at den er indgangsplan.
- *Forfatter* og *Organisation* skrives kun i IFC-filens hoved, hvis du udfylder dem; et navn er en personoplysning.

Modellen får også konteksten Axis til væggenes akser fra starten, og rapporten minder om, at modellen mangler et koordinatsystem
(buildingSMART-reglen GRF003), indtil `set_site` har givet den et.

AI'en nummererer etagerne i højdeorden for hele projektet (Plan 1, Plan 2 …) og skriver indgangsplanet i etagens beskrivelse;
`create_storeys_and_grid` tager `description` og `long_name` pr. etage. `create_spaces` tager et `number` pr. rum, entydigt i
bygningen: nummeret bliver rummets Name, rumnavnet dets LongName og `long_name` dets beskrivelse, og en rumtype (`room_type`)
skrives som ObjectType med PredefinedType USERDEFINED. Uden nummer gælder navnene som før.

`set_site` kender de sammensatte EPSG-koder for SWEREF 99 med højder i RH 2000: 5845 for SWEREF 99 TM og 5846–5857 for de tolv
lokale zoner i samme rækkefølge som 3007–3018 (for eksempel 5850 for SWEREF 99 18 00 + RH 2000). For en bygning i Sverige
foretrækker AI'en den lokale zone, når koordinaterne er i den; den regner aldrig selv koordinater om. Koordinatsystemet
(IfcProjectedCRS) får en beskrivelse i klartekst og, når koden ikke angiver højdesystemet, RH 2000 som VerticalDatum (et andet med
`vertical_datum`). Kortenheden er altid meter og konverteringens Scale filens længdeenhed i meter (GRF005), så en model i
millimeter får Scale 0,001. Hver overordnet kontekst (Model, Plan) får sin egen IfcMapConversion med de samme værdier (GRF001).
Bygningens højde over havet står i konverteringens OrthogonalHeight; i IFC4 og IFC2X3 også i IfcBuilding.ElevationOfRefHeight, som
IFC4X3 har udfaset.

Filhovedet: hver IFC-fil, appen skriver eller gemmer, får FILE_DESCRIPTION med visningsdefinition og niveauet 2;1, og FILE_NAME med
filens navn, tiden efter ISO 8601, præprocessoren (Dataspatium og IfcOpenShell med versioner) og oprindelsesprogrammet i formen
*Dataspatium - Dataspatium - version*. Visningsdefinitionen er CoordinationView_V2.0 for IFC2X3 og ReferenceView_V1.2 for IFC4.
IFC4X3 har ingen officiel visning for en model i hele skemaet (Reference View udelader blandt andet ekstruderede legemer), så
hovedet siger `notYetAssigned` i stedet for en visning, filen ikke følger; buildingSMARTs valideringstjeneste markerer det, og en
modtager, der kræver en visning, angiver den. En fil, appen ændrer, beholder sin egen forfatter, organisation og sit
oprindelsesprogram, og sin visning, når valideringstjenesten godtager den.

## En ny bygning ud fra en opgavebeskrivelse

Skriv en opgavebeskrivelse i formularen *Ny bygningsmodel* ("et toetagers hus 12 × 8 m med sadeltag, teglfacade, entré mod syd …"), og vælg *Byg ud
fra opgavebeskrivelsen med AI*, når modellen er oprettet: modellen åbnes i Bearbejd med AI-panelet i tilstanden **Byg ud fra beskrivelse**. Der kan du
vedhæfte fotos og skannede tegninger (JPEG, PNG eller PDF; en plantegning giver de rigtige mål, et foto udseende, materialer og
hvordan delene hænger sammen) eller tilføje billederne fra en billedsamling, for eksempel dem du har taget med Dataspatium Mobil.
AI'en læser den tomme model, siger sin plan, spørger i panelet, når beskrivelsen lader noget væsentligt stå åbent (fodaftryk, antal etager,
etagehøjde, vægtykkelser, materialer), og bygger derefter i grupper med samme værktøjer som *Ændr*: etager og net, vægge pr. etage,
dæk, åbninger, egenskaber og materialer, med forhåndsvisning og rettelser efter hver gruppe. Intet skrives i modellen, før du
forhåndsviser og godkender ændringssættet som sædvanligt, og du kan supplere med en ny beskrivelse i samme tilstand. Billederne sendes til
leverandøren sammen med beskrivelsen efter samtykket til leverandørens vært; en lokal model, der ser billeder, beholder alt på computeren.
Med *Oplysninger fra et datasæt* lægges rækker fra en tabel i beskrivelsen som tekst: en bygningsflade hentet fra kortet (Åbne geodata) bliver
hjørner i meter fra det sydvestlige hjørne, så væggene får rigtige mål, og mål og noter fra en feltformular i Dataspatium Mobil bliver
rækker; en runde med telefonen kan derefter give flere billeder og mål, og beskrivelsen suppleres i samme tilstand.
Opgavebeskrivelsen og billederne kan også lægges på serveren som modellens grundlag, når modellen er hentet fra et CDE: sagen *Grundlag* i
modellens projekt får beskrivelsen som tekstdokument og hvert billede som dokument, så andre, der arbejder med modellen i egne klienter,
ser, hvad den blev bygget af. Knappen hedder *Læg grundlaget på serveren*.
Øverst i panelet står *Bygningens oplysninger* (hvilken bygning, etager, længde, bredde, højde, fundering, tag) og *Detaljeringsgrad*
(skitse, hovedtræk eller detaljeret): udfyld det du ved, så indleder det beskrivelsen, og AI'en spørger om resten. Ordene er almindelige,
men bag dem ligger ISO 19650's informationskrav og level of information need, og modellen er tænkt som bygningens driftsmodel. Hvert
billede vedhæftes som foto, facade mod nord, øst, syd eller vest, indvendigt eller tegning, og et foto med position og tidspunkt i
filen (EXIF) får dem med i sin billedtekst, så AI'en ved, hvad den ser. Oplysningerne fra et datasæt giver også bygningsfladens
sydvestlige hjørne på kortet, så AI'en placerer modellen med `set_site` (placering, højde og SWEREF 99 TM), og med *Med terrænhøjde i
hjørnerne*, som vises når Lantmäteriets kilde er tilføjet, terrænhøjden i hvert hjørne fra højdemodellen: et netværkskald med din nøgle
efter samtykke.
Når et datasæt er valgt, viser *Stedet på kortet* bygningens grundflade tæt på, og valget af baggrundskort tilbyder det ortofoto, der
dækker stedet: du ser bygningen oppefra, mens du placerer den. Kortet tegnes, når du åbner det, og billederne hentes først, når du
vælger baggrund og giver samtykke. Danmark, Finland og Island har åbne ortofotos som fliser; i Sverige læser appen Lantmäteriets
ortofoto for stedet og 250 m omkring det fra Lantmäteriets filer med din nøgle fra Geotorget (den samme som til terrænhøjden); Norge har
intet åbent ortofoto (se [kartor.md](kartor.md#ortofotos)).
Efter væggene på hver etage læser forhåndsvisningen bygningens topologi: væggenes midterlinjer bliver til rum, og etagen er lukket, når
væggene lukker om mindst ét rum, og ingen vægende står løs; AI'en retter løse ender ved at flytte eller tilføje vægge, før den lægger
dækkene. Ydervæggene med deres verdenshjørner lader AI'en parre et foto af facaden mod syd med de rigtige vægge (læseværktøjet
`get_topology`), og den samme topologi vises på kortet *Topologi* i Kontrollér.

### Formål, fase og krav

Under *Bygningens oplysninger* findes også *Formål*, *Fase* og *Krav (IDS)*. Formålet er det, modellen skal bruges til, og det vælger
detaljeringsgrad og krav, som du kan ændre bagefter:

| Formål | Detaljeringsgrad | Krav |
|---|---|---|
| Volumenstudie | Skitse | SE-Dataspatium_Grund |
| Byggetilladelse | Hovedtræk | SE-Dataspatium_Grund |
| Klimaerklæring | Hovedtræk | SE-Dataspatium_Klimatdeklaration |
| Drift og vedligehold | Detaljeret | SE-Dataspatium_Grund |
| Affaldshåndtering | Detaljeret | SE-Dataspatium_Avfallshantering |
| Andet (med egen tekst) | Hovedtræk | ingen |

Fasen siger, hvor i bygningens liv modellen hører hjemme: forundersøgelse, forslag, udførelsesprojekt, under opførelse eller
eksisterende bygning. Formål, fase og krav indleder opgavebeskrivelsen. Med krav prøver hver forhåndsvisning, AI'ens egen og din, kandidaten mod
IDS-filen, og AI'en får de specifikationer, der ikke er opfyldt, så den kan rette dem. Kravene forhindrer ikke godkendelsen; panelet
viser, hvor mange specifikationer der er opfyldt, og hvilke der ikke er.

Detaljeringsgraden følger informationsbehovet i ISO 7817-1 (afsnit 6), som deler det i geometri, alfanumerisk information og
dokumentation. Med appens egne ord betyder de tre niveauer dette pr. aspekt:

| Aspekt | Skitse | Hovedtræk | Detaljeret |
|---|---|---|---|
| Detalje | etager, ydervægge og dæk som enkle legemer, ingen åbninger | alle vægge med typernes tykkelse, dæk, tagets form og åbninger med rimelige mål | lag pr. type, døre og vinduer med karm og ramme, vægge der mødes i hjørnerne |
| Dimensioner | legemer i 3D og væggens akse | som skitsen | som skitsen; plansymboler kan komme senere |
| Placering | etagernes højder, gitteret og grunden, når den er kendt | mål fra tegning eller opgavebeskrivelse, georefereret når oplysningerne findes | indmålte eller målsatte placeringer, åbninger på det præcise sted |
| Udseende | standardfarver | farve efter materialets kategori | en overfladestil pr. materiale, adskilt fra materialet |
| Parametrisk adfærd | ekstruderinger hvis mål kan ændres | typer (skift typen, så ændres alle) og lag | forbindelser der genberegner hjørnerne, døre og vinduer med parametre |
| Identifikation | navn, IFC-klasse med PredefinedType og GlobalId | typer med navn, rum med nummer og navn | dele og rumklasser, Tag på døre og vinduer |
| Informationsindhold | etager og højder | IsExternal, LoadBearing og materialer på typerne, basismængder | brand, U-værdi og klimadata pr. type eller materiale, tilstanden i en eksisterende bygning |
| Dokumentation | opgavebeskrivelsen | opgavebeskrivelsen og billederne som modellens grundlag | EPD-referencer og produktblade |

## Kontrollér med AI

Tilstanden **Kontrollér** i AI-panelet afprøver en eksisterende bygnings model mod fotos af skader og slid, taget med Dataspatium
Mobil, et kamera eller en drone, og mod mål fra en feltformular. Vedhæft fotoene i panelet, mærket med facade eller indvendigt, eller
tilføj billederne fra en billedsamling, du har importeret i Hent; et foto med position og tidspunkt i filen (EXIF) får dem i sin
billedtekst, og *Oplysninger fra et datasæt* lægger mål og noter fra en feltformular i spørgsmålet. AI'en læser modellen med de samme
værktøjer som i *Spørg*, finder elementet, som hvert foto viser, og skriver et fund for hver skade med titel, beskrivelse, stand (god,
acceptabel, dårlig eller kritisk), prioritet (lav, middel, høj eller akut) og anbefalet tiltag; et foto uden synlig skade giver intet
fund. Elementets stand lægges i egenskabssættet Pset_Condition (vurderingsdato, stand og en kort beskrivelse) i et ændringssæt, som du
forhåndsviser og godkender som i *Ændr*, og ingen elementer oprettes, flyttes eller slettes. Fundene vises under svaret, og *Gem
fundene som tabel* opretter et nyt datasæt med ét fund per række: foto, element, titel, beskrivelse, stand, prioritet, tiltag, dato og
fotoets position. *Eksportér som BCF* downloader en BCF-fil med én sag per fund, hvor visningen ser på elementet, markeret og farvet, med et billede af modellen som øjebliksbillede og fotoet som dokument, og for en model hentet fra en server, du er logget ind på, opretter *Opret sager på serveren* de samme sager i
modellens projekt efter en bekræftelse; der bliver fotoet et dokument i projektet, eller en egen viewpoint med kun fotoet, når du ikke må tilføje dokumenter, og sagerne knyttes til modelfilen, når serveren tillader det. Under *Flere indstillinger* giver du sagerne status, tildelt, ansvarlig part, fase og frist, på en server fra projektets lister. Fotoene sendes til leverandøren sammen med spørgsmålet efter samtykket for leverandørens vært,
og de forlader kun computeren igen, når du selv opretter sager på serveren.

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
kortkonverteringen, det vil sige modellens origo i øst- og nordkoordinater og dens drejning (ikke i IFC2X3, som mangler den).
Værktøjet `create_roof` lægger et sadeltag, valmtag, pulttag eller fladt tag med hældning, udhæng og tykkelse på en etages vægge (uden
angivet etage den øverste): et IfcRoof af tagplader (IfcSlab af typen ROOF), én per tagflade, over væggenes omskrevne rektangel eller
et angivet rektangel (en anden kontur erstattes indtil videre af sit omskrevne rektangel). Værktøjet `create_spaces` opretter de rum,
væggene lukker om, som IfcSpace med navne fra rumprogrammet, valgt med et punkt indeni eller deres nummer i topologien, med højden op
til næste etage, rumarealer (Qto_SpaceBaseQuantities) og grænser mod væggene og deres døre og vinduer. Værktøjerne ændrer ingenting: de
fylder et ændringssæt, som panelet lister trin for trin (mål i meter; nye elementer får referencerne new-1, new-2 …, indtil filen har
givet dem id).

Værktøjet `define_type` opretter en vægtype, dæktype eller tagtype (IfcWallType, IfcSlabType eller IfcSlabType af typen ROOF til
tagpladerne) med materialelag i meter, for en væg fra højre side til venstre set fra start mod slut og for dæk og tag oppefra og ned.
Hvert lag kan få materialets kategori (IFC's anbefalede: concrete, steel, aluminium, block, brick, stone, wood, glass, gypsum, plastic
og earth) og lagets rolle (bærende, isolering, indre eller ydre overflade), men kun når de er kendt. `create_wall`, `create_slab` og
`create_roof` tager typen: elementet får typen (IfcRelDefinesByType), sin tykkelse fra lagene og lagene lagt på sig
(IfcMaterialLayerSetUsage: væggens centreret på linjen, dækkets nedad fra oversiden i etagens højde og tagpladernes opad fra
undersiden), og dets PredefinedType står på typen. Materialer og fælles egenskaber hører til typen, og AI'en definerer typerne først.
Når ændringssættet køres, forbindes de vægge, det opretter, med de vægge, de møder (IfcRelConnectsPathElements): i et hjørne går den
tykkeste væg (ved samme tykkelse den længste) forbi hjørnet, og den anden slutter mod den, og en væg, der ender på en andens linje,
slutter mod dens side, så hjørnerne hverken får sprækker eller overlap, og intet volumen tælles to gange. Væggenes midterlinjer ændres
ikke, og hjørner i andre vinkler end rette forbindes, som de er tegnet. Til sidst får de vægge, dæk, tage, døre og vinduer, som
ændringssættet har oprettet eller ændret, basismængder (Qto_WallBaseQuantities, Qto_SlabBaseQuantities, Qto_RoofBaseQuantities,
Qto_DoorBaseQuantities og Qto_WindowBaseQuantities) beregnet ud fra målene, med åbningerne trukket fra og med navnene fra skemaets
skabeloner.

Værktøjet `create_element` laver de bygningsdele, der ikke har et eget værktøj, af den mest specifikke IFC-klasse og aldrig som
IfcBuildingElementProxy: søjler (IfcColumn), bjælker (IfcBeam), stænger som stolper og spær (IfcMember), fundamenter (IfcFooting), pæle
(IfcPile), beklædninger som gulvbelægning, lofter, facadebeklædning, tagdækning og isolering (IfcCovering), rækværker (IfcRailing),
skorstene (IfcChimney), solafskærmning (IfcShadingDevice), sanitet (IfcSanitaryTerminal), møbler (IfcFurniture, i IFC2X3
IfcFurnishingElement) og lige trapper (IfcStair). Klassen og dens PredefinedType kontrolleres mod modellens skema som i de andre
værktøjer. Kroppen er en ekstruderet profil: et rektangel, en cirkel eller et omrids i etagens plan, stående opad fra en højde over
etagen (søjler, fundamenter, beklædninger, møbler) eller liggende i en retning (bjælker, stænger og rækværker). Elementet ligger på
etagen eller er en del af en helhed (`part_of`), for eksempel et rækværk på en trappe, og ligger da i helheden og på dens etage, men
ikke direkte på etagen. En beklædning kan angive, hvad den beklæder (`host`): en bygningsdel eller et rum. I IFC4 og senere bliver
den en del af bygningsdelen (IfcRelAggregates) eller ligger i rummet; kun i IFC2X3 får den IfcRelCoversBldgElements eller
IfcRelCoversSpaces. En lige trappe (STRAIGHT_RUN_STAIR) består af et skrånende trappeløb (IfcStairFlight, STRAIGHT) med antal trin,
trinhøjde, trindybde og bredde som attributter og i Pset_StairFlightCommon og efter ønske en repos (IfcSlab, LANDING) øverst; den
sidste stigning er reposens eller dækkets forkant.

`define_type` laver også typer for beklædninger (med lag, som en dæktype), søjler, bjælker, fundamenter, rækværker, døre og vinduer
(IfcCoveringType, IfcColumnType, IfcBeamType, IfcFootingType, IfcRailingType, IfcDoorType og IfcWindowType; i IFC2X3 IfcDoorStyle og
IfcWindowStyle) med materiale. En dørtype har sin åbningsmåde (OperationType, for eksempel SINGLE_SWING_LEFT, med hængslerne til
venstre set i den retning, døren åbner), en vinduestype sin opdeling (PartitioningType, for eksempel SINGLE_PANEL eller
DOUBLE_PANEL_VERTICAL), og begge bredde, højde og karmdybde. Geometrien med karm, dørblade eller rammer og glas tegnes af IfcOpenShell
én gang på typen og genbruges af hver dør og hvert vindue af typen (mappet geometri), og typen får karmens og dørbladenes egenskaber
(IfcDoorLiningProperties, IfcDoorPanelProperties, IfcWindowLiningProperties). `create_opening` tager typen: døren eller vinduet får
typens størrelse og geometri og står i flugt med væggens venstre side, set fra væggens start mod dens slutning (indersiden af en
ydervæg tegnet mod uret), og en dør åbner til den side, en venstrehængt med hængslerne i den side af åbningen, der er nærmest væggens
start. Med `side: right` vendes den: i flugt med højre side og åbnende mod den. En karm så dyb, som væggen er tyk, fylder hele
lysningen.
Værktøjet `edit_element` ændrer et eksisterende element på stedet, så det beholder sit GlobalId hele sin levetid: en væggs start, slut,
tykkelse, højde og type, et dæks omrids, tykkelse og type, en åbnings placering, bredde, højde og underkant sammen med dens dør eller
vindue, et tags hældning, udhæng og tagfodens højde, og ethvert elements navn. Målene læses ud fra elementets egen geometri (væggens
start og slut ud fra dens akse), og kroppen, aksen, lagene, basismængderne og vægsamlingerne laves på ny. Læseværktøjet
`get_parameters` viser AI'en de mål, som `edit_element` ændrer, læst på samme måde, så den kan ændre et element, den ikke selv har
oprettet. Væggens åbninger beholder deres plads langs væggen, så længe den beholder sin retning (ellers deres afstand fra starten), og
skal kunne være i den, og taget beholder sit rektangel. En væg eller et dæk med type får sin tykkelse fra typen, så en tykkere væg får
en anden type. Et element, der ikke er tegnet, som skriveværktøjerne tegner, kan kun få nyt navn, og svaret siger, hvad AI'en kan gøre
i stedet. AI'en ændrer derfor elementer i stedet for at slette og oprette dem på ny og sletter kun, når du beder om det. Flytning med
`transform_elements` sker i etagens plan: en dør eller et vindue flyttes med sin åbning, en flyttet væg forbindes med de vægge, den
møder, intet punkt bliver tilbage uden brug, og grunden, bygningen og etagerne flyttes aldrig, fordi deres placering og højder gælder
hele projektet og kun ændres efter aftale.
Produktidentiteter skriver AI'en kun, når du angiver dem, og den finder aldrig på dem: GTIN (GlobalTradeItemNumber), producent
(Manufacturer) og model (ModelLabel) i Pset_ManufacturerTypeInformation på typen, og serienummer (SerialNumber) og stregkode
(BarCode) i Pset_ManufacturerOccurrence på bygningsdelen. IFC2X3 har intet GTIN.
**Bærende, status og egenskaber.** `create_wall` og `create_slab` tager `load_bearing` (bærende eller ej), og de og `create_roof`
tager `status` (NEW ny, EXISTING eksisterende, DEMOLISH nedrives, TEMPORARY midlertidig), men kun når opgavebeskrivelsen eller du siger det:
AI'en gætter aldrig, og en digital tvilling af en eksisterende bygning får EXISTING. Værdierne skrives som LoadBearing og Status i
Pset_WallCommon, Pset_SlabCommon og Pset_RoofCommon, på typen når alle elementer af typen siger det samme, og ellers på elementet;
IFC2X3 har ingen Status, og rapporten siger det. Når ændringssættet køres, sætter appen selv IsExternal ud fra topologien på de vægge,
det har oprettet eller ændret: sand langs etagens ydre grænse og falsk inde i bygningen, og dørene og vinduerne i væggene får deres
vægs værdi. Tage og tagplader er ydre. En etage, hvis vægge ikke slutter sig, får ingen IsExternal, og rapporten og AI'ens
forhåndsvisning siger hvorfor; en værdi, som modellen allerede havde, bevares. Det er med LoadBearing og IsExternal, at
klimaerklæringen skelner mellem kategorierne.
`set_properties` prøver et egenskabssæt, der hedder Pset_… eller Qto_…, mod IfcOpenShells skabeloner for modellens skema: et sæt eller
en egenskab, som skabelonen mangler, afvises med de nærmeste navne, sand og falsk, mål og opregninger skal have den rigtige type, og
et tal med enheden skrevet i værdien ("40 dB") afvises. Angiv kun tallet, længder i meter, arealer i m², rumfang i m³ og vinkler i
grader, så skriver appen dem i filens enheder. Et sæt, der hedder Qto_…, bliver et mængdesæt (IfcElementQuantity). Et eget
egenskabssæt må ikke begynde med Pset_ eller Qto_, og AI'en får det råd at kalde det land-oprindelse-projekt_Navn, for eksempel
SE-ACME-42_Akustik, med egenskabsnavne i PascalCase uden å, ä og ö. Egenskaberne skrives i elementets eget sæt, aldrig i typens.
`assign` tager materialets kategori (IfcMaterial.Category, de samme elleve som i `define_type`).

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
IFC-DB-modulet slået til), viser panelet afprøvningens udfald under sagen: hvor mange ændringer der kunne anvendes på basisversionen,
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
samme model. En server, der angiver formen `ops_form` (`dataspatium-tools/1`), får desuden skriveværktøjernes operationer, så nye
elementer, sletninger og relationer kommer med i forslaget: serveren bygger dem på basisversionen med samme kode som appen, og en
kolliderende nøgle, du opgiver, sendes med som `keep_theirs`.

Har projektet teams (kortet *Projektets medlemmer* i Håndtér), viser panelet, hvilke teams ændringen rører. Rører den kun et teams
del, godkender teamets ansvarlige, også med rollen redaktør, og serveren afviser (403) en projektansvarlig; rører den flere teams dele,
eller ingen, godkender en projektansvarlig som før. Når et IDS-dokument får en ny version, kontrollerer serveren projektets seneste
IFC-versioner igen, og deres rapporter står som ventende imens.

Angiver serveren værdierne pr. kollision, viser panelet for hver kollision værdien i basen, det der kom imellem, og dit forslag, og
du vælger pr. kollision at beholde dit forslag eller tage det, der kom imellem. *Foreslå igen med mine valg* sender forslaget mod den
nyeste version med de beholdte ændringer og uden de strøgne, og serveren afprøver det igen, før det kan godkendes. Sammenfletningen
sker på serveren; browseren håndterer kun selve kollisionerne.

## Den rigtige IFC-klasse

I IFC er klassen den første klassifikation: den mest specifikke klasse med sin PredefinedType, ObjectType kun når PredefinedType er
USERDEFINED, og et typeobjekt; andre klassifikationssystemer lægges ovenpå. AI'en finder klassen for en ting med læseværktøjet
`search_ifc_class`, med engelske IFC-ord som *sink* eller *handrail*, i dokumentationen af modellens skema, som følger med
IfcOpenShell, og ændringssættet accepterer kun klasser, der findes og ikke er abstrakte i modellens skema, og PredefinedType fra
klassens liste. Kortet *IFC-klasser* i Kontrollér (og læseværktøjet `get_class_report`) tæller proxyelementer
(IfcBuildingElementProxy), USERDEFINED uden navn, elementer uden type, PredefinedType på både type og element (reglen OJT001) og
elementer uden for den rumlige struktur (SPS007), med eksempler.

## buildingSMART's regler i forhåndsvisningen

Forhåndsvisningen prøver også det, ændringssættet opretter eller ændrer, mod et udvalg af buildingSMART's normative regler, de samme
regler som buildingSMART's valideringstjeneste bruger (ifc-gherkin-rules), overført til appens egen Python:

- **IFC102**: ingen udfasede entiteter, attributter eller værdier i filens skema, for eksempel IfcWallStandardCase, væggen STANDARD
  eller IfcBuildingStorey.Elevation i IFC 4.3;
- **GEM111**: ingen gentagne punkter i polylinjer og polyløkker, og en lukket polylinje slutter i sit eget første punkt;
- **SWE001**: profiler der ikke skærer sig selv (prøvet med shapely);
- **PSE001** og **PSE002**: et standardsæt (Pset_) har skemaskabelonens navn, egenskaber, typer og klasser, og et eget sæt begynder
  ikke som Pset;
- **QTY001**: et mængdesæt (Qto_) følger skabelonen og har MethodOfMeasurement BaseQuantities;
- **GRF001**, **GRF003** og **GRF005**: alle kontekster har samme koordinatoperation, en model med en bygning har et koordinatsystem,
  og kortkonverteringens skala passer til enhederne;
- **SPS007**: bygningsdele ligger i den rumlige struktur, og en del af en bygningsdel ligger ikke samtidig i en etage;
- **OJT001**: PredefinedType står på typen eller på elementet, ikke på begge, og USERDEFINED har et navn;
- **PJS003**: hvert GlobalId har 22 tilladte tegn og begynder med 0–3, og intet GlobalId bruges to gange.

Hvert fund bærer sin regels kode. Det, buildingSMART regner for aftaler, giver fejl, som forhindrer godkendelsen ligesom skemafejl;
branchepraksis (PSE002, GRF003 og GRF005) giver advarsler, som står for sig. Kun det, ændringssættet forårsager, tæller: det, der
allerede fandtes i modellen, spærrer intet. AI'en får de regler, der ikke holder, efter hver forhåndsvisning og retter dem, som den
gør med topologien. Appen har ikke hele regelsættet: GRF005 kender koordinatsystemets enhed for de nordiske koder, appen skriver,
eller ud fra dets MapUnit, og SWE001 følger polylinjer, indekserede kurver og sammensatte kurver af dem. Hele sættet hører hjemme på
serveren.

Derfor skriver appen heller ikke selv det, IFC102 udfaser. I IFC4 og senere bliver en beklædning med `host` en del af den
bygningsdel, den beklæder (IfcRelAggregates), eller ligger i rummet, i stedet for IfcRelCoversBldgElements og IfcRelCoversSpaces, og
trappens antal trin og mål står kun i Pset_StairFlightCommon. I IFC 4.3 står karmens og dørbladenes egenskaber i
Pset_DoorLiningProperties, Pset_DoorPanelProperties og Pset_WindowLiningProperties, som erstatter IfcDoorLiningProperties og de andre.
Et standardsæt, der først kom med IFC4, for eksempel Pset_Condition i en IFC2X3-fil, giver kun en advarsel fra PSE001.

*Godkend* kører desuden skemaets EXPRESS-regler (WHERE-regler og funktioner) med IfcOpenShell; pytest hentes til dem som komponent
første gang. Et ændringssæt, der bryder en regel, som modellen overholdt før, godkendes ikke, og meddelelsen nævner reglen; bed AI'en
rette ændringssættet, og godkend igen. I en model med mere end 300.000 instanser springes EXPRESS-reglerne over, og loggen siger det.

## Grundoplysninger

Kortet **Grundoplysninger** i Kontrollér prøver en model mod grundreglerne i Praxi, BIM Alliances vejledning for IFC, her med appens
egne ord; ingen tekster, værdilister eller skabeloner fra Praxi følger med appen. Kortet læser modellen, når du trykker på knappen:

- filhovedet angiver visning (MVD), programmet der skrev filen, præprocessoren og tidspunktet (forfatter og organisation vises ikke);
- modellen har et projiceret koordinatsystem med én EPSG-kode, en kortkonvertering og et højdesystem;
- projektet, grunden, bygningen og etagerne har navne, bygningen også et langt navn og etagerne en beskrivelse;
- hvert rum har et nummer i Name, og intet nummer bruges to gange i samme bygning;
- et eget egenskabssæt begynder ikke som IFC's (Pset_, Qto_), begynder med en landekode (SE-…), har kun A–Z, cifre, - og _, og
  egenskaber i PascalCase uden å, ä og ö;
- ingen værdi bærer sin enhed: 40, ikke "40 dB".

Hver kontrol vises som opfyldt, bør ses efter eller fejl, med de første eksempler. IDS kan ikke prøve filhovedet eller at noget er
entydigt, og derfor er det et kort for sig.

## Appens IDS-filer

Appen har egne IDS-filer i `presets/ids/`, skrevet ud fra åbne regler:

- **SE-Dataspatium_Grund.ids**: navne på grund, bygning, etager og rum, ingen proxyelementer og en PredefinedType på dæk, tage, døre,
  vinduer og beklædninger (USERDEFINED godtages med et navn).
- **SE-Dataspatium_Klimatdeklaration.ids**: LoadBearing på vægge, dæk, tage, søjler og bjælker, IsExternal på vægge, døre og vinduer,
  materialer på bygningsdelene, en kategori på hvert materiale og basismængder: det, den foreløbige klimaerklæring læser.

IDS nævner en klasse uden dens underklasser, så IFC4's klasser …StandardCase har egne specifikationer, og en specifikation gælder kun
de IFC-versioner, den angiver. Opgavebeskrivelsen vælger en fil efter formålet, og IDS-kontrol i Analysér kan køre dem.

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
