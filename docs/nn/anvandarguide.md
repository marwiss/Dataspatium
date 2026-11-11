# Brukarrettleiing

Denne rettleiinga skildrar korleis du arbeider i Dataspatium frå første fil til ferdig rapport. Ho føreset at du har
opna appen som skildra i [kom-igang.md](kom-igang.md). Detaljar om kvar modus finst i [lagen.md](lagen.md), om
filformat i [format.md](format.md), om API i [api-konfiguration.md](api-konfiguration.md), om bearbeiding i
[bearbeta.md](bearbeta.md), om R i [r-guide.md](r-guide.md), om Python i [python.md](python.md), om diagram i [visualisera.md](visualisera.md) og om
dokument i [dokumentmallar.md](dokumentmallar.md). Vanlege spørsmål blir svara på i [faq.md](faq.md).

## Arbeidsområdet

Skjermen ser lik ut i alle modusar. Øvst byter du modus (Hent, Handter, Søk, Bearbeid, Kontroller, Analyser,
Visualiser, Eksporter, Del; Alt+1 til Alt+9 verkar òg) og når kommandopaletten (forstørringsglaset eller Ctrl+K),
språkknappen, tema (lyst eller mørkt) og hjelpeknappen med versjonsnummer og *Sjå etter oppdateringar*.
Kommandopaletten er den raskaste vegen til det meste: skriv nokre bokstavar for å byte modus, opne eit datasett, eit
diagram eller eit dashbord, søkje i data eller køyre ei handling på det valde datasettet. Til venstre finst objekta til
modusen (datasett, kjelder, diagram, malar), i midten arbeidsflata og til høgre inspektøren med eigenskapar og
statistikk. Nedst ligg statuslinja: lagringsstatus, lagring, det valde datasettet, R-motoren, pågåande
internettkall og knappane som faldar panela inn og opnar loggen, der kvar handling, åtvaring og feil blir skriven; det
er han du les når noko ikkje blir som du tenkte. Breidda på panela blir endra ved å dra i kanten mot arbeidsflata, og i
smale vindauge blir panela opna som ark over arbeidsflata (sjå [lagen.md](lagen.md)).

Alt du lagar, blir lagra automatisk i databasen til nettlesaren på datamaskina di. Ingenting blir sendt nokon stad med mindre du
sjølv hentar frå eit API, ser etter oppdateringar, sender til GitHub eller deler. Første gongen appen treng internett
for eit føremål, spør han om løyve, og svaret kan lagrast; under *Handter → Arbeidsområde → Internettilgang* ser du kva
som er tillate, og kva kall som er gjorde. Delar av appen som ikkje følgjer med i mappa (somme komponentar og
R-pakkar), blir henta på same måte når dei trengst, og lagra deretter lokalt.

## Grunnkurset

Grunnkurset er ein god måte å bli kjend med appen på. Det startar etter språkvalet første gongen appen blir opna, og elles
frå hjelpa (spørsmålsteiknet øvst til høgre) eller med kommandoen *Opne grunnkurset* i kommandopaletten. Kurset blir vist
i eit panel nedst til høgre medan du arbeider i den verkelege appen, og det følgjer dømet *Folketal per kommune
2024 (Sverige)* i ni steg:

1. Velkomen: kva appen gjer, og korleis skjermen er ordna.
2. Hent: importer dømedata, og kva eit datasett er.
3. Handter: namn og kortnamn, kjelde, kolonnar, versjonar og tryggingskopiar.
4. Bearbeid: tabellen, kolonneprofilar og ein utrekna kolonne som blir eit steg i oppskrifta.
5. Analyser med SQL: folketalet per län, og korleis kortnamn koplar saman datasett.
6. Analyser med R: `dm_read()`, ei oppsummering og eit histogram med ggplot2.
7. Visualiser: eit liggjande stolpediagram over folketalet per län.
8. Eksporter: data, diagram og dokument.
9. Ferdig: kvar du går vidare.

