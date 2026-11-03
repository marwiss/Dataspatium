# Brukerveiledning

Denne veiledningen beskriver hvordan du arbeider i Dataspatium fra første fil til ferdig rapport. Den forutsetter at du har
åpnet appen som beskrevet i [kom-igang.md](kom-igang.md). Detaljer om hver modus finnes i [lagen.md](lagen.md), om
filformater i [format.md](format.md), om API-er i [api-konfiguration.md](api-konfiguration.md), om bearbeiding i
[bearbeta.md](bearbeta.md), om R i [r-guide.md](r-guide.md), om diagrammer i [visualisera.md](visualisera.md) og om
dokumenter i [dokumentmallar.md](dokumentmallar.md). Vanlige spørsmål besvares i [faq.md](faq.md).

## Arbeidsområdet

Skjermen ser lik ut i alle moduser. Øverst bytter du modus (Hent, Håndter, Søk, Bearbeid, Analyser, Visualiser,
Eksporter, Del; Alt+1 til Alt+8 virker også) og når kommandopaletten (forstørrelsesglasset eller Ctrl+K),
språkknappen, tema (lyst eller mørkt) og hjelpeknappen med versjonsnummer og *Se etter oppdateringer*.
Kommandopaletten er den raskeste veien til det meste: skriv noen bokstaver for å bytte modus, åpne et datasett, et
diagram eller et dashbord, søke i data eller kjøre en handling på det valgte datasettet. Til venstre finnes modusens
objekter (datasett, kilder, diagrammer, maler), i midten arbeidsflaten og til høyre inspektøren med egenskaper og
statistikk. Nederst ligger statuslinjen: lagringsstatus, lagring, det valgte datasettet, R-motoren, pågående
internettkall og knappene som folder panelene inn og åpner loggen, der hver handling, advarsel og feil skrives; det
er den du leser når noe ikke blir som du tenkte. Panelenes bredde endres ved å dra i kanten mot arbeidsflaten, og i
smale vinduer åpnes panelene som ark over arbeidsflaten (se [lagen.md](lagen.md)).

Alt du lager, lagres automatisk i nettleserens database på datamaskinen din. Ingenting sendes noe sted med mindre du
selv henter fra et API, ser etter oppdateringer, sender til GitHub eller deler. Første gang appen trenger internett
for et formål, spør den om lov, og svaret kan lagres; under *Håndter → Arbeidsområde → Internettilgang* ser du hva
som er tillatt, og hvilke kall som er gjort. Deler av appen som ikke følger med i mappen (enkelte komponenter og
R-pakker), hentes på samme måte når de trengs, og lagres deretter lokalt.

## Grunnkurset

Grunnkurset er en god måte å bli kjent med appen på. Det starter etter språkvalget første gang appen åpnes, og ellers
fra hjelpen (spørsmålstegnet øverst til høyre) eller med kommandoen *Åpne grunnkurset* i kommandopaletten. Kurset vises
i et panel nederst til høyre mens du arbeider i den virkelige appen, og det følger eksempelet *Befolkning per kommune
2024 (Sverige)* i ni trinn:

1. Velkommen: hva appen gjør, og hvordan skjermen er ordnet.
2. Hent: importer eksempeldata, og hva et datasett er.
3. Håndter: navn og kortnavn, kilde, kolonner, versjoner og sikkerhetskopier.
4. Bearbeid: tabellen, kolonneprofiler og en beregnet kolonne som blir et trinn i oppskriften.
5. Analyser med SQL: folketallet per län, og hvordan kortnavn kobler sammen datasett.
6. Analyser med R: `dm_read()`, en oppsummering og et histogram med ggplot2.
7. Visualiser: et liggende stolpediagram over folketallet per län.
8. Eksporter: data, diagrammer og dokumenter.
9. Ferdig: hvor du går videre.

