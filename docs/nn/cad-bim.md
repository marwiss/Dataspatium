# CAD og BIM: bygningsmodellar og teikningar

Dataspatium opnar bygningsmodellar i IFC og teikningar i DXF som ein eigen type datasett. Modellen blir teikna i 3D,
bygningsdelane blir ein tabell, og eigenskapar og mengder kan søkjast i, reknast ut og eksporterast. Alt skjer i nettlesaren: fila
forlèt aldri datamaskina. Originalfila blir lagra i datasettet og følgjer med i pakkar og tryggingskopiar.

## Opne ein modell

Slepp ei `.ifc`-, `.ifczip`- eller `.dxf`-fil i Hent. Opplysningane om fila blir viste (skjema, prosjekt, program, etasjar og tal
per type), og *Importer* lagar datasettet. IFC2X3, IFC4 og IFC4X3 i STEP-format blir støtta. Ein modell på rundt 50 MB tek om lag
eit kvart minutt å importere og blir deretter opna på nokre sekund.

## Store modellar frå tenaren

Ein modell som er for stor til å lesast i nettlesaren kan hentast frå Dataregium utan IFC-fila. I fillista til kjelda under *Hent →
OpenCDE* har ein modell knappen **Stor modell** når tenaren har geometri-API-et (`ifc_geometry`). Vel detaljnivå: *Heile geometrien*
gjev netta til bygningsdelane, *Boksar per bygningsdel* berre ein boks kvar for ei rask oversikt. Appen hentar geometrien som binær
glTF, les han i ein bakgrunnstråd og lagar eit modelldatasett med éi rad per bygningsdel (id, GlobalId, klasse, namn og etasje frå dei
namngjevne spørjingane til tenaren). Geometrien vert lagra med datasettet, så 3D-visinga, markering, utval og saker fungerer som for ein
modell frå ei fil. Eigenskapar og mengder følgjer ikkje med, og det som treng IFC-fila, som kollisjonskontrollen i appen og eksport av
originalen, manglar; kollisjonstesten og spørjingane på tenaren går som vanleg. Kortet i Handter viser *Geometri: Frå tenaren*.

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
- **Klimaerklæring**: ei førebels klimaerklæring ut frå modellen per kategori og lag, sjå *Førebels klimaerklæring* nedanfor.

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

## Prosjektprofil

Kortet **Prosjektprofil** i visinga til kjelda under *Hent → OpenCDE* viser profilen til det valde prosjektet: IDS-dokumenta til
prosjektet (filer med endinga `.ids` blant filene i prosjektet) og dei bSDD-ordbøkene du har valt for prosjektet, lagra i denne
nettlesaren per tenar og prosjekt.

- **Skriv IDS med AI** skriv ein Information Delivery Specification ut frå ei skildring i ord. Vel leverandør, modellen krava skal
  prøvast mot, og skildra krava. AI-en gjev fila til appen, som kontrollerer henne (først forma, så med ifctester mot modellen, i
  Python i nettlesaren) og svarar med feilen som skal rettast eller med utfallet per spesifikasjon. Det går runde for runde til fila
  kan køyrast, høgst fire rundar, og krava vert aldri mjuka opp for å gå gjennom. Resultatet kan lagrast som `.ids`-fil eller lastast
  opp til prosjektet som eit dokument.
- **Søk i bSDD** slår opp klassar i buildingSMART Data Dictionary etter samtykke for verten `api.bsdd.buildingsmart.org`, i dei valde
  ordbøkene eller alle; *Ordbøker* listar ordbøkene så du kan leggje dei til i profilen. I *Endre med AI* kan AI-en søkje med
  verktøyet `search_bsdd` og klassifisere bygningsdelar med `set_classification`, som vert skrive som `IfcClassificationReference` i
  endringssettet du godkjenner.
  `search_bsdd` søkjer berre i frie ordbøker der lisensen er lesen (IFC 4.3, Uniclass 2015 og ETIM 10.1), og svarar med ordbok og lisens
  for kvar klasse, og `set_classification` skriv utgåva, utgjevaren og adressa til systemet på `IfcClassification` for det.

buildingSMART-reglane til tenaren vert viste på kortet *Valider modellen* i Handter; vel ein regel i lista ved sida av *Merk i modellen* for
å markere berre dei bygningsdelane som den regelen treffer.

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

