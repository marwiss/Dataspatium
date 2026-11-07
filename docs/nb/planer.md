# Planer: digitale reguleringsplaner og kommuneplaner

Dataspatium åpner digitale planer som planer: en svensk detaljplan (reguleringsplan) tegnes som plankart med
Boverkets farger og betegnelser, bestemmelsene listes og slås opp i Boverkets katalog over planbestemmelser
(Planbestämmelsekatalogen), og en översiktsplan (kommuneplan) vises tema for tema. Planen er et datasett av typen
*plan*: ett planobjekt per rad (planområdet og hver bestemmelse eller hvert innholdsobjekt) med geometri i WGS 84,
planens opplysninger i metadata og originalfilen lagret i datasettet. Tabellen er alltid ett klikk unna.

## Formater som leses

| Format | Gjenkjennes på | Innhold |
|---|---|---|
| Nasjonal spesifikasjon Detaljplan (Lantmäteriet, versjon 4.1) | GeoJSON med `feature:mediatyp application/vnd.lm.detaljplan.v4+json` eller `feature:typ` (detaljplan, användningsbestämmelse, egenskapsbestämmelse, administrativ bestämmelse; også skrevet uten å, ä og ö) | Planområde, bestemmelser med katalogreferanse, formulering, verdier og motiv, geometrier som flater, linjer, punkter og legemer (med høyde i RH 2000), vedtaksinformasjon (påbegynt, vedtatt, rettskraft, gjennomføringstid, saksnummer) og planbeskrivelsens navn |
| Referanseobjekter fra den nasjonale geodataplattformen | STAC-objekter med `properties.detaljplan` og `properties.planbestammelse` (svaret fra Lantmäteriets reguleringsplan-API) | Planens opplysninger, bestemmelsenes formulering, katalogreferanse, kategori og verdi |
| Nasjonal spesifikasjon Översiktsplan (Lantmäteriet, versjon 2.0, testversjon 4) | GeoJSON med `feature:mediatyp application/vnd.lm.oversiktsplan.v2+json` eller `feature:typ` oversiktsplan, innehallOP, beslutOP | Planens opplysninger og vedtak (fattet, rettskraft), innholdsobjekter med innholdstype, tema etter ÖP-katalogens kategori, navn, presisering, planhendelse, sammenhengsnivå og koblinger, også innhold som bare beskrives i tekst |
| Boverkets ÖP-modell (GeoPackage, databasemodell 0.4) | Tabeller `innehall_op_<tema>_<geometritype>` og `oversiktsplan` | Alle innholdslag som én plan med tema per lag, planens vedtak (`beslut_op`), koblinger mellom innhold og plandokumentets avsnitt (bokmerker) |
| Detaljplan i GeoPackage | Tabellene `detaljplan`, `bestammelse` og `anvandning_yta`, `egenskap_yta`, `egenskap_linje`, `egenskap_punkt` med feltnavnene i den nasjonale spesifikasjonen | Planen slik planleggingsverktøyet lagrer den: planområde, flater, linjer og punkter med sine bestemmelser, betegnelser, farger, motiver og høyder, vedtaksinformasjon og dokumenter; flater som ennå mangler en bestemmelse, vises slik de er tegnet |

Koordinater i SWEREF 99 TM og de lokale SWEREF 99-sonene (EPSG:3006–3018, lest fra `koordinatsystemPlan`) samt Web
Mercator regnes om til WGS 84. En GeoJSON-fil gjenkjennes på innholdet, ikke på filendelsen: slipp den i Hent inn,
så vises planens opplysninger og knappen *Importer*. En GeoPackage-fil i ÖP-modellen får valget *Hele kommuneplanen
som plan*; avslått importeres én tabell om gangen som før. En detaljplan i GeoPackage får valget *Hele planen som plan*. Koordinatsystemet i en GeoPackage-fil leses fra filen, også når det bare står med navn (for eksempel *SWEREF99 15 00*).

## Plankartet i Bearbeid

En plan åpnes som plankart: bruksbestemmelsene fylt med Boverkets farger (boliger gul, sentrum brun, industri blågrå,
gate lysegrå, park lysegrønn, vann blå og så videre etter de allmenne rådene til BFS 2020:5; nyansene er appens),
egenskapsbestemmelser som blå stiplede konturer, administrative bestemmelser som lilla prikkede, plangrensen i svart
og betegnelsene som etiketter. Klikk på et objekt, så viser inspektøren opplysningene og hva katalogen sier om
bestemmelsen: kode, type, gyldighet og katalogens formulering. Lagene slås av og på per type, bakgrunnskart vises etter samtykke, og knappene gir *Planbestemmelser*
(listen som Markdown) og *Vis som tabell*.

En kommuneplan tegnes per tema: areal- og vannbruken fylt per innholdstype, øvrige temaer med én farge per tema og
valgbar synlighet. Inspektøren viser arealet per areal- og vannbruk.

