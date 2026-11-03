# Visualisoi

Visualisoi-tila tekee aineistoista kaavioita kolmella moottorilla, jotka kaikki käyttävät sovelluksen palettia, fonttia ja
lukumuotoa: kaaviorakentaja (Vega-Lite), valmiit D3-mallit ja R-skriptit (ggplot2). Kaaviot tallennetaan työtilaan, ne voi
viedä SVG-, PNG- ja PDF-muotoon, jakaa tiedostoina ja luoda eräajona ryhmittäin.

## Luo kaavio

1. Valitse aineisto kohdepaneelista ja paina **Uusi kaavio**.
2. Valitse moottori: **Kaaviorakentaja**, **D3-malli** tai **R-skripti**.
3. Anna kaaviolle nimi otsikkokenttään ja paina **Tallenna**. Tallennetut kaaviot näkyvät kohdepaneelin kohdassa Kaaviot ja
   galleriassa.

Esikatselu päivittyy muuttaessasi. Kaavion alla kerrotaan, montako riviä käytettiin; suuret aineistot koostetaan SQL:ssä, kun
kaavio tarvitsee vain summia, keskiarvoja tai lukumääriä, muuten rivien määrää rajataan (oletus 50 000, muutetaan kohdassa
Lisää asetuksia).

## Kaaviorakentaja (Vega-Lite)

| Kaaviotyyppi | Käyttö |
|---|---|
| Pylväät, Vaakapalkit | Luokkien vertailu, valinnainen värijako ja pinoaminen |
| Viiva, Alue | Kehitys ajassa tai järjestetyt luokat |
| Pisteet | Kahden luvun välinen yhteys, väri ja koko lisäulottuvuuksina |
| Histogrammi | Luvun jakauma luokkiin |
| Lämpökartta | Kaksi luokkaa ja arvo värinä |
| Laatikkokuvio | Hajonta luokittain |
| Ympyrä | Osuudet kokonaisuudesta (vähän luokkia) |
| Kartta | Alueet värjättynä arvon mukaan (teemakartta) geometriasarakkeesta, ks. *Kartat* alla |
| Pistekartta | Pisteet pituus- ja leveysasteista (tai SWEREF 99 TM) koko ja väri arvojen mukaan, kunta- tai läänirajojen päällä |

Jokaiselle kanavalle (X, Y, Väri, Koko, Pienet paneelit) valitset sarakkeen, miten se tulkitaan (luku, luokka, järjestetty
luokka, aika), laskelman (summa, keskiarvo, mediaani, pienin, suurin, lukumäärä, erillisten lukumäärä), lajittelun,
aikayksikön ja akselin otsikon. Muut asetukset: otsikko ja alaotsikko, lukumuoto, korkeus, selitteen sijainti, pinoaminen
(pinottu, prosentit, päällekkäin), arvojen selitteet pylväissä ja pisteet viivoilla. **Suodattimet** rajaavat rivejä
sarakkeiden ehdoilla. Kohdassa **Lisää asetuksia** ovat riviraja, väriasteikko (jatkuva tai kaksisuuntainen) ja **Oma
Vega-Lite-määritys**: JSON-määritystä voi muokata suoraan kaikkeen, mitä rakentaja ei kata; data lisätään aineistosta, kun
kaavio piirretään.

Kaavio tallennetaan rakentajan tilana (tai omana määrityksenä) yhdessä aineiston nimen ja lyhytnimen kanssa, joten sen voi
luoda uudelleen uudelle datalle, jossa on samat sarakkeet.

### Akselit ja viivat

Osio **Akselit ja viivat** (kaikki kaaviotyypit paitsi ympyrä ja kartat) ohjaa akseleita ja lisää viivoja. Tyhjät
kentät antavat automaattiset arvot.