Kvart steg forklarar eit omgrep og gjev ei oppgåve. Ei ramme merkjer knappen du skal klikke på, og steget blir kryssa av når
appen ser at oppgåva er gjord. *Gjer det for meg* (eller *Vis meg*) utfører steget, slik at du kan følgje med utan å
skrive noko. Kurset kan minimerast med pila og lukkast med krysset; neste gong held det fram der du slapp. Det opprettar
dømedatasettet, ein kolonne i det og eit diagram, som du slettar som vanleg når du ikkje treng dei lenger.

## Ein arbeidsflyt frå fil til rapport

### 1. Hent data (Hent)

Slepp ei fil på flata, lim inn ein tabell eller hent ei fil frå ei nettadresse (tenaren må tillate CORS; ein delt
Dataspatium-konfigurasjon blir lagd til direkte). Kontroller førehandsvisinga: teiknkoding, skiljeteikn, overskriftsrad og
desimalteikn blir gjetta, men kan endrast. I kolonnesteget får kvar kolonne ein type; kodar med innleiande nullar (kommunenummer,
personnummer) blir haldne som tekst. Gje datasettet eit namn, og importer. Under flata finst data som følgjer med
appen: knappen for dømedataa *Folketal per kommune 2024 (Sverige)* og lista *Grenser for kart* med kommune- og
regiongrenser for Sverige, Danmark, Noreg og Finland.

Under *Legg til kjelder* → *Opne API-ar* finst oversynet over førehandsinnstillingar (dei du legg til, kjem under *Tillagde kjelder*; SCB og Boverket ligg der frå start) for statistikkbyråa og fleire andre etatar i Noreg, Danmark, Finland og
Island, dei sjølvstyrte områda, Nordic Statistics, Eurostat og dei svenske etatane (SCB, Folkhälsomyndigheten,
Socialstyrelsen, Kolada, SMHI, Naturvårdsverket, Lantmäteriet, Sveriges dataportal og dessutan Boverket for dei som har nøklar).
Landknappane over lista vel kva lands kjelder som blir viste. Bla eller søk fram ein tabell, vel variablar, førehandsvis, og
hent til eit nytt datasett eller legg til i eit eksisterande. Eit henta datasett hugsar spørjinga si, så det kan hentast på
nytt frå Handter når kjelda er oppdatert, og *Lagra hentingar* i Hent oppdaterer slike datasett med eitt klikk og
spelar av oppskriftene deira.

Databasar: Access-filer blir sleppte på flata som andre filer; databasar på datamaskina (SQL Server, ODBC, Excel,
SQLite) blir nådde gjennom *Database via brua* og tenester over HTTP (PostgREST, OData, GraphQL med fleire) gjennom *Databasekjelde*; OpenCDE og Neo4j har eigne val under Legg til kjelder. I Chrome og Edge kan ei fil lenkjast og lesast inn igjen frå disken. Sjå [kallor.md](kallor.md).

### 2. Gå gjennom og rett (Bearbeid)

Tabellen viser datasettet rad for rad sjølv når det har hundretusenvis av rader. Klikk på ei overskrift for å sortere og sjå
statistikken for kolonnen til høgre: tal, manglande, unike, minste, største, gjennomsnitt og vanlegaste verdiar. Filtrer med
søkjefeltet. Dobbeltklikk på ei celle for å endre henne.

*Datakvalitet* går gjennom alle kolonnar og peikar på problem (tal lagra som tekst, blanda datoformat, duplikat,
kodingsfeil, avvikande kategoriar) med ein knapp som utfører rett handling. *Reglar* lèt deg skrive ned kva som skal gjelde
(må ikkje mangle, unik, intervall, liste, mønster, lengd, SQL-vilkår), køyre kontrollen når som helst, lagre feilande
rader som eige datasett og laste ned ein rapport. Alle handlingar finst òg i paletten: fjern tomme rader, fjern mellomrom,
store og små bokstavar, søk og erstatt med regulære uttrykk, byt type, tolk datoar og tal, fyll inn manglande verdiar,
duplikat, klyng liknande kategoriar og meir. Kvar handling blir logga som eit steg i oppskrifta og kan angrast. Før deling kan
identifikatorar som personnummer pseudonymiserast med salta hashverdiar, maskering eller løpenummer; saltet blir aldri lagra i
oppskrifta.

