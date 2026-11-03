# Kuusi tilaa

Dataspatium on jaettu kuuteen tilaan, jotka seuraavat työn kulkua tilastotuotannon tapaan (kerää, käsittele, analysoi ja
levitä): Nouda, Hallitse, Muokkaa, Analysoi, Visualisoi, Vie. Kaikilla tiloilla on sama runko: tilanvalitsin ylhäällä,
kohdepaneeli vasemmalla, työalue keskellä, ominaisuuspaneeli oikealla ja loki alhaalla. Paneelit eivät koskaan vaihda
paikkaa. Alt+1 … Alt+6 vaihtaa tilaa. Tyhjä työtila avautuu Nouda-tilaan, työtila, jossa on aineistoja, Hallitse-tilaan.
Oikean yläkulman painikkeet piilottavat paneelit, vaihtavat teeman (vaalea, tumma, järjestelmän mukaan), vaihtavat kielen ja
avaavat ohjeen.

Komentopaletti (Ctrl+K tai suurennuslasi ylhäällä) tavoittaa kaiken yhdestä hakukentästä: vaihda tilaa, avaa aineisto, kaavio
tai kojelauta, suorita muokkaustoiminto valitulle aineistolle, vie, avaa työtila, vaihda teema tai tarkista päivitykset.
Nuolinäppäimet valitsevat, Enter suorittaa ja Esc sulkee; viimeksi suoritetut komennot ovat ylimpänä.

## Nouda

Täällä data tulee sisään: alueelle pudotetut tiedostot, liitetty teksti, verkko-osoitteet ja avoimet rajapinnat.
Tiedostojen tuonti etenee vaiheittain: tiedosto, asetukset esikatseluineen, sarakkeet tyyppeineen, valmis. Muodot: CSV ja muu
erotinmuotoinen teksti, kiinteälevyinen teksti, Excel, ODS, JSON (myös JSON-stat ja GeoJSON), XML, SQLite, GeoPackage,
shapefile sekä R:n kautta SPSS, Stata, SAS, PX, Parquet, RDS ja RData (ks. [format.md](format.md)); R-muodot tuodaan yhdessä
vaiheessa ilman esikatselua. Avointen rajapintojen alla on valmisasetukset Suomen, Ruotsin, Norjan, Tanskan, Islannin,
Grönlannin, Färsaarten ja Ahvenanmaan tilastovirastoille ja useille muille viranomaisille sekä Nordic Statisticsille ja
Eurostatille; luettelon yläpuolella olevat maapainikkeet valitsevat, minkä maiden lähteet näytetään. Omat määritykset
lisätään tiedostosta, ja niitä voi jakaa. Ks. [api-konfiguration.md](api-konfiguration.md).

## Hallitse

Aineistojen koti. Yleiskatsaus metatietoineen, sarakeluettelo, historia aineistolle tehdyistä toimista, versiot, uudelleen
nimeäminen ja lyhytnimi (lyhytnimeä käytetään SQL:ssä, R:ssä ja kaaviotiedostoissa), poistaminen ja uudelleennouto
rajapinnasta (yksi aineisto tai kaikki kerralla). Täällä on myös työtila: käytetyn tallennustilan määrä, pysyvä
tallennustila, varmuuskopiointi ZIP-tiedostoon ja palautus sekä Edgessä ja Chromessa siirrettävä kansio: työtila tallennetaan
tavallisina tiedostoina valitsemaasi kansioon, halutessasi automaattisesti jokaisen muutoksen jälkeen, ja sen voi ladata
toisella tietokoneella. *Jaa paketti* luo ZIP-tiedoston valituista aineistoista, kaavioista, kojelaudoista, malleista ja
muistikirjoista kollegalle, joka lataa sen kohdassa *Palauta ZIP-tiedostosta*.

## Muokkaa

