# Tiedostomuodot ja tuonti

## Tuetut tiedostomuodot

| Muoto | Tuonti | Vienti | Huomautus |
|---|---|---|---|
| CSV, TSV, TXT erottimin | Kyllä | Kyllä | Erotin, merkistökoodaus ja otsikkorivi tunnistetaan automaattisesti, ja niitä voi muuttaa |
| Kiinteälevyinen teksti | Kyllä | Ei | Valitse muoto tuontivaiheessa (.fwf- tai .prn-päätteiset tiedostot tunnistetaan). Sarakkeiden alkukohdat löydetään kaikilla riveillä olevista välilyönneistä tai ne annetaan sijainteina |
| Excel xlsx, xlsm, xls, xlsb | Kyllä | xlsx | Valitse taulukko; päivämääristä ja kyllä/ei-arvoista tulee oikeita tyyppejä |
| ODS ja FODS (LibreOffice) | Kyllä | ods | Sama tyyppien käsittely kuin Excelissä |
| Vanhemmat taulukkolaskentamuodot: Excel 2003 XML, SYLK (slk), DIF, dBase (dbf), Lotus 1-2-3 (wk1, wk3, wk4, wks), Quattro Pro (wq1, wq2, wb1, wb2, wb3, qpw) | Kyllä | Ei | Luetaan samalla taulukkolukijalla kuin Excel; valitse taulukko. Excel 2003 XML tunnistetaan sisällöstä, vaikka tiedoston nimi päättyisi .xml |
| Taulukot asiakirjoissa: HTML (html, htm, xhtml), Markdown (md), Word (docx), LaTeX (tex) | Kyllä | Ei | Kaikki tiedoston taulukot näytetään luettelossa otsikon tai kuvatekstin sekä rivien ja sarakkeiden määrän kanssa. Yhdistetyt solut (colspan ja rowspan, Wordin yhdistetyt solut, `\multicolumn`) täytetään kaikille riveille ja sarakkeille, jotka ne kattavat. Otsikkorivi saadaan elementeistä `th` ja `thead`, Markdownin erotinrivistä, Wordin otsikkorivistä tai `booktabs`-viivoista (`\midrule`) |
| KML ja KMZ (Google Earth) | Kyllä | Kyllä | Yksi rivi paikkaa kohden; nimi, kuvaus, kansiopolku, aika ja laajennetut tiedot sarakkeina; pisteistä, viivoista, monikulmioista ja yhdistetyistä geometrioista tulee GeoJSONia |
| GPX (GPS-jäljet) | Kyllä | Kyllä | Valitse taso: reittipisteet, reitit, jäljet (pisteiden määrä ja pituus kilometreinä) tai jälkipisteet (yksi rivi pistettä kohden, aika ja korkeus) |
| TopoJSON | Kyllä | Ei | Jokainen topologian objekti on taso; kaaret puretaan tavallisiksi GeoJSON-geometrioiksi. Tunnistetaan sisällöstä, vaikka tiedoston nimi päättyisi .json |
| JSON | Kyllä | Kyllä | Luettelo objekteja, objekti, joka sisältää luettelon (polun voi antaa), luettelo luetteloita |
| NDJSON, JSON Lines | Kyllä | Ei | Yksi objekti riviä kohden |
| JSON-stat | Kyllä | Ei | Tunnistetaan automaattisesti (`class: dataset`); yksi rivi solua kohden koodein, tekstein ja arvoin |
| SDMX-JSON | Kyllä | Ei | SDMX-JSON 1.0- ja 2.0-datasanomat (esimerkiksi EKP:ltä ja OECD:ltä) tunnistetaan automaattisesti; yksi rivi havaintoa kohden, jokaiselle ulottuvuudelle koodi- ja tekstisarake, ajanjakso, arvo ja attribuutit |
| GeoJSON | Kyllä | Kyllä | Yksi rivi featurea kohden; ominaisuuksista tulee sarakkeita, geometriasta tekstisarake GeoJSON-muodossa, jonka karttakaavio piirtää (kartta lukee myös sarakkeessa olevaa WKT-tekstiä, esimerkiksi CSV:stä). Viennissä geometriasarakkeesta (GeoJSON tai WKT) tulee kunkin featuren geometria ja muista sarakkeista sen ominaisuudet |
| Shapefile (ZIP, jossa shp, dbf, prj, cpg, tai pelkkä shp) | Kyllä | Ei | Attribuuteista tulee tyypitettyjä sarakkeita dbf-rakenteen mukaan, geometriasta GeoJSON sarakkeeseen `geometry`. Valitse taso, jos ZIP-tiedostossa on useita, ja yksinkertaista geometriaa toleranssilla karttayksiköissä. Koordinaatit säilytetään |
| XML | Kyllä | Kyllä | Yksi rivi toistuvaa elementtiä kohden (valitaan tuontivaiheessa); attribuuteista ja alielementeistä tulee sarakkeita, sisäkkäiset elementit saavat pistenimiä kuten `lage.lan` |
| SQLite | Kyllä | Kyllä | Dataspatiumin oma tiedosto palautetaan tyyppeineen, selitteineen ja historioineen; muista tietokannoista valitset taulun, ja tyypit otetaan rakenteesta |
| SQL-skripti (sql) | Kyllä | Ei | Skripti, jossa on `CREATE TABLE`- ja `INSERT`-lauseita, esimerkiksi tietokantavedos, ajetaan tyhjässä SQLite-tietokannassa, ja taulut tarjotaan valittaviksi. MySQL:n omat rivit (`SET`, `LOCK TABLES`, `USE`, `/*!…*/` ja taulujen asetukset kuten `ENGINE=`) poistetaan ensin; muut murteet toimivat siltä osin kuin ne noudattavat SQLiten syntaksia |
| GeoPackage (gpkg) | Kyllä | Kyllä | Tasot (feature- ja attribuuttitaulut) valitaan tauluina; geometriasarakkeesta tulee GeoJSON, jonka karttakaavio piirtää, ja koordinaattijärjestelmä näytetään |
| Access (mdb, accdb) | Kyllä | Ei | Luetaan suoraan selaimessa mdb-readerilla; taulu valitaan Asetukset-vaiheessa ja tyypit tulevat Accessista. Kyselyt, linkitetyt taulut ja salasanat vaativat [tietokantasillan](kallor.md). |
| Asiakirjat: PDF, Word (docx), OpenDocument (odt), Markdown (md), teksti (txt) | Kyllä | Ei | Tulee asiakirjakokoelmaksi, jossa on yksi kappale riviä kohti (asiakirja, sivu, kappale, tyyppi, teksti, merkit); useista tiedostoista kerralla tulee yksi kokoelma, ja alkuperäiset kulkevat mukana. Katso [dokument.md](dokument.md) |
| Kuvat: JPEG, PNG, WebP, GIF, BMP, AVIF | Kyllä | Ei | Tulee kuvakokoelmaksi, jossa on yksi rivi kuvaa kohti (mitat, koko, päivämäärä, kamera ja sijainti EXIF-tiedoista); esikatselukuva ja pienoiskuva tallennetaan, alkuperäisiä ei. Katso [dokument.md](dokument.md) |
| BCF (bcf, bcfzip) | Kyllä | Kyllä | BCF-XML 3.0. Asioista tulee taulukko, kommenteista ja viewpoint-komponenteista taulukot sen viereen; tilannekuvat eivät tule mukaan. Projektin asioiden vienti mallinäkymän Asiat-paneelista |
| QGIS-projekti (qgs, qgz) | Kyllä | Ei | Tulee karttanäkymäksi Visualisoi-tilaan projektin tasojärjestyksen, näkyvyyden ja symbolien (värit, viivanleveydet, pistekoot) kanssa; tasot yhdistetään samannimisiin aineistoihin, ja mukana tulevat datatiedostot tuodaan. Katso [kartor.md](kartor.md) |
| SPSS sav, zsav, por | Kyllä | sav | R-paketin haven kautta. Muuttujaselitteistä tulee sarakeselitteitä ja arvoselitteistä sarakkeen metatietoja (ks. alla) |
| Stata dta | Kyllä | dta | havenin kautta. Arvoselitteet kuten SPSS:ssä. Viennissä sarakkeiden nimet lyhennetään Statan sääntöjen mukaan (32 merkkiä, ASCII) |
| SAS sas7bdat, xpt | Kyllä | Ei | havenin kautta |
| PX (PC-Axis, Pohjoismaiden tilastovirastojen käyttämä) | Kyllä | Ei | R-paketin pxR kautta; merkistökoodaus luetaan tiedoston CODEPAGE- tai CHARSET-kentästä. Tuloksena on pitkä taulukko, jossa on yksi arvosarake |
| Parquet | Kyllä | Kyllä | R-paketin nanoparquet kautta; säilyttää tyypit tarkasti |
| RDS, RData | Kyllä | rds | R-objekteja; RData-tiedoston on sisällettävä data.frame |
| Liitetty teksti | Kyllä | | Sarkaimin, puolipistein tai pilkuin erotettu |

