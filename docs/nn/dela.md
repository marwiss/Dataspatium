# Del

Modusen Del samlar det som handlar om å gje data til andre menneske og einingar. Eksporter handlar om filer til di
eiga datamaskin; Del om pakkar, GitHub, einingar, delingsmenyen, publisering og mottak. Før datasett forlèt appen,
går dei gjennom ein gjennomgang av personopplysningar (sjå nedanfor).

## Pakke

Ein pakke er ei ZIP-fil med valde datasett og det som høyrer til dei: diagram, dashbord, malar, notatbøker og
skript, saman med ei melding, namnet på avsendaren og ein endringslogg over det som er gjort med kvart datasett sidan det
sist vart delt. *Lag pakke* opnar dialogen med alle datasett førehandsvalde; med eit datasett valt finst òg *Pakk
berre det*. Mottakaren opnar pakken under *Ta imot* og ser melding og endringar før noko blir teke inn. Inspektøren viser kor
mykje som finst å dele. Sjå òg [format.md](format.md) om oppbygginga av pakken.

**Filene.** Eit datasett med filer viser kor store dei er, og du kan la dei bli att for å gjere pakken mindre. Radene følgjer med. Utan filene viser ei biletsamling berre opplysningane om bileta, og eit dokument teksten sin.

## GitHub

Arbeidsområdet som ei mappe i eit GitHub-repositorium, helst privat. Oppgje repositorium (`eigar/namn`), grein og mappe, og
eit finkorna tilgangstoken som berre får lese og skrive innhaldet i det repositoriet. Tokenet blir brukt i sesjonen eller
lagra kryptert; ingenting blir sendt før du trykkjer *Send til GitHub* eller *Hent frå GitHub*. Berre endra filer blir sende,
i éin commit med meldinga di. Ved henting vel du, som for pakkar, om datasett som allereie finst, skal erstattast
(din eigen versjon blir lagra under *Versjonar*). Første gongen spør appen om løyve til å kontakte GitHub (sjå *Internettilgang*
i [anvandarguide.md](anvandarguide.md)).

## Samarbeide via GitHub

Når du hentar frå GitHub, blir det som allereie er her, samanlikna med det henta etter historikken deira. Dialogen seier for kvart
datasett kven som har endra kva, og kommentarar og notat frå begge sider blir alltid haldne.

- Har berre den andre sida endra data, blir den versjonen teken inn, og din blir lagra som ein versjon å gå tilbake til.
- Har berre du endra data, blir din versjon halden.
- Har begge endra, vel du: hald på begge, med den henta som eit eige datasett, hald på din eller ta den henta. Å halde på
  begge er førehandsvalt, så ingenting forsvinn.

Kommentarar frå andre som du ikkje har lese, blir viste i statuslinja. Eit klikk opnar dei, og namnet på den som har skrive, står ved
kvar kommentar. Namnet er det personen sjølv har oppgjeve.

## Einingar

Direkte overføring til telefonar, nettbrett og andre datamaskiner over det lokale nettverket, utan tenar.
Datamaskina viser ein QR-kode; telefonen skannar han med kameraet og opnar Dataspatium Mobil, som tek imot pakkar
og filer, viser tabellane og kan sende dei vidare eller levere dei til ei anna datamaskin. Første gongen viser
telefonen ein kode som blir skriven inn på datamaskina, og einingane blir para; deretter held det med éi skanning. Begge
einingane viser same kontrollkode, og mottakaren godkjenner før noko blir teke imot. To datamaskiner koplar til med kodar
som blir limte inn. Heile flyten, krav og feilsøking finst i [mobil.md](mobil.md). Knappen *QR-kode til mobilsida*
viser adressa som blir skanna for å opne mobilsida første gongen.

## Gjennomgang før deling

Alt som forlèt appen via pakkar, einingar eller delingsmenyen, blir gjennomgått først, og gjennomgangen gjeld heile fila. Appen leitar etter identitetsnummer, e-postadresser og telefonnummer, både i
heile kolonnar og inne i løpande tekst, og viser det som elles følgjer med utan å synast i tabellen. For kvar del vel du kva som skal skje i kopien.

| Del | Val |
|---|---|
| Kolonne med identitetsnummer, e-post eller telefon | Hald på, pseudonymiser eller fjern. Pseudonymiser tyder at same verdi gjev same kode, men at verdien ikkje kan lesast |
| Løpande tekst, til dømes avsnitta i dokumenta | Hald på, masker treffa eller fjern kolonnen |
| Kantane i grafen og eigenskapane i modellen | Hald på, masker treffa eller fjern i kopien |
| Originalfiler | Hald på eller fjern. Dei kan ikkje pseudonymiserast, så det blir føreslått å fjerne dei når noko anna blir endra |
| Bilete | Hald på eller fjern. Posisjonen blir fjerna for seg, både frå tabellen og frå biletfila |
| Kommentarar og forfattarar i metadataa til dokumenta | Hald på eller fjern |
| Innsamla rader | Kven som samla inn, kan pseudonymiserast, og posisjonen kan fjernast |