Det siste resultatet står på kortet Valider modellen i Handter, med om det vart gjort i appen eller på tenaren. Målinga føreset lukka flater: eit element med opne eller øydelagde
flater kan gi usikre djupner. Bøygde flater er delte opp i trekantar, så ein toleranse under ein millimeter blir usikker. Element som 3D-visinga ikkje kan teikne, er ikkje med, og resultatet seier kor mange dei er; i ein prøvemodell frå Tekla gjaldt det alle armeringsjerna.

## Førebels klimaerklæring

Verktøyet **Klimaerklæring** i Analyser (fana Mengder) reknar ut ei førebels klimaerklæring frå modellen: klimapåverknaden for A1–A3,
A4 og A5 i kg CO₂e per kategori og per lag i bygningen. Det er eit grunnlag i prosjekteringa, ikkje ei erklæring for registrering hos
Boverket.

**Kategori og lag.** Kvar bygningsdel får ein av dei fire kategoriane til Boverket (berande konstruksjonsdelar – fundamentering,
berande konstruksjonsdelar – andre, klimaskjerm, innerveggar) eller *Inngår ikkje*, og eitt av dei seks laga i bygningen frå rapport
2024:26 frå Boverket: 1 tomt og fundamentering, 2 berande system og andre berande konstruksjonar, 3 klimaskjerm, yttertak og fasade,
4 tekniske installasjonar, 5 himlingar, innerveggar og overflater innandørs, 6 fast inventar. Reglane les berre IFC-klassen,
PredefinedType (til bygningsdelen eller typen) og LoadBearing og IsExternal i Pset_*Common; ingen klassifikasjon blir lesen. Dei
følgjer lista til Boverket over bygningsdelar som inngår: pelar, grunnarbeid, installasjonar, fast inventar, flyttbare innerveggar,
innvendige overflater og solskjerming inngår ikkje; trapper, rampar og rekkverk er berande; himlingar, nedsenka himlingar og
innerdører høyrer til innerveggane. Kolonnen *Regel* viser kva som avgjorde.

- **Usikker**: bygningsdelen inngår, men kategorien er usikker, til dømes ein innervegg utan LoadBearing eller ei dør utan
  IsExternal. Han blir talt i kategorien som står, og blir lista under *Skal avgjerast*. Ein yttervegg er klimaskjerm same kva
  LoadBearing seier.
- **Kan ikkje avgjerast**: reglane kan ikkje seie om bygningsdelen inngår, til dømes eit proxyelement eller solceller (som berre
  inngår når dei er integrerte i tak eller fasade). Han blir ikkje talt før du har avgjort han.
- **Utleidd IsExternal**: når fila ikkje oppgjev IsExternal, får ei dør eller eit vindauge verdien frå veggen der dei sit. *Utlei
  IsExternal* les topologien til bygningen med Python i appen, som startar då (første gongen blir komponentane henta med samtykket
  ditt): veggane langs den ytre grensa til ein etasje er ytre, og på ein lukka etasje er dei andre veggane til romma indre. Regelen
  seier når ein verdi er utleidd.
- Ein samansett bygningsdel, til dømes eit tak av takplater, blir talt i delane sine, og ein del som reglane ikkje kan avgjere, får
  kategorien til heilskapen.

Under **Skal avgjerast** vel du kategori for ei heil gruppe bygningsdelar med same klasse, type og regel. Valet blir lagra per
bygningsdel (GlobalId) i nettlesaren til du lèt reglane avgjere igjen.

**Mengder.** Volum, areal og vekt blir tekne frå mengdene i fila, netto før brutto og sidearealet til veggen. Har fila ingen mengder,
blir volumet rekna ut frå geometrien når bygningsdelen er ei enkel ekstrudering: arealet til profilen gonger djupna (rektangel,
sirkel, I-profil, polylinje med fleire), også gjennom representasjonen til typen og før ei klipping. Opningar blir då ikkje trekte
frå, og kolonnen *Kjelda til mengda* seier det. Dører og vindauge blir talde per kvadratmeter ut frå måla. Ein bygningsdel med
materialsjikt blir delt per materiale etter tjukkleiken til sjikta. Elles har rada inga mengd og blir ikkje tald.

