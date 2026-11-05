# Dataspatium Mobil og overføring mellom enheter

Dataspatium Mobil er en liten side for telefoner og nettbrett som tar imot, viser og sender videre data fra
Dataspatium. Den kjøres fra nettet (<https://marwiss.github.io/Dataspatium/m/> eller samme mappe som appen på en
egen nettserver) og kan installeres som app. Hele Dataspatium kjøres ikke på telefonen: mobilsiden er en kurer, en
mottaker, en viser og en videresender.

Overføringen går direkte mellom enhetene over det lokale nettverket med WebRTC, uten server og uten at data passerer
internett. Datamaskinen viser en QR-kode, telefonen skanner den, og begge viser samme kontrollkode. Samme teknikk
kobler sammen to datamaskiner med koder som limes inn.

## Første gang: par telefonen

1. På datamaskinen: åpne *Del → Enheter*, la *Koble til* stå på *Ny enhet* og klikk på *Vis QR-kode*.
2. På telefonen: åpne kameraet og rett det mot QR-koden. Mobilsiden åpnes i nettleseren (første gang hentes den fra
   nettet; deretter ligger den i telefonens hurtigbuffer). Telefonen viser en kode på 52 tegn.
3. På datamaskinen: skriv inn telefonens kode i feltet under QR-koden og klikk på *Koble til*. En datamaskin med
   kamera vil i en kommende versjon kunne skanne telefonens QR-kode i stedet.
4. Begge enhetene viser nå samme sekssifrede kontrollkode. Stemmer den: klikk på *Par enheten* på datamaskinen.
   Telefonen får beskjed og lagrer også paringen.

Neste gang holder det å velge telefonen under *Koble til* på datamaskinen, vise QR-koden og skanne: tilkoblingen
skjer uten noen kode tilbake. Paringen består av telefonens sertifikat og en hemmelighet som enhetene deler; den
lagres i nettleseren på begge sider og kan fjernes under *Parede enheter* (datamaskinen) eller ved å slette
nettstedsdata (telefonen).

## Sende fra datamaskinen

Under *Send* velger du valgte datasett eller alle datasett som pakke, eller filer fra datamaskinen. Datasett går
først gjennom gjennomgangen før deling (se [dela.md](dela.md)): kolonner som ser ut til å inneholde
identitetsnumre, e-post eller telefonnumre, kan pseudonymiseres eller fjernes i kopien. Telefonen spør før den tar
imot og viser kontrollkoden en gang til. Overføringen går i blokker med kontrollsum; brytes den, gjenopptas den fra
blokkene som allerede har kommet fram når dere kobler til igjen.

## På telefonen

- **Mottatt** lister pakker og filer med antall datasett, størrelse og avsender. En pakke åpnes med en liste over
  datasettene sine; et datasett vises som tabell med filter og blaing, med første kolonne fast når tabellen rulles
  sidelengs.
- **Del videre** sender pakken eller filen gjennom telefonens delingsmeny (e-post, meldinger, skylagring).
- **Send til en datamaskin** legger pakken i kø: skann den andre datamaskinens QR-kode, så sendes den dit når
  tilkoblingen er oppe. Slik fungerer kurerflyten datamaskin → telefon → datamaskin, også mellom to nettverk.
- Telefonen kan også sende egne filer (*Send filer fra telefonen*) til en tilkoblet datamaskin; de importeres der
  som datasett, eller åpnes under *Motta* hvis det er en pakke.
- Apper på telefonen kan dele filer til Dataspatium Mobil gjennom delingsmenyen når mobilsiden er installert som
  app; filene havner under *Mottatt*.
- *Innstillinger* har telefonens navn (det datamaskinen viser), koden dens og språk.

Et datasett vises i sin egen form: bilder å bla i, dokumenter å lese, steder som punkter, en grafs noder med antall kanter, hva en modell består av, og en plans bestemmelser. Radene ligger under *Radene*.

## Datamaskin til datamaskin

Velg *Annen datamaskin (lim inn kode)* på den ene datamaskinen og lim inn koden fra den andre datamaskinens *Vis
QR-kode*-visning (knappen *Kopier* under QR-koden). Den første datamaskinen viser da en svarkode som limes inn på den
andre under *Kode fra enheten*. Deretter fungerer alt som mellom datamaskin og telefon, inkludert paring.

## Samle inn i felt

Et skjema fra datamaskinen havner øverst på startsiden. Telefonen fyller ut rader uten nett, med bilde og posisjon, og kontrollerer dem med en gang mot
skjemaet og datasettets regler. *Send til datamaskinen* fører dem tilbake over samme tilkobling. Se [insamling.md](insamling.md).

## Krav og begrensninger

- Enhetene må nå hverandre på nettverket. På hjemmenettverk og de fleste kontornettverk fungerer det; nettverk som
  isolerer klienter fra hverandre (gjestenettverk, enkelte bedriftsnettverk), stopper tilkoblingen. Del da
  datamaskinens eller telefonens eget nettverk (internettdeling) midlertidig.
- Datamaskinen trenger Edge, Chrome eller Firefox. Telefonen trenger en nettleser med WebRTC og, for skanning,
  kamera; i Android Chrome leses QR-koder direkte i siden, i andre nettlesere åpnes koden via kameraappen eller
  limes inn.
- Telefonen må nå nettet første gang for å hente mobilsiden; deretter fungerer den uten nettverk bortsett fra
  selve overføringen, som går lokalt.
- Ingen data sendes til noen server. QR-koden inneholder datamaskinens nettverksadresse og en engangsnøkkel;
  kontrollkoden beskytter mot at noen andre på nettverket kobler seg på. Par bare enheter du har sammenlignet
  kontrollkoden for.
- En overføring holdes i minnet; svært store pakker (flere hundre megabyte) kan være for store for en telefon.

## Feilsøking

- *Venter på at enheten kobler til* forsvinner ikke: enhetene er på ulike nettverk, eller nettverket blokkerer
  trafikk mellom dem. Prøv internettdeling fra telefonen og koble datamaskinen til den.
- *Motparten er ikke enheten koden peker på*: koden som ble skrevet inn, tilhører en annen telefon. Skriv den inn
  igjen.
- Kontrollkodene er ulike: koble fra. Noen andre kan ha skannet koden.
- Loggen nederst på datamaskinen viser hvert trinn i tilkoblingen.
