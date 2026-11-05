# Innsamling i felt

Med **Innsamling i felt** fyller du ut rader på telefonen, med eller utan nett, med bilete og posisjon. Skjemaet byggjer på kolonnane og
reglane i eit datasett, så ei feil rad blir vist med ein gong der du står. Radene kjem deretter tilbake til datamaskina som ein ny versjon av
datasettet. Bileta blir ei biletsamling, og posisjonane hamnar på kartet.

## Slik går det til

1. I **Hent** vel du *Innsamling i felt* og deretter eit datasett eller *Nytt datasett*.
2. Bestem kva felt telefonen skal spørje om, og trykk på *Send til mobilen*.
3. Kople til telefonen under **Einingar** i Del, og send skjemaet. Telefonen treng nett denne gongen.
4. På telefonen opnar du skjemaet og samlar inn rader. No trengst ikkje nett.
5. Når du er tilbake, trykkjer du på *Send til datamaskina* og skannar koden på datamaskina.
6. Datamaskina viser kva som har kome, og du vel *Legg til*.

## Skjemaet

Kvar kolonne blir eit felt. Du kan slå av ein kolonne, endre etiketten og velje om feltet er påkravd. *Hald på til neste rad* passar for det
som er likt på mange rader, til dømes dato eller område.

Typen til feltet kjem frå kolonnen. Verdietikettar og regelen *tillatne verdiar* blir av seg sjølv ei valliste. Du kan òg skrive val sjølv,
eitt per linje som `verdi` eller `kode = tekst`, eller hente dei med *Hent val frå kolonnen*.

Posisjon og bilete kan vere slått av, valfrie eller påkravde. Bilete blir forminska på telefonen slik at lengste side blir 2048 pikslar, med
mindre du vel noko anna under *Fleire alternativ*.

*Nytt datasett* tek éin kolonne per linje, som `stad` eller `tal: heiltal`.

Før skjemaet forlèt datamaskina, viser appen kva som følgjer med. Det er felt, etikettar, val og reglar, aldri rader.

## Reglane

Telefonen kontrollerer reglane med same SQLite som datamaskina, så ei rad blir vurdert likt begge stader.

- **Blir kontrollerte på telefonen:** intervall, tillatne og forbodne verdiar, mønster, format, lengd, personnummer og andre identitetar,
  samanlikningar mellom kolonnar og frie SQL-vilkår som berre brukar kolonnane i skjemaet.
- **Unike verdiar** blir berre samanlikna med radene på telefonen. Datamaskina kontrollerer mot heile datasettet.
- **Blir berre kontrollerte på datamaskina:** fullstendigheit, verdiar i eit anna datasett og reglar om kolonnar som ikkje er med i skjemaet.

Ein feil i skjemaet, som eit tomt påkravd felt eller ein bokstav i eit talfelt, hindrar at rada blir lagra. Ein broten regel hindrar det éin gong.
Trykkjer du på Lagre igjen, blir rada halden med regelen notert, sidan du som står på staden, kan vite betre enn regelen.

## På telefonen

Skjemaet ligg øvst på startsida i Dataspatium Mobil. *Lagre og ny rad* er den vanlege vegen vidare.

Ei rad du held på med, blir lagra som utkast frå første endring, og bilete blir lagra så snart dei er tekne. Telefonar lukkar nokre gonger sida når
kameraet blir opna. Då tilbyr skjemaet *Hald fram på utkastet* når du kjem tilbake.

Telefonen viser *Fungerer utan nett på denne telefonen* når han har alt han treng. Står det i staden at sida skal opnast ein gong til, gjer det
medan du har nett. Installer gjerne sida på heimeskjermen. Nettlesarar kan elles tømme lagringa for sider som ikkje blir brukte, og på ein iPhone kan
det skje etter ei veke utan bruk.

Rader blir verande på telefonen til du vel *Rydd sende*. Ei send rad kan ikkje endrast på telefonen, berre på datamaskina.

Har du inga tilkopling til datamaskina, kan du bruke *Del som fil* og sende fila på annan måte. Ho blir teken imot under **Ta imot** i Del.

## På datamaskina

Radene kjem via Einingar eller Ta imot, og du ser dei før noko blir lagt til.

- Tabellen blir først lagra som ein versjon, så du kan gå tilbake.
- Kolonnar som manglar, blir lagde til: `falt_id`, `lat`, `lon`, `noggrannhet_m`, `foto`, `insamlad` og `insamlad_av`. Har datasettet allereie
  kolonnar for lengde- og breiddegrad, blir dei brukte.
- Datasettet blir opna som kart i Bearbeid, sidan radene har posisjonar.
- Bileta blir biletsamlinga *Namn: bilete* med posisjonen og tida til rada. Seinare leveransar hamnar i same samling.
- Reglane i datasettet blir køyrde på resultatet, og loggen seier kor mange som blir brotne.

Rader blir kjende att på `falt_id`. Same fil kan difor takast imot to gonger utan at noko blir dobla, men ei rad som er endra på datamaskina,
blir ikkje overskriven.

Finst ikkje datasettet lenger på datamaskina, blir eit nytt føreslått med kolonnane i skjemaet.

## Personopplysningar

Posisjon og bilete er ofte personopplysningar, og eit bilete kan vise menneske. Spør berre om det som trengst, og slå elles av posisjon og bilete.

Telefonen ber om løyve før han gjev ut posisjonen, og sjølve posisjonen blir ikkje send nokon stad før du sender radene. Rader og bilete ligg ukrypterte
i lagringa til nettlesaren på telefonen, så send dei og rydd jamleg.

## Avgrensingar

- Dataspatium Mobil blir køyrd frå ei nettadresse, ikkje frå ei fil, og treng nett første gongen.
- Nøyaktigheita i ein posisjon avheng av telefonen. Feltet `noggrannhet_m` seier kor sikker han er.
- Store innsamlingar blir delte opp i fleire filer, som blir tekne imot kvar for seg.
- Fleire telefonar kan samle inn med same skjema. Kvar telefon har sine eigne rader, og dei blir lagde til kvar for seg.