Vähintään 64 Mt:n erotinmuotoiset tekstitiedostot luetaan osissa: esikatselu näyttää ensimmäiset rivit tavalliseen tapaan, ja
tuonnissa rivit kirjoitetaan aineistoon tiedostoa luettaessa, joten koko tekstin ei koskaan tarvitse olla muistissa.
Saraketyypit otetaan sarakevaiheesta tai arvataan ensimmäisestä osasta. Edistyminen näytetään luettujen rivien määränä.

Kaikki tiedostomuodot voi noutaa myös verkko-osoitteesta Nouda-tilan kohdassa *Verkko-osoitteesta*, jos palvelin sallii
pyynnöt selaimesta (CORS). Dataspatiumin omat määritystiedostot (API-lähde, kaavio, kojelauta, asiakirjamalli, muistikirja)
tunnistetaan `format`-kentästä ja lisätään suoraan.

R:n kautta kulkevat muodot käynnistävät R-istunnon tarvittaessa (muutama sekunti ensimmäisellä kerralla), eikä niillä ole
esikatselua: R lukee tiedoston ja luovuttaa sen `dm_write()`-funktiolla, joten saraketyypit tulevat R:stä. Kyllä/ei muuttuu
arvoiksi 0/1 SPSS:ssä ja Statassa, joista puuttuu looginen tyyppi.