**Klimadata.** *Hent klimadatabasen* hentar klimadatabasen til Boverket (om lag 0,9 MB) frå api.boverket.se med samtykket ditt til
API-henting og lagrar han i nettlesaren; ingenting om modellen blir sendt. Under *Material og ressursar* vel du ein ressurs for kvart
materiale. Forslaga byggjer først på kategorien til materialet i IFC (IfcMaterial.Category, til dømes concrete, steel, wood, glass
eller gypsum) og deretter på namnet; dører og vindauge blir føreslåtte etter namnet på typen. *Godta forslaga* lagrar forslaga som vala
dine, som gjeld alle modellar. Klimapåverknaden er massen (volumet gonger densiteten eller arealet gonger vekta per kvadratmeter)
gonger verdiane i databasen for A1–A3, A4 og A5 (svinn). Boverket oppgjev at klimadata for byggjevarer er sette konservativt, om lag
25 prosent over gjennomsnittet; verktøyet reknar med den konservative verdien og viser den typiske ved behov.

Kvar vising kan lagrast som datasett. Kjelde: Boverket, klimadatabasen (opne data, sjå [licenser.md](licenser.md)).

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

## Ein ny bygning frå ein brief

Skriv ein brief i skjemaet *Ny bygningsmodell* ("eit toetasjes hus 12 × 8 m med saltak, teglfasade, inngang mot sør …") og vel *Bygg frå
briefen med AI* når modellen er laga: modellen opnar i Bearbeid med AI-panelet i modusen **Bygg frå brief**. Der kan du leggje ved
foto og skanna teikningar (JPEG, PNG eller PDF; ei planteikning gjev dei rette måla, eit foto utsjånad, materialar og korleis delane
heng saman) eller leggje til bileta frå ei biletsamling, til dømes dei du har teke med Dataspatium Mobil. AI-en les den tomme
modellen, seier planen sin, spør i panelet når briefen lèt noko vesentleg stå ope (fotavtrykk, tal på etasjar, etasjehøgd,
veggtjukkleikar, materialar) og byggjer så i grupper med same verktøy som *Endre*: etasjar og rutenett, veggar per etasje, dekke,
opningar, eigenskapar og materialar, med førehandsvising og rettingar etter kvar gruppe. Ingenting vert skrive i modellen før du
førehandsviser og godkjenner endringssettet som vanleg, og du kan supplere med ein ny brief i same modus. Bileta vert sende til
leverandøren saman med briefen etter samtykket for verten til leverandøren; ein lokal modell som ser bilete held alt på datamaskina.
Med *Opplysningar frå eit datasett* vert rader frå ein tabell lagde i briefen som tekst: ei bygningsflate henta frå kartet (Opne geodata)
vert hjørne i meter frå det sørvestlege hjørnet, så veggane får rette mål, og mål og notat frå eit feltskjema i Dataspatium Mobil vert
rader; ein runde med telefonen kan så gje fleire bilete og mål, og briefen vert supplert i same modus.
Briefen og bileta kan òg leggjast på tenaren som grunnlaget til modellen når modellen er henta frå eit CDE: saka *Grunnlag* i
prosjektet til modellen får briefen som tekstdokument og kvart bilete som dokument, så andre som arbeider med modellen i eigne
klientar ser kva han vart bygd av. Knappen heiter *Legg grunnlaget på tenaren*.
Øvst i panelet står *Opplysningane om bygningen* (kva bygning, etasjar, lengd, breidd, høgd, fundamentering, tak) og *Nøyaktigheit*
(skisse, hovudtrekk eller detaljert): fyll inn det du veit, så innleier det briefen og AI-en spør om resten. Orda er vanlege, men bak
dei ligg informasjonskrava i ISO 19650 og level of information need, og modellen er tenkt som forvaltningsmodellen til bygningen. Kvart
bilete vert lagt ved som foto, fasade mot nord, aust, sør eller vest, innvendig eller teikning, og eit foto med posisjon og tidspunkt i
fila (EXIF) får dei i biletteksten sin, så AI-en veit kva han ser. Opplysningane frå eit datasett gjev òg det sørvestlege hjørnet til
bygningsflata på kartet, så AI-en plasserer modellen med `set_site` (posisjon, høgd og SWEREF 99 TM), og med *Med terrenghøgd i
hjørna*, som vert vist når kjelda til Lantmäteriet er lagd til, terrenghøgda i kvart hjørne frå høgdemodellen: eit nettverkskall med
nøkkelen din etter samtykke.
Etter veggane på kvar etasje les førehandsvisinga topologien til bygningen: midtlinjene til veggane blir rom, og etasjen er lukka når
veggane lukkar minst eitt rom og ingen veggende står laus; AI-en rettar lause endar ved å flytte eller leggje til veggar før han legg
dekka. Ytterveggane med himmelretningane sine lèt AI-en pare eit foto av fasaden mot sør med dei rette veggane (lesverktøyet
`get_topology`), og den same topologien blir vist på kortet *Topologi* i Kontroller.