| Asetus | Mitä se tekee |
|---|---|
| Arvoakselin pienin ja suurin arvo | Kiinteät rajat arvoakselille (Y, tai X vaakapalkeissa), esimerkiksi 0–100 prosenteille tai sama asteikko useassa kaaviossa. Rajojen ulkopuolelle jäävä osa leikataan pois |
| X-akselin pienin ja suurin arvo | Näkyy, kun X-akseli on luku (pisteet ja viivat), esimerkiksi tietyn välin tarkentamiseen |
| Arvoakselin asteikko | Lineaarinen, logaritminen (arvoille, jotka ulottuvat usean kymmenpotenssin yli; vaatii positiiviset arvot) tai neliöjuuri |
| Arvoakseli alkaa nollasta | Oletuksena käytössä; poista käytöstä, jotta akseli alkaa läheltä pienintä arvoa, esimerkiksi lämpötiloille |
| Selitteiden kulma | Automaattinen, 0°, 45° tai 90° pitkänimisille luokille |
| Apuviivat | Kaavion taustan ruudukko, oletuksena käytössä |
| Vertailuviiva arvon kohdalla | Katkoviiva arvoakselin arvon kohdalla, esimerkiksi tavoite tai valtakunnallinen keskiarvo, valinnaisella tekstillä |
| Trendiviiva | Pisteet ja viivat, joiden X-akselilla on luku: suora (lineaarinen regressio) tai tasoitettu käyrä (loess), yksi väriryhmää kohden |
| Peittävyys | Kuinka peittäviä pisteet, alueet ja palkit ovat (0,05–1), esimerkiksi kun päällekkäisiä pisteitä on paljon |

Vertailu- ja trendiviivoja ei piirretä kaavioihin, joissa on pienet paneelit. Asetukset tallennetaan kaavion mukana,
ja ne kulkevat mukana jaetuissa kaaviotiedostoissa ja eräajoissa.

## D3-mallit

- **Järjestys**: yksi rivi luokkaa kohden arvon mukaan lajiteltuna, pisteellä ja viivalla. Valitse luokka, arvo, laskelma,
  määrä ja järjestys.
- **Kaltevuuskaavio**: kaksi jaksoa luokkaa kohden ja niiden välissä viiva; vihreät viivat kasvavat, punaiset vähenevät.
- **Väestöpyramidi**: ryhmät (ikäryhmät) palkkeina kahteen suuntaan, esimerkiksi naiset ja miehet.

Mallit on kirjoitettu D3:lla sovelluksen tyylimoduulin avulla, ja ne tuottavat vektorigrafiikkaa, joka viedään sellaisenaan.

## R-skriptit

Skripti suoritetaan R-istunnossa niin, että aineisto on ladattuna nimellä `df` (luettu lyhytnimellä). Piirrä ggplot2:lla tai
perusgrafiikalla; `theme_dataspatium()` ja `dm_palette()` antavat sovelluksen ulkoasun. Viimeisin kaavio näytetään ja
tallennetaan skriptin kanssa. Vienti tapahtuu R:n kautta (svglite SVG:lle, `png()` ja `pdf()`), ja eräajot suorittavat
skriptin kerran ryhmää kohden suodatetulla `df`:llä. Ctrl+Enter suorittaa skriptin.

## Vie

**Vie** avaa valintaikkunan, jossa ovat muoto (PNG, SVG, PDF, PowerPoint), leveys, korkeus, PNG:n mittakaava ja tiedostonimi.
PNG piirretään selaimessa sovelluksen fontilla. SVG:hen fontti on upotettu, joten tiedosto näyttää samalta muilla
tietokoneilla. PDF on vektorigrafiikkaa (jsPDF ja svg2pdf.js); teksti ladotaan PDF:n vakiofontilla Helvetica. PowerPoint
(pptx, PptxGenJS:n avulla) tuottaa esityksen, jossa on otsikkodia ja kaavio korkearesoluutioisena kuvana; Vie-tilassa on
lisäksi **Kaikki kaaviot PowerPointina**, yksi dia tallennettua kaaviota kohden. Kaavioita voi viedä myös Vie-tilasta, jossa
kaikki tallennetut kaaviot luetellaan.

## Eräajo ryhmittäin

**Eräajo ryhmittäin** luo kaavion kerran ryhmittelysarakkeen jokaista arvoa kohden (esimerkiksi jokaiselle kunnalle tai
vuodelle) arvon mukaan suodatettuna ja arvo otsikossa, ja pakkaa kaikki tiedostot ZIP-tiedostoon `manifest.json`-tiedoston
kanssa. Valitse sarake, muoto (yksi tai useampi), tiedostonimen kaava (`{diagram}` ja `{grupp}` korvataan), leveys ja ryhmien
enimmäismäärä. Ajon voi peruuttaa. Epäonnistuneet ryhmät luetellaan manifestissa. PowerPoint-muoto tuottaa ZIP-tiedoston
sijaan yhden esityksen, jossa on yksi dia ryhmää kohden.