Arvoselitteet (koodit nimineen, kuten `1 = Mies` ja `2 = Nainen`) kulkevat sarakkeen mukana metatietoina SQLite-tiedostossa
(`_columns.value_labels`). SPSS-, Stata- ja SAS-tiedostoja tuotaessa valitset asetusvaiheessa, näyttääkö sarake selitteet
tekstinä (oletus) vai säilyttääkö se koodit; selitteet tallennetaan kummassakin tapauksessa. Niitä voi asettaa, muuttaa ja
vaihtaa koodeihin Muokkaa-tilassa, ne näkyvät koodikirjassa, välittyvät R:lle `haven::labelled`-muodossa ja kirjoitetaan
.sav- ja .dta-tiedostoihin, jolloin sarake, jossa selitteet ovat tekstinä, saa koodinsa takaisin.

Sovelluksen mukana tulee myös dataa, joka lisätään Nouda-tilassa: esimerkkiaineisto *Väestö kunnittain 2024 (Ruotsi)* ja
karttojen rajat GeoJSON-muodossa pituus- ja leveysasteina: Ruotsin kunnat ja läänit (SCB, CC0), Tanskan kunnat ja alueet
(DAGI), Norjan kunnat ja läänit (Kartverket, CC BY 4.0) sekä Suomen kunnat ja maakunnat (Tilastokeskus, CC BY 4.0).
Lähteet ja lisenssit ovat tiedostossa `presets/geo/KALLA.md`. Mitään ei noudeta verkosta.

