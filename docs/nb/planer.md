# Planer: digitale reguleringsplaner og kommuneplaner

Dataspatium åpner digitale planer som planer: en svensk detaljplan (reguleringsplan) tegnes som plankart med
Boverkets farger og betegnelser, bestemmelsene listes og slås opp i Boverkets katalog over planbestemmelser
(Planbestämmelsekatalogen), og en översiktsplan (kommuneplan) vises tema for tema. Planen er et datasett av typen
*plan*: ett planobjekt per rad (planområdet og hver bestemmelse eller hvert innholdsobjekt) med geometri i WGS 84,
planens opplysninger i metadata og originalfilen lagret i datasettet. Tabellen er alltid ett klikk unna.

## Formater som leses

| Format | Gjenkjennes på | Innhold |
|---|---|---|
| Nasjonal spesifikasjon Detaljplan (Lantmäteriet, versjon 4) | GeoJSON med `feature:typ` (detaljplan, anvandningsbestammelse, egenskapsbestammelse, administrativBestammelse, beslutsinformation, planbestammelsebeskrivning) eller `feature:mediatyp application/vnd.lm.detaljplan.v4+json` | Planområde, bestemmelser med katalogreferanse, formulering og verdi, beslutningsopplysninger (påbegynt, vedtatt, rettskraft, gjennomføringstid), begrunnelser |
| Referanseobjekter fra den nasjonale geodataplattformen | STAC-objekter med `properties.detaljplan` og `properties.planbestammelse` (svaret fra Lantmäteriets reguleringsplan-API) | Planens opplysninger, bestemmelsenes formulering, katalogreferanse, kategori og verdi |
| Nasjonal spesifikasjon Översiktsplan (testversjon 1.0) | GeoJSON med `feature:typ` oversiktsplan, innehallOP, beslutOP | Planens opplysninger og innholdsobjekter med innholdstype, navn, presisering og planhendelse |
| Boverkets ÖP-modell (GeoPackage) | Tabeller `innehall_op_<tema>_<geometritype>` og `oversiktsplan` | Alle innholdslag som én plan med tema per lag |

Koordinater i SWEREF 99 TM og de lokale SWEREF 99-sonene (EPSG:3006–3018, lest fra `koordinatsystemPlan`) samt Web
Mercator regnes om til WGS 84. En GeoJSON-fil gjenkjennes på innholdet, ikke på filendelsen: slipp den i Hent inn,
så vises planens opplysninger og knappen *Importer*. En GeoPackage-fil i ÖP-modellen får valget *Hele kommuneplanen
som plan*; avslått importeres én tabell om gangen som før.

Fra Lantmäteriets reguleringsplan-API (kilden *Lantmäteriet geodataplattformen: detaljplaner*, krever nøkkel fra en
tilknyttet organisasjon) lagres et svar som plan med knappen *Lagre som plan* i stedet for som tabell.

## Plankartet i Bearbeid

En plan åpnes som plankart: bruksbestemmelsene fylt med Boverkets farger (boliger gul, sentrum brun, industri blågrå,
gate lysegrå, park lysegrønn, vann blå og så videre etter de allmenne rådene til BFS 2020:5; nyansene er appens),
egenskapsbestemmelser som blå stiplede konturer, administrative bestemmelser som lilla prikkede, plangrensen i svart
og betegnelsene som etiketter. Klikk på et objekt, så viser inspektøren opplysningene og hva katalogen sier om
bestemmelsen: kode, type, gyldighet og katalogens formulering. Lagene slås av og på per type, bakgrunnskart vises
etter samtykke, og knappene gir *Lagre som kartvisning* (for Visualiser, dashboards og Publiser), *Planbestemmelser*
(listen som Markdown) og *Vis som tabell*.

En kommuneplan tegnes per tema: areal- og vannbruken fylt per innholdstype, øvrige temaer med én farge per tema og
valgbar synlighet. Inspektøren viser arealet per areal- og vannbruk.

## Fanen Plan i Analyser

En plan får fanen **Plan** etter Regex:

- **Sammendrag**: planens opplysninger, antall objekter per type, katalogreferansenes status og planens bruksareal.
- **Bestemmelser**: alle bestemmelser som tabell med betegnelse, formulering, kategori, verdi, kode og katalogstatus;
  kan lagres som datasett eller lastes ned som Markdown. For en kommuneplan: innholdet per tema.
- **Arealer**: areal per bruksformål (sum av flatene, regnet i SWEREF 99 TM) og andel av planens bruksareal.
- **Katalogkontroll**: hver katalogreferanse slås opp i katalogen: gjeldende, erstattet (og av hva), opphørt, ukjent
  eller manglende, og om formuleringen følger katalogens mal.