## Galleria ja paneeli

**Galleria** näyttää kaikki tallennetut kaaviot kortteina pienoiskuvan, aineiston ja ajankohdan kera. Valitse sarakkeiden
määrä ja paina **Piirrä kaikki (paneeli)** piirtääksesi kaaviot rinnakkain. Täältä kaavioita avataan, viedään ja poistetaan.

## Kartat

Kaksi kaaviotyyppiä piirtää karttoja, molemmat ilman karttapalvelinta: **Kartta** (teemakartta: alueet värjättynä arvon
mukaan) ja **Pistekartta** (pisteet koordinaateissa, koko ja väri arvojen mukaan). Ruotsin, Tanskan, Norjan ja Suomen
kuntien ja alueiden rajat tulevat sovelluksen mukana; muiden maiden rajat tuodaan GeoJSON-, shapefile- tai
GeoPackage-tiedostosta.

![Teemakartta väestöstä kunnittain ja pistekartta mittausasemista kojelaudalla](../images/kartor.png)

### Teemakartta (Kartta)

1. Hae rajat: valitse esimerkiksi **Suomen kuntien rajat (Tilastokeskus)** tai **Ruotsin kuntien rajat (SCB)** Nouda-tilan
   luettelosta *Rajat karttoja varten* ja paina **Tuo rajat**, tai tuo omat rajat GeoJSON-, shapefile- tai
   GeoPackage-tiedostosta. Niistä tulee aineistoja, joissa on koodi, nimi ja geometriasarake (`geometry`, GeoJSON pituus-
   ja leveysasteina). Koodit ovat virallisia: nelinumeroiset kuntakoodit Ruotsissa, Tanskassa (DAGI, kuten `0101`;
   Danmarks Statistik kirjoittaa `101`) ja Norjassa, kolminumeroiset Suomessa (kuten `091`; StatFin kirjoittaa `KU091`).
   Jos tilaston koodit poikkeavat, ne voi sovittaa Muokkaa-tilassa toiminnoilla *Täydennä etunollilla* tai *Etsi ja
   korvaa*.
2. Yhdistä arvot rajoihin Muokkaa-tilassa (*Yhdistä aineistoja*) koodin perusteella, jotta aineistossa on sekä `geometry` että
   värjättävä arvo. Vaihtoehtoisesti arvot on jo tuotu geometrian kanssa.
3. Valitse rakentajasta *Kartta*. Geometriasarake löydetään automaattisesti (sarake `geometry`), selite on tekstisarake, joka
   näytetään, kun osoitat aluetta, ja arvo ohjaa väriä sovelluksen jatkuvalla asteikolla (valitse kaksisuuntainen kohdasta
   *Lisää asetuksia* keskiarvon ympärillä vaihteleville arvoille).

Geometriasarakkeessa voi olla GeoJSON- tai WKT-muotoa (`POLYGON((...))`, `POINT(...)` ja muut, myös `SRID=...;`-etuliitteellä),
joten viennit GeoPackagesta, PostGIS:stä ja laskentataulukoista toimivat suoraan.

### Pistekartta

Valitse *Pistekartta* aineistolle, jossa on koordinaatit, esimerkiksi sääasemat tai osoitteet pituus- ja leveysasteineen.
Sarakkeet löydetään nimen perusteella (`longitude`/`latitude`, `lon`/`lat`, `x`/`y`, `öst`/`norr`), ja ne voi vaihtaa.
Metreinä annetut koordinaatit (SWEREF 99 TM) tunnistetaan ja muunnetaan pituus- ja leveysasteiksi. **Koko** ja **Väri**
ottavat arvosarakkeita (tai luokan värille), **Selite** näytetään, kun osoitat pistettä, ja **Tausta** valitsee jonkin
mukana tulevista rajoista tai ei taustaa. Jos aineistossa on alueita pisteiden sijaan, *Muokkaa > Paikkatieto > Keskipiste
geometriasta* antaa jokaiselle alueelle pituus- ja leveysasteen, jolloin arvot voi piirtää kuplina.