### Føremål, fase og krav

Under *Opplysningane om bygningen* finst også *Føremål*, *Fase* og *Krav (IDS)*. Føremålet er det modellen skal brukast til, og det vel
nøyaktigheit og krav, som du kan endre etterpå:

| Føremål | Nøyaktigheit | Krav |
|---|---|---|
| Volumstudie | Skisse | SE-Dataspatium_Grund |
| Byggjesøknad | Hovudtrekk | SE-Dataspatium_Grund |
| Klimaerklæring | Hovudtrekk | SE-Dataspatium_Klimatdeklaration |
| Forvaltning | Detaljert | SE-Dataspatium_Grund |
| Avfallshandtering | Detaljert | SE-Dataspatium_Avfallshantering |
| Anna (med eigen tekst) | Hovudtrekk | ingen |

Fasen seier kvar i livet til bygget modellen høyrer heime: moglegheitsstudie, forslag, arbeidsteikningar, under bygging eller
eksisterande bygg. Føremål, fase og krav opnar briefen. Med krav prøver kvar førehandsvising, den til AI-en og di, kandidaten mot
IDS-fila, og AI-en får spesifikasjonane som ikkje er oppfylte, slik at han kan rette dei. Krava hindrar ikkje godkjenninga; panelet
viser kor mange spesifikasjonar som er oppfylte, og kva for nokre som ikkje er det.

Nøyaktigheita følgjer informasjonsbehovet i ISO 7817-1 (avsnitt 6), som deler det i geometri, alfanumerisk informasjon og
dokumentasjon. Med eigne ord til appen tyder dei tre nivåa dette per aspekt:

| Aspekt | Skisse | Hovudtrekk | Detaljert |
|---|---|---|---|
| Detalj | etasjar, ytterveggar og dekke som enkle lekamar, ingen opningar | alle veggar med tjukna til typane, dekke, forma på taket og opningar med rimelege mål | sjikt per type, dører og vindauge med karm og ramme, veggar som møtest i hjørna |
| Dimensjonar | lekamar i 3D og aksen til veggen | som skissa | som skissa; plansymbol kan kome seinare |
| Plassering | høgdene til etasjane, rutenettet og tomta når ho er kjend | mål frå teikning eller brief, georeferert når opplysningane finst | innmålte eller målsette plasseringar, opningar på nøyaktig stad |
| Utsjånad | standardfargar | farge etter kategorien til materialet | ein overflatestil per materiale, skild frå materialet |
| Parametrisk åtferd | ekstruderingar der måla kan endrast | typar (byt typen, så blir alle endra) og sjikt | samband som reknar om hjørna, dører og vindauge med parametrar |
| Identifikasjon | namn, IFC-klasse med PredefinedType og GlobalId | typar med namn, rom med nummer og namn | delar og romklassar, Tag på dører og vindauge |
| Informasjonsinnhald | etasjar og høgder | IsExternal, LoadBearing og materiale på typane, basismengder | brann, U-verdi og klimadata per type eller materiale, tilstanden i eit eksisterande bygg |
| Dokumentasjon | briefen | briefen og bileta som grunnlaget for modellen | EPD-referansar og produktblad |

## Kontroller med AI

