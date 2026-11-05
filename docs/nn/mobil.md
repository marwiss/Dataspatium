# Dataspatium Mobil og overføring mellom einingar

Dataspatium Mobil er ei lita side for telefonar og nettbrett som tek imot, viser og sender vidare data frå
Dataspatium. Ho blir køyrd frå nettet (<https://marwiss.github.io/Dataspatium/m/> eller same mappe som appen på ein
eigen webtenar) og kan installerast som app. Heile Dataspatium blir ikkje køyrt på telefonen: mobilsida er ein kurér, ein
mottakar, ein visar og ein vidaresendar.

Overføringa går direkte mellom einingane over det lokale nettverket med WebRTC, utan tenar og utan at data passerer
internett. Datamaskina viser ein QR-kode, telefonen skannar han, og begge viser same kontrollkode. Same teknikk
koplar saman to datamaskiner med kodar som blir limte inn.

## Første gongen: par telefonen

1. På datamaskina: opne *Del → Einingar*, la *Kople til* stå på *Ny eining* og klikk på *Vis QR-kode*.
2. På telefonen: opne kameraet og rett det mot QR-koden. Mobilsida blir opna i nettlesaren (første gongen blir ho henta frå
   nettet; deretter ligg ho i hurtigbufferen på telefonen). Telefonen viser ein kode på 52 teikn.
3. På datamaskina: skriv inn koden frå telefonen i feltet under QR-koden og klikk på *Kople til*. Ei datamaskin med
   kamera vil i ein kommande versjon kunne skanne QR-koden til telefonen i staden.
4. Begge einingane viser no same sekssifra kontrollkode. Stemmer han: klikk på *Par eininga* på datamaskina.
   Telefonen får melding og lagrar òg paringa.

Neste gong held det å velje telefonen under *Kople til* på datamaskina, vise QR-koden og skanne: tilkoplinga
skjer utan nokon kode tilbake. Paringa består av sertifikatet til telefonen og ein løyndom som einingane deler; ho
blir lagra i nettlesaren på begge sider og kan fjernast under *Para einingar* (datamaskina) eller ved å slette
nettstaddata (telefonen).

## Sende frå datamaskina

Under *Send* vel du valde datasett eller alle datasett som pakke, eller filer frå datamaskina. Datasett går
først gjennom gjennomgangen før deling (sjå [dela.md](dela.md)): kolonnar som ser ut til å innehalde
identitetsnummer, e-post eller telefonnummer, kan pseudonymiserast eller fjernast i kopien. Telefonen spør før han tek
imot og viser kontrollkoden ein gong til. Overføringa går i blokker med kontrollsum; blir ho broten, blir ho teken opp att frå
blokkene som allereie har kome fram når de koplar til igjen.

## På telefonen

- **Motteke** listar pakkar og filer med tal på datasett, storleik og avsendar. Ein pakke blir opna med ei liste over
  datasetta sine; eit datasett blir vist som tabell med filter og blading, med første kolonne fast når tabellen blir rulla
  sidelengs.
- **Del vidare** sender pakken eller fila gjennom delingsmenyen på telefonen (e-post, meldingar, skylagring).
- **Send til ei datamaskin** legg pakken i kø: skann QR-koden til den andre datamaskina, så blir han send dit når
  tilkoplinga er oppe. Slik fungerer kurérflyten datamaskin → telefon → datamaskin, òg mellom to nettverk.
- Telefonen kan òg sende eigne filer (*Send filer frå telefonen*) til ei tilkopla datamaskin; dei blir importerte der
  som datasett, eller opna under *Ta imot* om det er ein pakke.
- Appar på telefonen kan dele filer til Dataspatium Mobil gjennom delingsmenyen når mobilsida er installert som
  app; filene hamnar under *Motteke*.
- *Innstillingar* har namnet på telefonen (det datamaskina viser), koden hans og språk.

Eit datasett blir vist i si eiga form: bilete å bla i, dokument å lese, stader som punkt, nodane i ein graf med tal på kantar, kva ein modell består av, og føresegnene i ein plan. Radene ligg under *Radene*.

## Datamaskin til datamaskin

Vel *Anna datamaskin (lim inn kode)* på den eine datamaskina og lim inn koden frå *Vis QR-kode*-visinga på den andre
datamaskina (knappen *Kopier* under QR-koden). Den første datamaskina viser då ein svarkode som blir limt inn på den
andre under *Kode frå eininga*. Deretter fungerer alt som mellom datamaskin og telefon, inkludert paring.

## Samle inn i felt

Eit skjema frå datamaskina hamnar øvst på startsida. Telefonen fyller ut rader utan nett, med bilete og posisjon, og kontrollerer dei med ein gong mot
skjemaet og reglane i datasettet. *Send til datamaskina* fører dei tilbake over same tilkopling. Sjå [insamling.md](insamling.md).

## Krav og avgrensingar

- Einingane må nå kvarandre på nettverket. På heimenettverk og dei fleste kontornettverk fungerer det; nettverk som
  isolerer klientar frå kvarandre (gjestenettverk, somme bedriftsnettverk), stoppar tilkoplinga. Del då
  det eigne nettverket til datamaskina eller telefonen (internettdeling) mellombels.
- Datamaskina treng Edge, Chrome eller Firefox. Telefonen treng ein nettlesar med WebRTC og, for skanning,
  kamera; i Android Chrome blir QR-kodar lesne direkte i sida, i andre nettlesarar blir koden opna via kameraappen eller
  limt inn.
- Telefonen må nå nettet første gongen for å hente mobilsida; deretter fungerer ho utan nettverk bortsett frå
  sjølve overføringa, som går lokalt.
- Ingen data blir sende til nokon tenar. QR-koden inneheld nettverksadressa til datamaskina og ein eingongsnøkkel;
  kontrollkoden vernar mot at nokon andre på nettverket koplar seg på. Par berre einingar du har samanlikna
  kontrollkoden for.
- Ei overføring blir halden i minnet; svært store pakkar (fleire hundre megabyte) kan vere for store for ein telefon.

## Feilsøking

- *Ventar på at eininga koplar til* forsvinn ikkje: einingane er på ulike nettverk, eller nettverket blokkerer
  trafikk mellom dei. Prøv internettdeling frå telefonen og kople datamaskina til henne.
- *Motparten er ikkje eininga koden peikar på*: koden som vart skriven inn, høyrer til ein annan telefon. Skriv han inn
  igjen.
- Kontrollkodane er ulike: kople frå. Nokon andre kan ha skanna koden.
- Loggen nedst på datamaskina viser kvart steg i tilkoplinga.