### Projektio ja rajat

Projektio valitaan koordinaattien mukaan: metrit (SWEREF 99 TM) piirretään sellaisenaan, Euroopan pituus- ja leveysasteet
transversaalisen Mercator-projektion kautta sen maan ruudukon keskimeridiaanin ympärillä, jossa data sijaitsee (9° itää
Tanskalle, 15° itää Ruotsille ja Norjalle, 27° itää Suomelle), ja muut Mercatorin kautta. Mukana tulevat rajat on
yksinkertaistettu teemakarttoja varten, eivätkä ne sovellu tarkkoihin rajanvetoihin: SCB:n kunta- ja läänirajat (CC0,
versio helmikuu 2026), DAGI 1:500 000 Tanskalle, Kartverketin N1000 Norjalle (rajattu rantaviivaa pitkin, koska Norjan
kunnat ulottuvat muuten merelle) ja Tilastokeskuksen 1:1 000 000 -aluejako Suomelle (ks. `presets/geo/KALLA.md`).
Karttoja viedään, jaetaan, lisätään kojelautoihin ja ajetaan eräajoina kuten muitakin rakentajan kaavioita; kojelautojen
suodattimet toimivat myös kartoissa. Geometriaa sisältävän aineiston voi viedä GeoJSON-muotoon Vie-tilasta.

## Kojelaudat

Kojelauta on nimetty valikoima tallennettuja kaavioita ruudukossa yhteisin suodattimin. Luo sellainen kohdepaneelin
painikkeella **Uusi kojelauta**, anna sille nimi ja valitse tallennetuista kaavioista painikkeella **Lisää kaavio**. Jokaisen
kortin voi leventää (yksi, kaksi tai kolme saraketta), siirtää ylös tai alas, avata rakentajassa tai poistaa kojelaudalta;
ruudukon sarakkeiden määrä ja kuvaus asetetaan ominaisuuspaneelissa. Kaikki muutokset tallennetaan automaattisesti.

**Suodattimet** näyttää sarakkeet, jotka ovat kaikissa kojelaudan kaavioiden käyttämissä aineistoissa (teksti, kokonaisluku,
päivämäärä ja kyllä/ei). Jokaisesta valitusta suodattimesta tulee valitsin kaavioiden yläpuolelle, ja valinta koskee kaikkia
Vega- ja D3-kaavioita kerralla (R-kaaviot näytetään tallennettuina kuvina). Suodattimet lisätään kaavioiden omiin
suodattimiin.

Kojelauta viedään itsenäisenä **HTML**-sivuna (kaaviot upotettuina SVG-kuvina, aktiiviset suodattimet mainittuina),
**PowerPointina** (otsikkodia ja yksi dia kaaviota kohden) tai jaetaan `*.dash.json`-tiedostona, joka sisältää kaavioiden
määritykset. Tuonnissa kaaviot yhdistetään olemassa oleviin samannimisiin kaavioihin samassa aineistossa; puuttuvat luodaan
tiedostosta. Varmuuskopio ja siirrettävä kansio sisältävät kaikki kojelaudat. Kojelautoja voi avata myös komentopaletista
(Ctrl+K) ja viedä Vie-tilasta.

## Kaavioiden jakaminen

**Vie määritys** lataa kaavion `*.viz.json`-tiedostona ilman dataa. Toinen käyttäjä lisää tiedoston toiminnolla **Tuo kaavio
(tiedosto)**; kaavio yhdistetään saman lyhytnimen tai nimen aineistoon kyseisessä työtilassa. Työtilan varmuuskopio
(Hallitse) sisältää kaikki kaaviot tällaisina tiedostoina.

## Rajoitukset

- Kaaviot elävät selaimessa; hyvin suuret aineistot ilman koostamista rajataan rivirajaan.
- PDF käyttää tekstille Helveticaa, ei Interiä.
- R-kaaviot vaativat käynnissä olevan R-istunnon, joten ne viedään vain Visualisoi-tilasta.
- Mukana tulevat rajat on yksinkertaistettu teemakarttoja varten, eivätkä ne ole tarkkoja rajoja.
- PowerPoint-vienti käyttää kaavioista kuvia (PNG), ei muokattavia PowerPoint-kaavioita.
