# CAD og BIM: bygningsmodellar og teikningar

Dataspatium opnar bygningsmodellar i IFC og teikningar i DXF som ein eigen type datasett. Modellen blir teikna i 3D,
bygningsdelane blir ein tabell, og eigenskapar og mengder kan søkjast i, reknast ut og eksporterast. Alt skjer i nettlesaren: fila
forlèt aldri datamaskina. Originalfila blir lagra i datasettet og følgjer med i pakkar og tryggingskopiar.

## Opne ein modell

Slepp ei `.ifc`-, `.ifczip`- eller `.dxf`-fil i Hent. Opplysningane om fila blir viste (skjema, prosjekt, program, etasjar og tal
per type), og *Importer* lagar datasettet. IFC2X3, IFC4 og IFC4X3 i STEP-format blir støtta. Ein modell på rundt 50 MB tek om lag
eit kvart minutt å importere og blir deretter opna på nokre sekund.

## Modellen i Bearbeid

Modellen blir opna som 3D-vising med ein tabell over bygningsdelane under. Dra for å dreie, rull for å zoome og dra med høgre
knapp for å flytte. Knappen med ramma viser heile modellen; einskilde objekt langt frå bygningen blir ikkje rekna med.

- **Merk**: klikk på ein bygningsdel i modellen eller ei rad i tabellen. Merkinga følgjer med, og inspektøren viser
  type, etasje, materiale, klassifikasjon, eigenskapar og mengder og dessutan overflate og volum målt på geometrien.
- **Filtrer**: vel type eller etasje, eller søk på namn, materiale eller eigenskap. Tabellen og modellen viser same utval.
- **Vis som tabell**: alle kolonnar som ein vanleg tabell med alle verktøya i Bearbeid.
- **Lagre som diagram**: visinga med filter og kameravinkel blir eit diagram i Visualiser.

Geometrien blir rekna ut frå originalfila første gongen modellen blir opna i ein sesjon, og blir berre brukt til å teikne og måle. Tabellane
finst framleis sjølv om datamaskina manglar WebGL; då blir ei melding vist i staden for 3D-visinga.

## Saker frå eit CDE

Ein modell henta frå ein OpenCDE-tenar, eller kva modell som helst når ein slik tenar finst som kjelde, kan vise sakene
sine: knappen *Saker* i modellvisinga opnar eit panel i inspektøren med BCF-sakene i prosjektet. Dei som peikar på
bygningsdelar i denne modellen står først, med status og tal på bygningsdelar. Klikk på ei sak, så blir bygningsdelane merkte i
3D-visinga, og panelet viser skildring, augneblinksbilete og kommentarar. Sakene blir henta når du ber om det og blir ikkje lagra i
datasettet; for å rekne på dei lagrar du dei som ein tabell i Hent. Dette er lesing; å opprette og endre saker kjem i
neste utgåve.

Med rettane til det kan du òg skrive. *Ny sak* opprettar ei sak på tenaren med tittel, type, status og etikettar frå
listene i prosjektet, og visinga følgjer med som viewpoint: kameraet, eit augneblinksbilete og dei merkte bygningsdelane som
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

Grafen til modellen på tenaren blir teikna og spurd frå *Hent*, og knappen *IFC-LPG* tek deg dit, sjå [grafer.md](grafer.md#ifc-lpg-på-ein-kontroll-tenar).

Modellen til grafen, relasjonane og spørjingane frå Dataspatium si side finst i [ifc-lpg.md](https://github.com/marwiss/Kontroll/blob/main/docs/nn/ifc-lpg.md) hos Kontroll.

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

Appen kan lese, kontrollere og endre IFC-modellar med IfcOpenShell, det same biblioteket som Kontroll byggjer på. Det
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

## DXF-teikningar

Ei DXF-fil blir ein tabell med eitt teikningsobjekt per rad (type, lag, farge, lengd, areal, tekst og plassering) og ei
SVG-teikning. Teikninga blir opna i Bearbeid, der du zoomar med hjulet og panorerer ved å dra. Laga blir slått av og på i inspektøren,
og eit klikk merkjer objektet og rada. Fana Mengder gjev tal, lengd og areal per lag og type.

Linjer, polylinjer med bogar, sirklar, bogar, ellipsar, splines, punkt, tekstar, solid, 3D-flater, blokker og
blokkene til målsetjingar blir teikna. Skravering (HATCH) blir ikkje teikna.

## Eksport

Eksporter gjev originalfila, eigenskapane og mengdene som CSV (éi rad per verdi) og teikninga som SVG, i tillegg til dei
vanlege tabellformata for `data`. Diagram av modellar blir eksporterte som PNG, SVG og PDF; ein 3D-modell blir då eit bilete.

## Avgrensingar

- Modellen kan ikkje redigerast, og inga ny IFC-fil blir skriven. Endringar i tabellane påverkar ikkje originalfila.
- Ein modell blir teikna på nytt frå originalfila i kvar ny sesjon. Modellen på 57 MB som appen er prøvd med, tek 4–6 sekund.
- Den første teikninga av ein svært stor modell kan låse sida ei augneblink medan grafikkortet tek imot trekantane.
- Mengdene er ikkje ei mengdeberekning etter noko regelverk. Kontroller dei mot kjelda før dei blir brukte.
- DXF blir lese i to dimensjonar. DWG må først lagrast som DXF.
