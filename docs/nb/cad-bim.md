# CAD og BIM: bygningsmodeller og tegninger

Dataspatium åpner bygningsmodeller i IFC og tegninger i DXF som en egen type datasett. Modellen tegnes i 3D,
bygningsdelene blir en tabell, og egenskaper og mengder kan søkes i, beregnes og eksporteres. Alt skjer i nettleseren: filen
forlater aldri datamaskinen. Originalfilen lagres i datasettet og følger med i pakker og sikkerhetskopier.

## Åpne en modell

Slipp en `.ifc`-, `.ifczip`- eller `.dxf`-fil i Hent. Filens opplysninger vises (skjema, prosjekt, program, etasjer og antall
per type), og *Importer* lager datasettet. IFC2X3, IFC4 og IFC4X3 i STEP-format støttes. En modell på rundt 50 MB tar omtrent
et kvarter minutt å importere og åpnes deretter på noen sekunder.

## Store modeller fra serveren

En modell som er for stor til å leses i nettleseren kan hentes fra Dataregium uten IFC-filen. I kildens filliste under *Hent →
OpenCDE* har en modell knappen **Stor modell** når serveren har geometri-API-et (`ifc_geometry`). Velg detaljnivå: *Hele geometrien* gir
bygningsdelenes nett, *Bokser per bygningsdel* bare en boks hver for en rask oversikt. Appen henter geometrien som binær glTF, leser den
i en bakgrunnstråd og lager et modelldatasett med en rad per bygningsdel (id, GlobalId, klasse, navn og etasje fra serverens navngitte
spørringer). Geometrien lagres med datasettet, så 3D-visningen, markering, utvalg og saker fungerer som for en modell fra en fil.
Egenskaper og mengder følger ikke med, og det som trenger IFC-filen, som kollisjonskontrollen i appen og eksport av originalen, mangler;
serverens kollisjonstest og spørringer går som vanlig. Kortet i Håndter viser *Geometri: Fra serveren*.

## Modellen i Bearbeid