Linjer (avkjørselsforbud, gjerder, utviklingsretninger) og punkter (for eksempel terrenghøyden) tegnes slik de er. En bestemmelse som er begrenset i høyden, tegnes med sitt fotavtrykk, og inspektøren viser høyden i planens høydesystem (RH 2000 i planer til NGP): underkant, overkant eller begge. Inspektøren viser også planens vedtak (vedtatt, rettskraft, påklaget, gjennomføringstid, saksnummer, vedtakstype), planbeskrivelsens navn og dokumentene, og for det valgte objektet andre opplysninger som gyldighetstid, sekundær egenskapsgrense, hvilke bruksbestemmelser en egenskap regulerer, sammenhengsnivå, hva innholdet berører, og hvor i plandokumentet det beskrives. Innhold som bare beskrives i tekst, uten plassering i kartet, listes under *objekter uten plassering i kartet* og kan velges der.

## Koordinatsystemer og høyder

Detaljplaner til NGP lages i SWEREF 99 TM eller i kommunens lokale SWEREF 99-sone med høyder i RH 2000, og filen oppgir
begge (`koordinatsystemPlan` og `hojdsystem`). Oversiktsplaner er oftest i SWEREF 99 TM. Inspektøren viser planens
koordinatsystem og, for en plan med høyder, høydesystemet; en GeoPackage-fil oppgir ikke noe høydesystem, og da står det det.

Plankartet tegnes som nettkart (Web Mercator med nord opp, der OpenStreetMap kan være bakgrunn) eller i planens eget
system: velg det i verktøylinjen, for eksempel *SWEREF 99 16 30*. Da er rutenettets nord opp som på plankartet, og hvert
objekt ligger på koordinatene sine. Bakgrunnen kan da komme fra en WMS-tjeneste som tilbyr samme system: velg
*WMS-tjeneste* som bakgrunnskart og oppgi adresse og lag (*Les lag* henter tjenestens lagliste og sier fra om laget
mangler systemet). OpenStreetMap finnes bare som nettkart. Bakgrunnen hentes etter samtykke, som andre bakgrunnskart.

En plan i et koordinatsystem som appen ikke kan regne om, leses med alle objektene sine, men objektene tegnes ikke, fordi
de ville havnet feil: Hent og inspektøren sier hvilket system filen oppgir, og objektene står under *objekter uten
plassering i kartet*. Appen regner om SWEREF 99 TM og de tolv lokale sonene, RT 90 2,5 gon V, de nordiske UTM- og TM-systemene, ISN93 og Web
Mercator; omregningen stemmer med PROJ (som QGIS bruker) innenfor en millimeter, RT 90 innenfor to desimeter.

## Planer fra planleggingsverktøy

Planer som tegnes i et planleggingsverktøy, leses som alle planer av samme slag, uansett hvilket verktøy som har laget dem. Et eksempel er [Rita Detaljplan og Rita Översiktsplan](https://github.com/ritaplan), programtillegg til QGIS. Det de lagrer og leverer, åpnes slik:

| Fil | Åpnes som |
|---|---|
| Detaljplanens leveransefil til NGP (JSON, Detaljplan 4.1) | Plankart med betegnelser og farger fra Planbestämmelsekatalogen |
| Detaljplan i GeoPackage med feltnavnene i den nasjonale spesifikasjonen | Plankart med planens egne betegnelser og farger, motivene og høydene |
| Översiktsplanens leveransefil til NGP (JSON, Översiktsplan 2.0) | Översiktsplan per tema med vedtak |
| Översiktsplan i GeoPackage (Boverkets databasemodell 0.4) | Översiktsplan per tema med vedtak, koblinger og plandokumentets avsnitt |
| Arkivpakke (mappe eller ZIP-fil med `metadata/PREMIS.xml`) | Planen fra mappen `content` med dokumentene, og kontrollen av filene |

Slipp filen i Hent, eller hent den med *Fra nettadresse* når den ligger på nettet (for eksempel en plan som kommunen publiserer); en fil uten filendelse gjenkjennes på innholdstypen. En arkivpakke slippes som mappe eller som ZIP-fil: appen leser planen fra mappen `content` (GeoPackage-filen først, ellers leveransefilen), lagrer pakkens filer med planen og sammenligner hver fil med kontrollsummen (SHA-256) i `PREMIS.xml`. Inspektøren viser under *Arkivpakke* om filene stemmer, hvilke som er endret eller mangler, og åpner dokumentene (plankart og planbeskrivelse) i en ny fane. Et sted som peker utenfor pakken, kontrolleres ikke og leses aldri.

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

## Begrensninger

- Boverkets farger er oppgitt som navn i forskriftene; nyansene i appen er egne. Symbolbetegnelser (prikkmark,
  kryssmark og andre) tegnes som konturer med betegnelse, ikke med Boverkets symboler.
- Bestemmelsesbeskrivelser, planleggingsgrunnlag og beslutningsdokumenter følger bare med som tekst (begrunnelser)
  eller som opplysninger i planens metadata; dokumentene hentes ikke.
- Arealer er plane beregninger i SWEREF 99 TM; for planer i lokale soner er feilen ubetydelig.