Hvert trinn forklarer et begrep og gir en oppgave. En ramme markerer knappen du skal klikke på, og trinnet hukes av når
appen ser at oppgaven er gjort. *Gjør det for meg* (eller *Vis meg*) utfører trinnet, slik at du kan følge med uten å
skrive noe. Kurset kan minimeres med pilen og lukkes med krysset; neste gang fortsetter det der du slapp. Det oppretter
eksempeldatasettet, en kolonne i det og et diagram, som du sletter som vanlig når du ikke trenger dem lenger.

## En arbeidsflyt fra fil til rapport

### 1. Hent data (Hent)

Slipp en fil på flaten, lim inn en tabell eller hent en fil fra en nettadresse (serveren må tillate CORS; en delt
Dataspatium-konfigurasjon legges til direkte). Kontroller forhåndsvisningen: tegnkoding, skilletegn, overskriftsrad og
desimaltegn gjettes, men kan endres. I kolonnetrinnet får hver kolonne en type; koder med innledende nuller (kommunenumre,
personnumre) beholdes som tekst. Gi datasettet et navn, og importer. Under flaten finnes data som følger med
appen: knappen for eksempeldataene *Befolkning per kommune 2024 (Sverige)* og listen *Grenser for kart* med kommune- og
regiongrenser for Sverige, Danmark, Norge og Finland.

Under *Åpne API-er* finnes forhåndsinnstillinger for statistikkbyråene og flere andre etater i Norge, Danmark, Finland og
Island, de selvstyrte områdene, Nordic Statistics, Eurostat og de svenske etatene (SCB, Folkhälsomyndigheten,
Socialstyrelsen, Kolada, SMHI, Naturvårdsverket, Lantmäteriet, Sveriges dataportal samt Boverket for dem som har nøkler).
Landknappene over listen velger hvilke lands kilder som vises. Bla eller søk fram en tabell, velg variabler, forhåndsvis, og
hent til et nytt datasett eller legg til i et eksisterende. Et hentet datasett husker spørringen sin, så det kan hentes på
nytt fra Håndter når kilden er oppdatert, og *Lagrede hentinger* i Hent oppdaterer slike datasett med ett klikk og
spiller av oppskriftene deres.

### 2. Gå gjennom og rett (Bearbeid)

Tabellen viser datasettet rad for rad selv når det har hundretusener av rader. Klikk på en overskrift for å sortere og se
kolonnens statistikk til høyre: antall, manglende, unike, minste, største, gjennomsnitt og vanligste verdier. Filtrer med
søkefeltet. Dobbeltklikk på en celle for å endre den.

*Datakvalitet* går gjennom alle kolonner og peker på problemer (tall lagret som tekst, blandede datoformater, duplikater,
kodingsfeil, avvikende kategorier) med en knapp som utfører riktig handling. *Regler* lar deg skrive ned hva som skal gjelde
(må ikke mangle, unik, intervall, liste, mønster, lengde, SQL-betingelse), kjøre kontrollen når som helst, lagre feilende
rader som eget datasett og laste ned en rapport. Alle handlinger finnes også i paletten: fjern tomme rader, fjern mellomrom,
store og små bokstaver, søk og erstatt med regulære uttrykk, bytt type, tolk datoer og tall, fyll inn manglende verdier,
duplikater, klyng lignende kategorier og mer. Hver handling logges som et trinn i oppskriften og kan angres. Før deling kan
identifikatorer som personnumre pseudonymiseres med saltede hashverdier, maskering eller løpenumre; saltet lagres aldri i
oppskriften.

### 3. Kombiner og omform (Bearbeid)

Beregnede kolonner, del opp og slå sammen kolonner, filtrer bort rader, gi nytt navn og ny rekkefølge, pivoter mellom bred og
lang form, grupper og aggreger, koble to datasett på en nøkkel og slå sammen datasett med de samme kolonnene. Aggregeringer,
koblinger og sammenslåinger blir nye datasett, så originalen finnes fortsatt. Gruppen *Geodata* gir sentroide og areal fra
geometrier, omregning mellom SWEREF 99 TM og WGS 84 og svensk kommune og län fra koordinater med de medfølgende grensene.