### 3. Kombiner og omform (Bearbeid)

Utrekna kolonnar, del opp og slå saman kolonnar, filtrer bort rader, gje nytt namn og ny rekkjefølgje, pivoter mellom brei og
lang form, grupper og aggreger, kople to datasett på ein nøkkel og slå saman datasett med dei same kolonnane. Aggregeringar,
koplingar og samanslåingar blir nye datasett, så originalen finst framleis. Gruppa *Geodata* gjev sentroide og areal frå
geometriar, omrekning mellom SWEREF 99 TM og WGS 84 og svensk kommune og län frå koordinatar med grensene som følgjer med.

Oppskrifta (alle steg i rekkjefølgje) kan visast, spelast av på ein ny versjon av dataa og eksporterast som JSON, R-kode eller
SQL. Versjonar blir tekne ved import, før massehandlingar og ved behov; to versjonar kan samanliknast og ein eldre gjenopprettast.

### 4. Analyser med R og SQL (Analyser)

R-konsollen køyrer ekte R (WebR) i nettlesaren. `dm_list()` viser datasetta, `dm_read("kortnamn")` les eitt som data.frame
med rette typar, `dm_write(df, "Nytt namn")` sender ein data.frame tilbake som nytt datasett. `theme_dataspatium()` og
`dm_palette()` gjev ggplot2 utsjånaden til appen. Diagram blir viste i panelet og eksporterte som SVG, PNG eller PDF. Pakkar som
ggplot2, dplyr, tidyr, data.table, haven og readxl følgjer med og blir installerte i sesjonen første gongen dei blir brukte. Skript kan
lagrast og køyrast igjen. Første oppstart tek nokre sekund.

SQL-fana spør tabellen `data` i datasettet direkte med SQLite. Andre datasett blir nådde med kortnamna sine (blir viste under namnet i
objektpanelet), slik at éi spørjing kan gjere join over fleire datasett, til dømes
`select ... from befolkning_2024 b join kommungranser k on k.kommunkod = b.kommunkod`. SELECT-spørjingar viser resultatet
(opptil 5 000 rader) og kan lagrast som nytt datasett; UPDATE, DELETE og ALTER blir logga som steg i oppskrifta. Knappen *Set
inn dm_read()* og R-døma i inspektøren brukar òg kortnamnet.

Fana *Notatbok* samlar tekst (Markdown), R og SQL i celler som blir køyrde i rekkjefølgje og lagrar utdataa sine. Ei ferdig
notatbok blir eksportert som HTML, Word, PDF, Markdown eller LaTeX, med eller utan koden. Sjå [anteckningsbok.md](anteckningsbok.md).

Fana *Regex* prøver eit regulært uttrykk på ein kolonne medan du skriv: dei vanlegaste verdiane blir viste med treffa
merkte, og radene som samsvarar, blir telde. Same mønster kan så filtrere rader, hente ut grupper til nye kolonnar,
erstatte, dele opp, markere eller telje treff, eller bli ein kvalitetsregel. *Mønsterprofil* viser kva former
verdiane har (til dømes `9999-99-99` og `99/99/9999` for datoar), og biblioteket til venstre har ferdige
mønster for mellom anna personnummer, postnummer og datoar. Sjå [regex.md](regex.md).

### 5. Visualiser (Visualiser)

Diagrambyggjaren lagar stolpe-, linje-, areal-, punkt-, sektor- og andre diagram frå eit datasett: vel kolonnar for aksar,
farge og små panel, aggregering, sortering og titlar. D3-malar gjev spesialdiagram (lollipop, hellingsdiagram,
befolkningspyramide), og R-diagram kan lagrast med koden sin. Alle motorar brukar same fargar og skrifttypar. Lagra
diagram blir samla i galleriet og eksporterte som SVG, PNG, PDF eller PowerPoint, enkeltvis eller eitt per gruppe (til
dømes per kommune) til ei ZIP-fil eller ein presentasjon. Kart blir teikna med diagramtypen *Kart* frå eit datasett med geometri
(dei svenske kommune- eller länsgrensene som følgjer med eller eigne frå GeoJSON, shapefile og GeoPackage) kopla til verdiar per
kode, og med *Punktkart* frå lengde- og breiddegrad med grensene som bakgrunn. Eit dashbord samlar fleire lagra diagram i
eit rutenett med felles filter, til dømes fylke eller år, og blir eksportert som frittståande HTML eller PowerPoint.