Modellen åpnes som 3D-visning med en tabell over bygningsdelene under. Dra for å dreie, rull for å zoome mot pekeren, og
dra med høyre knapp eller med Skift for å flytte; på en berøringsskjerm dreier én finger, og to kniper og flytter. Dobbeltklikk
på en bygningsdel for å dreie rundt akkurat det punktet. Knappen med rammen viser alt som vises; enkelte objekter langt fra
bygningen regnes ikke med. Flere måter å se modellen på står under [Visninger og tastaturet](#visninger-og-tastaturet).

- **Marker**: klikk på en bygningsdel i modellen eller en rad i tabellen. Markeringen følger med, og inspektøren viser
  type, etasje, materiale, klassifikasjon, egenskaper og mengder samt overflate og volum målt på geometrien.
- **Filtrer**: velg type eller etasje, eller søk på navn, materiale eller egenskap. Tabellen og modellen viser samme utvalg.
- **Vis som tabell**: alle kolonner som en vanlig tabell med alle verktøyene i Bearbeid.
- **Lagre som diagram**: visningen med filter og kameravinkel blir et diagram i Visualiser.

Geometrien beregnes fra originalfilen første gang modellen åpnes i en økt, og brukes bare til å tegne og måle. Tabellene
finnes fortsatt selv om datamaskinen mangler WebGL; da vises en melding i stedet for 3D-visningen.

### Visninger og tastaturet

- **Visningskuben** i hjørnet dreier med modellen. Klikk på en side for å se modellen ovenfra, forfra, fra høyre, bakfra, fra
  venstre eller nedenfra, og på knappen under kuben for å se den skrått ovenfra. Forfra ser langs modellens Y-akse, det vil si
  mot nord når modellen er tegnet med nord opp. Visningene viser det filteret viser.
- **Ortografisk visning**: knappen med kvadratet bytter mellom perspektiv og ortografisk visning, der bygningsdelene ikke krymper
  med avstanden. Ovenfra blir da en plantegning og forfra en fasade. Et diagram og et viewpoint husker hvilken visning det var.
- **Snitt**: knappen med lagene åpner snittet i inspektøren. Dra i glidebryterne for øst–vest, sør–nord og høyde for å skjære bort
  det som ligger utenfor en boks, eller velg en etasje under *Snitt ved etasje* for å se den fra gulvet opp til 1,2 m som en
  plantegning. *Fjern snittet* viser alt igjen. Snittet følger med et diagram og et viewpoint, og et viewpoint fra et annet
  program viser snittet sitt.
- **Zoom til markerte** viser de markerte bygningsdelene, og **Vis bare markerte** skjuler alt annet slik at du kan dreie rundt
  dem; klikk igjen for å vise alt.
- **Tastaturet** virker når 3D-visningen har fokus: klikk i den eller gå dit med Tab.

| Tast | Gjør |
|---|---|
| Pilene | flytter visningen |
| Ctrl eller Skift og pilene | dreier |
| + og − | zoomer |
| F | zoomer til de markerte |
| Home | viser alt |
| 1–7 | ovenfra, forfra, fra høyre, bakfra, fra venstre, nedenfra, skrått ovenfra |
| O | bytter ortografisk visning |

## Saker fra et CDE

En modell hentet fra en OpenCDE-server, eller hvilken som helst modell når en slik server finnes som kilde, kan vise sakene
sine: knappen *Saker* i modellvisningen åpner et panel i inspektøren med prosjektets BCF-saker. De som peker på
bygningsdeler i denne modellen står først, med status og antall bygningsdeler. Klikk på en sak, så markeres bygningsdelene i
3D-visningen, og panelet viser beskrivelse, øyeblikksbilde og kommentarer. Sakene hentes når du ber om det og lagres ikke i
datasettet; for å regne på dem lagrer du dem som en tabell i Hent. Har saken et viewpoint med kamera, går visningen dit, i perspektiv eller ortografisk og med snittet sitt.

Med rettighetene til det kan du også skrive. *Ny sak* oppretter en sak på serveren med tittel, type, status og etiketter fra
prosjektets lister, og visningen følger med som viewpoint: kameraet (perspektiv eller ortografisk) med snittet, et øyeblikksbilde og de markerte bygningsdelene som
komponenter. I en valgt sak kan du skrive en kommentar, bytte status og legge til den aktuelle visningen som et nytt viewpoint.
*Lagre som BCF* gir alle prosjektets saker med kommentarer, viewpoints og øyeblikksbilder som en BCF-fil, som verktøy uten API
kan åpne. En BCF-fil kan også leses inn i Hent: sakene blir en tabell, kommentarer og komponenter tabeller ved siden av.

*Farg etter status* gir bygningsdelene fargen fra sin mest åpne sak: rød for åpne, gul for pågående, grønn for avsluttede, med en
tegnforklaring under listen. *Lagre som tabell* gir prosjektets saker som en tabell med én rad per sak og bygningsdel (type, navn
og etasje følger med), som Håndter kjenner igjen som saker: kortet *Saker* viser status og oppretter dashbordet *Sakstatus* med
status, type, ansvarlig, prioritet og måned bak felles filtre, og knappen *Vis i modellen* går tilbake til panelet. Verktøyet
*Saker* i Analysers fane Mengder teller saker, åpne saker og bygningsdeler per status, type, prioritet, ansvarlig, bygningsdelstype
eller etasje fra en slik tabell, og SQL-startkoden får spørringer for koblingen. *Lagre som diagram* lagrer visningen med fargene
som et modelldiagram, som dashbord, dokumenter og Publiser viser med tegnforklaring.

Modellens graf på serveren tegnes og spørres fra *Hent*, og knappen *IFC-LPG* tar deg dit, se [grafer.md](grafer.md#ifc-lpg-på-en-dataregium-server).

Grafens modell, relasjonene og spørringene fra Dataspatiums side finnes i Dataregiums [ifc-lpg.md](https://github.com/marwiss/Dataregium/blob/main/docs/nb/ifc-lpg.md).

## Tabellene

| Tabell | Innhold |
|---|---|
| `data` | Én rad per bygningsdel, rom og etasje: id, guid, typ (type), kategori (byggdel, rum, struktur), namn (navn), beskrivning, objekttyp, tagg, vaning (etasje), typnamn, material, klassificering, egenskaper og mangder (mengder) som JSON |
| `_properties` | Én rad per egenskap: id, uppsattning (sett), namn, varde (verdi), tal, enhet, kalla (objekt eller typ) |
| `_quantities` | Én rad per mengde i SI-enheter: id, uppsattning, namn, varde, slag (langd, area, volym, vikt, tid, antal), enhet |
| `_entities` | Filens ikke-geometriske entiteter med rå attributter: id, typ, attribut |

Egenskaper som bare finnes på bygningsdelens type, regnes med og er merket `typ`. Mengder regnes om til meter,
kvadratmeter, kubikkmeter og kilogram med prosjektets enheter. Åpninger og tilkoblingsporter er ikke bygningsdeler og finnes
bare i `_entities`.

Tabellene kan spørres med SQL i Analyser:

```sql
SELECT d.vaning, d.typ, count(*) AS antal, sum(q.varde) AS volym
FROM data d JOIN _quantities q ON q.id = d.id
WHERE q.namn = 'NetVolume'
GROUP BY 1, 2 ORDER BY 1, 2
```

I R og Python gir `dm_read()` bygningsdelene, `dm_read_properties()` egenskapene og `dm_read_quantities()` mengdene.

## Fanen Mengder i Analyser

- **Sammendrag**: filens opplysninger og innhold.
- **Mengder**: antall, lengde, areal, volum og vekt gruppert etter type, etasje, materiale, typenavn eller klassifikasjon.
  Kilden *Filens mengder* tar én verdi per bygningsdel og slag: netto før andre og brutto sist, slik at en vegg ikke telles
  to ganger. Kilden *Målt på geometrien* regner på trekantene og virker også når filen mangler mengder. Overflaten er da
  hele overflaten rundt bygningsdelen, ikke for eksempel en veggs sideareal.
- **Mengdeliste**: hvert mengdenavn i filen per type med sum. Her ser du nøyaktig hva filen angir.
- **Egenskaper**: hvilke verdier en egenskap har, og hos hvor mange bygningsdeler av hver type.
- **Entiteter**: hvor mange entiteter av hvert slag filen består av.
- **Klimaerklæring**: en foreløpig klimaerklæring ut fra modellen per kategori og lag, se *Foreløpig klimaerklæring* nedenfor.
- **Materialkartlegging**: grunnlag for avfallshåndteringsplanen ut fra modellen, med byggevarer som kan ombrukes, avfallet per
  fraksjon og lag og de farlige stoffene modellen oppgir, se *Materialkartlegging for avfallshåndteringsplanen* nedenfor.

Hvert resultat kan lagres som datasett.

## IfcOpenShell i appen

Appen kan lese, kontrollere og endre IFC-modeller med IfcOpenShell, det samme biblioteket som Dataregium bygger på. Det
kjører i Python i nettleseren, hentes første gang det brukes (cirka 13 MB, etter ditt samtykke til komponenter) og lagres
deretter i nettleseren. Ingenting sendes noe sted; modellen forlater ikke datamaskinen.

**I Analyser, fanen Mengder**, har en IFC-modell fem verktøy til:

- **Validering** kontrollerer modellen mot sitt IFC-skjema: attributter, typer og referanser, valgfritt også skjemaets regler.
  Funnene kan lagres som datasett.
- **Romlig struktur** viser prosjekt, tomt, bygning, etasjer og rom som et tre med antall elementer per del.
- **Egenskapssett** gir alle egenskapssett for en elementtype som en bred tabell: en rad per element, en kolonne per
  egenskap (`Sett.Egenskap`), valgfritt også mengdesettene.
- **IFC-utvalg** henter elementer med IfcOpenShells utvalgsspråk, for eksempel `IfcWall, Pset_WallCommon.FireRating=EI60` eller
  `IfcElement, material=Betong`.
- **Geometrimål** måler volum, overflate og omsluttende boks per element på geometrien (OpenCASCADE). Langsomt for store
  modeller.
- **IDS-kontroll** kontrollerer modellen mot en IDS-fil (buildingSMART Information Delivery Specification) med
  ifctester, IfcOpenShells egen kontrollør: velg .ids-filen, så får du en rad per krav og element med godkjent, ikke godkjent
  eller ikke relevant og årsaken, samt en opptelling. Filen blir i nettleseren. ifctester følger med appen uten webappen sin, så
  ingenting hentes utover Python selv.
  Under *IDS i appen* velger du i stedet en av appens egne IDS-filer, for eksempel *Avfallshantering* (se *Materialkartlegging for
  avfallshåndteringsplanen*), som prøves på samme måte; *Lagre IDS-filen* lagrer den valgte på datamaskinen.

**I Bearbeid** har modellen to handlinger under *Handlinger* (knappen finnes i modellvisningen og i tabellvisningen), i gruppen
*Modell*:

- **Skriv tabell til modellen** skriver en tabells verdier inn i modellen. Radene matches på GUID; kolonnene `Name`,
  `Description`, `ObjectType` og `Tag` (eller `namn`, `beskrivning`, `objekttyp`, `tagg`) blir attributter, og kolonner som
  `Pset_WallCommon.FireRating` blir egenskaper (settet opprettes hvis det mangler). Arbeidsmåten: lagre *Egenskapssett* som
  datasett, rediger det i Bearbeid og skriv tilbake.
- **Python på modellen** kjører en funksjon `step(model)` med IfcOpenShells API på hele modellen.

Begge er steg i oppskriften: den endrede modellen blir datasettets nye innhold (originalfilen byttes og tabellene bygges om),
steget logges og kan angres, og originalfilen er alltid den gjeldende versjonen når du eksporterer modellen eller sender den
til et CDE.

**I Python** (fanen Python i Analyser og kodeceller i notatboken) åpner `dm_ifc("navn")` modellen som en `ifcopenshell.file`.
Hjelperne `dm_ifc_elements`, `dm_ifc_psets`, `dm_ifc_tree`, `dm_ifc_validate`, `dm_ifc_select` og `dm_ifc_geometry` gir
tabeller, `dm_ifc_set(model, df)` skriver en tabell inn i modellen, og `dm_ifc_write(model, "navn")` sender modellen til appen som
et nytt datasett; se [Python i Dataspatium](python.md). Verktøyene i Analyser og Python endrer aldri datasettet; bare
handlingene i Bearbeid gir en ny versjon.

IfcOpenShell er LGPL-3.0 og hentes uendret som fastlåste wheels fra IfcOpenShells egen fortegnelse, se [Lisenser](licenser.md).

## Valider modellen

Kortet **Valider modellen** i Håndter samler kontrollene av en IFC-modell, med det siste resultatet av hver.

- **Serverens kontroll** finnes for en modell som er hentet som dokumentversjon fra et CDE. Dataregium (fra 3.0.0) kontrollerer hver
  opplastet IFC-fil mot IFC-skjemaet og, når serveren har dem installert, mot buildingSMARTs regler (ifc-gherkin-rules), og legger
  resultatet i versjonens metadata. *Hent serverens kontroll* leser det: ingen funn, funn som bare er advarsler, funn med feil, venter
  på kontroll eller kunne ikke kontrolleres, og når og med hvilke regler. Appen spør serveren først når du trykker på knappen. Finnes
  det funn, viser *Vis funnene* serverens rapport: antall funn og feil, hvilke kontroller som ble gjort og hvilke regler som ikke
  kunne kjøres, og hvert funn med regelen, instansen (`#123`) og elementets GlobalId. *Marker i modellen* markerer deretter elementene
  i modellvisningen i Bearbeid, og *Lagre som tabell* lagrer funnene som en tabell med kolonnene `kind`, `rule`, `severity`, `message`, `step_id`, `global_id` og `attribute`. Rapporten
  hentes med samme innlogging fra en adresse appen selv bygger på samme server; en adresse fra metadata følges aldri.
- **Prosjektets IDS-filer**: kontrollerer serveren også filen mot prosjektets IDS-dokumenter (den nyeste versjonen av hvert dokument der
  navnet slutter på `.ids`), viser rapporten hvor mange spesifikasjoner som ble godkjent, ikke godkjent eller ikke gjaldt filen, og hvilke
  som ikke ble godkjent, med dokumentets navn og antall funn. Et IDS-dokument som ikke kunne leses, står blant reglene som ikke kunne kjøres.
- **Det ingen GlobalId når**: finner serverens kontroll graph instanser som ingenting med en GlobalId når, viser rapporten knappen
  *Fjern det ingen GlobalId når*. Serveren foreslår da, etter din bekreftelse, et endringssett som fjerner dem; forslaget blir en
  sak som prøves og godkjennes som andre, og versjonen beholder alt.
- **Kontroller her** viser den siste *Validering*, *IDS-kontroll* og kollisjonskontroll som er kjørt i appen, og knappene åpner dem i
  Analyser. Resultatene lagres i appens innstillinger, ikke i datasettet.

Funnene gjelder filen slik den ble lastet opp, og serveren stopper aldri en fil på grunn av dem. En fil der alle funn er advarsler,
regnes som gyldig av buildingSMARTs valideringstjeneste. Har serveren ingen slik kontroll, sier kortet at serveren ikke har
kontrollert versjonen.

## Prosjektprofil

Kortet **Prosjektprofil** i kildens visning under *Hent → OpenCDE* viser det valgte prosjektets profil: prosjektets IDS-dokumenter
(filer med endelsen `.ids` blant prosjektets filer) og de bSDD-ordbøkene du har valgt for prosjektet, lagret i denne nettleseren per
server og prosjekt.

- **Skriv IDS med AI** skriver en Information Delivery Specification ut fra en beskrivelse i ord. Velg leverandør, modellen kravene
  skal prøves mot, og beskriv kravene. AI-en gir filen til appen, som kontrollerer den (først formen, så med ifctester mot modellen,
  i Python i nettleseren) og svarer med feilen som skal rettes eller med utfallet per spesifikasjon. Det går runde for runde til
  filen kan kjøres, høyst fire runder, og kravene mykes aldri opp for å gå gjennom. Resultatet kan lagres som `.ids`-fil eller lastes
  opp til prosjektet som et dokument.
- **Søk i bSDD** slår opp klasser i buildingSMART Data Dictionary etter samtykke for verten `api.bsdd.buildingsmart.org`, i de valgte
  ordbøkene eller alle; *Ordbøker* lister ordbøkene så du kan legge dem til i profilen. I *Endre med AI* kan AI-en søke med verktøyet
  `search_bsdd` og klassifisere bygningsdeler med `set_classification`, som skrives som `IfcClassificationReference` i endringssettet
  du godkjenner.
  `search_bsdd` søker bare i frie ordbøker der lisensen er lest (IFC 4.3, Uniclass 2015 og ETIM 10.1), og svarer med ordbok og lisens
  for hver klasse, og `set_classification` skriver systemets utgave, utgiver og adresse på dets `IfcClassification`.

Serverens buildingSMART-regler vises på kortet *Valider modellen* i Håndter; velg en regel i listen ved siden av *Marker i modellen* for å
markere bare de bygningsdelene som den regelen treffer.

## Kollisjonskontroll

Verktøyet **Kollisjoner** i Analyser (fanen Mengder) finner bygningsdeler som går inn i hverandre eller kommer for nær hverandre. Det
arbeider på de samme trekantene som 3D-visningen viser, i en egen tråd, og trenger verken Python eller nett.

- **Mengde A og mengde B** er alle bygningsdeler eller en type, for eksempel kanaler mot bjelker. B kan ligge i samme modell eller i en
  annen modell i samme prosjekt, og modellene må da dele koordinatsystem. Åpninger teller ikke.
- **På serveren**: for en modell fra Dataregium (fra 3.0.0, når serveren har kollisjonskontrollen slått på) velger *Hvor* om appen
  regner selv eller om serveren gjør samme kontroll av versjonene. Serveren arbeider i en kø; appen venter og viser rapporten som
  sin egen, med samme tabell, markering og BCF-fil, og *Send som saker* lar serveren lage sakene med et viewpoint hver. Den andre
  modellen må da være en versjon i samme prosjekt.
- **Skjæring** teller par der det ene elementet når dypere inn i det andre enn toleransen (2 mm hvis ikke annet er angitt). Dybden
  måles som hvor langt hjørner og kanter når inn i det andre elementet, så flater som bare møtes, teller ikke. *Innelukking* er et
  element som ligger helt inne i et annet.
- **Fri avstand** teller par som er nærmere hverandre enn avstanden (50 mm hvis ikke annet er angitt), skjæringer medregnet.

Resultatet er en tabell med begge elementenes id, GlobalId, type og navn, slaget, dybden eller avstanden i millimeter og et punkt i
modellens egne koordinater. Derfra:

- *Marker i modellen* markerer elementene i modellvisningen i Bearbeid.
- *Lagre som BCF* lagrer én sak per kollisjon i en BCF-fil, med en visning som ser på punktet og begge elementene markert og farget.
  Kamera og punkt står i modellens koordinater med Z opp, så andre BCF-verktøy viser samme sted.
- *Send som saker* oppretter sakene direkte i prosjektet på serveren gjennom BCF API, for en modell som er hentet fra et CDE. Der ser
  alle klienter dem, for eksempel Bonsai.
- *Opprett datasett* lagrer tabellen.

Det siste resultatet står på kortet Valider modellen i Håndter, med om det ble gjort i appen eller på serveren. Målingen forutsetter lukkede flater: et element med åpne eller
ødelagte flater kan gi usikre dybder. Buede flater er delt opp i trekanter, så en toleranse under en millimeter blir usikker. Elementer som 3D-visningen ikke kan tegne, er ikke med, og resultatet sier hvor mange de er; i en prøvemodell fra Tekla gjaldt det alle armeringsjernene.

## Foreløpig klimaerklæring

Verktøyet **Klimaerklæring** i Analyser (fanen Mengder) beregner en foreløpig klimaerklæring ut fra modellen: klimapåvirkningen for
A1–A3, A4 og A5 i kg CO₂e per kategori og per lag i bygningen. Det er et grunnlag i prosjekteringen, ikke en erklæring for registrering
hos Boverket.

**Kategori og lag.** Hver bygningsdel får en av Boverkets fire kategorier (bærende konstruksjonsdeler – fundamentering, bærende
konstruksjonsdeler – øvrige, klimaskjerm, innervegger) eller *Inngår ikke*, og ett av bygningens seks lag fra Boverkets rapport
2024:26: 1 tomt og fundamentering, 2 bæresystem og andre bærende konstruksjoner, 3 klimaskjerm, yttertak og fasade, 4 tekniske
installasjoner, 5 himlinger, innervegger og overflater innendørs, 6 fast inventar. Reglene leser bare IFC-klassen, PredefinedType
(bygningsdelens eller typens) og LoadBearing og IsExternal i Pset_*Common; ingen klassifikasjon leses. De følger Boverkets liste over
bygningsdeler som inngår: peler, grunnarbeider, installasjoner, fast inventar, flyttbare innervegger, innvendige overflater og
solskjerming inngår ikke; trapper, ramper og rekkverk er bærende; himlinger, nedforede himlinger og innerdører hører til
innerveggene. Kolonnen *Regel* viser hva som avgjorde.

- **Usikker**: bygningsdelen inngår, men kategorien er usikker, for eksempel en innervegg uten LoadBearing eller en dør uten
  IsExternal. Den telles i kategorien som står, og listes under *Skal avgjøres*. En yttervegg er klimaskjerm uansett LoadBearing.
- **Kan ikke avgjøres**: reglene kan ikke si om bygningsdelen inngår, for eksempel et proxyelement eller solceller (som bare inngår
  når de er integrert i tak eller fasade). Den telles ikke før du har avgjort den.
- **Utledet IsExternal**: når filen ikke angir IsExternal, får en dør eller et vindu verdien fra veggen den sitter i. *Utled
  IsExternal* leser bygningens topologi med appens Python, som starter da (første gang hentes komponentene med ditt samtykke):
  veggene langs en etasjes ytre grense er ytre, og på en lukket etasje er rommenes øvrige vegger indre. Regelen sier når en verdi er
  utledet.
- En sammensatt bygningsdel, for eksempel et tak av takplater, telles i delene sine, og en del som reglene ikke kan avgjøre, får
  helhetens kategori.

Under **Skal avgjøres** velger du kategori for en hel gruppe bygningsdeler med samme klasse, type og regel. Valget lagres per
bygningsdel (GlobalId) i nettleseren til du lar reglene avgjøre igjen.

**Mengder.** Volum, areal og vekt tas fra filens mengder, netto før brutto og veggens sideareal. Har filen ingen mengder, beregnes
volumet fra geometrien når bygningsdelen er en enkel ekstrudering: profilens areal ganger dybden (rektangel, sirkel, I-profil,
polylinje med flere), også gjennom typens representasjon og før en klipping. Åpninger trekkes da ikke fra, og kolonnen *Mengdens
kilde* sier det. Dører og vinduer telles per kvadratmeter ut fra målene. En bygningsdel med materialsjikt deles per materiale etter
sjiktenes tykkelse. Ellers har raden ingen mengde og telles ikke.

**Klimadata.** *Hent klimadatabasen* henter Boverkets klimadatabase (omtrent 0,9 MB) fra api.boverket.se med ditt samtykke til
API-henting og lagrer den i nettleseren; ingenting om modellen sendes. Under *Materialer og ressurser* velger du en ressurs for hvert
materiale. Forslagene bygger først på materialets kategori i IFC (IfcMaterial.Category, for eksempel concrete, steel, wood, glass
eller gypsum) og deretter på navnet; dører og vinduer foreslås etter typens navn. *Godta forslagene* lagrer forslagene som dine valg,
som gjelder alle modeller. Klimapåvirkningen er massen (volumet ganger densiteten eller arealet ganger vekten per kvadratmeter) ganger
databasens verdier for A1–A3, A4 og A5 (svinn). Boverket oppgir at klimadata for byggevarer er satt konservativt, omtrent 25 prosent
over gjennomsnittet; verktøyet regner med den konservative verdien og viser den typiske ved behov.

Hver visning kan lagres som datasett. Kilde: Boverket, klimadatabasen (åpne data, se [licenser.md](licenser.md)).

## Materialkartlegging for avfallshåndteringsplanen

Verktøyet **Materialkartlegging** i Analyser (fanen Mengder) samler det modellen vet, som grunnlag for avfallshåndteringsplanen
(avfallshanteringsplan). Etter den svenske PBL 10 kap. 8 a §, som gjelder siden 1. juli 2026, skal byggherren sørge for at det
finnes en avfallshåndteringsplan med opplysninger om

1. hvilke byggevarer som kan ombrukes, og hvordan de tas hånd om, og
2. hvilket avfall tiltaket kan gi opphav til, og hvordan det tas hånd om, særlig hvordan byggherren vil gjøre mulig a)
   materialgjenvinning av høy kvalitet og b) sikker håndtering og fjerning av farlige stoffer.

Planen kreves ikke når den åpenbart ikke trengs, og den kontrollansvarlige (kontrollansvarig) har samme oppgave for den som for
kontrollplanen. Boverket foreslo planen i rapport 2024:26 under navnet ressursforvaltningsplan. Verktøyet gir grunnlaget; planen og
vurderingene er byggherrens. Visningene følger bestemmelsens to punkter.

**1. Byggevarer som kan ombrukes.** Bygningsdelene med en type, de med produktdata først: produsent (Manufacturer), modell
(ModelLabel) og GTIN (GlobalTradeItemNumber) fra Pset_ManufacturerTypeInformation, helst på typen, og serienummer (SerialNumber) og
strekkode (BarCode) fra Pset_ManufacturerOccurrence på bygningsdelen. Kontrollsifferet i GTIN prøves etter GS1; en feil vises, men
rettes aldri. Hver rad har laget i bygningen, materialene, fraksjonene og de farlige stoffene modellen oppgir. IFC2X3 har ikke GTIN.

**2 a. Avfall per fraksjon og per lag og fraksjon.** Hvert materiale i hver bygningsdel får en avfallsfraksjon etter den svenske
avfallsforskriften (avfallsförordningen 3 kap. 10 §), som i tillegg til farlig avfall krever at tre, mineral (betong, tegl, klinker,
keramikk og stein), metall, glass, plast og gips sorteres ut. Fraksjonen tas først fra materialets kategori i IFC
(IfcMaterial.Category, for eksempel concrete, steel, wood, glass, gypsum eller plastic) og ellers fra materialets navn (betong,
limtre, gipsplate, isolerglass og lignende, på de nordiske språkene og engelsk). Mineralull, glassull og steinull hører verken til
mineral eller glass, og kompositter som glassfiberarmert plast, navn som oppgir flere fraksjoner (tre/aluminium) eller ingen, og
bygningsdeler uten materiale blir *Annet / avgjøres*. Kolonnen *Regel* viser hva som avgjorde. Summene gir bygningsdeler, rader,
volum, areal og masse per fraksjon og per lag i bygningen (klimaerklæringens seks lag) og fraksjon. Ingen klassifikasjon leses.

**2 b. Farlige stoffer.** Bare det en egenskap i modellen sier: en egenskap der navnet eller settet gjelder farlige stoffer eller
farlig avfall (for eksempel Pset_EnvironmentalImpactValues.HazardousWaste, eller et eget sett med asbest eller PCB), og der verdien
sier ja, på bygningsdelen, typen eller materialet. Appen gjetter aldri. Oppgir modellen ingen farlige stoffer, sier verktøyet det,
og en kartlegging av farlige stoffer trengs likevel.

**Alle bygningsdeler og materialer** er radene bak summene: mengden, materialets kategori, tykkelsen, fraksjonen med regelen, laget,
densiteten og massen.

**Mengder og masse.** Mengdene er klimaerklæringens: filens mengder, ellers geometrien for enkle ekstruderinger, og en bygningsdel
med materialsjikt deles etter sjiktenes tykkelse; dører og vinduer telles her per materiale. Massen er filens vekt, ellers volumet
ganger materialets densitet (Pset_MaterialCommon.MassDensity i kg/m³). Mangler densiteten, har raden ingen masse, og merknaden sier
hvor mange rader det gjelder.

**IDS for avfallshåndtering.** *IDS Avfallshåndtering* åpner IDS-kontroll med appens IDS-fil `SE-Dataspatium_Avfallshantering.ids`
og prøver modellen mot den i appens Python: et materiale med en av IFCs anbefalte kategorier på hver bygningsdel; basismengden for
volum på vegger, dekker, bjelker, søyler, staver og plater (IfcMember og IfcPlate), fundamenter og trappeløp og for areal på dører,
vinduer, kledninger, tak og glassfasader; produsent og modell på dører, vinduer og installasjoner og GTIN i riktig form når det
finnes. Filen gjelder IFC4 og IFC4.3, fordi IFC2X3 mangler materialkategori, maler for basismengder og GTIN. ifctester godkjenner
materialkravet når minst ett av bygningsdelens materialer har en kategori, og sammensatte bygningsdeler (tak, trapper, ramper og
glassfasader) prøves i delene sine.

Hver visning kan lagres som datasett. Ingenting hentes fra nettet.

## DXF-tegninger

En DXF-fil blir en tabell med ett tegningsobjekt per rad (type, lag, farge, lengde, areal, tekst og plassering) og en
SVG-tegning. Tegningen åpnes i Bearbeid, der du zoomer med hjulet eller ved å knipe og panorerer ved å dra; når tegningen har fokus, flytter pilene, + og − zoomer, Home viser alt og F zoomer til det markerte objektet. En rad i tabellen zoomer til objektet sitt. Lagene slås av og på i inspektøren,
og et klikk markerer objektet og raden. Fanen Mengder gir antall, lengde og areal per lag og type.

Linjer, polylinjer med buer, sirkler, buer, ellipser, splines, punkter, tekster, solider, 3D-flater, blokker og
målsettingers blokker tegnes. Skravering (HATCH) tegnes ikke.

## Eksport

Eksporter gir originalfilen, egenskapene og mengdene som CSV (én rad per verdi) og tegningen som SVG, i tillegg til de
vanlige tabellformatene for `data`. Diagrammer av modeller eksporteres som PNG, SVG og PDF; en 3D-modell blir da et bilde.

## Begrensninger

- Tabellene kan ikke redigeres direkte. Modellen endres med oppskriftsstegene for IfcOpenShell og med *Endre med AI*, som skriver en
  ny versjon av IFC-filen.
- En modell tegnes på nytt fra originalfilen i hver ny økt. Modellen på 57 MB som appen er prøvd med, tar 4–6 sekunder.
- Den første tegningen av en svært stor modell kan låse siden et øyeblikk mens grafikkortet tar imot trekantene.
- Mengdene er ikke en mengdeberegning etter noe regelverk. Kontroller dem mot kilden før de brukes.
- DXF leses i to dimensjoner. DWG må først lagres som DXF.

## Ny modell

En ny, tom modell lages i Hent med *Ny bygningsmodell*. Velg skjema (IFC4X3_ADD2 er standard; IFC4 og IFC2X3 finnes for programmer
som ikke leser det nyeste) og navn på prosjekt, tomt, bygning og første etasje. Appen skriver modellen med IfcOpenShell i appens
Python, i meter og med modellens kontekster, og modellen består skjemakontrollen. Første gang hentes Python og IfcOpenShell etter
samtykke.

Modellen blir et vanlig modelldatasett. Åpne det i Bearbeid og bygg i det med *Endre med AI*, for eksempel «to etasjer og et
rutenett på 6×4 m med yttervegger langs rutenettet». Det kan eksporteres som IFC og publiseres på en Dataregium som andre modeller.

## En ny bygning fra en brief

Skriv en brief i skjemaet *Ny bygningsmodell* ("et toetasjes hus 12 × 8 m med saltak, teglfasade, inngang mot sør …") og velg *Bygg fra
briefen med AI* når modellen er laget: modellen åpnes i Bearbeid med AI-panelet i modusen **Bygg fra brief**. Der kan du legge ved
foto og skannede tegninger (JPEG, PNG eller PDF; en plantegning gir de riktige målene, et foto utseende, materialer og hvordan delene
henger sammen) eller legge til bildene fra en bildesamling, for eksempel dem du har tatt med Dataspatium Mobil. AI-en leser den
tomme modellen, sier planen sin, spør i panelet når briefen lar noe vesentlig stå åpent (fotavtrykk, antall etasjer, etasjehøyde,
veggtykkelser, materialer) og bygger så i grupper med samme verktøy som *Endre*: etasjer og rutenett, vegger per etasje, dekker,
åpninger, egenskaper og materialer, med forhåndsvisning og rettinger etter hver gruppe. Ingenting skrives i modellen før du
forhåndsviser og godkjenner endringssettet som vanlig, og du kan supplere med en ny brief i samme modus. Bildene sendes til
leverandøren sammen med briefen etter samtykket for leverandørens vert; en lokal modell som ser bilder beholder alt på datamaskinen.
Med *Opplysninger fra et datasett* legges rader fra en tabell i briefen som tekst: en bygningsflate hentet fra kartet (Åpne geodata) blir
hjørner i meter fra det sørvestlige hjørnet, så veggene får riktige mål, og mål og notater fra et feltskjema i Dataspatium Mobil blir
rader; en runde med telefonen kan så gi flere bilder og mål, og briefen suppleres i samme modus.
Briefen og bildene kan også legges på serveren som modellens grunnlag når modellen er hentet fra et CDE: saken *Grunnlag* i
modellens prosjekt får briefen som tekstdokument og hvert bilde som dokument, så andre som arbeider med modellen i egne klienter ser
hva den ble bygd av. Knappen heter *Legg grunnlaget på serveren*.
Øverst i panelet står *Bygningens opplysninger* (hvilken bygning, etasjer, lengde, bredde, høyde, fundamentering, tak) og *Nøyaktighet*
(skisse, hovedtrekk eller detaljert): fyll inn det du vet, så innleder det briefen og AI-en spør om resten. Ordene er vanlige, men bak
dem ligger informasjonskravene i ISO 19650 og level of information need, og modellen er tenkt som bygningens forvaltningsmodell. Hvert
bilde legges ved som foto, fasade mot nord, øst, sør eller vest, innvendig eller tegning, og et foto med posisjon og tidspunkt i filen
(EXIF) får dem i bildeteksten sin, så AI-en vet hva den ser. Opplysningene fra et datasett gir også bygningsflatens sørvestlige hjørne
på kartet, så AI-en plasserer modellen med `set_site` (posisjon, høyde og SWEREF 99 TM), og med *Med terrenghøyde i hjørnene*, som
vises når Lantmäteriets kilde er lagt til, terrenghøyden i hvert hjørne fra høydemodellen: et nettverkskall med nøkkelen din etter
samtykke.
Etter veggene på hver etasje leser forhåndsvisningen bygningens topologi: veggenes senterlinjer blir rom, og etasjen er lukket når
veggene lukker minst ett rom og ingen veggende står løs; AI-en retter løse ender ved å flytte eller legge til vegger før den legger
dekkene. Ytterveggene med himmelretningene sine lar AI-en pare et foto av fasaden mot sør med de riktige veggene (leseverktøyet
`get_topology`), og den samme topologien vises på kortet *Topologi* i Kontroller.

## Kontroller med AI

Modusen **Kontroller** i AI-panelet prøver en eksisterende bygnings modell mot foto av skader og slitasje, tatt med Dataspatium Mobil,
et kamera eller en drone, og mot mål fra et feltskjema. Legg ved fotoene i panelet, merket med fasade eller innvendig, eller legg til
bildene fra en bildesamling du har importert i Hent; et foto med posisjon og tidspunkt i filen (EXIF) får dem i bildeteksten, og
*Opplysninger fra et datasett* legger mål og notater fra et feltskjema i spørsmålet. AI-en leser modellen med de samme verktøyene som
i *Spør*, finner elementet hvert foto viser, og skriver et funn for hver skade med tittel, beskrivelse, tilstand (god, akseptabel,
dårlig eller kritisk), prioritet (lav, middels, høy eller akutt) og anbefalt tiltak; et foto uten synlig skade gir ikke noe funn.
Elementets tilstand legges i egenskapssettet Pset_Condition (vurderingsdato, tilstand og en kort beskrivelse) i et endringssett som du
forhåndsviser og godkjenner som i *Endre*, og ingen elementer opprettes, flyttes eller slettes. Funnene listes under svaret, og *Lagre
funnene som tabell* oppretter et nytt datasett med ett funn per rad: foto, element, tittel, beskrivelse, tilstand, prioritet, tiltak,
dato og fotoets posisjon. *Eksporter som BCF* laster ned en BCF-fil med én sak per funn, der fotoet er visningens øyeblikksbilde og
elementet er markert, og for en modell hentet fra en server du er logget inn på, oppretter *Opprett saker på serveren* de samme sakene
i modellens prosjekt etter en bekreftelse. Fotoene sendes til leverandøren sammen med spørsmålet etter samtykket for leverandørens
vert, og de forlater datamaskinen igjen bare når du selv oppretter saker på serveren.

## Spør AI om modellen

Knappen *Spør AI* i modellvisningen åpner et panel i inspektøren der du stiller et spørsmål om den åpne IFC-modellen, for eksempel
"hvilke dører mangler brannklasse i etasje 2?". AI-modellen leser med verktøy (modellens oversikt, etasjene, elementer etter klasse, etasje,
navn og egenskap, ett element med alle egenskaper, det du har markert i 3D-visningen og, for en modell hentet fra Dataregium, serverens
navngitte spørringer) og svarer med elementene den bygger på. *Marker n
elementer* legger svarets elementer i utvalget, som 3D-visningen, tabellen og de andre modusene følger. Panelet viser hvert verktøykall og
hvor mange token som gikk med. AI-en kan bare lese: ingenting endres, lagres eller publiseres, og neste spørsmål fortsetter samtalen.

*Leverandører* legger til en skytjeneste eller en lokal modell: Anthropic Messages eller et OpenAI-kompatibelt API (OpenAI, Gemini,
Ollama, vLLM, llama.cpp med flere), med adresse, modell og API-nøkkel. Nøkkelen holdes i økten eller kryptert med passordfrasen din, aldri i
klartekst og aldri i spørsmålet. *Policy* avgjør hva som får kalles: *Spør* ber om samtykke per leverandør første gang, *Sky* tillater
skytjenester, og *Bare lokal* tillater bare modeller på din egen datamaskin. Det som sendes, er spørsmålet ditt og verktøysvarene modellen
ber om; verktøysvarene er data fra modellen, aldri instruksjoner, og kappes når de er store.

## Endre med AI

Modusen *Endre* i samme panel lar AI-en foreslå endringer i modellen, for eksempel "lag to etasjer og et rutenett på 6×4 m, yttervegger
langs rutenettet, ett dekke per etasje og en dør i hver vegg i etasje 1". AI-en leser modellen med de samme verktøyene som i Spør og
skriver med verktøy for etasjer og rutenett, vegger, dekker, åpninger med dør eller vindu, egenskaper, materialer, flytting og sletting.
Verktøyet `set_site` angir modellens sted på jorden: tomtens breddegrad, lengdegrad og høyde, og med en EPSG-kode som 3006 for SWEREF 99
TM også kartkonverteringen, det vil si modellens origo i øst- og nordkoordinater og dens rotasjon (ikke i IFC2X3, som mangler den).
Verktøyet `create_roof` legger et saltak, valmtak, pulttak eller flatt tak med takvinkel, takutstikk og tykkelse på en etasjes vegger
(uten angitt etasje den øverste): et IfcRoof av takplater (IfcSlab av typen ROOF), én per takflate, over veggenes omskrevne rektangel
eller et angitt rektangel (en annen kontur erstattes inntil videre av sitt omskrevne rektangel). Verktøyet `create_spaces` lager
rommene veggene lukker, som IfcSpace med navn fra romprogrammet, valgt med et punkt inni eller nummeret sitt i topologien, med høyden
opp til neste etasje, romarealer (Qto_SpaceBaseQuantities) og grenser mot veggene og dørene og vinduene i dem. Verktøyene endrer
ingenting: de fyller et endringssett som panelet lister trinn for trinn (mål i meter; nye elementer får referansene new-1, new-2 … til
filen har gitt dem id).

Verktøyet `define_type` lager en veggtype, dekketype eller taktype (IfcWallType, IfcSlabType eller IfcSlabType av typen ROOF for
takplatene) med materialsjikt i meter, for en vegg fra høyre side til venstre sett fra start mot slutt og for dekke og tak ovenfra og
ned. Hvert sjikt kan få materialets kategori (IFCs anbefalte: concrete, steel, aluminium, block, brick, stone, wood, glass, gypsum,
plastic og earth) og sjiktets rolle (bærende, isolasjon, indre eller ytre overflate), men bare når de er kjent. `create_wall`,
`create_slab` og `create_roof` tar typen: elementet får typen (IfcRelDefinesByType), tykkelsen sin fra sjiktene og sjiktene lagt på seg
(IfcMaterialLayerSetUsage: veggens sentrert på linjen, dekkets nedover fra oversiden i etasjens høyde og takplatenes oppover fra
undersiden), og PredefinedType står på typen. Materialer og felles egenskaper hører til typen, og AI-en definerer typene først. Når
endringssettet kjøres, kobles veggene det lager, til veggene de møter (IfcRelConnectsPathElements): i et hjørne går den tykkeste veggen
(ved lik tykkelse den lengste) forbi hjørnet og den andre slutter mot den, og en vegg som ender på en annens linje, slutter mot dens
side, slik at hjørnene verken får glipper eller overlapp og ikke noe volum telles to ganger. Veggenes midtlinjer endres ikke, og
hjørner i andre vinkler enn rette kobles slik de er tegnet. Til slutt får de veggene, dekkene, takene, dørene og vinduene som
endringssettet har laget eller endret, basismengder (Qto_WallBaseQuantities, Qto_SlabBaseQuantities, Qto_RoofBaseQuantities,
Qto_DoorBaseQuantities og Qto_WindowBaseQuantities) beregnet ut fra målene, med åpningene trukket fra og med navnene fra skjemaets maler.

Produktidentiteter skriver AI-en bare når du oppgir dem, og den finner aldri på dem: GTIN (GlobalTradeItemNumber), produsent
(Manufacturer) og modell (ModelLabel) i Pset_ManufacturerTypeInformation på typen, og serienummer (SerialNumber) og strekkode
(BarCode) i Pset_ManufacturerOccurrence på bygningsdelen. IFC2X3 har ikke GTIN.

*Forhåndsvis* kjører endringssettet på en kopi av modellen med IfcOpenShell i appens Python (komponentene hentes etter samtykke første
gang), tegner resultatet i 3D med nytt grønt og endret gult, og viser hva som opprettes, endres og slettes samt skjemakontrollens funn.
*Godkjenn* gjør endringene til oppskriftstrinnet *AI-endring*: modellen får en ny versjon i arbeidsområdet, tabellene bygges om, og
trinnet kan angres nøyaktig. Trinnet bærer proveniensen (leverandør, modell og spørsmålene). Et endringssett med skjemafeil kan ikke
godkjennes, slettinger bekreftes en gang til, og *Avvis* kaster endringssettet uten å røre modellen. AI-en kan aldri lagre eller
publisere: det gjør du med knappene.

Forhåndsvisningen kontrollerer også modellens relasjoner: en åpning uten vegg, en dør eller et vindu uten åpning, en bygningsdel
utenfor etasjene og en relasjon uten innhold teller som feil, men bare når endringssettet har forårsaket dem; det som allerede var i
modellen, sperrer ingenting. Slettes en vegg, følger dørene og vinduene med. Når appens Python allerede kjører, forhåndsviser AI-en
selv endringssettet før du ser det, og retter det hjulet finner, høyst to ganger; godkjenningen er fortsatt din.

En modell hentet fra Dataregium publiseres som ny versjon i Del med dokumentets basisversjon, den versjonen du hentet. Har dokumentet
fått en nyere versjon i mellomtiden, avviser serveren publiseringen (412 version_conflict); hent da den nyeste versjonen, gjør
endringene på nytt og publiser igjen. For en modell hentet fra Dataregium spør *Forhåndsvis* også serverens forhåndskontroll av
kandidaten (skjema, buildingSMART-regler og prosjektets IDS) når kilden er logget inn, og et prosjekt som ikke tar imot filer med
valideringsfeil avviser publiseringen (422) med serverens funn i meldingen og på kortet Valider modellen.

*Foreslå på serveren* sender et forhåndsvist endringssett til Dataregium som et endringsforslag i stedet for å publisere: en BCF-sak
i prosjektet med endringene vedlagt i serverens form (snippet-typen DataregiumIfcChangeSet, som serveren holder mot skjemaet sitt).
Formen angir endringer av eksisterende instanser, én per attributt: egenskapsverdier, plasseringer, tilhørighet til etasje og lignende,
med dokumentets basisversjon, navnet ditt på serveren og AI-modellen som proveniens. Nye elementer, slettinger og nye relasjoner kan
ennå ikke angis i formen; panelet teller dem, og de står i sakens beskrivelse. Knappen finnes for en modell hentet fra Dataregium når
serveren angir kapabiliteten `ifc_changes`, og modellen endres ikke av forslaget. Prøver serveren forslag (Dataregium med
IFC-LPG-modulen på), viser panelet utfallet av prøvingen under saken: hvor mange endringer som kunne brukes på basisversjonen, nye
funn mot basen, og hver endring som ikke kunne brukes, med årsaken (et funn av slaget proposal), for eksempel at en verdi ikke lenger
er den forslaget gikk ut fra. Er prøvingen ren, kan en *manager* i prosjektet trykke *Godkjenn på serveren*: serveren gjør forslaget
til dokumentets neste versjon (med basisversjon, forslagsstiller og godkjenner i versjonens metadata) og lukker saken. Modellen i appen
endres ikke av det; hent den nye versjonen fra Dataregium for å arbeide videre på den. Har dokumentet fått nyere versjoner siden
basen, prøver serveren forslaget på nytt mot den nyeste i samme steg og godkjenner mot den når prøvingen er ren; kolliderer endringene
med det som har kommet imellom, avviser serveren (412), og panelet viser de kolliderende nøklene (instans og attributt) eller sier at
alt kan ha endret seg når en hel fil er lastet opp imellom. Hent da den nyeste versjonen, gjør endringene på nytt og foreslå igjen.
Kortet *Endringsforslag på serveren* i modellvisningen viser, for en modell hentet fra Dataregium, alle forslag mot dokumentet når
serveren angir kapabiliteten `ifc_proposals_url`: tittel, tilstand, hvem som foreslo, hvor mange endringer og mot hvilken versjon;
*Godkjenn* gjør et prøvd forslag til neste versjon for den som får godkjenne, så flere personer med hver sin klient kan arbeide mot
samme modell. En server som oppgir formen `ops_form` (`dataspatium-tools/1`), får dessuten skriveverktøyenes operasjoner, så nye
elementer, slettinger og relasjoner kommer med i forslaget: serveren bygger dem på basisversjonen med samme kode som appen, og en
kolliderende nøkkel du gir opp, sendes med som `keep_theirs`.

Har prosjektet team (kortet *Prosjektets medlemmer* i Håndter), viser panelet hvilke team endringen rører. Rører den bare ett teams
del, godkjenner teamets ansvarlige, også med rollen redaktør, og serveren nekter (403) en prosjektansvarlig; rører den flere teams
deler, eller ingen, godkjenner en prosjektansvarlig som før. Når et IDS-dokument får en ny versjon, kontrollerer serveren prosjektets
siste IFC-versjoner på nytt, og rapportene deres står som ventende imens.

Oppgir serveren verdiene per kollisjon, viser panelet for hver kollisjon verdien i basen, det som kom imellom, og forslaget ditt, og
du velger per kollisjon å beholde forslaget ditt eller ta det som kom imellom. *Foreslå igjen med mine valg* sender forslaget mot den
nyeste versjonen med de beholdte endringene og uten de strøkne, og serveren prøver det på nytt før det kan godkjennes.
Sammenflettingen skjer på serveren; nettleseren håndterer bare selve kollisjonene.

## Riktig IFC-klasse

I IFC er klassen den første klassifiseringen: den mest spesifikke klassen med sin PredefinedType, ObjectType bare når PredefinedType er
USERDEFINED, og et typeobjekt; andre klassifiseringssystemer legges oppå. AI-en finner klassen for en ting med leseverktøyet
`search_ifc_class`, med engelske IFC-ord som *sink* eller *handrail*, i dokumentasjonen av modellens skjema som følger med
IfcOpenShell, og endringssettet godtar bare klasser som finnes og ikke er abstrakte i modellens skjema, og PredefinedType fra klassens
liste. Kortet *IFC-klasser* i Kontroller (og leseverktøyet `get_class_report`) teller proxyelementer (IfcBuildingElementProxy),
USERDEFINED uten navn, elementer uten type, PredefinedType på både type og element (regelen OJT001) og elementer utenfor den romlige
strukturen (SPS007), med eksempler.

## Sammenlign versjoner

Knappen *Sammenlign* i modellvisningen sammenligner den åpne modellen med en lagret versjon av samme datasett (Versjoner i Bearbeid)
eller med en annen IFC-modell i arbeidsområdet, for eksempel en nyere versjon hentet fra et CDE. Elementene matches på GlobalId; panelet
lister hva som bare finnes her, bare i den andre og hva som er endret, attributt for attributt og egenskap for egenskap. I 3D farges det
som bare finnes her grønt og det endrede gult; *Vis den andre versjonen* tegner i stedet den andre filen med det som bare finnes der
rødt. *Marker* legger forskjellene i utvalget. Ingenting endres; samme sammenligning får senere Dataregiums diff-API som kilde.

For en modell hentet fra Dataregium viser panelet også *Serverens endringssett*: endringene som ga den hentede versjonen på serveren,
når den ble godkjent fra et endringsforslag, med saken, hvem som foreslo og godkjente, basisversjonen (den versjonen forslaget ble
prøvd mot) og hver endring med instans, attributt, gammel og ny verdi. *Marker* markerer instansene i modellen. En versjon lastet opp
som hel fil har ingen endringssett. Det er en tredje kilde ved siden av øyeblikksbildene og de andre modellene.

Med *Serverens versjoner* hentes dokumentets øvrige versjoner på Dataregium som valg i listen *Sammenlign med*. Velger du en av dem,
beregnes sammenligningen av serveren (dens diff mellom versjoner, etter GlobalId og attributt, med plassering, form, beholder og type
som egne felt) og vises som de samme listene og fargene her, men uten den andre versjonen i 3D; hent den versjonen om du vil se den.