Oppskriften (alle trinn i rekkefølge) kan vises, spilles av på en ny versjon av dataene og eksporteres som JSON, R-kode eller
SQL. Versjoner tas ved import, før massehandlinger og ved behov; to versjoner kan sammenlignes og en eldre gjenopprettes.

### 4. Analyser med R og SQL (Analyser)

R-konsollen kjører ekte R (WebR) i nettleseren. `dm_list()` viser datasettene, `dm_read("kortnavn")` leser ett som data.frame
med riktige typer, `dm_write(df, "Nytt navn")` sender en data.frame tilbake som nytt datasett. `theme_dataspatium()` og
`dm_palette()` gir ggplot2 appens utseende. Diagrammer vises i panelet og eksporteres som SVG, PNG eller PDF. Pakker som
ggplot2, dplyr, tidyr, data.table, haven og readxl følger med og installeres i sesjonen første gang de brukes. Skript kan
lagres og kjøres igjen. Første oppstart tar noen sekunder.

SQL-fanen spør datasettets tabell `data` direkte med SQLite. Andre datasett nås med kortnavnene sine (vises under navnet i
objektpanelet), slik at én spørring kan gjøre join over flere datasett, for eksempel
`select ... from befolkning_2024 b join kommungranser k on k.kommunkod = b.kommunkod`. SELECT-spørringer viser resultatet
(opptil 5 000 rader) og kan lagres som nytt datasett; UPDATE, DELETE og ALTER logges som trinn i oppskriften. Knappen *Sett
inn dm_read()* og R-eksemplene i inspektøren bruker også kortnavnet.

Fanen *Notatbok* samler tekst (Markdown), R og SQL i celler som kjøres i rekkefølge og lagrer utdataene sine. En ferdig
notatbok eksporteres som HTML, Word, PDF, Markdown eller LaTeX, med eller uten koden. Se [anteckningsbok.md](anteckningsbok.md).

Fanen *Regex* prøver et regulært uttrykk på en kolonne mens du skriver: de vanligste verdiene vises med treffene
markert, og radene som matcher, telles. Samme mønster kan så filtrere rader, hente ut grupper til nye kolonner,
erstatte, dele opp, markere eller telle treff, eller bli en kvalitetsregel. *Mønsterprofil* viser hvilke former
verdiene har (for eksempel `9999-99-99` og `99/99/9999` for datoer), og biblioteket til venstre har ferdige
mønstre for blant annet personnumre, postnumre og datoer. Se [regex.md](regex.md).

### 5. Visualiser (Visualiser)

Diagrambyggeren lager stolpe-, linje-, areal-, punkt-, sektor- og andre diagrammer fra et datasett: velg kolonner for akser,
farge og små paneler, aggregering, sortering og titler. D3-maler gir spesialdiagrammer (lollipop, helningsdiagram,
befolkningspyramide), og R-diagrammer kan lagres med koden sin. Alle motorer bruker samme farger og skrifttyper. Lagrede
diagrammer samles i galleriet og eksporteres som SVG, PNG, PDF eller PowerPoint, enkeltvis eller ett per gruppe (for
eksempel per kommune) til en ZIP eller en presentasjon. Kart tegnes med diagramtypen *Kart* fra et datasett med geometri
(de medfølgende svenske kommune- eller länsgrensene eller egne fra GeoJSON, shapefile og GeoPackage) koblet til verdier per
kode, og med *Punktkart* fra lengde- og breddegrad med grensene som bakgrunn. Et dashbord samler flere lagrede diagrammer i
et rutenett med felles filtre, for eksempel fylke eller år, og eksporteres som frittstående HTML eller PowerPoint.

### 6. Dokumenter (Eksporter, fanen Dokumenter)