Kaikki, mitä taulukolle tehdään painikkeilla ja valintaikkunoilla: solujen muokkaus suoraan taulukossa, lajittelu,
suodatus ja saraketilastot; toiminnot puhdistukseen (etsi ja korvaa säännöllisillä lausekkeilla, välilyöntien poisto,
kirjainkoko, merkistökoodauksen korjaus, arvon korvaus, puuttuvien täyttö, kaksoiskappaleet, luokkien puhdistus), tyyppeihin
(luvut, päivämäärät, kyllä/ei), rakenteeseen (lasketut sarakkeet, jakaminen ja yhdistäminen, rivien poisto, pivotointi) ja
uusiin aineistoihin (ryhmittely ja koostaminen, yhdistäminen, liittäminen). Datan laatuprofiili osoittaa, mitä kannattaa
korjata, ja laatusäännöt (ei saa puuttua, yksilöllinen, väli, luettelo, kuvio, pituus, SQL-ehto) tarkistavat datan
pyydettäessä raportin kera, ja rikkovat rivit saa omaksi aineistokseen. Kaikki kirjataan resepteiksi, jotka voi kumota, ajaa
toiselle aineistolle ja viedä R- tai SQL-koodina. Versiot tallentavat tilannekuvia, joihin voi palata. Ks.
[bearbeta.md](bearbeta.md).

## Analysoi

Koodi ja tilastot. R-konsoli, jossa on ggplot2, dplyr, tidyr ja muita paketteja, tallennetut skriptit, kaaviot ja niiden
vienti SVG-, PNG- ja PDF-muotoon sekä `dm_read()`/`dm_write()` datan siirtämiseen sovelluksen ja R:n välillä (ks.
[r-guide.md](r-guide.md)). SQL-konsoli valittua aineistoa (`data`) vastaan; muihin aineistoihin viitataan niiden
lyhytnimillä, joten yksi kysely voi yhdistää useita aineistoja join-liitoksella; kyselyt näyttävät tuloksia, jotka voi
tallentaa uutena aineistona, ja muuttavat lauseet kirjataan reseptin vaiheina (ks. [bearbeta.md](bearbeta.md)). Muistikirja
yhdistää tekstiä (Markdown), R:ää ja SQL:ää soluihin, jotka suoritetaan järjestyksessä, ja niistä syntyy raportti HTML-,
Word-, PDF-, Markdown- tai LaTeX-muodossa (ks. [anteckningsbok.md](anteckningsbok.md)). Myöhemmin: tilastolliset mallit ja
mahdollisesti Python.

## Visualisoi

Kaavioita kolmella moottorilla ja yhdellä ulkoasulla: kaaviorakentaja (Vega-Lite), jossa on pylväät, viivat, alueet,
pisteet, histogrammit, lämpökartat, laatikkokuviot, ympyräkaaviot ja kartat (teemakartat GeoJSON- tai shapefile-datasta);
D3-mallit järjestykseen, kaltevuuskaavioihin ja väestöpyramideihin; ja R-skriptit ggplot2:lla. Tallennetut kaaviot voi viedä
SVG-, PNG-, PDF- ja PowerPoint-muotoon, jakaa viz-tiedostoina, näyttää galleriassa ja luoda eräajona ryhmittäin. Kojelaudat
kokoavat tallennetut kaaviot ruudukkoon yhteisillä suodattimilla, ja ne viedään HTML- tai PowerPoint-muotoon. Ks.
[visualisera.md](visualisera.md).

## Vie

Kolme välilehteä. **Data**: CSV (Excelille sovitettu tai vakio), Excel, ODS, JSON, XML, SQLite sekä R:n kautta Parquet, SPSS,
Stata ja RDS. **Kaaviot**: tallennetut kaaviot ja kojelaudat (myös kaikki kaaviot yhtenä PowerPointina) SVG-, PNG- ja
PDF-muodossa, yksitellen tai eräajona ryhmittäin ZIP-tiedostoon. **Asiakirjat**: raportit, koodikirjat ja yhteenvedot
Markdown-malleista paikkamerkeillä HTML-, Word-, PDF-, Markdown- tai LaTeX-muotoon, yksitellen tai eräajona ryhmittäin (ks.
[dokumentmallar.md](dokumentmallar.md)).