**Digitaaliset kaavat** (tyyppi kaava): ruotsalaiset asemakaavat Lantmäterietin kansallisen määrittelyn mukaan
(GeoJSON, `feature:typ`), viitekohteet kansalliselta paikkatietoalustalta, yleiskaavat määrittelyn testiversion mukaan
(GeoJSON) ja Boverketin ÖP-malli (GeoPackage, jossa `innehall_op_*`). Tunnistetaan sisällöstä ja avataan
kaavakarttana; katso [planer.md](planer.md).

**Pohjoismaiset kaavat** (tyyppi kaava): Plandata.dk-GeoJSON (paikalliskaavat, osa-alueet, rakennusalat, kuntakaavan
kehykset), kaavatietomalli (Ryhti-JSON), Skipulagsstofnunin stafrænt skipulag (GeoJSON tai GeoPackage-malli) ja
norjalaiset reguleringsplan/kommuneplan GeoPackage-muodossa (Rp-/Kp-taulut). Tunnistetaan sisällöstä; GeoPackage-tiedostot
saavat valinnan *Koko kaava kaavana*. Katso [planer.md](planer.md).

**Verkot** (tyyppi verkko): GraphML, GEXF, JSON solmuilla ja särmillä (D3, networkx, Cytoscape, Neo4j) ja Cypher-skriptit
(APOC-vienti). Luetaan ja kirjoitetaan; tunnistetaan sisällöstä. Katso [grafer.md](grafer.md).

**Rakennusmallit ja piirustukset** (tyyppi malli): IFC (`.ifc`, `.ifczip`; IFC2X3, IFC4, IFC4X3) ja DXF. Alkuperäinen tiedosto
tallennetaan; rakennusosista, ominaisuuksista ja määristä tulee taulukoita, ja DXF-piirustuksesta SVG. Katso [cad-bim.md](cad-bim.md).

## Merkistökoodaus

Tekstitiedostot tarkistetaan tässä järjestyksessä: tavujärjestysmerkki (UTF-8, UTF-16), UTF-16 ilman BOM:ia (paljon
nollatavuja), puhdas ASCII, ensimmäisen megatavun tiukka UTF-8-tarkistus, muuten Windows-1252. Windows-1252 on yleinen
vanhemmista pohjoismaisista Excel-versioista tallennetuissa tiedostoissa. Koodausta voi aina vaihtaa tuontivaiheessa.

## Erottimet ja desimaalierotin

Erotin arvataan puolipisteen, pilkun, sarkaimen ja pystyviivan joukosta. Pohjoismaiset CSV-tiedostot käyttävät useimmiten
puolipistettä, koska pilkku on desimaalierotin. Desimaalierotin päätetään sarakkeittain: jos pilkkudesimaalit ovat vähintään
yhtä yleisiä kuin pistedesimaalit, valitaan pilkku. Tuhaterottimet (välilyönti, sitova välilyönti, piste pilkkudesimaalien
kanssa) poistetaan.

## Saraketyypit

| Tyyppi | Tunnistetaan | Tallennetaan |
|---|---|---|
| Teksti | Kaikki, mikä ei sovi muuhun, ja kaikki etunollalla alkavat luvut (kuntakoodit, postinumerot, henkilötunnukset) | TEXT |
| Kokonaisluku | `12`, `-3`, `1 234` | INTEGER |
| Desimaaliluku | `1 234,5`, `1.5`, `2,0`, `1.5e3` | REAL |
| Päivämäärä | `2024-01-31`, `31/12/2024`, `31.12.2024`, `31-12-2024` | TEXT, ISO 8601 `VVVV-KK-PP` |
| Päivämäärä ja aika | `2024-01-31 10:05`, `2024-01-31T10:05:00Z`, Excel-päivämäärät kellonajalla | TEXT, `VVVV-KK-PP TT:MM:SS` |
| Kyllä/ei | `ja`, `nej`, `true`, `false`, `yes`, `no`, `sant`, `falskt`, `j`, `n` | INTEGER 0/1 |

Sarake saa tyypin vain, jos kaikki otoksen täytetyt arvot sopivat siihen. Tyhjistä arvoista tulee aina "tyhjä" (NULL). Myös
arvot, joita ei voi tulkita käsin valitsemallasi tyypillä, muuttuvat tyhjiksi.

