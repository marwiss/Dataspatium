# Planar: digitale reguleringsplanar og kommuneplanar

Dataspatium opnar digitale planar som planar: ein svensk detaljplan (reguleringsplan) blir teikna som plankart med
fargane og nemningane frå Boverket, føresegnene blir lista og slått opp i katalogen frå Boverket over planføresegner
(Planbestämmelsekatalogen), og ein översiktsplan (kommuneplan) blir vist tema for tema. Planen er eit datasett av typen
*plan*: eitt planobjekt per rad (planområdet og kvar føresegn eller kvart innhaldsobjekt) med geometri i WGS 84,
opplysningane om planen i metadata og originalfila lagra i datasettet. Tabellen er alltid eitt klikk unna.

## Format som blir lesne

| Format | Blir kjent att på | Innhald |
|---|---|---|
| Nasjonal spesifikasjon Detaljplan (Lantmäteriet, versjon 4) | GeoJSON med `feature:typ` (detaljplan, anvandningsbestammelse, egenskapsbestammelse, administrativBestammelse, beslutsinformation, planbestammelsebeskrivning) eller `feature:mediatyp application/vnd.lm.detaljplan.v4+json` | Planområde, føresegner med katalogreferanse, formulering og verdi, vedtaksopplysningar (påbyrja, vedteken, rettskraft, gjennomføringstid), grunngjevingar |
| Referanseobjekt frå den nasjonale geodataplattforma | STAC-objekt med `properties.detaljplan` og `properties.planbestammelse` (svaret frå reguleringsplan-API-et til Lantmäteriet) | Opplysningane om planen, formuleringa, katalogreferansen, kategorien og verdien til føresegnene |
| Nasjonal spesifikasjon Översiktsplan (testversjon 1.0) | GeoJSON med `feature:typ` oversiktsplan, innehallOP, beslutOP | Opplysningane om planen og innhaldsobjekt med innhaldstype, namn, presisering og planhending |
| ÖP-modellen frå Boverket (GeoPackage) | Tabellar `innehall_op_<tema>_<geometritype>` og `oversiktsplan` | Alle innhaldslag som éin plan med tema per lag |

Koordinatar i SWEREF 99 TM og dei lokale SWEREF 99-sonene (EPSG:3006–3018, lesne frå `koordinatsystemPlan`) og dessutan Web
Mercator blir rekna om til WGS 84. Ei GeoJSON-fil blir kjend att på innhaldet, ikkje på filendinga: slepp henne i Hent,
så blir opplysningane om planen viste saman med knappen *Importer*. Ei GeoPackage-fil i ÖP-modellen får valet *Heile kommuneplanen
som plan*; avslått blir éin tabell importert om gongen som før.

Frå reguleringsplan-API-et til Lantmäteriet (kjelda *Lantmäteriet geodataplattformen: detaljplaner*, krev nøkkel frå ein
tilknytt organisasjon) blir eit svar lagra som plan med knappen *Lagre som plan* i staden for som tabell.

## Plankartet i Bearbeid

Ein plan blir opna som plankart: bruksføresegnene fylte med fargane frå Boverket (bustader gul, sentrum brun, industri blågrå,
gate lysegrå, park lysegrøn, vatn blå og så vidare etter dei allmenne råda til BFS 2020:5; nyansane er appen sine),
eigenskapsføresegner som blå stipla konturar, administrative føresegner som lilla prikka, plangrensa i svart
og nemningane som etikettar. Klikk på eit objekt, så viser inspektøren opplysningane og kva katalogen seier om
føresegna: kode, type, gyldigheit og formuleringa i katalogen. Laga blir slått av og på per type, bakgrunnskart blir vist
etter samtykke, og knappane gjev *Lagre som kartvising* (for Visualiser, dashbord og Publiser), *Planføresegner*
(lista som Markdown) og *Vis som tabell*.

Ein kommuneplan blir teikna per tema: areal- og vassbruken fylt per innhaldstype, andre tema med éin farge per tema og
valbar synlegheit. Inspektøren viser arealet per areal- og vassbruk.

## Fana Plan i Analyser

Ein plan får fana **Plan** etter Regex:

- **Samandrag**: opplysningane om planen, tal på objekt per type, statusen til katalogreferansane og bruksarealet i planen.
- **Føresegner**: alle føresegner som tabell med nemning, formulering, kategori, verdi, kode og katalogstatus;
  kan lagrast som datasett eller lastast ned som Markdown. For ein kommuneplan: innhaldet per tema.
- **Areal**: areal per bruksføremål (sum av flatene, rekna i SWEREF 99 TM) og andel av bruksarealet i planen.
- **Katalogkontroll**: kvar katalogreferanse blir slått opp i katalogen: gjeldande, erstatta (og av kva), opphøyrd, ukjend
  eller manglande, og om formuleringa følgjer malen i katalogen.