- **Søk i katalogen**: fritekstsøk blant katalogens 3 700 bestemmelser med filter på type, bruksform og gyldighet;
  resultatet kan lagres som datasett.

## Katalogen over planbestemmelser

Appen har en innebygd kopi av Boverkets Planbestämmelsekatalog (åpne data; release 20251201), slik at oppslag, farger
og katalogkontroll virker uten nett. Kilden skal oppgis: Boverket og Planbestämmelsekatalogen. Katalogen finnes også
som kilde i Hent inn (*Boverket Planbestämmelsekatalogen*): slå opp en bestemmelse på dens UUID, vis releaser,
farger, bruksformer, kategorier og symboler via Boverkets åpne API. Kopien oppdateres med
`python tools/plan_catalog.py` før en ny utgave.

## Planer fra de andre nordiske landene

Appen leser også nabolandenes digitale planer og tegner dem som planer med hvert lands kartfarger (nyansene er appens;
kolonnen `farg` bærer fargenavnet). Boverkets katalog gjelder bare svenske planer, så fanen Plan viser sammendrag,
bestemmelser og arealer for disse.

| Land | Detaljplan / oversiktsplan | Slik får du dem inn |
|---|---|---|
| Danmark | lokalplan (delområder, byggefelt) / kommuneplanrammer | Kilden *Plandata.dk (WFS)*: **Hent plan** med planid eller plannummer henter lokalplanen med delområder og byggefelt; et lag (f.eks. kommuneplanrammer) hentes som kart og lagres med *Lagre som plan*. GeoJSON-filer fra Plandata gjenkjennes på innholdet. Farge per generell bruk: bolig gul, næring lilla, sentrum brun, rekreasjon grønn, offentlige formål blå, tekniske anlegg grå, fritidshus oransje, landområde lysegrønn. |
| Finland | asemakaava / yleiskaava | En plan i den nasjonale plandatamodellen (Ryhti-JSON med `planObjects` og `planRegulationGroups`) importeres som fil: planobjektenes bruksbestemmelser får kartbetegnelsen (AK, VP …) fra kodelisten RY_Kaavamaarayslaji (innebygd kopi) og det finske plankartets farger; øvrige bestemmelser blir egenskapsbestemmelser. Kilden *Ryhti kaavatiedot* gir planindeksen (gjeldende og pågående planer med lenker til dokumentene) som tabell og kart; Helsingfors' avoindata-WFS har byens planindeks og planenheter. |
| Island | deiliskipulag / aðalskipulag | Kilden *Skipulagsstofnun skipulagsgögn (ArcGIS)*: **Hent plan** med plannummeret henter plangrense, tomter, byggeretter, heftelser og samferdsel (fem lag); `ask:` foran nummeret henter en kommuneplan med arealbruksklasser (ÍB, M, VÞ …). En GeoPackage etter Skipulagsstofnuns mal importeres hel med valget *Hele planen som plan*. |
| Norge | reguleringsplan / kommuneplan | Vektordata krever Norge digitalt-avtale: last ned planen som GeoPackage fra Geonorge og importer den hel (tabellene RpOmråde, RpArealformålOmråde, RpBestemmelseOmråde, hensynssoner med flere); arealformålskodene får navn fra den innebygde kodelisten og farge per hovedformål (bebyggelse gul, sentrum brun, næring lilla, samferdsel lysegrå, grønnstruktur grønn, LNFR lysegrønn, sjø blå). DiBKs WMS `https://nap.ft.dibk.no/services/wms/reguleringsplaner/` kan legges som bakgrunn i kartvisningen. |

Koordinater i ETRS89 UTM 32–35, ETRS-TM35FIN, de finske GK-sonene og ISN93 regnes om til WGS 84. Begrensninger: Ryhti
inneholder planer godkjent fra 2024 (landsdekkende 2029); islandske planer før 2025 har bare plangrense; Plandata lagrer
bestemmelser som koder og tall, ikke som løpende tekst.

## Begrensninger

- Boverkets farger er oppgitt som navn i forskriftene; nyansene i appen er egne. Symbolbetegnelser (prikkmark,
  kryssmark og andre) tegnes som konturer med betegnelse, ikke med Boverkets symboler.
- Bestemmelsesbeskrivelser, planleggingsgrunnlag og beslutningsdokumenter følger bare med som tekst (begrunnelser)
  eller som opplysninger i planens metadata; dokumentene hentes ikke.
- Arealer er plane beregninger i SWEREF 99 TM; for planer i lokale soner er feilen ubetydelig.
- Lantmäteriets reguleringsplan-API krever nøkkel; appen er testet mot den dokumenterte modellen med egne testdata.