Berre kopien som blir delt, blir endra, og datasettet i appen blir som det er. Endrar du noko, følgjer verken endringsloggen eller oppskrifta med, sidan dei kan innehalde dei opphavlege verdiane. Pakkar
blir òg reinsa for restar av fjerna verdiar i sjølve fila.

Gjennomgangen ser ikkje alt. Namn, adresser og innhaldet i originalfiler og bilete må du vurdere sjølv. Ein pakke tek berre med diagram, dashbord og notatbøker for dei valde datasetta.
Personopplysningar i dei, i malar og skript, i dei lagra utdata i notatbøkene og i namn og filnamn på datasetta blir viste under *Det som
følgjer med pakken* og maskerte i kopien om du ikkje vel å behalde dei, fjerne utdata eller utelate fila.

Ei synkronisering til **GitHub** må kunne hentast tilbake slik ho var, så der kan ingenting pseudonymiserast. Appen viser i staden kva som kan vere personopplysningar før du sender. **Publiser** lagar ei
HTML-side med verdiane diagramma viser, så kontroller dei før du legg ut sida.

## Delingsmeny

Den eigne delingsmenyen til datamaskina eller telefonen: send ei fil til e-post, Teams, meldingsappar eller andre appar. Vel
om det valde datasettet skal delast som fil (CSV, Excel, ODS eller JSON) eller om alle datasett skal delast som ein
pakke, og trykk på *Del*. Delingsmenyen for filer finst i Edge og Chrome på Windows og på mobil; i andre nettlesarar
(Firefox) blir fila lagra i staden, og knappen heiter då *Lagre fil*. På ein telefon med Dataspatium Mobil installert kan
filer òg delast *til* Dataspatium frå andre appar; dei hamnar under *Motteke* på mobilsida.

## Publiser

Ei frittståande HTML-fil som fungerer utan Dataspatium og kan leggjast på eit intranett eller sendast: dashbord (med
diagramma innebygde) og dokument frå malar, fylte med det valde datasettet. Publiserte filer inneheld data og
diagram i klartekst; del dei berre med dei som får sjå opplysningane.

**Eit datasett som eiga side.** Under Datasett blir eit datasett ei side i si eiga form: ein tekst å lese, bilete å bla i, eit kart, eit nettverk eller ein tabell å filtrere. Sida hentar ingenting frå nettet og kan sendast som éi fil. Ho går gjennom gjennomgangen først og viser høgst 2 000 rader eller 100 bilete.

## Publisere eit arbeidsområde

*Publiser arbeidsområdet* lagar ein nettstad av heile arbeidsområdet eller eit utval, til eit intranett eller å sende. Det blir ei
ZIP-fil med ei startside og ei side for kvart datasett, dashbord og dokument, med søk i tabellar og ei kodebok under kvart datasett.
Sidene kan berre lesast, heng saman med relative lenkjer og hentar ingenting frå nettet.

Datasetta går gjennom kontrollen og blir viste frå kopiar. Dashbord og dokument blir teikna ut frå datasetta slik dei er, så der får
du vite kva dei inneheld, og vel sjølv om dei skal vere med.

## Til CDE

Fana *Til CDE* sender eit datasett til eit prosjekt på ein OpenCDE-tenar som Dataregium. Vel tenar, logg inn og vel prosjekt;
vel så om datasettet skal skrivast i eit filformat eller om originalfila skal sendast, og om det skal gå gjennom Documents API,
der den eigne sida til tenaren spør om tittel, versjon og prosjekt og fila deretter blir lasta opp i delar, eller som BCF-dokument, som
berre tek fila. Datasettet blir skrive frå ein kopi som har vore gjennom kontrollen, og originalfiler får same åtvaring som i
pakkane. Eit datasett henta frå tenaren kan sendast som ein ny versjon av dokumentet sitt, og kortet *Frå CDE* i Handter veit det
deretter. Kvar sending blir notert i historikken til datasettet.

*Arbeidsområdepakke* sender ein pakke i staden for eit datasett: pakkedialogen vel datasett og innhald som vanleg, kontrollen
blir gjord, og fila går opp som dokument. Mottakaren ser pakken i fillista til kjelda i Hent og tek han imot med eitt klikk.

## Ta imot

Opne ein pakke frå ei fil (slepp han på flata) eller frå ei nettadresse. Avsendar, melding og endringar blir viste først;
datasett som allereie finst, kan erstattast med versjonen i pakken, elles blir dei hoppa over. Ein tryggingskopi (ZIP frå
*Ta tryggingskopi av arbeidsområdet*) kan òg opnast her, men høyrer heime under Handter, Arbeidsområde.

## Kva som ikkje går

Ein nettlesar kan ikkje vere tenar, så andre kan ikkje hente data frå datamaskina di når ho er av, eller når dei
ikkje er på same nettverk; då passerer ei fil eller ein pakke via delingsmenyen, ei skymappe (den portable mappa
under Handter kan liggje i OneDrive eller Dropbox) eller GitHub. På same nettverk går overføringa direkte mellom
einingane (fana Einingar). `mailto:`-lenkjer kan ikkje bere vedlegg; bruk delingsmenyen eller lagre fila og legg henne
ved.