- **Søk i katalogen**: fritekstsøk blant dei 3 700 føresegnene i katalogen med filter på type, bruksform og gyldigheit;
  resultatet kan lagrast som datasett.

## Katalogen over planføresegner

Appen har ein innebygd kopi av Planbestämmelsekatalogen frå Boverket (opne data; utgåve 20251201), slik at oppslag, fargar
og katalogkontroll verkar utan nett. Kjelda skal oppgjevast: Boverket og Planbestämmelsekatalogen. Katalogen finst òg
som kjelde i Hent (*Boverket Planbestämmelsekatalogen*): slå opp ei føresegn på UUID-en hennar, vis utgåver,
fargar, bruksformer, kategoriar og symbol via det opne API-et til Boverket. Kopien blir oppdatert med
`python tools/plan_catalog.py` før ei ny utgåve.

## Planar frå dei andre nordiske landa

Appen les òg dei digitale planane til nabolanda og teiknar dei som planar med kartfargane til kvart land (nyansane er appen sine;
kolonnen `farg` ber fargenamnet). Katalogen frå Boverket gjeld berre svenske planar, så fana Plan viser samandrag,
føresegner og areal for desse.

| Land | Detaljplan / oversiktsplan | Slik får du dei inn |
|---|---|---|
| Danmark | lokalplan (delområde, byggjefelt) / kommuneplanrammer | Kjelda *Plandata.dk (WFS)*: **Hent plan** med planid eller plannummer hentar lokalplanen med delområde og byggjefelt; eit lag (t.d. kommuneplanrammer) blir henta som kart og lagra med *Lagre som plan*. GeoJSON-filer frå Plandata blir kjende att på innhaldet. Farge per generell bruk: bustad gul, næring lilla, sentrum brun, rekreasjon grøn, offentlege føremål blå, tekniske anlegg grå, fritidshus oransje, landområde lysegrøn. |
| Finland | asemakaava / yleiskaava | Ein plan i den nasjonale plandatamodellen (Ryhti-JSON med `planObjects` og `planRegulationGroups`) blir importert som fil: bruksføresegnene til planobjekta får kartnemninga (AK, VP …) frå kodelista RY_Kaavamaarayslaji (innebygd kopi) og fargane frå det finske plankartet; andre føresegner blir eigenskapsføresegner. Kjelda *Ryhti kaavatiedot* gjev planindeksen (gjeldande og pågåande planar med lenkjer til dokumenta) som tabell og kart; avoindata-WFS-en til Helsingfors har planindeksen og planeiningane til byen. |
| Island | deiliskipulag / aðalskipulag | Kjelda *Skipulagsstofnun skipulagsgögn (ArcGIS)*: **Hent plan** med plannummeret hentar plangrense, tomter, byggjerettar, hefte og samferdsel (fem lag); `ask:` framfor nummeret hentar ein kommuneplan med arealbruksklassar (ÍB, M, VÞ …). Ei GeoPackage-fil etter malen frå Skipulagsstofnun blir importert heil med valet *Heile planen som plan*. |
| Noreg | reguleringsplan / kommuneplan | Vektordata krev Norge digitalt-avtale: last ned planen som GeoPackage frå Geonorge og importer henne heil (tabellane RpOmråde, RpArealformålOmråde, RpBestemmelseOmråde, omsynssoner med fleire); arealføremålskodane får namn frå den innebygde kodelista og farge per hovudføremål (busetnad gul, sentrum brun, næring lilla, samferdsel lysegrå, grønstruktur grøn, LNFR lysegrøn, sjø blå). WMS-en frå DiBK `https://nap.ft.dibk.no/services/wms/reguleringsplaner/` kan leggjast som bakgrunn i kartvisinga. |

Koordinatar i ETRS89 UTM 32–35, ETRS-TM35FIN, dei finske GK-sonene og ISN93 blir rekna om til WGS 84. Avgrensingar: Ryhti
inneheld planar godkjende frå 2024 (landsdekkjande 2029); islandske planar før 2025 har berre plangrense; Plandata lagrar
føresegner som kodar og tal, ikkje som løpande tekst.

## Avgrensingar

- Fargane frå Boverket er oppgjevne som namn i forskriftene; nyansane i appen er eigne. Symbolnemningar (prikkmerke,
  kryssmerke og andre) blir teikna som konturar med nemning, ikkje med symbola frå Boverket.
- Føresegnskildringar, planleggingsgrunnlag og vedtaksdokument følgjer berre med som tekst (grunngjevingar)
  eller som opplysningar i metadataa til planen; dokumenta blir ikkje henta.
- Areal er plane utrekningar i SWEREF 99 TM; for planar i lokale soner er feilen uvesentleg.
- Reguleringsplan-API-et til Lantmäteriet krev nøkkel; appen er testa mot den dokumenterte modellen med eigne testdata.