Dokumentmaler skrives i Markdown med plassholdere: `{{datamangd}}`, `{{antal_rader}}`, `{{#tabell}}…{{/tabell}}` for rader,
`{{diagram "Navn"}}` for et lagret diagram, `{{sidbrytning}}` og nøkkeltall som `{{summor.kolumn}}`. Rapport, kodebok og
gruppesammendrag er innebygd. Generer som HTML, Word, PDF, Markdown eller LaTeX, enkeltvis eller ett dokument per gruppe.

### 7. Eksporter data (Eksporter, fanen Data)

CSV (tilpasset Excel i Norden eller standard), Excel, ODS, JSON, GeoJSON (for datasett med geometri), XML, SQLite samt via
R: Parquet, SPSS, Stata og RDS. SQLite og Parquet beholder typene nøyaktig; alle formater kan importeres igjen.

## Finne i data (Søk)

Søk finner rader uten kode. Skriv ett eller flere ord, velg alle datasett eller bare det valgte, og trykk på *Søk*.
Treffene vises per datasett; fasettene (de vanligste verdiene i kolonner med få ulike verdier) avgrenser med ett
klikk, og en rad i tabellen viser hele posten i inspektøren. Søket kan lagres som liste, bli et nytt datasett eller
åpnes i Bearbeid med datasettet valgt. Se [soka.md](soka.md).

## Holde orden (Håndter)

Hvert datasett har en oversikt (kilde, størrelse, beskrivelse, mappe og tagger), en kolonneliste med typer,
etiketter, beskrivelser og enheter (settes under Bearbeid med *Etikett, beskrivelse og enhet*), kommentarer, en
lesbar historikk over alt som er gjort, og versjoner. Gi nytt navn og kortnavn, ordne, slett eller hent igjen fra API
(oppdater med oppskriften, eller legg til rader). Under *Arbeidsområde* ser du hvor mye lagring som brukes, ber om
vedvarende lagring, tar sikkerhetskopi som ZIP og gjenoppretter. Appen minner deg ved oppstart når det har gått
lenger enn valgt antall dager siden siste sikkerhetskopi (30 dager som standard; endres eller slås av i samme kort).
I Edge og Chrome kan arbeidsområdet dessuten speiles til en portabel mappe på disken, automatisk ved hver endring.

Objektpanelet i Håndter er et tre. *Ordne* gir et datasett en mappe (med undermapper, som `Økonomi/2026`) og
tagger; mapper kan foldes sammen, og et datasett kan dras til en annen mappe. Filterfeltet søker på navn, kortnavn,
tagg og mappe, og listen kan sorteres etter endret, navn eller rader. Avkrysningsboksene velger flere datasett
(Skift velger et spenn), og knappen *Handlinger (n)* gjør det samme med alle på én gang: ordne, pakke, eksportere
som ZIP med CSV-filer, hente igjen fra API, kjøre en oppskrift eller slette. Mappe og tagger lagres i datasettets
fil og følger med i pakker, sikkerhetskopier og GitHub; i R viser `dm_list()` mappen, og `dm_read("Mappe/Navn")`
leser et datasett i en mappe.

## Dele med andre

Alt som skal til andre mennesker, finnes i modusen *Del* (se [dela.md](dela.md)):

- Et utvalg: *Pakke* gir en ZIP med valgte datasett, diagrammer, dashbord, maler, notatbøker og skript, en melding og
  en endringslogg: det som er gjort med hvert datasett siden det sist ble delt, og kommentarene som ikke er løst.
  Mottakeren åpner den under *Motta*, ser meldingen og endringene og velger for datasett som allerede finnes, om de
  skal erstattes med pakkens versjon (den egne lagres under *Versjoner*); resten hoppes over. Under Håndter gjør
  *Handlinger* på flere valgte datasett det samme.
- Kommentarer: hvert datasett har fanen *Kommentarer* i Håndter, og i Bearbeid kommenterer du en kolonne fra
  inspektøren. Kommentarene ligger i datasettets fil og følger med i pakker, sikkerhetskopier, den portable mappen og
  GitHub. Navnet som vises, angir du selv; det lagres bare i nettleseren.
