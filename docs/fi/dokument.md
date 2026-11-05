# Asiakirjat ja kuvat

Dataspatium lukee asiakirjat **asiakirjakokoelmina** ja kuvat **kuvakokoelmina**. Asiakirjakokoelma avautuu
lukunäkymänä ja kuvakokoelma galleriana. Pinnan alla molemmat ovat omanlajisiaan aineistoja, joissa on yksi kappale
tai yksi kuva riviä kohti ja tiedostot itse aineistossa, joten kaikki, mikä koskee taulukoita, koskee myös näitä:
suodattimet, Hae, säännöt, reseptit, SQL, R ja Python, vienti, paketit ja jakaminen. Lisäksi Analysoi-tilassa ovat
työkalut **Teksti** ja **Kuvat**, jotka toimivat ilman koodia.

## Asiakirjakokoelmat

| Muoto | Tunnistetaan | Kappaleet | Otsikot | Sivut |
|---|---|---|---|---|
| PDF | .pdf | Tekstirivit kootaan kappaleiksi rivivälin mukaan | Rivit, joiden kirjasinkoko on selvästi sivun tekstiä suurempi | Oikeat sivut |
| Word | .docx | Kappaleet ja taulukkorivit | Kappaletyylit nimeltä Heading, Rubrik, Title | Sivunvaihdot ja Wordin tallentamat sivunvaihdot |
| OpenDocument | .odt | Kappaleet, luettelot ja taulukkorivit | `text:h`-elementit | Pehmeät sivunvaihdot |
| Markdown | .md, .markdown | Tyhjän rivin erottamat lohkot; luettelot yhdellä rivillä | `#`-merkillä alkavat rivit | Kaikki on sivua 1 |
| Teksti | .txt (valitse muoto *Asiakirjat*) | Tyhjän rivin erottamat lohkot | Ei | Kaikki on sivua 1 |

Jokaisessa asiakirjakokoelmassa on sarakkeet `dokument` (tiedostonimi), `sida` (sivu), `stycke` (juokseva
numero asiakirjassa), `typ` (`rubrik`, `stycke` tai `tabell`), `text` ja `tecken` (merkkejä). Taulukoista tulevien
rivien solut erotetaan merkeillä ` | `. Alkuperäiset tiedostot tallennetaan aineistoon, jotta PDF-sivut voidaan
näyttää ja tiedostot ladata uudelleen; ne lasketaan aineiston kokoon Hallitse-tilassa.

PDF-tiedostot luetaan pdf.js-kirjastolla taustasäikeessä, joten sovellus vastaa, kun pitkää raporttia luetaan;
200 sivua kestää noin sekunnin. Skannatut PDF-tiedostot ilman tekstikerrosta eivät anna kappaleita ennen kuin luet ne,
ks. *Tekstin lukeminen kuvista* jäljempänä.

### Tuonti

Pudota yksi tai useampi tiedosto Nouda-tilaan. Useista asiakirjoista kerralla tulee **yksi** aineisto, jossa on
kaikki kappaleet, ja asetusvaihe näyttää tiedostoluettelon, nimen ja edistymispalkin tiedosto kerrallaan (PDF:ssä
sivu kerrallaan). Yksittäinen Word- tai Markdown-asiakirja luetaan myös asiakirjana; jos haluat sen sijaan sen
taulukot, valitse muoto *Taulukot asiakirjoissa*. Tekstitiedosto luetaan CSV:nä, kunnes valitset *Asiakirjat*.
Sarakevaihe ohitetaan, koska sarakkeet ovat annetut. Asiakirjoja voi noutaa samalla tavalla myös verkko-osoitteesta
(Nouda > Verkko-osoite).

## Asiakirjanäkymä Muokkaa-tilassa

Asiakirjakokoelma avautuu Muokkaa-tilassa lukunäkymänä ja Hallitse-tilasta painikkeella *Lue*; sen yleiskatsausvälilehti
luettelee asiakirjat, ja napsautus johonkin niistä avaa juuri sen. Valitse asiakirja ja näkymä: *Sivu kerrallaan*,
*Koko asiakirja* (jatkuva teksti sivumerkeillä, piirretään osissa, jotta pitkäkin raportti avautuu heti) tai PDF:lle
*Sivu kuvana*. Otsikot näytetään otsikoina ja taulukkorivit tasalevyisellä kirjasimella. Napsauta kappaletta, niin
tarkastelupaneeli näyttää sivun, numeron, tyypin ja merkkimäärän sekä painikkeen tekstin kopiointiin; paneelin
yläosassa ovat asiakirjan otsikko, tekijä, sivut, kappaleet ja sanat sekä painike *Lataa alkuperäinen*.

