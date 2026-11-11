# CAD og BIM: bygningsmodellar og teikningar

Dataspatium opnar bygningsmodellar i IFC og teikningar i DXF som ein eigen type datasett. Modellen blir teikna i 3D,
bygningsdelane blir ein tabell, og eigenskapar og mengder kan søkjast i, reknast ut og eksporterast. Alt skjer i nettlesaren: fila
forlèt aldri datamaskina. Originalfila blir lagra i datasettet og følgjer med i pakkar og tryggingskopiar.

## Opne ein modell

Slepp ei `.ifc`-, `.ifczip`- eller `.dxf`-fil i Hent. Opplysningane om fila blir viste (skjema, prosjekt, program, etasjar og tal
per type), og *Importer* lagar datasettet. IFC2X3, IFC4 og IFC4X3 i STEP-format blir støtta. Ein modell på rundt 50 MB tek om lag
eit kvart minutt å importere og blir deretter opna på nokre sekund.

## Modellen i Bearbeid

Modellen blir opna som 3D-vising med ein tabell over bygningsdelane under. Dra for å dreie, rull for å zoome mot peikaren,
og dra med høgre knapp eller med Skift for å flytte; på ein berøringsskjerm dreier éin finger, og to klyp og flyttar.
Dobbeltklikk på ein bygningsdel for å dreie rundt akkurat det punktet. Knappen med ramma viser alt som blir vist; einskilde
objekt langt frå bygningen blir ikkje rekna med. Fleire måtar å sjå modellen på står under [Visingar og tastaturet](#visingar-og-tastaturet).

- **Merk**: klikk på ein bygningsdel i modellen eller ei rad i tabellen. Merkinga følgjer med, og inspektøren viser
  type, etasje, materiale, klassifikasjon, eigenskapar og mengder og dessutan overflate og volum målt på geometrien.
- **Filtrer**: vel type eller etasje, eller søk på namn, materiale eller eigenskap. Tabellen og modellen viser same utval.
- **Vis som tabell**: alle kolonnar som ein vanleg tabell med alle verktøya i Bearbeid.
- **Lagre som diagram**: visinga med filter og kameravinkel blir eit diagram i Visualiser.

Geometrien blir rekna ut frå originalfila første gongen modellen blir opna i ein sesjon, og blir berre brukt til å teikne og måle. Tabellane
finst framleis sjølv om datamaskina manglar WebGL; då blir ei melding vist i staden for 3D-visinga.

### Visingar og tastaturet

- **Visingskuben** i hjørnet dreier med modellen. Klikk på ei side for å sjå modellen ovanfrå, framanfrå, frå høgre, bakanfrå,
  frå venstre eller nedanfrå, og på knappen under kuben for å sjå han skrått ovanfrå. Framanfrå ser langs Y-aksen til modellen,
  det vil seie mot nord når modellen er teikna med nord opp. Visingane viser det filteret viser.
- **Ortografisk vising**: knappen med kvadratet byter mellom perspektiv og ortografisk vising, der bygningsdelane ikkje krympar
  med avstanden. Ovanfrå blir då ei planteikning og framanfrå ein fasade. Eit diagram og eit viewpoint hugsar kva vising det var.
- **Snitt**: knappen med laga opnar snittet i inspektøren. Dra i glidebrytarane for aust–vest, sør–nord og høgd for å skjere bort
  det som ligg utanfor ein boks, eller vel ein etasje under *Snitt ved etasje* for å sjå han frå golvet opp til 1,2 m som ei
  planteikning. *Fjern snittet* viser alt igjen. Snittet følgjer med eit diagram og eit viewpoint, og eit viewpoint frå eit anna
  program viser snittet sitt.
- **Zoom til merkte** viser dei merkte bygningsdelane, og **Vis berre merkte** gøymer alt anna slik at du kan dreie rundt dei;
  klikk igjen for å vise alt.
- **Tastaturet** verkar når 3D-visinga har fokus: klikk i ho eller gå dit med Tab.

| Tast | Gjer |
|---|---|
| Pilene | flyttar visinga |
| Ctrl eller Skift og pilene | dreier |
| + og − | zoomar |
| F | zoomar til dei merkte |
| Home | viser alt |
| 1–7 | ovanfrå, framanfrå, frå høgre, bakanfrå, frå venstre, nedanfrå, skrått ovanfrå |
| O | byter ortografisk vising |

## Saker frå eit CDE

Ein modell henta frå ein OpenCDE-tenar, eller kva modell som helst når ein slik tenar finst som kjelde, kan vise sakene
sine: knappen *Saker* i modellvisinga opnar eit panel i inspektøren med BCF-sakene i prosjektet. Dei som peikar på
bygningsdelar i denne modellen står først, med status og tal på bygningsdelar. Klikk på ei sak, så blir bygningsdelane merkte i
3D-visinga, og panelet viser skildring, augneblinksbilete og kommentarar. Sakene blir henta når du ber om det og blir ikkje lagra i
datasettet; for å rekne på dei lagrar du dei som ein tabell i Hent. Har saka eit viewpoint med kamera, går visinga dit, i perspektiv eller ortografisk og med snittet sitt.

Med rettane til det kan du òg skrive. *Ny sak* opprettar ei sak på tenaren med tittel, type, status og etikettar frå
listene i prosjektet, og visinga følgjer med som viewpoint: kameraet (perspektiv eller ortografisk) med snittet, eit augneblinksbilete og dei merkte bygningsdelane som
komponentar. I ei vald sak kan du skrive ein kommentar, byte status og leggje til den aktuelle visinga som eit nytt viewpoint.
*Lagre som BCF* gjev alle sakene i prosjektet med kommentarar, viewpoints og augneblinksbilete som ei BCF-fil, som verktøy utan API
kan opne. Ei BCF-fil kan òg lesast inn i Hent: sakene blir ein tabell, kommentarar og komponentar tabellar ved sida av.

*Farg etter status* gjev bygningsdelane fargen frå den mest opne saka si: raud for opne, gul for pågåande, grøn for avslutta, med ei
teiknforklaring under lista. *Lagre som tabell* gjev sakene i prosjektet som ein tabell med éi rad per sak og bygningsdel (type, namn
og etasje følgjer med), som Handter kjenner att som saker: kortet *Saker* viser status og opprettar dashbordet *Sakstatus* med
status, type, ansvarleg, prioritet og månad bak felles filter, og knappen *Vis i modellen* går tilbake til panelet. Verktøyet
*Saker* i fana Mengder i Analyser tel saker, opne saker og bygningsdelar per status, type, prioritet, ansvarleg, bygningsdelstype
eller etasje frå ein slik tabell, og SQL-startkoden får spørjingar for koplinga. *Lagre som diagram* lagrar visinga med fargane
som eit modelldiagram, som dashbord, dokument og Publiser viser med teiknforklaring.

Grafen til modellen på tenaren blir teikna og spurd frå *Hent*, og knappen *IFC-LPG* tek deg dit, sjå [grafer.md](grafer.md#ifc-lpg-på-ein-dataregium-tenar).

Modellen til grafen, relasjonane og spørjingane frå Dataspatium si side finst i [ifc-lpg.md](https://github.com/marwiss/Dataregium/blob/main/docs/nn/ifc-lpg.md) hos Dataregium.

## Tabellane

| Tabell | Innhald |
|---|---|
| `data` | Éi rad per bygningsdel, rom og etasje: id, guid, typ (type), kategori (byggdel, rum, struktur), namn, beskrivning, objekttyp, tagg, vaning (etasje), typnamn, material, klassificering, egenskaper og mangder (mengder) som JSON |
| `_properties` | Éi rad per eigenskap: id, uppsattning (sett), namn, varde (verdi), tal, enhet, kalla (objekt eller typ) |
| `_quantities` | Éi rad per mengd i SI-einingar: id, uppsattning, namn, varde, slag (langd, area, volym, vikt, tid, antal), enhet |
| `_entities` | Dei ikkje-geometriske entitetane i fila med rå attributt: id, typ, attribut |

Eigenskapar som berre finst på typen til bygningsdelen, blir rekna med og er merkte `typ`. Mengder blir rekna om til meter,
kvadratmeter, kubikkmeter og kilogram med einingane i prosjektet. Opningar og tilkoplingsportar er ikkje bygningsdelar og finst
berre i `_entities`.

Tabellane kan spørjast med SQL i Analyser:

```sql
SELECT d.vaning, d.typ, count(*) AS antal, sum(q.varde) AS volym
FROM data d JOIN _quantities q ON q.id = d.id
WHERE q.namn = 'NetVolume'
GROUP BY 1, 2 ORDER BY 1, 2
```

I R og Python gjev `dm_read()` bygningsdelane, `dm_read_properties()` eigenskapane og `dm_read_quantities()` mengdene.

## Fana Mengder i Analyser

- **Samandrag**: opplysningane om fila og innhaldet.
- **Mengder**: tal, lengd, areal, volum og vekt gruppert etter type, etasje, materiale, typenamn eller klassifikasjon.
  Kjelda *Mengdene i fila* tek éin verdi per bygningsdel og slag: netto før andre og brutto sist, slik at ein vegg ikkje blir telt
  to gonger. Kjelda *Målt på geometrien* reknar på trekantane og verkar òg når fila manglar mengder. Overflata er då
  heile overflata rundt bygningsdelen, ikkje til dømes sidearealet til ein vegg.
- **Mengdeliste**: kvart mengdenamn i fila per type med sum. Her ser du nøyaktig kva fila oppgjev.
- **Eigenskapar**: kva verdiar ein eigenskap har, og hos kor mange bygningsdelar av kvar type.
- **Entitetar**: kor mange entitetar av kvart slag fila består av.

Kvart resultat kan lagrast som datasett.

## IfcOpenShell i appen

Appen kan lese, kontrollere og endre IFC-modellar med IfcOpenShell, det same biblioteket som Dataregium byggjer på. Det
køyrer i Python i nettlesaren, blir henta første gongen det blir brukt (om lag 13 MB, etter samtykket ditt til komponentar) og
lagra i nettlesaren. Ingenting blir sendt nokon stad; modellen forlèt ikkje datamaskina.

**I Analyser, fana Mengder**, har ein IFC-modell fem verktøy til:

- **Validering** kontrollerer modellen mot IFC-skjemaet sitt: attributt, typar og referansar, valfritt òg reglane i skjemaet.
  Funna kan lagrast som datasett.
- **Romleg struktur** viser prosjekt, tomt, bygning, etasjar og rom som eit tre med talet på element per del.
- **Eigenskapssett** gir alle eigenskapssett for ein elementtype som ein brei tabell: ei rad per element, ein kolonne per
  eigenskap (`Sett.Eigenskap`), valfritt òg mengdesetta.
- **IFC-utval** hentar element med utvalsspråket i IfcOpenShell, til dømes `IfcWall, Pset_WallCommon.FireRating=EI60` eller
  `IfcElement, material=Betong`.
- **Geometrimål** måler volum, overflate og omsluttande boks per element på geometrien (OpenCASCADE). Seint for store
  modellar.
- **IDS-kontroll** kontrollerer modellen mot ei IDS-fil (buildingSMART Information Delivery Specification) med
  ifctester, IfcOpenShell sin eigen kontrollør: vel .ids-fila, så får du ei rad per krav og element med godkjend, ikkje godkjend
  eller ikkje relevant og årsaka, og ei oppteljing. Fila blir i nettlesaren. ifctester følgjer med appen utan webappen sin, så
  ingenting blir henta utover Python sjølv.

**I Bearbeid** har modellen to handlingar under *Handlingar* (knappen finst i modellvisinga og i tabellvisinga), i gruppa
*Modell*:

- **Skriv tabell til modellen** skriv verdiane i ein tabell inn i modellen. Radene blir kopla på GUID; kolonnane `Name`,
  `Description`, `ObjectType` og `Tag` (eller `namn`, `beskrivning`, `objekttyp`, `tagg`) blir attributt, og kolonnar som
  `Pset_WallCommon.FireRating` blir eigenskapar (settet blir oppretta om det manglar). Arbeidsmåten: lagre *Eigenskapssett* som
  datasett, rediger det i Bearbeid og skriv tilbake.
- **Python på modellen** køyrer ein funksjon `step(model)` med API-et i IfcOpenShell på heile modellen.

Begge er steg i oppskrifta: den endra modellen blir det nye innhaldet i datasettet (originalfila blir bytt og tabellane bygde
om), steget blir logga og kan angrast, og originalfila er alltid den gjeldande versjonen når du eksporterer modellen eller
sender han til eit CDE.

**I Python** (fana Python i Analyser og kodeceller i notatboka) opnar `dm_ifc("namn")` modellen som ei `ifcopenshell.file`.
Hjelparane `dm_ifc_elements`, `dm_ifc_psets`, `dm_ifc_tree`, `dm_ifc_validate`, `dm_ifc_select` og `dm_ifc_geometry` gir
tabellar, `dm_ifc_set(model, df)` skriv ein tabell inn i modellen, og `dm_ifc_write(model, "namn")` sender modellen til appen som
eit nytt datasett; sjå [Python i Dataspatium](python.md). Verktøya i Analyser og Python endrar aldri datasettet; berre
handlingane i Bearbeid gir ein ny versjon.

IfcOpenShell er LGPL-3.0 og blir henta uendra som fastlåste wheels frå IfcOpenShell si eiga oversikt, sjå [Lisensar](licenser.md).

## Valider modellen

Kortet **Valider modellen** i Handter samlar kontrollane av ein IFC-modell, med det siste resultatet av kvar.

- **Kontrollen til tenaren** finst for ein modell som er henta som dokumentversjon frå eit CDE. Dataregium (frå 3.0.0) kontrollerer
  kvar opplasta IFC-fil mot IFC-skjemaet og, når tenaren har dei installerte, mot reglane til buildingSMART (ifc-gherkin-rules), og
  legg resultatet i metadataa til versjonen. *Hent kontrollen til tenaren* les det: ingen funn, funn som berre er åtvaringar, funn
  med feil, ventar på kontroll eller kunne ikkje kontrollerast, og når og med kva reglar. Appen spør tenaren først når du trykkjer på
  knappen. Finst det funn, viser *Vis funna* rapporten til tenaren: talet på funn og feil, kva kontrollar som vart gjorde og kva
  reglar som ikkje kunne køyrast, og kvart funn med regelen, instansen (`#123`) og GlobalId-en til elementet. *Merk i modellen*
  merkjer deretter elementa i modellvisinga i Bearbeid, og *Lagre som tabell* lagrar funna som ein tabell med kolonnane `kind`, `rule`, `severity`, `message`, `step_id`, `global_id` og
  `attribute`. Rapporten blir henta med same innlogging frå ei adresse som appen sjølv byggjer på same tenar; ei adresse frå
  metadataa blir aldri følgd.
- **IDS-filene til prosjektet**: kontrollerer tenaren også fila mot IDS-dokumenta til prosjektet (den nyaste versjonen av kvart dokument
  der namnet sluttar på `.ids`), viser rapporten kor mange spesifikasjonar som vart godkjende, ikkje godkjende eller ikkje galdt fila, og
  kva for nokre som ikkje vart godkjende, med namnet på dokumentet og talet på funn. Eit IDS-dokument som ikkje kunne lesast, står blant
  reglane som ikkje kunne køyrast.
- **Det ingen GlobalId når**: finn kontrollen graph til tenaren instansar som ingenting med ein GlobalId når, viser rapporten
  knappen *Fjern det ingen GlobalId når*. Tenaren føreslår då, etter stadfestinga di, eit endringssett som fjernar dei; framlegget
  blir ei sak som blir prøvd og godkjend som andre, og versjonen held på alt.
- **Kontrollar her** viser den siste *Validering*, *IDS-kontroll* og kollisjonskontroll som er køyrd i appen, og knappane opnar dei i
  Analyser. Resultata blir lagra i innstillingane til appen, ikkje i datasettet.

Funna gjeld fila slik ho vart lasta opp, og tenaren stoppar aldri ei fil på grunn av dei. Ei fil der alle funn er åtvaringar, blir
rekna som gyldig av valideringstenesta til buildingSMART. Har tenaren ingen slik kontroll, seier kortet at tenaren ikkje har
kontrollert versjonen.

## Kollisjonskontroll

Verktøyet **Kollisjonar** i Analyser (fana Mengder) finn bygningsdelar som går inn i kvarandre eller kjem for nær kvarandre. Det
arbeider på dei same trekantane som 3D-visinga viser, i ein eigen tråd, og treng verken Python eller nett.

- **Mengd A og mengd B** er alle bygningsdelar eller ein type, til dømes kanalar mot bjelkar. B kan liggje i same modell eller i ein
  annan modell i same prosjekt, og modellane må då dele koordinatsystem. Opningar tel ikkje.
- **På tenaren**: for ein modell frå Dataregium (frå 3.0.0, når tenaren har kollisjonskontrollen slått på) vel *Kvar* om appen
  reknar sjølv eller om tenaren gjer same kontrollen av versjonane. Tenaren arbeider i ein kø; appen ventar og viser rapporten som
  sin eigen, med same tabell, markering og BCF-fil, og *Send som saker* lèt tenaren lage sakene med eitt viewpoint kvar. Den andre
  modellen må då vere ein versjon i same prosjekt.
- **Skjering** tel par der det eine elementet når djupare inn i det andre enn toleransen (2 mm om ikkje anna er oppgitt). Djupna blir
  målt som kor langt hjørne og kantar når inn i det andre elementet, så flater som berre møtest, tel ikkje. *Innelukking* er eit
  element som ligg heilt inne i eit anna.
- **Fri avstand** tel par som er nærare kvarandre enn avstanden (50 mm om ikkje anna er oppgitt), skjeringar medrekna.

Resultatet er ein tabell med id, GlobalId, type og namn for begge elementa, slaget, djupna eller avstanden i millimeter og eit punkt
i dei eigne koordinatane til modellen. Derifrå:

- *Merk i modellen* merkjer elementa i modellvisinga i Bearbeid.
- *Lagre som BCF* lagrar éi sak per kollisjon i ei BCF-fil, med ei vising som ser på punktet og begge elementa merkte og farga.
  Kamera og punkt står i koordinatane til modellen med Z opp, så andre BCF-verktøy viser same staden.
- *Send som saker* opprettar sakene direkte i prosjektet på tenaren gjennom BCF API, for ein modell som er henta frå eit CDE. Der ser
  alle klientar dei, til dømes Bonsai.
- *Opprett datasett* lagrar tabellen.

Det siste resultatet står på kortet Valider modellen i Handter. Målinga føreset lukka flater: eit element med opne eller øydelagde
flater kan gi usikre djupner. Bøygde flater er delte opp i trekantar, så ein toleranse under ein millimeter blir usikker. Element som 3D-visinga ikkje kan teikne, er ikkje med, og resultatet seier kor mange dei er; i ein prøvemodell frå Tekla gjaldt det alle armeringsjerna.

## DXF-teikningar

Ei DXF-fil blir ein tabell med eitt teikningsobjekt per rad (type, lag, farge, lengd, areal, tekst og plassering) og ei
SVG-teikning. Teikninga blir opna i Bearbeid, der du zoomar med hjulet eller ved å klype og panorerer ved å dra; når teikninga har fokus, flyttar pilene, + og − zoomar, Home viser alt og F zoomar til det merkte objektet. Ei rad i tabellen zoomar til objektet sitt. Laga blir slått av og på i inspektøren,
og eit klikk merkjer objektet og rada. Fana Mengder gjev tal, lengd og areal per lag og type.

Linjer, polylinjer med bogar, sirklar, bogar, ellipsar, splines, punkt, tekstar, solid, 3D-flater, blokker og
blokkene til målsetjingar blir teikna. Skravering (HATCH) blir ikkje teikna.

## Eksport

Eksporter gjev originalfila, eigenskapane og mengdene som CSV (éi rad per verdi) og teikninga som SVG, i tillegg til dei
vanlege tabellformata for `data`. Diagram av modellar blir eksporterte som PNG, SVG og PDF; ein 3D-modell blir då eit bilete.

## Avgrensingar

- Tabellane kan ikkje redigerast direkte. Modellen blir endra med oppskriftsstega for IfcOpenShell og med *Endre med AI*, som skriv
  ein ny versjon av IFC-fila.
- Ein modell blir teikna på nytt frå originalfila i kvar ny sesjon. Modellen på 57 MB som appen er prøvd med, tek 4–6 sekund.
- Den første teikninga av ein svært stor modell kan låse sida ei augneblink medan grafikkortet tek imot trekantane.
- Mengdene er ikkje ei mengdeberekning etter noko regelverk. Kontroller dei mot kjelda før dei blir brukte.
- DXF blir lese i to dimensjonar. DWG må først lagrast som DXF.

## Ny modell

Ein ny, tom modell blir laga i Hent med *Ny bygningsmodell*. Vel skjema (IFC4X3_ADD2 er standard; IFC4 og IFC2X3 finst for program
som ikkje les det nyaste) og namn på prosjekt, tomt, bygning og første etasje. Appen skriv modellen med IfcOpenShell i Python i
appen, i meter og med kontekstane til modellen, og modellen består skjemakontrollen. Første gongen blir Python og IfcOpenShell henta
etter samtykke.

Modellen blir eit vanleg modelldatasett. Opne det i Bearbeid og byggj i det med *Endre med AI*, til dømes «to etasjar og eit
rutenett på 6×4 m med ytterveggar langs rutenettet». Det kan eksporterast som IFC og publiserast på ein Dataregium som andre
modellar.

## Spør AI om modellen

Knappen *Spør AI* i modellvisinga opnar eit panel i inspektøren der du stiller eit spørsmål om den opne IFC-modellen, til dømes "kva
dører manglar brannklasse i etasje 2?". AI-modellen les med verktøy (oversynet over modellen, etasjane, element etter klasse, etasje, namn og
eigenskap, eitt element med alle eigenskapar, det du har markert i 3D-visinga og, for ein modell henta frå Dataregium, dei namngjevne
spørjingane til tenaren) og svarar med elementa han byggjer på. *Marker n element*
legg elementa i svaret i utvalet, som 3D-visinga, tabellen og dei andre modusane følgjer. Panelet viser kvart verktøykall og kor mange token
som gjekk med. AI-en kan berre lese: ingenting blir endra, lagra eller publisert, og neste spørsmål held fram samtalen.

*Leverandørar* legg til ei skyteneste eller ein lokal modell: Anthropic Messages eller eit OpenAI-kompatibelt API (OpenAI, Gemini, Ollama,
vLLM, llama.cpp med fleire), med adresse, modell og API-nøkkel. Nøkkelen blir halden i økta eller kryptert med passordfrasen din, aldri i
klartekst og aldri i spørsmålet. *Policy* avgjer kva som får kallast: *Spør* ber om samtykke per leverandør første gongen, *Sky* tillèt
skytenester, og *Berre lokal* tillèt berre modellar på di eiga datamaskin. Det som blir sendt, er spørsmålet ditt og verktøysvara modellen
ber om; verktøysvara er data frå modellen, aldri instruksjonar, og blir kappa når dei er store.

## Endre med AI

Modusen *Endre* i same panel lèt AI-en føreslå endringar i modellen, til dømes "lag to etasjar og eit rutenett på 6×4 m, ytterveggar
langs rutenettet, eitt dekke per etasje og ei dør i kvar vegg i etasje 1". AI-en les modellen med dei same verktøya som i Spør og skriv
med verktøy for etasjar og rutenett, veggar, dekke, opningar med dør eller vindauge, eigenskapar, material, flytting og sletting.
Verktøya endrar ingenting: dei fyller eit endringssett som panelet listar steg for steg (mål i meter; nye element får referansane new-1,
new-2 … til fila har gjeve dei id).

*Førehandsvis* køyrer endringssettet på ein kopi av modellen med IfcOpenShell i Python i appen (komponentane vert henta etter samtykke
første gongen), teiknar resultatet i 3D med nytt grønt og endra gult, og viser kva som vert oppretta, endra og sletta saman med funna
frå skjemakontrollen. *Godkjenn* gjer endringane til oppskriftssteget *AI-endring*: modellen får ein ny versjon i arbeidsområdet,
tabellane vert bygde om, og steget kan angrast nøyaktig. Steget ber proveniensen (leverandør, modell og spørsmåla). Eit endringssett med
skjemafeil kan ikkje godkjennast, slettingar vert stadfesta ein gong til, og *Avvis* kastar endringssettet utan å røre modellen. AI-en
kan aldri lagre eller publisere: det gjer du med knappane.

Førehandsvisinga kontrollerer også relasjonane i modellen: ei opning utan vegg, ei dør eller eit vindauge utan opning, ein
bygningsdel utanfor etasjane og ein relasjon utan innhald tel som feil, men berre når endringssettet har ført til dei; det som alt var
i modellen, sperrar ingenting. Vert ein vegg sletta, følgjer dørene og vindauga med. Når Python i appen alt køyrer, førehandsviser AI-en
sjølv endringssettet før du ser det, og rettar det hjulet finn, høgst to gonger; godkjenninga er framleis di.

Ein modell henta frå Dataregium vert publisert som ny versjon i Del med basisversjonen til dokumentet, den versjonen du henta. Har
dokumentet fått ein nyare versjon i mellomtida, avviser tenaren publiseringa (412 version_conflict); hent då den nyaste versjonen, gjer
endringane på nytt og publiser igjen. For ein modell henta frå Dataregium spør *Førehandsvis* også førehandskontrollen til tenaren
av kandidaten (skjema, buildingSMART-reglar og IDS-en til prosjektet) når kjelda er innlogga, og eit prosjekt som ikkje tek imot filer
med valideringsfeil avviser publiseringa (422) med funna til tenaren i meldinga og på kortet Valider modellen.

*Foreslå på tenaren* sender eit førehandsvist endringssett til Dataregium som eit endringsframlegg i staden for å publisere: ei
BCF-sak i prosjektet med endringane vedlagde i forma til tenaren (snippet-typen DataregiumIfcChangeSet, som tenaren held mot skjemaet
sitt). Forma gjev endringar av eksisterande instansar, éin per attributt: eigenskapsverdiar, plasseringar, tilhøyrsle til etasje og
liknande, med basisversjonen til dokumentet, namnet ditt på tenaren og AI-modellen som proveniens. Nye element, slettingar og nye
relasjonar kan enno ikkje gjevast i forma; panelet tel dei, og dei står i skildringa av saka. Knappen finst for ein modell henta frå
Dataregium når tenaren gjev kapabiliteten `ifc_changes`, og modellen vert ikkje endra av framlegget. Prøver tenaren framlegg
(Dataregium med IFC-LPG-modulen på), viser panelet utfallet av prøvinga under saka: kor mange endringar som kunne brukast på
basisversjonen, nye funn mot basen, og kvar endring som ikkje kunne brukast, med årsaka (eit funn av slaget proposal), til dømes at ein
verdi ikkje lenger er den framlegget gjekk ut frå. Er prøvinga rein, kan ein *manager* i prosjektet trykkje *Godkjenn på tenaren*:
tenaren gjer framlegget til neste versjon av dokumentet (med basisversjon, framleggsstillar og godkjennar i metadataa til versjonen) og
lukkar saka. Modellen i appen vert ikkje endra av det; hent den nye versjonen frå Dataregium for å arbeide vidare på han. Har dokumentet fått
nyare versjonar sidan basen, prøver tenaren framlegget på nytt mot den nyaste i same steg og godkjenner mot han når prøvinga er rein;
kolliderer endringane med det som har kome imellom, avviser tenaren (412), og panelet viser dei kolliderande nøklane (instans og
attributt) eller seier at alt kan ha endra seg når ei heil fil er lasta opp imellom. Hent då den nyaste versjonen, gjer endringane på
nytt og foreslå igjen.

Gjev tenaren verdiane per kollisjon, viser panelet for kvar kollisjon verdien i basen, det som kom imellom, og framlegget ditt, og du
vel per kollisjon å halde på framlegget ditt eller ta det som kom imellom. *Foreslå igjen med vala mine* sender framlegget mot den
nyaste versjonen med dei haldne endringane og utan dei strokne, og tenaren prøver det på nytt før det kan godkjennast.
Samanflettinga skjer på tenaren; nettlesaren handterer berre sjølve kollisjonane.

## Samanlikn versjonar

Knappen *Samanlikn* i modellvisinga samanliknar den opne modellen med ein lagra versjon av same datasett (Versjonar i Arbeid) eller
med ein annan IFC-modell i arbeidsområdet, til dømes ein nyare versjon henta frå eit CDE. Elementa vert kopla på GlobalId; panelet listar
kva som berre finst her, berre i den andre og kva som er endra, attributt for attributt og eigenskap for eigenskap. I 3D vert det som
berre finst her grønt og det endra gult; *Vis den andre versjonen* teiknar i staden den andre fila med det som berre finst der raudt.
*Marker* legg skilnadene i utvalet. Ingenting vert endra; same samanlikning får seinare diff-API-et til Dataregium som kjelde.

For ein modell henta frå Dataregium viser panelet også *Endringssettet til tenaren*: endringane som gav den henta versjonen på
tenaren, når han vart godkjend frå eit endringsframlegg, med saka, kven som føreslo og godkjende, basisversjonen (den versjonen
framlegget vart prøvd mot) og kvar endring med instans, attributt, gammal og ny verdi. *Marker* markerer instansane i modellen. Ein
versjon lasta opp som heil fil har ingen endringssett. Det er ei tredje kjelde ved sida av augneblinksbileta og dei andre modellane.

Med *Versjonane til tenaren* vert dei andre versjonane av dokumentet på Dataregium henta som val i lista *Samanlikn med*. Vel du ein
av dei, vert samanlikninga rekna av tenaren (diffen mellom versjonar, etter GlobalId og attributt, med plassering, form, behaldar og
type som eigne felt) og vist som dei same listene og fargane her, men utan den andre versjonen i 3D; hent den versjonen om du vil sjå han.