- Hele arbeidsområdet: sikkerhetskopien (ZIP) gjenopprettes under Håndter på en annen datamaskin.
- Mellom datamaskiner via GitHub: fanen *GitHub* sender arbeidsområdet til et GitHub-repository (helst privat) og
  henter det på en annen datamaskin. Det krever et finkornet tilgangstoken (fine-grained personal access token) som
  bare får lese og skrive innholdet i akkurat det repositoryet. Tokenet brukes i økten eller lagres kryptert, og
  ingenting sendes før du trykker *Send til GitHub* eller *Hent fra GitHub*. Bare endrede filer sendes, i én commit
  med meldingen din; ved henting velger du, som for pakker, om eksisterende datasett skal erstattes.
- Via datamaskinens eller telefonens delingsmeny: fanen *Delingsmeny* sender et datasett som CSV, Excel, ODS eller
  JSON, eller alle datasett som pakke, til e-post, Teams og andre apper (Edge og Chrome; Firefox lagrer filen).
- Som ferdig nettside: fanen *Publiser* gjør et dashbord eller et dokument til en frittstående HTML-fil.
- Ett datasett: eksporter som SQLite (alt følger med) eller Parquet under Eksporter.
- API-konfigurasjoner (`.api.json`), diagrammer og dokumentmaler (JSON) og oppskrifter (JSON, R eller SQL) eksporteres og
  lastes inn som filer. Nøkler følger aldri med.

## Tastatur

Alt+1 til Alt+8 bytter modus, og Ctrl+K åpner kommandopaletten. Kanten mellom et panel og arbeidsflaten kan få fokus
med Tab og flyttes med piltastene (Skift for større steg, Home og End for minste og største bredde). Første trykk på Tab på siden viser lenken *Gå til innholdet*,
som flytter fokus forbi modusvelgeren og objektpanelet. Alt nås med Tab og Enter; dialoger lukkes med Esc. I tabellen
flytter piltastene mellom celler, og Enter redigerer. Appen følger systeminnstillingen for redusert bevegelse.

Faner byttes med venstre og høyre piltast, Home og End. Alle knapper, felt og koderedigeringsprogrammer har navn
som skjermlesere leser opp, dialoger leses opp med overskriften sin, og siden har landemerker for modusvelgeren,
objektpanelet, arbeidsflaten og inspektøren. Tekst og feltkanter har kontrast etter WCAG AA i både lyst og mørkt
tema. Diagrammer fra diagrambyggeren beskrives for skjermlesere av Vega; for R-diagrammer og D3-maler finnes
tallene i tabellen i Bearbeid.

## Språk

Brukergrensesnittet finnes på svensk, dansk, norsk (bokmål), finsk, islandsk og engelsk. Første gang appen åpnes, velger du
språk; språkknappen øverst til høyre (eller kommandoen *Språk* i paletten) bytter det senere. Valget lagres i nettleseren,
så hver datamaskin og nettleserprofil har sitt eget. Tall i grensesnittet følger språkets konvensjoner; selve dataene endres
aldri. R sine meldinger følger samme valg, mens malenes plassholdere som `{{datamangd}}` og tabellnøkkelordene `kolumner`,
`sortera`, `topp`, `filter` og `rubrik` er en del av malspråket og er like på alle språk. Dokumentasjonen finnes på alle seks
språk under `docs/` (svensk i `docs/`, de øvrige i `docs/<språk>/`).

## Når noe går galt

Les loggen nederst: feil du kan rette, beskrives på ditt språk med forslag. Hvis R henger, bruker du *Start R på nytt*;
datasettene påvirkes ikke. Ta sikkerhetskopi før du sletter nettleserdata. Feil rapporteres som issues på GitHub, se
[CONTRIBUTING.md](../../CONTRIBUTING.md).