### 6. Dokument (Eksporter, fana Dokument)

Dokumentmalar blir skrivne i Markdown med plasshaldarar: `{{datamangd}}`, `{{antal_rader}}`, `{{#tabell}}…{{/tabell}}` for rader,
`{{diagram "Namn"}}` for eit lagra diagram, `{{sidbrytning}}` og nøkkeltal som `{{summor.kolumn}}`. Rapport, kodebok og
gruppesamandrag er innebygde. Generer som HTML, Word, PDF, Markdown eller LaTeX, enkeltvis eller eitt dokument per gruppe.

### 7. Eksporter data (Eksporter, fana Data)

CSV (tilpassa Excel i Norden eller standard), Excel, ODS, JSON, GeoJSON (for datasett med geometri), XML, SQLite og dessutan via
R: Parquet, SPSS, Stata og RDS. SQLite og Parquet held på typane nøyaktig; alle format kan importerast igjen.

## Finne i data (Søk)

Søk finn rader utan kode. Skriv eitt eller fleire ord, vel alle datasett eller berre det valde, og trykk på *Søk*.
Treffa blir viste per datasett; fasettane (dei vanlegaste verdiane i kolonnar med få ulike verdiar) avgrensar med eitt
klikk, og ei rad i tabellen viser heile posten i inspektøren. Søket kan lagrast som liste, bli eit nytt datasett eller
opnast i Bearbeid med datasettet valt. Fana *Spørjing* byggjer ei spørjing over eitt eller fleire datasett med
kolonnar, utrekningar, vilkår og sortering utan kode og viser SQL-koden som blir laga; lagra lister avgrensar
tabellen i Bearbeid og radene i diagram. Sjå [soka.md](soka.md).

## Halde orden (Handter)

Kvart datasett har eit oversyn (kjelde, storleik, skildring, mappe og taggar), ei kolonneliste med typar,
etikettar, skildringar og einingar (blir sette under Bearbeid med *Etikett, skildring og eining*), kommentarar, ein
lesbar historikk over alt som er gjort, og versjonar. Gje nytt namn og kortnamn, ordne, slett eller hent igjen frå API
(oppdater med oppskrifta, eller legg til rader). Under *Arbeidsområde* ser du kor mykje lagring som blir brukt, ber om
varig lagring, tek tryggingskopi som ZIP og gjenopprettar. Appen minner deg ved oppstart når det har gått
lenger enn valt tal på dagar sidan siste tryggingskopi (30 dagar som standard; blir endra eller slått av i same kort).
I Edge og Chrome kan arbeidsområdet dessutan speglast til ei portabel mappe på disken, automatisk ved kvar endring.

Objektpanelet i Handter er eit tre. *Ordne* gjev eit datasett ei mappe (med undermapper, som `Økonomi/2026`) og
taggar; mapper kan faldast saman, og eit datasett kan dragast til ei anna mappe. Filterfeltet søkjer på namn, kortnamn,
tagg og mappe, og lista kan sorterast etter endra, namn eller rader. Avkryssingsboksane vel fleire datasett
(Skift vel eit spenn), og knappen *Handlingar (n)* gjer det same med alle på éin gong: ordne, pakke, eksportere
som ZIP med CSV-filer, hente igjen frå API, køyre ei oppskrift eller slette. Mappe og taggar blir lagra i fila til datasettet
og følgjer med i pakkar, tryggingskopiar og GitHub; i R viser `dm_list()` mappa, og `dm_read("Mappe/Namn")`
les eit datasett i ei mappe.

## Dele med andre

