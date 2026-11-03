# Hae

Hae-tila löytää ja listaa ilman koodia. Se sijaitsee Hallitse- ja Muokkaa-tilojen välissä: ensin löydät etsimäsi,
sitten muokkaat sitä. Versiosta 2.0 alkaen on kaksi välilehteä, Hae ja Listat; välilehti Kysely, visuaalinen
kyselyrakentaja, joka näyttää luomansa SQL:n, tulee versiossa 2.2.

## Hae

Kirjoita sana tai lause hakukenttään, valitse, haetko kaikista aineistoista vai vain valitusta, ja paina Hae (tai
Enter). Kaikista sarakkeista haetaan tyypistä riippumatta, ja jokaisen sanan on löydyttävä jostakin riviltä.
Kirjainkoolla ei ole merkitystä, ei myöskään ä:n ja ö:n osalta. Merkit, joilla on muuten erityismerkitys kuvioissa
(piste, sulkeet, tähti), tarkoittavat tässä vain itseään; kuviohakuun on Regex-välilehti Analysoi-tilassa.

Osumat näytetään aineistoittain lukumäärineen. Jokaisessa kortissa on:

- **Fasetit**: sarakkeille, joissa on vähän eri arvoja osumien joukossa, näytetään yleisimmät arvot lukumäärineen.
  Napsauta arvoa rajataksesi haun siihen; aktiiviset rajaukset näytetään merkittyinä painikkeina, ja ne poistetaan
  napsautuksella. Sarakkeita, joissa jokaisella osumalla on oma arvonsa (nimet, tunnisteet), ei näytetä fasetteina,
  koska ne eivät rajaa mitään.
- **Taulukko**, jossa on ensimmäiset sata osumaa. Napsauta riviä nähdäksesi koko tietueen oikealla olevassa
  tarkastelupaneelissa rivinumeron ja painikkeen *Avaa Muokkaa-tilassa* kanssa.
- **Tallenna listaksi** tallentaa haun (tekstin ja rajaukset) kyseiselle aineistolle Listat-välilehdelle.
- **Tallenna aineistoksi** tekee osumista uuden aineiston samoilla sarakkeilla ja tyypeillä.
- **Avaa Muokkaa-tilassa** valitsee aineiston ja vaihtaa tilaa.

Haku suoritetaan SQLitessä workerissa, joten sivu ei jumitu. Miljoonan rivin aineistossa haku kestää noin sekunnin
sanaa kohden.

## Listat

Lista on aineistoon tallennettu haku: teksti, rajaukset ja osumien määrä, kun se viimeksi suoritettiin. *Suorita*
näyttää tämän päivän osumat Hae-välilehdellä (data voi olla muuttunut listan tallentamisen jälkeen), *Tallenna
aineistoksi* tekee osumista uuden aineiston ja *Poista* poistaa listan. Listat seuraavat aineistoa: jos aineisto
poistetaan, sen listat katoavat.

## Komentopaletti

Ctrl+K löytää kohteet ja komennot kuten ennenkin. Komento *Hae datasta* avaa Hae-tilan hakukenttä kohdistettuna.

## Näppäimistö

Enter hakukentässä hakee. Fasettien painikkeet ja taulukon rivit tavoitetaan Sarkaimella; rivi avataan
tarkastelupaneeliin Enterillä.