Modusen **Kontroller** i AI-panelet prøver modellen av ein eksisterande bygning mot foto av skadar og slitasje, tekne med Dataspatium
Mobil, eit kamera eller ein drone, og mot mål frå eit feltskjema. Legg ved fotoa i panelet, merkte med fasade eller innvendig, eller
legg til bileta frå ei biletsamling du har importert i Hent; eit foto med posisjon og tidspunkt i fila (EXIF) får dei i biletteksten,
og *Opplysningar frå eit datasett* legg mål og notat frå eit feltskjema i spørsmålet. AI-en les modellen med dei same verktøya som i
*Spør*, finn elementet som kvart foto viser, og skriv eitt funn for kvar skade med tittel, skildring, tilstand (god, akseptabel,
dårleg eller kritisk), prioritet (låg, middels, høg eller akutt) og tilrådd tiltak; eit foto utan synleg skade gjev ikkje noko funn.
Tilstanden til elementet vert lagd i eigenskapssettet Pset_Condition (vurderingsdato, tilstand og ei kort skildring) i eit
endringssett som du førehandsviser og godkjenner som i *Endre*, og ingen element vert oppretta, flytte eller sletta. Funna vert lista
under svaret, og *Lagre funna som tabell* opprettar eit nytt datasett med eitt funn per rad: foto, element, tittel, skildring,
tilstand, prioritet, tiltak, dato og posisjonen til fotoet. *Eksporter som BCF* lastar ned ei BCF-fil med éi sak per funn, der fotoet
er augneblinksbiletet i visinga og elementet er merkt, og for ein modell henta frå ein tenar du er logga inn på, opprettar *Opprett
saker på tenaren* dei same sakene i prosjektet til modellen etter ei stadfesting. Fotoa vert sende til leverandøren saman med
spørsmålet etter samtykket for verten til leverandøren, og dei forlèt datamaskina igjen berre når du sjølv opprettar saker på tenaren.

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
Verktøyet `set_site` gjev staden til modellen på jorda: breiddegrad, lengdegrad og høgd for tomta, og med ein EPSG-kode som 3006 for
SWEREF 99 TM òg kartkonverteringa, det vil seie origo til modellen i aust- og nordkoordinatar og rotasjonen hans (ikkje i IFC2X3, som
manglar henne). Verktøyet `create_roof` legg eit saltak, valmtak, pulttak eller flatt tak med takvinkel, takutstikk og tjukn på veggane
i ein etasje (utan oppgjeven etasje den øvste): eit IfcRoof av takplater (IfcSlab av typen ROOF), éi per takflate, over det omskrivne
rektangelet til veggane eller eit oppgjeve rektangel (ein annan kontur blir inntil vidare bytt ut med det omskrivne rektangelet sitt).
Verktøyet `create_spaces` lagar romma veggane lukkar, som IfcSpace med namn frå romprogrammet, valde med eit punkt inni eller nummeret
sitt i topologien, med høgda opp til neste etasje, romareal (Qto_SpaceBaseQuantities) og grenser mot veggane og dørene og vindauga i
dei. Verktøya endrar ingenting: dei fyller eit endringssett som panelet listar steg for steg (mål i meter; nye element får referansane
new-1, new-2 … til fila har gjeve dei id).

Verktøyet `define_type` lagar ein veggtype, dekketype eller taktype (IfcWallType, IfcSlabType eller IfcSlabType av typen ROOF for
takplatene) med materialsjikt i meter, for ein vegg frå høgre side til venstre sett frå start mot slutt og for dekke og tak ovanfrå og
ned. Kvart sjikt kan få kategorien til materialet (dei IFC tilrår: concrete, steel, aluminium, block, brick, stone, wood, glass,
gypsum, plastic og earth) og rolla til sjiktet (berande, isolasjon, indre eller ytre overflate), men berre når dei er kjende.
`create_wall`, `create_slab` og `create_roof` tek typen: elementet får typen (IfcRelDefinesByType), tjukna si frå sjikta og sjikta lagde
på seg (IfcMaterialLayerSetUsage: veggen sine sentrerte på linja, dekket sine nedover frå oversida i høgda til etasjen og takplatene
sine oppover frå undersida), og PredefinedType står på typen. Material og felles eigenskapar høyrer til typen, og AI-en definerer typane
først. Når endringssettet køyrer, vert veggane det lagar, kopla til veggane dei møter (IfcRelConnectsPathElements): i eit hjørne går den
tjukkaste veggen (ved lik tjukn den lengste) forbi hjørnet og den andre sluttar mot han, og ein vegg som endar på linja til ein annan,
sluttar mot sida hans, slik at hjørna verken får glipper eller overlapp og ikkje noko volum vert talt to gonger. Midtlinjene til
veggane vert ikkje endra, og hjørne i andre vinklar enn rette vert kopla slik dei er teikna. Til slutt får dei veggane, dekka, taka,
dørene og vindauga som endringssettet har laga eller endra, basismengder (Qto_WallBaseQuantities, Qto_SlabBaseQuantities,
Qto_RoofBaseQuantities, Qto_DoorBaseQuantities og Qto_WindowBaseQuantities) rekna ut frå måla, med opningane trekte frå og med namna
frå malane til skjemaet.

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
Kortet *Endringsframlegg på tenaren* i modellvisinga viser, for ein modell henta frå Dataregium, alle framlegg mot dokumentet når
tenaren gjev kapabiliteten `ifc_proposals_url`: tittel, tilstand, kven som foreslo, kor mange endringar og mot kva versjon; *Godkjenn*
gjer eit prøvd framlegg til neste versjon for den som får godkjenne, så fleire personar med kvar sin klient kan arbeide mot same
modell. Ein tenar som oppgjev forma `ops_form` (`dataspatium-tools/1`), får dessutan operasjonane til skriveverktøya, så nye element,
slettingar og relasjonar kjem med i framlegget: tenaren byggjer dei på basisversjonen med same kode som appen, og ein kolliderande
nøkkel du gjev opp, vert send med som `keep_theirs`.