Alt som skal til andre menneske, finst i modusen *Del* (sjå [dela.md](dela.md)):

- Eit utval: *Pakke* gjev ei ZIP-fil med valde datasett, diagram, dashbord, malar, notatbøker og skript, ei melding og
  ein endringslogg: det som er gjort med kvart datasett sidan det sist vart delt, og kommentarane som ikkje er løyste.
  Mottakaren opnar han under *Ta imot*, ser meldinga og endringane og vel for datasett som allereie finst, om dei
  skal erstattast med versjonen i pakken (den eigne blir lagra under *Versjonar*); resten blir hoppa over. Under Handter gjer
  *Handlingar* på fleire valde datasett det same.
- Kommentarar: kvart datasett har fana *Kommentarar* i Handter, og i Bearbeid kommenterer du ein kolonne frå
  inspektøren. Kommentarane ligg i fila til datasettet og følgjer med i pakkar, tryggingskopiar, den portable mappa og
  GitHub. Namnet som blir vist, oppgjev du sjølv; det blir berre lagra i nettlesaren.
- Heile arbeidsområdet: tryggingskopien (ZIP) blir gjenoppretta under Handter på ei anna datamaskin.
- Mellom datamaskiner via GitHub: fana *GitHub* sender arbeidsområdet til eit GitHub-repositorium (helst privat) og
  hentar det på ei anna datamaskin. Det krev eit finkorna tilgangstoken (fine-grained personal access token) som
  berre får lese og skrive innhaldet i akkurat det repositoriet. Tokenet blir brukt i sesjonen eller lagra kryptert, og
  ingenting blir sendt før du trykkjer *Send til GitHub* eller *Hent frå GitHub*. Berre endra filer blir sende, i éin commit
  med meldinga di; ved henting vel du, som for pakkar, om eksisterande datasett skal erstattast.
- Direkte til ein telefon eller ei anna datamaskin på same nettverk: fana *Einingar* viser ein QR-kode som telefonen
  skannar; Dataspatium Mobil tek imot, viser og sender vidare (sjå [mobil.md](mobil.md)). Begge einingane viser same
  kontrollkode, og etter ei paring held det med éi skanning.
- Via delingsmenyen på datamaskina eller telefonen: fana *Delingsmeny* sender eit datasett som CSV, Excel, ODS eller
  JSON, eller alle datasett som pakke, til e-post, Teams og andre appar (Edge og Chrome; Firefox lagrar fila).
- Gjennomgang først: når datasett blir pakka eller sende, søkjer appen etter identitetsnummer, e-post og telefonnummer og
  lèt deg pseudonymisere eller fjerne kolonnane i kopien.
- Som ferdig nettside: fana *Publiser* gjer eit dashbord eller eit dokument til ei frittståande HTML-fil.
- Eitt datasett: eksporter som SQLite (alt følgjer med) eller Parquet under Eksporter.
- API-konfigurasjonar (`.api.json`), diagram og dokumentmalar (JSON) og oppskrifter (JSON, R eller SQL) blir eksporterte og
  lasta inn som filer. Nøklar følgjer aldri med.

## AI-assistenten

*AI-assistent* i statuslinja, eller *AI-assistent* i kommandopaletten (Ctrl+K), opnar eit panel der ein AI gjer oppgåver for deg
med kommandoane i appen, i alle modusar. Han brukar AI-leverandøren du har lagt til under *Leverandørar*, ei skyteneste med
nøkkelen din eller ein lokal modell, og vert nådd først når du har gjeve samtykke for verten til leverandøren.

Skriv kva du vil få gjort, og trykk på *Send* (eller Ctrl+Enter). AI-en les først, til dømes kva datasett og kolonnar som finst, og
vel neste steg etter det han får vite. Stega vert viste i panelet medan dei vert køyrde.

- Alt som endrar noko, som ei handling i Bearbeid, ein eksport eller eit R- eller Python-skript, vert først vist i ein eigen dialog
  med kommandoen og argumenta. Det vert berre køyrt viss du trykkjer på *Godkjenn*, og det kan angrast etterpå.
