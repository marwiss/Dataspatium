# CAD og BIM: bygningsmodeller og tegninger

Dataspatium åpner bygningsmodeller i IFC og tegninger i DXF som en egen type datasett. Modellen tegnes i 3D,
bygningsdelene blir en tabell, og egenskaper og mengder kan søkes i, beregnes og eksporteres. Alt skjer i nettleseren: filen
forlater aldri datamaskinen. Originalfilen lagres i datasettet og følger med i pakker og sikkerhetskopier.

## Åpne en modell

Slipp en `.ifc`-, `.ifczip`- eller `.dxf`-fil i Hent. Filens opplysninger vises (skjema, prosjekt, program, etasjer og antall
per type), og *Importer* lager datasettet. IFC2X3, IFC4 og IFC4X3 i STEP-format støttes. En modell på rundt 50 MB tar omtrent
et kvarter minutt å importere og åpnes deretter på noen sekunder.

## Modellen i Bearbeid

Modellen åpnes som 3D-visning med en tabell over bygningsdelene under. Dra for å dreie, rull for å zoome og dra med høyre
knapp for å flytte. Knappen med rammen viser hele modellen; enkelte objekter langt fra bygningen regnes ikke med.

- **Marker**: klikk på en bygningsdel i modellen eller en rad i tabellen. Markeringen følger med, og inspektøren viser
  type, etasje, materiale, klassifikasjon, egenskaper og mengder samt overflate og volum målt på geometrien.
- **Filtrer**: velg type eller etasje, eller søk på navn, materiale eller egenskap. Tabellen og modellen viser samme utvalg.
- **Vis som tabell**: alle kolonner som en vanlig tabell med alle verktøyene i Bearbeid.
- **Lagre som diagram**: visningen med filter og kameravinkel blir et diagram i Visualiser.

Geometrien beregnes fra originalfilen første gang modellen åpnes i en økt, og brukes bare til å tegne og måle. Tabellene
finnes fortsatt selv om datamaskinen mangler WebGL; da vises en melding i stedet for 3D-visningen.

## Saker fra et CDE

En modell hentet fra en OpenCDE-server, eller hvilken som helst modell når en slik server finnes som kilde, kan vise sakene
sine: knappen *Saker* i modellvisningen åpner et panel i inspektøren med prosjektets BCF-saker. De som peker på
bygningsdeler i denne modellen står først, med status og antall bygningsdeler. Klikk på en sak, så markeres bygningsdelene i
3D-visningen, og panelet viser beskrivelse, øyeblikksbilde og kommentarer. Sakene hentes når du ber om det og lagres ikke i
datasettet; for å regne på dem lagrer du dem som en tabell i Hent. Dette er lesing; å opprette og endre saker kommer i
neste utgave.

Med rettighetene til det kan du også skrive. *Ny sak* oppretter en sak på serveren med tittel, type, status og etiketter fra
prosjektets lister, og visningen følger med som viewpoint: kameraet, et øyeblikksbilde og de markerte bygningsdelene som
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
- **Kontroller her** viser den siste *Validering*, *IDS-kontroll* og kollisjonskontroll som er kjørt i appen, og knappene åpner dem i
  Analyser. Resultatene lagres i appens innstillinger, ikke i datasettet.

Funnene gjelder filen slik den ble lastet opp, og serveren stopper aldri en fil på grunn av dem. En fil der alle funn er advarsler,
regnes som gyldig av buildingSMARTs valideringstjeneste. Har serveren ingen slik kontroll, sier kortet at serveren ikke har
kontrollert versjonen.

## Kollisjonskontroll

Verktøyet **Kollisjoner** i Analyser (fanen Mengder) finner bygningsdeler som går inn i hverandre eller kommer for nær hverandre. Det
arbeider på de samme trekantene som 3D-visningen viser, i en egen tråd, og trenger verken Python eller nett.

- **Mengde A og mengde B** er alle bygningsdeler eller en type, for eksempel kanaler mot bjelker. B kan ligge i samme modell eller i en
  annen modell i samme prosjekt, og modellene må da dele koordinatsystem. Åpninger teller ikke.
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

