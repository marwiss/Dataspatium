# Hae

Hae-tila löytää ja listaa ilman koodia. Se sijaitsee Hallitse- ja Muokkaa-tilojen välissä: ensin löydät etsimäsi,
sitten muokkaat sitä. Kolme välilehteä: *Hae* (vapaa teksti ja fasetit), *Kysely* (visuaalinen kyselyrakentaja
yhdelle tai useammalle aineistolle, joka näyttää luomansa SQL:n) ja *Listat* (tallennetut haut ja kyselyt).

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

**Avaa osuma** siellä, missä se on. Tarkastimen painike vie oikealle sivulle asiakirjassa, oikeaan kuvaan kokoelmassa, solmuun naapureineen graafissa, elementtiin mallissa, kohteeseen kaavassa, paikkaan kartalla tai riville taulukossa.

## Kysely

Kysely-välilehti rakentaa kyselyn ilman, että kirjoitat SQL:ää, ja näyttää luomansa SQL:n. Kortti **Aineistot**
valitsee kyseltävän aineiston ja yhdistää siihen lisää valinnalla *Lisää yhdistäminen*: valitse aineisto, otetaanko
mukaan vain rivit, joille löytyy vastine molemmista, vai kaikki ensimmäisen rivit, ja mitkä sarakkeet vastaavat
toisiaan (avaimia voi lisätä; yhdistettävillä aineistoilla on oltava lyhytnimi). **Sarakkeet** valitsee, mitä
näytetään, arvona tai laskentana (lukumäärä, erillisten lukumäärä, summa, keskiarvo, pienin, suurin) ja
halutessasi nimen tuloksessa; jos mukana on laskenta, rivit ryhmitellään automaattisesti muiden sarakkeiden mukaan.
**Ehdot** lisätään ryhmiin, joissa kaikkien ehtojen on täytyttävä tai yksi riittää (on, ei ole, on suurempi kuin,
on vähintään, on pienempi kuin, on enintään, sisältää, alkaa, on jokin, on välillä, on tyhjä, ei ole tyhjä), ja
**Lajittelu ja määrä** viimeistelevät. *Suorita kysely* näyttää tuloksen taulukkona ja luodun SQL:n sen alla;
*Avaa Analysoi-tilassa* vie SQL:n SQL-konsoliin, jossa sitä voi muokata edelleen. SQL:ssä ensimmäinen aineisto on
`t0` ja yhdistetyt `t1`, `t2` ja niin edelleen.

*Tallenna listaksi* tallentaa kyselyn Listat-välilehdelle, jossa se suoritetaan uudelleen tämän päivän datalla, ja
*Tallenna aineistoksi* tekee tuloksesta uuden aineiston tuloksen sarakkeilla.

## Listat

Lista on aineistoon tallennettu haku: teksti, rajaukset ja osumien määrä, kun se viimeksi suoritettiin. *Suorita*
näyttää tämän päivän osumat Hae-välilehdellä (data voi olla muuttunut listan tallentamisen jälkeen), *Tallenna
aineistoksi* tekee osumista uuden aineiston ja *Poista* poistaa listan. Listat seuraavat aineistoa: jos aineisto
poistetaan, sen listat katoavat.

Listoja käytetään muuallakin. Muokkaa-tilassa taulukon työkalurivin *Lista* valitsee tallennetun haun, joka rajaa
taulukon (merkki näyttää rivien määrän kokonaismäärästä), ja kaaviorakentajassa suodattimien alla oleva *Lista*
valitsee rivit, joihin kaavio perustuu; valinta kulkee kaavion mukana kojelautoihin ja vienteihin ja suoritetaan
uudelleen tämän päivän datalla. Kysely-välilehdeltä tallennetut kyselyt näkyvät SQL:nsä kanssa Listat-välilehdellä
ja suoritetaan Kyselyssä.

## Komentopaletti

Ctrl+K löytää kohteet ja komennot kuten ennenkin. Komento *Hae datasta* avaa Hae-tilan hakukenttä kohdistettuna.

## Näppäimistö

Enter hakukentässä hakee. Fasettien painikkeet ja taulukon rivit tavoitetaan Sarkaimella; rivi avataan
tarkastelupaneeliin Enterillä.