Har prosjektet team (kortet *Medlemmene i prosjektet* i Handter), viser panelet kva team endringa rører. Rører ho berre delen til
eitt team, godkjenner den ansvarlege i teamet, òg med rolla redaktør, og tenaren nektar (403) ein prosjektansvarleg; rører ho delane
til fleire team, eller ingen, godkjenner ein prosjektansvarleg som før. Når eit IDS-dokument får ein ny versjon, kontrollerer tenaren
dei siste IFC-versjonane i prosjektet på nytt, og rapportane deira står som ventande imens.

Gjev tenaren verdiane per kollisjon, viser panelet for kvar kollisjon verdien i basen, det som kom imellom, og framlegget ditt, og du
vel per kollisjon å halde på framlegget ditt eller ta det som kom imellom. *Foreslå igjen med vala mine* sender framlegget mot den
nyaste versjonen med dei haldne endringane og utan dei strokne, og tenaren prøver det på nytt før det kan godkjennast.
Samanflettinga skjer på tenaren; nettlesaren handterer berre sjølve kollisjonane.

## Rett IFC-klasse

I IFC er klassen den første klassifiseringa: den mest spesifikke klassen med PredefinedType, ObjectType berre når PredefinedType er
USERDEFINED, og eit typeobjekt; andre klassifiseringssystem blir lagde oppå. AI-en finn klassen for ein ting med lesverktøyet
`search_ifc_class`, med engelske IFC-ord som *sink* eller *handrail*, i dokumentasjonen av skjemaet til modellen som følgjer med
IfcOpenShell, og endringssettet godtek berre klassar som finst og ikkje er abstrakte i skjemaet til modellen, og PredefinedType frå
lista til klassen. Kortet *IFC-klassar* i Kontroller (og lesverktøyet `get_class_report`) tel proxyelement (IfcBuildingElementProxy),
USERDEFINED utan namn, element utan type, PredefinedType på både type og element (regelen OJT001) og element utanfor den romlege
strukturen (SPS007), med døme.

## Reglane til buildingSMART i førehandsvisinga

Førehandsvisinga prøver også det endringssettet lagar eller endrar mot eit utval av dei normative reglane til buildingSMART, dei same
reglane som valideringstenesta til buildingSMART brukar (ifc-gherkin-rules), overførte til den eigne Python-koden i appen:

- **IFC102**: ingen utfasa entitetar, attributt eller verdiar i skjemaet til fila, til dømes IfcWallStandardCase, veggen STANDARD eller
  IfcBuildingStorey.Elevation i IFC 4.3;
- **GEM111**: ingen gjentekne punkt i polylinjer og polyløkker, og ei lukka polylinje sluttar i sitt eige første punkt;
- **SWE001**: profilar som ikkje kryssar seg sjølve (prøvd med shapely);
- **PSE001** og **PSE002**: eit standardsett (Pset_) har namna, eigenskapane, typane og klassane til skjemamalen, og eit eige sett
  byrjar ikkje som Pset;