Det siste resultatet står på kortet Valider modellen i Håndter. Målingen forutsetter lukkede flater: et element med åpne eller
ødelagte flater kan gi usikre dybder. Buede flater er delt opp i trekanter, så en toleranse under en millimeter blir usikker. Elementer som 3D-visningen ikke kan tegne, er ikke med, og resultatet sier hvor mange de er; i en prøvemodell fra Tekla gjaldt det alle armeringsjernene.

## DXF-tegninger

En DXF-fil blir en tabell med ett tegningsobjekt per rad (type, lag, farge, lengde, areal, tekst og plassering) og en
SVG-tegning. Tegningen åpnes i Bearbeid, der du zoomer med hjulet og panorerer ved å dra. Lagene slås av og på i inspektøren,
og et klikk markerer objektet og raden. Fanen Mengder gir antall, lengde og areal per lag og type.

Linjer, polylinjer med buer, sirkler, buer, ellipser, splines, punkter, tekster, solider, 3D-flater, blokker og
målsettingers blokker tegnes. Skravering (HATCH) tegnes ikke.

## Eksport

Eksporter gir originalfilen, egenskapene og mengdene som CSV (én rad per verdi) og tegningen som SVG, i tillegg til de
vanlige tabellformatene for `data`. Diagrammer av modeller eksporteres som PNG, SVG og PDF; en 3D-modell blir da et bilde.

## Begrensninger

- Modellen kan ikke redigeres, og ingen ny IFC-fil skrives. Endringer i tabellene påvirker ikke originalfilen.
- En modell tegnes på nytt fra originalfilen i hver ny økt. Modellen på 57 MB som appen er prøvd med, tar 4–6 sekunder.
- Den første tegningen av en svært stor modell kan låse siden et øyeblikk mens grafikkortet tar imot trekantene.
- Mengdene er ikke en mengdeberegning etter noe regelverk. Kontroller dem mot kilden før de brukes.
- DXF leses i to dimensjoner. DWG må først lagres som DXF.

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

Modusen *Endre* i samme panel lar AI-en foreslå endringer i modellen, for eksempel "lag to etasjer og et rutenett på 6×4 m,
yttervegger langs rutenettet, ett dekke per etasje og en dør i hver vegg i etasje 1". AI-en leser modellen med de samme verktøyene som i
Spør og skriver med verktøy for etasjer og rutenett, vegger, dekker, åpninger med dør eller vindu, egenskaper, materialer, flytting og
sletting. Verktøyene endrer ingenting: de fyller et endringssett som panelet lister trinn for trinn (mål i meter; nye elementer får
referansene new-1, new-2 … til filen har gitt dem id).

*Forhåndsvis* kjører endringssettet på en kopi av modellen med IfcOpenShell i appens Python (komponentene hentes etter samtykke første
gang), tegner resultatet i 3D med nytt grønt og endret gult, og viser hva som opprettes, endres og slettes samt skjemakontrollens funn.
*Godkjenn* gjør endringene til oppskriftstrinnet *AI-endring*: modellen får en ny versjon i arbeidsområdet, tabellene bygges om, og
trinnet kan angres nøyaktig. Trinnet bærer proveniensen (leverandør, modell og spørsmålene). Et endringssett med skjemafeil kan ikke
godkjennes, slettinger bekreftes en gang til, og *Avvis* kaster endringssettet uten å røre modellen. AI-en kan aldri lagre eller
publisere: det gjør du med knappene.

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

## Sammenlign versjoner

Knappen *Sammenlign* i modellvisningen sammenligner den åpne modellen med en lagret versjon av samme datasett (Versjoner i Bearbeid)
eller med en annen IFC-modell i arbeidsområdet, for eksempel en nyere versjon hentet fra et CDE. Elementene matches på GlobalId; panelet
lister hva som bare finnes her, bare i den andre og hva som er endret, attributt for attributt og egenskap for egenskap. I 3D farges det
som bare finnes her grønt og det endrede gult; *Vis den andre versjonen* tegner i stedet den andre filen med det som bare finnes der
rødt. *Marker* legger forskjellene i utvalget. Ingenting endres; samme sammenligning får senere Dataregiums diff-API som kilde.