Hakukenttä hakee koko kokoelmasta ja luettelee osumat asiayhteydessään (avainsanat kontekstissa); napsauta osumaa
siirtyäksesi sivulle. *Näytä taulukkona* antaa tavallisen taulukon kaikilla Muokkaa-tilan toiminnoilla, ja *Näytä
asiakirjana* vie takaisin. Aineisto itsessään on aina taulukko: se, mitä teet taulukossa (suodatat, korjaat, poistat
rivejä), näkyy myös lukunäkymässä.

## Teksti-työkalu Analysoi-tilassa

Kun asiakirjakokoelma on valittu, Analysoi saa välilehden **Teksti** (Regexin jälkeen, ennen Muistikirjaa), jossa on
neljä työkalua. Jokaisen tuloksen voi tallentaa uudeksi aineistoksi painikkeella *Luo aineisto*, ja koko kokoelman
sijaan voi valita yhden asiakirjan.

| Työkalu | Mitä se tekee | Asetukset |
|---|---|---|
| Yleiskatsaus | Sivut, kappaleet, otsikot, taulukkorivit, sanat, merkit, eri sanat ja sanaston vaihtelu (type/token-suhde) asiakirjaa kohti | |
| Sanafrekvenssi | Yleisimmät sanat määrän, osuuden ja asiakirjamäärän kanssa | Hukkasanojen kieli (ruotsi, tanska, norja, suomi, islanti, englanti), omat hukkasanat, sanan vähimmäispituus, laske luvut, näytettävien määrä |
| Avainsanat kontekstissa | Kaikki sanan tai ilmauksen esiintymät tekstin kanssa ennen ja jälkeen, asiakirja ja sivu | Kokonaiset sanat, erota isot ja pienet kirjaimet, säännöllinen lauseke |
| Yhteisesiintymät | Sanaparit, jotka esiintyvät yhdessä samassa kappaleessa tai muutaman sanan etäisyydellä | Ikkuna, hukkasanat, sanan vähimmäispituus |

Sanat ovat kirjainten ja numeroiden jonoja, joiden sisällä voi olla yhdysmerkkejä ja heittomerkkejä (`e-posti`,
`don't`), ja ne lasketaan pienillä kirjaimilla. Hukkasanalistat ovat lyhyitä kieliopillisten sanojen listoja; poista
valinta laskeaksesi kaikki sanat. Samoja tekstejä voi analysoida edelleen R:llä ja Pythonilla: `dm_read("nimi")`
antaa kappaletaulukon data.framena tai DataFramena.

## Kuvakokoelmat

Kuvista (JPEG, PNG, WebP, GIF, BMP ja AVIF, kun selain osaa lukea ne) tulee kuvakokoelma, jossa on yksi rivi
kuvaa kohti: `fil`, `typ`, `storlek` (tavua), `bredd`, `hojd`, `datum`, `kamera`, `lon`, `lat`, `altitud` ja
`beskrivning`. Päivämäärä, kamera, sijainti ja kuvaus luetaan JPEG-tiedostojen EXIF-tiedoista; muut muodot saavat
vain mitat ja koon. Esikatselukuva (pitkä sivu enintään 1600 px) ja pienoiskuva (320 px) tallennetaan aineistoon;
alkuperäisiä ei tallenneta, jotta satojen kuvien kokoelma pysyy selaimessa hallittavana. Pudota kaikki kuvat
kerralla Nouda-tilaan, niin niistä tulee yksi kokoelma.

Sijainnit voi piirtää Visualisoi-tilan karttakaavioon (lon ja lat koordinaatteina), ja päivämäärät toimivat kuten
kaikki muut päivämäärät suodattimissa, Kyselyssä ja kaavioissa.

## Galleria Muokkaa-tilassa

Kuvakokoelma avautuu Muokkaa-tilassa galleriana, jossa on pienoiskuvat, suodatin ja järjestys (tiedostonimi,
päivämäärä, koko), ja Hallitse-tilasta painikkeella *Näytä kuvat*; sen yleiskatsausvälilehti näyttää ensimmäiset
pienoiskuvat, ja napsautus johonkin niistä avaa sen galleriassa. Napsauta kuvaa, niin tarkastelupaneeli näyttää
suuremman esikatselukuvan, tyypin, koon, mitat, päivämäärän, kameran, sijainnin ja korkeuden sekä kuvauksen, jota voi
muokata ja tallentaa: muutos kirjataan reseptivaiheena kuten muutkin solumuutokset, ja sen voi kumota.
Kaksoisnapsauta nähdäksesi kuvan suurena tai lataa esikatselukuva tietokoneelle. *Näytä taulukkona* antaa taulukon
kaikilla toiminnoilla.

## Kuvat-työkalu Analysoi-tilassa

Kun kuvakokoelma on valittu, Analysoi saa välilehden **Kuvat**, jossa on kaksi työkalua:

- **Yleiskatsaus**: määrä, koko, kuvapisteet, kuinka monella kuvalla on päivämäärä, kamera ja sijainti, ajanjakso
  sekä jakauma tyypin, kameran, vuoden tai kuukauden mukaan, jonka voi tallentaa aineistoksi.