- **QTY001**: eit mengdesett (Qto_) følgjer malen og har MethodOfMeasurement BaseQuantities;
- **GRF001**, **GRF003** og **GRF005**: alle kontekstar har same koordinatoperasjon, ein modell med eit bygg har eit koordinatsystem, og
  skalaen til kartkonverteringa stemmer med einingane;
- **SPS007**: bygningsdelar ligg i den romlege strukturen, og ein del av ein bygningsdel ligg ikkje samtidig i ein etasje;
- **OJT001**: PredefinedType står på typen eller på elementet, ikkje på begge, og USERDEFINED har eit namn;
- **PJS003**: kvar GlobalId har 22 tillatne teikn og byrjar med 0–3, og ingen GlobalId blir brukt to gonger.

Kvart funn ber koden til regelen. Det buildingSMART reknar som avtalar, gir feil, som hindrar godkjenninga akkurat som skjemafeil;
bransjepraksis (PSE002, GRF003 og GRF005) gir åtvaringar, som står for seg. Berre det endringssettet fører til, tel: det som alt fanst
i modellen, sperrar ingenting. AI-en får reglane som ikkje held, etter kvar førehandsvising og rettar dei, slik han gjer med
topologien. Appen har ikkje heile regelsettet: GRF005 kjenner eininga til koordinatsystemet for dei nordiske kodane appen skriv eller
ut frå MapUnit, og SWE001 følgjer polylinjer, indekserte kurver og samansette kurver av dei. Heile settet høyrer heime på tenaren.

*Godkjenn* køyrer i tillegg EXPRESS-reglane til skjemaet (WHERE-reglar og funksjonar) med IfcOpenShell; pytest blir henta til dei som
komponent første gongen. Eit endringssett som bryt ein regel modellen oppfylte før, blir ikkje godkjent, og meldinga nemner regelen;
be AI-en rette endringssettet, og godkjenn på nytt. I ein modell med meir enn 300 000 instansar blir EXPRESS-reglane hoppa over, og
loggen seier det.

## Grunnopplysningar

Kortet **Grunnopplysningar** i Kontroller prøver ein modell mot grunnreglane i Praxi, rettleiinga til BIM Alliance for IFC, her med
eigne ord til appen; ingen tekstar, verdilister eller malar frå Praxi følgjer med appen. Kortet les modellen når du trykkjer på
knappen:

- filhovudet oppgir vising (MVD), programmet som skreiv fila, førprosessoren og tidspunktet (forfattar og organisasjon blir ikkje viste);
- modellen har eit projisert koordinatsystem med éin EPSG-kode, ei kartkonvertering og eit høgdesystem;
- prosjektet, tomta, bygget og etasjane har namn, bygget også eit langt namn og etasjane ei skildring;
- kvart rom har eit nummer i Name, og ingen nummer blir brukte to gonger i same bygg;
- eit eige eigenskapssett byrjar ikkje som IFC sine (Pset_, Qto_), byrjar med ein landkode (SE-…), har berre A–Z, siffer, - og _, og
  eigenskapar i PascalCase utan å, ä og ö;
- ingen verdi ber eininga si: 40, ikkje «40 dB».

Kvar kontroll blir vist som oppfylt, bør sjåast på eller feil, med dei første døma. IDS kan ikkje prøve filhovudet eller at noko er
eintydig, og difor er det eit eige kort.

## IDS-filene til appen

Appen har eigne IDS-filer i `presets/ids/`, skrivne ut frå opne reglar:

- **SE-Dataspatium_Grund.ids**: namn på tomt, bygg, etasjar og rom, ingen proxyelement og ein PredefinedType på dekke, tak, dører,
  vindauge og kledningar (USERDEFINED blir godteke med eit namn).
- **SE-Dataspatium_Klimatdeklaration.ids**: LoadBearing på veggar, dekke, tak, søyler og bjelkar, IsExternal på veggar, dører og
  vindauge, materiale på bygningsdelane, ein kategori på kvart materiale og basismengder: det den førebelse klimaerklæringa les.

IDS nemner ein klasse utan underklassane, så IFC4-klassane …StandardCase har eigne spesifikasjonar, og ein spesifikasjon gjeld berre
dei IFC-versjonane han oppgir. Briefen vel ei fil etter føremålet, og IDS-kontroll i Analyser kan køyre dei.

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
