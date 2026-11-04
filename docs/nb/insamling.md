# Innsamling i felt

Med **Innsamling i felt** fyller du ut rader på telefonen, med eller uten nett, med bilde og posisjon. Skjemaet bygger på et datasetts
kolonner og regler, så en feil rad vises med en gang der du står. Radene kommer deretter tilbake til datamaskinen som en ny versjon av
datasettet. Bildene blir en bildesamling, og posisjonene havner på kartet.

## Slik foregår det

1. I **Hent** velger du *Innsamling i felt* og deretter et datasett eller *Nytt datasett*.
2. Bestem hvilke felt telefonen skal spørre om, og trykk på *Send til mobilen*.
3. Koble til telefonen under **Enheter** i Del, og send skjemaet. Telefonen trenger nett denne gangen.
4. På telefonen åpner du skjemaet og samler inn rader. Nå trengs ikke nett.
5. Når du er tilbake, trykker du på *Send til datamaskinen* og skanner datamaskinens kode.
6. Datamaskinen viser hva som har kommet, og du velger *Legg til*.

## Skjemaet

Hver kolonne blir et felt. Du kan slå av en kolonne, endre etiketten og velge om feltet er påkrevd. *Behold til neste rad* passer for det
som er likt på mange rader, for eksempel dato eller område.

Feltets type kommer fra kolonnen. Verdietiketter og regelen *tillatte verdier* blir av seg selv en valgliste. Du kan også skrive valg selv,
ett per linje som `verdi` eller `kode = tekst`, eller hente dem med *Hent valg fra kolonnen*.

Posisjon og bilder kan være slått av, valgfrie eller påkrevd. Bilder forminskes på telefonen slik at lengste side blir 2048 piksler, med
mindre du velger noe annet under *Flere alternativer*.

*Nytt datasett* tar én kolonne per linje, som `sted` eller `antall: heltall`.

Før skjemaet forlater datamaskinen, viser appen hva som følger med. Det er felt, etiketter, valg og regler, aldri rader.

## Reglene

Telefonen kontrollerer reglene med samme SQLite som datamaskinen, så en rad vurderes likt begge steder.

- **Kontrolleres på telefonen:** intervaller, tillatte og forbudte verdier, mønstre, formater, lengde, personnummer og andre identiteter,
  sammenligninger mellom kolonner og frie SQL-betingelser som bare bruker skjemaets kolonner.
- **Unike verdier** sammenlignes bare med radene på telefonen. Datamaskinen kontrollerer mot hele datasettet.
- **Kontrolleres bare på datamaskinen:** fullstendighet, verdier i et annet datasett og regler om kolonner som ikke er med i skjemaet.

En feil i skjemaet, som et tomt påkrevd felt eller en bokstav i et tallfelt, hindrer at raden lagres. En brutt regel hindrer det én gang.
Trykker du på Lagre igjen, beholdes raden med regelen notert, siden du som står på stedet, kan vite bedre enn regelen.

## På telefonen

Skjemaet ligger øverst på startsiden i Dataspatium Mobil. *Lagre og ny rad* er den vanlige veien videre.

En rad du holder på med, lagres som utkast fra første endring, og bilder lagres så snart de er tatt. Telefoner lukker noen ganger siden når
kameraet åpnes. Da tilbyr skjemaet *Fortsett på utkastet* når du kommer tilbake.

Telefonen viser *Fungerer uten nett på denne telefonen* når den har alt den trenger. Står det i stedet at siden skal åpnes en gang til, gjør det
mens du har nett. Installer gjerne siden på hjemskjermen. Nettlesere kan ellers tømme lagringen for sider som ikke brukes, og på en iPhone kan
det skje etter en uke uten bruk.

Rader blir værende på telefonen til du velger *Rydd sendte*. En sendt rad kan ikke endres på telefonen, bare på datamaskinen.

Har du ingen tilkobling til datamaskinen, kan du bruke *Del som fil* og sende filen på annen måte. Den tas imot under **Motta** i Del.

## På datamaskinen

Radene kommer via Enheter eller Motta, og du ser dem før noe legges til.

- Tabellen lagres først som en versjon, så du kan gå tilbake.
- Kolonner som mangler, legges til: `falt_id`, `lat`, `lon`, `noggrannhet_m`, `foto`, `insamlad` og `insamlad_av`. Har datasettet allerede
  kolonner for lengde- og breddegrad, brukes de.
- Datasettet åpnes som kart i Bearbeid, siden radene har posisjoner.
- Bildene blir bildesamlingen *Navn: bilder* med radens posisjon og tid. Senere leveranser havner i samme samling.
- Datasettets regler kjøres på resultatet, og loggen sier hvor mange som brytes.

Rader kjennes igjen på `falt_id`. Samme fil kan derfor tas imot to ganger uten at noe dobles, men en rad som er endret på datamaskinen,
overskrives ikke.

Finnes ikke datasettet lenger på datamaskinen, foreslås et nytt med skjemaets kolonner.

## Personopplysninger

Posisjon og bilder er ofte personopplysninger, og et bilde kan vise mennesker. Spør bare om det som trengs, og slå ellers av posisjon og bilder.

Telefonen ber om lov før den gir ut posisjonen, og selve posisjonen sendes ingen steder før du sender radene. Rader og bilder ligger ukryptert
i nettleserens lagring på telefonen, så send dem og rydd jevnlig.

## Begrensninger

- Dataspatium Mobil kjøres fra en nettadresse, ikke fra en fil, og trenger nett første gang.
- Nøyaktigheten i en posisjon avhenger av telefonen. Feltet `noggrannhet_m` sier hvor sikker den er.
- Store innsamlinger deles opp i flere filer, som tas imot hver for seg.
- Flere telefoner kan samle inn med samme skjema. Hver telefon har sine egne rader, og de legges til hver for seg.