- **Kaksoiskappaleet**: jokainen pienoiskuva muunnetaan 8 × 8 ruudun harmaasävykuvaksi; keskiarvoa vaaleammat ruudut
  saavat arvon yksi ja antavat 64 bitin tiivisteen. Kuvat, joiden tiivisteet eroavat enintään valitun bittimäärän
  verran, ryhmitellään: 0 bittiä antaa vain tarkat kopiot, 5 bittiä tavalliset kaksoiskappaleet (eri koko, eri
  pakkaus), 12 bittiä myös rajatut tai värikorjatut versiot ja enemmän vääriä osumia. Ryhmät näytetään
  pienoiskuvina, ja ne voi tallentaa aineistoksi, jossa on tiedosto, ryhmä, etäisyys ja tiiviste.

## Tekstin lukeminen kuvista

Skannatussa PDF:ssä ei ole tekstiä, joten siitä ei tule kappaleita. Asiakirjanäkymä kertoo, montako sivua asia koskee, ja
painike *Lue teksti kuvista* lukee ne tekstintunnistuksella. Valitse kuvien kieli; englanti luetaan aina mukana, koska nimet ja
ammattisanat ovat usein englanniksi. Tekstistä tulee tavallisia kappaleita asiakirjan taulukkoon, joten sitä voi hakea, laskea
ja viedä, ja toiminnon voi kumota. Jos keskeytät, jo luetut sivut säilyvät.

Koneellisesti luetussa tekstissä voi olla virheitä. Siksi sivulla lukee *Koneellisesti luettu teksti* ja lukemisen varmuus, ja
painike näyttää sivun kuvana.

Galleriassa *Lue teksti kuvista* tekee näkyvistä kuvista uuden asiakirjakokoelman, yhden asiakirjan kuvaa kohden. Kuvakokoelma
ei muutu. *Lue teksti kuvasta* tarkastimessa lisää tekstin kuvan kuvaukseen, jossa voit korjata sen ennen tallennusta.

Myös kuvan taulukosta voi tuoda tiedot. Valitse *Liitä* Nouda-tilassa ja sitten *Lue taulukko kuvasta*, tai liitä kuva suoraan
kenttään. Teksti tulee kenttään puolipisteet sarakkeiden välissä. Korjaa se siellä, niin se kulkee sitten tavallisen tuonnin
läpi.

Lukeminen tapahtuu kokonaan selaimessa, eikä mitään lähetetä minnekään. Lukumoottori Tesseract ja kielitiedot eivät tule
sovelluksen mukana: ne haetaan ensimmäisellä kerralla suostumuksellasi kiinteistä osoitteista ja tarkistetaan tarkistussummia
vasten. Sen jälkeen ne ovat selaimessa ja näkyvät kohdassa Komponentit Hallitse-tilassa.

## Kuvat asiakirjamalleissa

Asiakirjamalleissa (Vie > Asiakirjat) tunniste `{{bild "tiedosto.jpg" | bredd: 400}}` lisää kuvan kuvakokoelmasta.
Kuvaa etsitään ensin mallin aineistosta ja sitten kaikista kuvakokoelmista; esikatselukuvaa käytetään ja se
skaalataan annettuun leveyteen (`bredd`, oletuksena enintään 720 px; myös `hojd` voidaan antaa). Tunniste toimii
Wordissa, PDF:ssä, HTML:ssä, Markdownissa ja LaTeXissa kuten `{{diagram}}`, myös eräajoissa.

## Jakaminen ja vienti

Asiakirja- ja kuvakokoelmat ovat tavallisia aineistoja: ne sisältyvät paketteihin, ne voi viedä GitHubiin ja lähettää
toiseen laitteeseen tiedostot mukana. Jakamista edeltävä tarkastus koskee taulukkoa (`text`-sarakkeen tekstiä,
kuvauksia) kuten muissakin aineistoissa. Vienti CSV:hen, Exceliin ja muihin taulukkomuotoihin antaa kappale- tai
kuvataulukon ilman tiedostoja; Dataspatiumin SQLite-tiedosto ja paketit vievät tiedostot mukanaan.

## Rajoitukset

- Koneellisesti luetussa tekstissä voi olla virheitä, varsinkin taulukoissa, käsialassa ja huonoissa skannauksissa.
- Wordin ja OpenDocumentin sivunumerot seuraavat tiedoston sivunvaihtoja ja voivat poiketa siitä, mitä
  tekstinkäsittelyohjelma näyttää.
- EXIF luetaan vain JPEG-tiedostoista. Puhelinten HEIC-kuvat on muunnettava ensin, koska selain ei osaa purkaa niitä.
- Hyvin suurten kokoelmien (tuhansia kuvia tai kymmeniätuhansia sivuja) lukeminen vie aikaa ja tilaa selaimen
  tallennustilasta; jaa ne useiksi aineistoiksi.