- Når vegen er avhengig av kva du vil, spør AI-en deg i panelet med nokre svar å velje mellom. Eit svar på eit spørsmål
  godkjenner aldri noko.
- For ei oppgåve som skal gjerast igjen, kan AI-en foreslå ein heil flyt, som du lagrar med *Lagre som flyt*. Etter ei oppgåve kan
  du òg lagre dei godkjende stega som ein flyt. Begge vert deretter køyrde utan AI under *Flytar og vakting*.
- AI-en svarar på språket i appen. *Stopp* avbryt før neste steg. AI-en hugsar samtalen mellom økter: han vert lagra som notatboka
  *AI-assistent* under Analyser, som du kan lese og slette, og følgjer aldri med i ein pakke til andre. *Ny samtale* byrjar på nytt og
  gløymer han.

Det AI-en les i datasetta, vert rekna som data, aldri som instruksjonar. Det som vert sendt til ei skyteneste, forlèt
datamaskina, så vel ein lokal modell for sensitive oppgåver.

## Hjelp i appen

Heile handboka finst i appen: knappen **?** øvst til høgre, tasten **F1** eller kommandoen *Hjelp* i
kommandopaletten opnar henne ved kapittelet for modusen du står i. Til venstre er innhaldet, over det eit søkjefelt som
søkjer i alle avsnitt, og lenkjer mellom dokumenta blir følgde inne i handboka. Dialogar med ein **?**-knapp opnar rett
avsnitt direkte. Handboka følgjer språket i appen og treng ikkje nett; nedst finst versjonen, *Sjå etter
oppdateringar* og lenkja til dokumentasjonen på GitHub.

## Tastatur

Alt+1 til Alt+9 byter modus, Ctrl+K opnar kommandopaletten, og F1 opnar handboka. Kanten mellom eit panel og arbeidsflata kan få fokus
med Tab og flyttast med piltastane (Skift for større steg, Home og End for minste og største breidd). Første trykk på Tab på sida viser lenkja *Gå til innhaldet*,
som flyttar fokus forbi modusveljaren og objektpanelet. Alt blir nådd med Tab og Enter; dialogar blir lukka med Esc. I tabellen
flyttar piltastane mellom celler, og Enter redigerer. Appen følgjer systeminnstillinga for redusert rørsle.

Faner blir bytte med venstre og høgre piltast, Home og End. Alle knappar, felt og kodeeditorar har namn
som skjermlesarar les opp, dialogar blir lesne opp med overskrifta si, og sida har landemerke for modusveljaren,
objektpanelet, arbeidsflata og inspektøren. Tekst og feltkantar har kontrast etter WCAG AA i både lyst og mørkt
tema. Diagram frå diagrambyggjaren blir skildra for skjermlesarar av Vega; for R-diagram og D3-malar finst
tala i tabellen i Bearbeid.

## Språk

Brukargrensesnittet finst på svensk, dansk, norsk (bokmål og nynorsk), finsk, islandsk og engelsk. Første gongen appen blir opna, vel du
språk; språkknappen øvst til høgre (eller kommandoen *Språk* i paletten) byter det seinare. Valet blir lagra i nettlesaren,
så kvar datamaskin og nettlesarprofil har sitt eige. Tal i grensesnittet følgjer konvensjonane til språket; sjølve dataa blir
aldri endra. Meldingane frå R følgjer same val, medan plasshaldarane i malane som `{{datamangd}}` og tabellnøkkelorda `kolumner`,
`sortera`, `topp`, `filter` og `rubrik` er ein del av malspråket og er like på alle språk. Dokumentasjonen finst på alle sju
språka under `docs/` (svensk i `docs/`, dei andre i `docs/<språk>/`).

## Når noko går gale

Les loggen nedst: feil du kan rette, blir skildra på ditt språk med forslag. Om R heng, brukar du *Start R på nytt*;
datasetta blir ikkje påverka. Ta tryggingskopi før du slettar nettlesardata. Feil blir rapporterte som issues på GitHub, sjå
[CONTRIBUTING.md](../../CONTRIBUTING.md).