## Aineiston tiedosto

Jokainen aineisto on SQLite-tiedosto, jossa on taulut `data` (rivit), `_columns` (nimi, tyyppi, selite, alkuperäinen nimi,
kuvaus, yksikkö ja arvoselitteet; kolme viimeistä lisätään, kun vanhempi tiedosto avataan), `_meta` (nimi, lyhytnimi,
kuvaus, aikaleimat, lähde, tuontiasetukset), `_log` (kaikki aineistolle tehty) ja, kun joku on kommentoinut, `_comments`
(aika, nimi, teksti, sarake ja onko kommentti ratkaistu). Tiedoston voi avata R:ssä RSQLitellä, DB Browser for SQLite
-ohjelmassa ja useimmissa muissa työkaluissa.

## Työtilan tiedostot

Varmuuskopiolla (ZIP), siirrettävällä kansiolla (Edge ja Chrome) ja GitHub-repositorion kansiolla on sama rakenne:
`manifest.json` sisältöluetteloineen, `datasets/<id>.sqlite` aineistoa kohden, `charts/<id>.viz.json` tallennettua kaaviota
kohden, `documents/<id>.doc.json` omaa asiakirjamallia kohden, `dashboards/<id>.dash.json` kojelautaa kohden,
`notebooks/<id>.nb.json` muistikirjaa kohden ja `scripts/<id>.script.json` kutakin tallennettua R-skriptiä, SQL-skriptiä tai
regex-kuviota kohden. Paketilla (*Paketti* Jaa-tilassa) on sama rakenne, mutta se sisältää vain valitsemasi. Sen
manifestissa on `kind: bundle`, lähettäjän nimi (`author`), viesti (`message`) ja kunkin aineiston muutokset sen jälkeen,
kun se viimeksi jaettiin tai vastaanotettiin (`changes`), ja paketissa on lisäksi `CHANGELOG.md`, jossa sama ja
ratkaisemattomat kommentit ovat luettavassa muodossa. Kun paketti ladataan, viesti ja muutokset näytetään, ja kaikki jo
olemassa oleva ohitetaan (samalla id:llä olevat aineistot sekä samannimiset kaaviot, kojelaudat, mallit ja muistikirjat),
paitsi aineistot, jotka valitset korvattaviksi paketin versiolla; oma versiosi tallennetaan silloin kohtaan *Versiot*. Kun
automaattinen tallennus on käytössä, muuttuneet aineistot kirjoitetaan siirrettävään kansioon pian jokaisen tallennuksen
jälkeen ja poistettujen aineistojen tiedostot poistetaan. Kansion voi ladata toisella tietokoneella samalla tavalla kuin
paketin.

Manifestissa on versiosta 2.0 alkaen `format: 2`: jokaisella luettelon aineistolla on `id`-, `name`- ja
`shortName`-kenttien lisäksi `folder` (kansio, kuten `Talous/2026`, tai tyhjä) ja `tags` (luettelo). Vanhemmat
paketit ja varmuuskopiot (ilman `format`-kenttää) luetaan kuten ennen. Kansio ja tunnisteet ovat myös aineiston
omassa tiedostossa (`_meta`), joten ne kulkevat mukana minne tahansa tiedosto päätyy, samoin kuin `kind` (`table`,
`graph`, `document`, `images`, `model`).

`_log`-taulun riveillä on aikaleima, toimintotyyppi ja yksityiskohdat JSON-muodossa. Toimintotyyppejä ovat muun muassa
`import`, `op` (reseptin vaihe, jossa `op`, `params`, `result` ja `description`; nämä rivit muodostavat reseptin), `undo`,
`snapshot`, `restore`, `comment` (uusi kommentti), `shared` ja `received` (kun aineisto jaettiin tai vastaanotettiin
paketissa tai GitHubista; seuraavan paketin muutosloki alkaa niistä viimeisimmän jälkeen). Hallitse-tila näyttää rivit
luettavana tekstinä. Muokkaa-tilan reseptin vienti perustuu `op`-riveihin, ks. [bearbeta.md](bearbeta.md).
