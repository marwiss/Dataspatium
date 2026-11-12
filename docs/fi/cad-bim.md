# CAD ja BIM: rakennusmallit ja piirustukset

Dataspatium avaa IFC-rakennusmallit ja DXF-piirustukset omana aineistotyyppinään. Malli piirretään 3D:nä, rakennusosista
tulee taulukko, ja ominaisuuksia ja määriä voi hakea, laskea ja viedä. Kaikki tapahtuu selaimessa: tiedosto ei koskaan
poistu tietokoneelta. Alkuperäinen tiedosto tallennetaan aineistoon ja kulkee pakettien ja varmuuskopioiden mukana.

## Mallin avaaminen

Pudota `.ifc`-, `.ifczip`- tai `.dxf`-tiedosto Nouda-tilaan. Tiedoston tiedot näytetään (skeema, projekti, ohjelma, kerrokset ja
lukumäärät tyypeittäin), ja *Tuo* luo aineiston. Tuettuja ovat IFC2X3, IFC4 ja IFC4X3 STEP-muodossa. Noin 50 Mt:n mallin tuonti
kestää noin neljännesminuutin, minkä jälkeen se avautuu muutamassa sekunnissa.

## Suuret mallit palvelimelta

Mallin, joka on liian suuri luettavaksi selaimessa, voi hakea Dataregiumista ilman IFC-tiedostoa. Lähteen tiedostoluettelossa kohdassa
*Nouda → OpenCDE* mallilla on painike **Suuri malli**, kun palvelimella on geometriarajapinta (`ifc_geometry`). Valitse
yksityiskohtaisuus: *Koko geometria* antaa rakennusosien verkot, *Laatikot rakennusosaa kohden* vain laatikon kullekin nopeaa yleiskuvaa
varten. Sovellus hakee geometrian binäärisenä glTF:nä, lukee sen taustasäikeessä ja tekee mallitietoaineiston, jossa on rivi rakennusosaa
kohden (id, GlobalId, luokka, nimi ja kerros palvelimen nimetyistä kyselyistä). Geometria tallennetaan tietoaineiston mukana, joten
3D-näkymä, korostus, valinnat ja asiat toimivat kuten tiedostosta luetulla mallilla. Ominaisuudet ja määrät eivät tule mukana, ja se, mikä
tarvitsee IFC-tiedoston, kuten sovelluksen törmäystarkistus ja alkuperäisen vienti, puuttuu; palvelimen törmäystesti ja kyselyt toimivat
tavalliseen tapaan. Hallitse-tilan kortti näyttää *Geometria: Palvelimelta*.

## Malli Muokkaa-tilassa

Malli avautuu 3D-näkymänä, jonka alla on rakennusosien taulukko. Kierrä vetämällä, zoomaa osoitinta kohti vierittämällä ja
siirrä vetämällä oikealla painikkeella tai vaihtonäppäin pohjassa; kosketusnäytöllä yksi sormi kiertää ja kaksi nipistää ja
siirtää. Kaksoisnapsauta rakennusosaa kiertääksesi juuri sen pisteen ympäri. Kehyspainike näyttää kaiken näytetyn; yksittäisiä
kaukana rakennuksesta olevia kohteita ei lasketa mukaan. Lisää tapoja katsoa mallia on kohdassa [Näkymät ja näppäimistö](#näkymät-ja-näppäimistö).

- **Valitse**: napsauta rakennusosaa mallissa tai riviä taulukossa. Valinta seuraa, ja tarkastelija näyttää tyypin, kerroksen,
  materiaalin, luokituksen, ominaisuudet ja määrät sekä geometriasta mitatun pinnan ja tilavuuden.
- **Suodata**: valitse tyyppi tai kerros tai hae nimeä, materiaalia tai ominaisuutta. Taulukko ja malli näyttävät saman valinnan.
- **Näytä taulukkona**: kaikki sarakkeet tavallisena taulukkona ja kaikki Muokkaa-tilan työkalut.
- **Tallenna kaaviona**: näkymästä suodattimineen ja kuvakulmineen tulee kaavio Visualisoi-tilaan.

Geometria lasketaan alkuperäisestä tiedostosta, kun malli avataan istunnossa ensimmäisen kerran, ja sitä käytetään vain
piirtämiseen ja mittaamiseen. Taulukot säilyvät, vaikka tietokoneesta puuttuisi WebGL; silloin 3D-näkymän tilalla näkyy viesti.

### Näkymät ja näppäimistö

- **Näkymäkuutio** kulmassa kääntyy mallin mukana. Napsauta sivua nähdäksesi mallin ylhäältä, edestä, oikealta, takaa,
  vasemmalta tai alhaalta, ja kuution alla olevaa painiketta nähdäksesi sen viistosti ylhäältä. Edestä katsotaan mallin
  Y-akselin suuntaan eli pohjoiseen, kun malli on piirretty pohjoinen ylöspäin. Näkymät näyttävät sen, minkä suodatin näyttää.
- **Ortografinen näkymä**: neliöpainike vaihtaa perspektiivin ja ortografisen näkymän välillä; ortografisessa näkymässä
  rakennusosat eivät pienene etäisyyden mukana. Ylhäältä katsottuna saadaan pohjapiirros ja edestä julkisivu. Kaavio ja
  viewpoint muistavat, mikä näkymä oli käytössä.
- **Leikkaus**: tasopainike avaa leikkauksen tarkastimeen. Vedä itä–länsi-, etelä–pohjoinen- ja korkeussäätimiä leikataksesi pois
  laatikon ulkopuolelle jäävän, tai valitse kerros kohdassa *Leikkaus kerroksen kohdalta* nähdäksesi sen lattiasta 1,2 metrin
  korkeuteen pohjapiirroksena. *Poista leikkaus* näyttää taas kaiken. Leikkaus seuraa kaaviota ja viewpointia, ja toisen ohjelman
  viewpoint näyttää oman leikkauksensa.
- **Sovita merkittyihin** näyttää merkityt rakennusosat, ja **Näytä vain merkityt** piilottaa kaiken muun, jotta voit kiertää
  niiden ympäri; napsauta uudelleen näyttääksesi kaiken.
- **Näppäimistö** toimii, kun 3D-näkymä on aktiivinen: napsauta sitä tai siirry siihen sarkaimella.

| Näppäin | Toiminto |
|---|---|
| Nuolet | siirtävät näkymää |
| Ctrl tai vaihto ja nuolet | kiertävät |
| + ja − | zoomaavat |
| F | sovittaa merkittyihin |
| Home | näyttää kaiken |
| 1–7 | ylhäältä, edestä, oikealta, takaa, vasemmalta, alhaalta, viistosti ylhäältä |
| O | vaihtaa ortografisen näkymän |

## Asiat CDE:stä

OpenCDE-palvelimelta haettu malli, tai mikä tahansa malli kun tällainen palvelin on lähteenä, voi näyttää asiansa: painike
*Asiat* mallinäkymässä avaa tarkastimeen paneelin, jossa ovat projektin BCF-asiat. Tämän mallin rakennusosiin osoittavat
asiat ovat ensin, tilan ja rakennusosien määrän kanssa. Napsauta asiaa, niin rakennusosat merkitään 3D-näkymässä ja paneeli
näyttää kuvauksen, tilannekuvan ja kommentit. Asiat haetaan pyynnöstä eikä niitä tallenneta aineistoon; laskeaksesi niistä
tallenna ne taulukkona Nouda-tilassa. Kun asialla on viewpoint, jossa on kamera, näkymä siirtyy sinne perspektiivisenä tai ortografisena ja leikkauksineen.

Oikeuksien salliessa voit myös kirjoittaa. *Uusi asia* luo palvelimelle asian, jolla on otsikko, tyyppi, tila ja nimikkeet projektin
luetteloista, ja näkymä liitetään viewpointina: kamera (perspektiivinen tai ortografinen) leikkauksineen, tilannekuva ja merkityt rakennusosat komponentteina. Valitussa asiassa
voit kirjoittaa kommentin, vaihtaa tilan ja lisätä nykyisen näkymän uutena viewpointina. *Tallenna BCF-tiedostona* antaa kaikki
projektin asiat kommentteineen, viewpointeineen ja tilannekuvineen BCF-tiedostona, jonka rajapintaa vailla olevat työkalut
voivat avata. BCF-tiedoston voi myös lukea Nouda-tilassa: asioista tulee taulukko, kommenteista ja komponenteista taulukot sen
viereen.

*Väritä tilan mukaan* antaa rakennusosille avoimimman asiansa värin: punainen avoimille, keltainen käynnissä oleville, vihreä
suljetuille, ja selitteen luettelon alle. *Tallenna taulukkona* antaa projektin asiat taulukkona, jossa on rivi kutakin asiaa ja
rakennusosaa kohti (tyyppi, nimi ja kerros mukana), ja Hallitse tunnistaa sen asioiksi: kortti *Asiat* näyttää tilanteen ja luo
koontinäytön *Asioiden tila*, jossa tila, tyyppi, vastuuhenkilö, prioriteetti ja kuukausi ovat yhteisten suodattimien takana, ja
painike *Näytä mallissa* palaa paneeliin. Analysoi-tilan Määrät-välilehden työkalu *Asiat* laskee asiat, avoimet asiat ja
rakennusosat tilan, tyypin, prioriteetin, vastuuhenkilön, rakennusosatyypin tai kerroksen mukaan tällaisesta taulukosta, ja
SQL-aloituskoodi saa kyselyt liitokselle. *Tallenna kaaviona* tallentaa näkymän väreineen mallikaaviona, jonka koontinäytöt,
asiakirjat ja Julkaise näyttävät selitteen kanssa.

Mallin verkko palvelimella piirretään ja siihen kysytään kohdasta *Nouda*, ja painike *IFC-LPG* vie sinut sinne, katso [grafer.md](grafer.md#ifc-lpg-dataregium-palvelimella).

Graafin malli, suhteet ja kyselyt Dataspatiumin puolelta ovat Dataregiumin tiedostossa [ifc-lpg.md](https://github.com/marwiss/Dataregium/blob/main/docs/fi/ifc-lpg.md).

## Taulukot

| Taulukko | Sisältö |
|---|---|
| `data` | Yksi rivi rakennusosaa, tilaa ja kerrosta kohti: id, guid, typ (tyyppi), kategori (byggdel, rum, struktur), namn (nimi), beskrivning, objekttyp, tagg, vaning (kerros), typnamn, material, klassificering, egenskaper (ominaisuudet) ja mangder (määrät) JSON-muodossa |
| `_properties` | Yksi rivi ominaisuutta kohti: id, uppsattning (joukko), namn, varde (arvo), tal (luku), enhet (yksikkö), kalla (objekt tai typ) |
| `_quantities` | Yksi rivi määrää kohti SI-yksiköissä: id, uppsattning, namn, varde, slag (langd, area, volym, vikt, tid, antal), enhet |
| `_entities` | Tiedoston ei-geometriset entiteetit raakoine attribuutteineen: id, typ, attribut |

Ominaisuudet, jotka löytyvät vain rakennusosan tyypistä, lasketaan mukaan ja merkitään `typ`. Määrät muunnetaan metreiksi,
neliömetreiksi, kuutiometreiksi ja kilogrammoiksi projektin yksiköillä. Aukot ja liitäntäportit eivät ole rakennusosia, ja ne
löytyvät vain taulukosta `_entities`.

Taulukoita voi kysellä SQL:llä Analysoi-tilassa:

```sql
SELECT d.vaning, d.typ, count(*) AS antal, sum(q.varde) AS volym
FROM data d JOIN _quantities q ON q.id = d.id
WHERE q.namn = 'NetVolume'
GROUP BY 1, 2 ORDER BY 1, 2
```

R:ssä ja Pythonissa `dm_read()` antaa rakennusosat, `dm_read_properties()` ominaisuudet ja `dm_read_quantities()` määrät.

## Määrät-välilehti Analysoi-tilassa

- **Yhteenveto**: tiedoston tiedot ja sisältö.
- **Määrät**: lukumäärä, pituus, pinta-ala, tilavuus ja paino ryhmiteltynä tyypin, kerroksen, materiaalin, tyypin nimen tai
  luokituksen mukaan. Lähde *Tiedoston määrät* ottaa yhden arvon rakennusosaa ja lajia kohti: netto ennen muita ja brutto
  viimeisenä, jotta seinää ei lasketa kahdesti. Lähde *Mitattu geometriasta* laskee kolmioista ja toimii myös, kun tiedostossa
  ei ole määriä. Pinta on silloin rakennusosan koko pinta, ei esimerkiksi seinän sivupinta-ala.
- **Määräluettelo**: jokainen tiedoston määrän nimi tyypeittäin summineen. Näet tarkalleen, mitä tiedosto ilmoittaa.
- **Ominaisuudet**: mitä arvoja ominaisuudella on ja kuinka monella kunkin tyypin rakennusosalla.
- **Entiteetit**: kuinka monesta kunkin lajin entiteetistä tiedosto koostuu.
- **Ilmastoselvitys**: alustava ilmastoselvitys mallista luokittain ja kerroksittain, katso *Alustava ilmastoselvitys* alla.

Jokaisen tuloksen voi tallentaa aineistona.

## IfcOpenShell sovelluksessa

Sovellus voi lukea, tarkistaa ja muokata IFC-malleja IfcOpenShellillä, samalla kirjastolla, johon Dataregium
perustuu. Se toimii Pythonissa selaimessa, haetaan ensimmäisellä käyttökerralla (noin 13 Mt, komponenttien käyttöluvan jälkeen) ja
tallennetaan sitten selaimeen. Mitään ei lähetetä minnekään; malli ei poistu koneelta.

**Analysoi-tilassa, Määrät-välilehdellä**, IFC-mallilla on viisi työkalua lisää:

- **Validointi** tarkistaa mallin IFC-skeemaansa vasten: attribuutit, tyypit ja viittaukset, valinnaisesti myös skeeman
  säännöt. Löydökset voidaan tallentaa tietoaineistona.
- **Tilarakenne** näyttää projektin, tontin, rakennuksen, kerrokset ja tilat puuna, jossa on elementtien määrä osaa kohti.
- **Ominaisuusjoukot** antaa elementtityypin kaikki ominaisuusjoukot leveänä taulukkona: rivi elementtiä kohti, sarake
  ominaisuutta kohti (`Joukko.Ominaisuus`), valinnaisesti myös määräjoukot.
- **IFC-valinta** hakee elementtejä IfcOpenShellin valintakielellä, esimerkiksi `IfcWall, Pset_WallCommon.FireRating=EI60` tai
  `IfcElement, material=Betoni`.
- **Geometriamitat** mittaa tilavuuden, pinta-alan ja rajauslaatikon elementtiä kohti geometriasta (OpenCASCADE). Hidas
  suurille malleille.
- **IDS-tarkistus** tarkistaa mallin IDS-tiedostoa (buildingSMART Information Delivery Specification) vasten
  ifctesterillä, IfcOpenShellin omalla tarkistimella: valitse .ids-tiedosto, niin saat rivin vaatimusta ja elementtiä kohti,
  tilana hyväksytty, hylätty tai ei sovellettavissa, sekä syyn ja yhteenvedon. Tiedosto pysyy selaimessa. ifctester kulkee
  sovelluksen mukana ilman verkkosovellustaan, joten mitään ei haeta Pythonin itsensä lisäksi.

**Muokkaa-tilassa** mallilla on kaksi toimintoa kohdassa *Toiminnot* (painike on sekä mallinäkymässä että taulukkonäkymässä),
ryhmässä *Malli*:

- **Kirjoita taulukko malliin** kirjoittaa taulukon arvot malliin. Rivit yhdistetään GUID:n perusteella; sarakkeet `Name`,
  `Description`, `ObjectType` ja `Tag` (tai `namn`, `beskrivning`, `objekttyp`, `tagg`) ovat attribuutteja, ja sarakkeet kuten
  `Pset_WallCommon.FireRating` ovat ominaisuuksia (joukko luodaan, jos se puuttuu). Työtapa: tallenna *Ominaisuusjoukot*
  tietoaineistona, muokkaa sitä Muokkaa-tilassa ja kirjoita takaisin.
- **Python mallille** suorittaa funktion `step(model)` IfcOpenShellin API:lla koko mallille.

Molemmat ovat reseptin vaiheita: muutettu malli tulee tietoaineiston uudeksi sisällöksi (alkuperäinen tiedosto vaihdetaan ja
taulukot rakennetaan uudelleen), vaihe kirjataan lokiin ja voidaan kumota, ja alkuperäinen tiedosto on aina nykyinen versio,
kun viet mallin tai lähetät sen CDE:hen.

**Pythonissa** (Analysoi-tilan Python-välilehti ja muistikirjan koodisolut) `dm_ifc("nimi")` avaa mallin `ifcopenshell.file`-oliona.
Apufunktiot `dm_ifc_elements`, `dm_ifc_psets`, `dm_ifc_tree`, `dm_ifc_validate`, `dm_ifc_select` ja `dm_ifc_geometry` antavat
taulukoita, `dm_ifc_set(model, df)` kirjoittaa taulukon malliin ja `dm_ifc_write(model, "nimi")` lähettää mallin sovellukseen
uutena tietoaineistona; katso [Python Dataspatiumissa](python.md). Analysoi-tilan ja Pythonin työkalut eivät koskaan muuta
tietoaineistoa; vain Muokkaa-tilan toiminnot tekevät uuden version.

IfcOpenShell on LGPL-3.0-lisensoitu ja haetaan muuttamattomana kiinnitettyinä wheel-paketteina IfcOpenShellin omasta
luettelosta, katso [Lisenssit](licenser.md).

## Validoi malli

Hallitse-tilan kortti **Validoi malli** kokoaa IFC-mallin tarkistukset ja kunkin viimeisimmän tuloksen.

- **Palvelimen tarkistus** on mallilla, joka on haettu asiakirjaversiona CDE:stä. Dataregium (3.0.0:sta alkaen) tarkistaa jokaisen
  ladatun IFC-tiedoston IFC-skeemaa vasten ja, kun palvelimelle on asennettu ne, buildingSMARTin sääntöjä (ifc-gherkin-rules)
  vasten, ja tallentaa tuloksen version metatietoihin. *Hae palvelimen tarkistus* lukee sen: ei löydöksiä, vain varoituksia, löydöksiä
  myös virheineen, odottaa tarkistusta tai ei voitu tarkistaa, sekä milloin ja millä säännöillä. Sovellus kysyy palvelimelta vasta,
  kun painat painiketta. Jos löydöksiä on, *Näytä löydökset* näyttää palvelimen raportin: löydösten ja virheiden määrän, tehdyt
  tarkistukset ja säännöt, joita ei voitu ajaa, sekä jokaisen löydöksen sääntöineen, instansseineen (`#123`) ja elementin GlobalId:n.
  *Merkitse malliin* merkitsee sitten elementit mallinäkymään Muokkaa-tilassa, ja *Tallenna taulukkona* tallentaa löydökset
  taulukkona, jonka sarakkeet ovat `kind`, `rule`, `severity`, `message`, `step_id`, `global_id` ja `attribute`. Raportti haetaan samalla kirjautumisella osoitteesta, jonka sovellus
  muodostaa itse samalle palvelimelle; metatietojen osoitetta ei koskaan seurata.
- **Projektin IDS-tiedostot**: jos palvelin tarkistaa tiedoston myös projektin IDS-asiakirjoja vasten (jokaisen `.ids`-päätteisen
  asiakirjan uusin versio), raportti näyttää, montako määrittelyä hyväksyttiin, hylättiin tai ei koskenut tiedostoa, ja mitkä hylättiin,
  asiakirjan nimen ja löydösten määrän kanssa. IDS-asiakirja, jota ei voitu lukea, on niiden sääntöjen joukossa, joita ei voitu suorittaa.
- **Se, mihin mikään GlobalId ei ulotu**: jos palvelimen tarkistus graph löytää instansseja, joihin mikään
  GlobalId-tunnisteellinen ei ulotu, raportti näyttää painikkeen *Poista se, mihin mikään GlobalId ei ulotu*. Palvelin ehdottaa
  silloin vahvistuksesi jälkeen muutosjoukkoa, joka poistaa ne; ehdotuksesta tulee asia, joka koetellaan ja hyväksytään kuten
  muutkin, ja versio säilyttää kaiken.
- **Tarkistukset täällä** näyttää sovelluksessa viimeksi ajetun *Validointi*-, *IDS-tarkistus*- ja törmäystarkistustuloksen, ja
  painikkeet avaavat ne Analysoi-tilassa. Tulokset tallennetaan sovelluksen asetuksiin, ei tietoaineistoon.

Löydökset koskevat tiedostoa sellaisena kuin se ladattiin, eikä palvelin koskaan pysäytä tiedostoa niiden vuoksi. Tiedostoa, jonka
löydökset ovat pelkkiä varoituksia, buildingSMARTin validointipalvelu pitää kelvollisena. Jos palvelimella ei ole tällaista
tarkistusta, kortti kertoo, ettei palvelin ole tarkistanut versiota.

## Projektiprofiili

Kortti **Projektiprofiili** lähteen näkymässä kohdassa *Nouda → OpenCDE* näyttää valitun projektin profiilin: projektin
IDS-asiakirjat (projektin tiedostoista ne, joiden pääte on `.ids`) ja projektille valitsemasi bSDD-sanakirjat, jotka tallennetaan
tähän selaimeen palvelinta ja projektia kohden.

- **Kirjoita IDS tekoälyllä** kirjoittaa Information Delivery Specification -määrittelyn sanallisesta kuvauksesta. Valitse
  toimittaja, malli, jota vasten vaatimukset tarkistetaan, ja kuvaile vaatimukset. Tekoäly antaa tiedoston sovellukselle, joka
  tarkistaa sen (ensin muodon, sitten ifctesterillä mallia vasten, Pythonissa selaimessa) ja vastaa korjattavalla virheellä tai
  tuloksella määrittelyä kohden. Se etenee kierros kierrokselta, kunnes tiedosto on ajettavissa, enintään neljä kierrosta, eikä
  vaatimuksia koskaan lievennetä läpimenon vuoksi. Tuloksen voi tallentaa `.ids`-tiedostona tai ladata projektiin asiakirjaksi.
- **Hae bSDD:stä** hakee luokkia buildingSMART Data Dictionarysta, kun olet antanut suostumuksen isännälle
  `api.bsdd.buildingsmart.org`, valituista sanakirjoista tai kaikista; *Sanakirjat* luettelee sanakirjat, jotta voit lisätä ne
  profiiliin. *Muuta tekoälyllä* -tilassa tekoäly voi hakea työkalulla `search_bsdd` ja luokitella rakennusosia työkalulla
  `set_classification`, joka kirjoitetaan `IfcClassificationReference`-viittauksena hyväksymääsi muutosjoukkoon.
  `search_bsdd` hakee vain vapaista sanakirjoista, joiden lisenssi on luettu (IFC 4.3, Uniclass 2015 ja ETIM 10.1), ja kertoo jokaisen
  luokan sanakirjan ja lisenssin, ja `set_classification` kirjoittaa järjestelmän painoksen, julkaisijan ja osoitteen sen
  `IfcClassification`-kohteeseen.

Palvelimen buildingSMART-säännöt näkyvät kortissa *Validoi malli* Hallitse-tilassa; valitse sääntö luettelosta painikkeen *Merkitse malliin*
vieressä, niin vain sen säännön osumat rakennusosat merkitään.

## Törmäystarkistus

Analysoi-tilan (välilehti Määrät) työkalu **Törmäykset** etsii rakennusosat, jotka menevät toistensa sisään tai tulevat liian lähelle
toisiaan. Se toimii samoilla kolmioilla, jotka 3D-näkymä näyttää, omassa säikeessään, eikä tarvitse Pythonia eikä verkkoa.

- **Joukko A ja joukko B** ovat kaikki rakennusosat tai yksi tyyppi, esimerkiksi kanavat palkkeja vastaan. B voi olla samassa mallissa
  tai toisessa saman projektin mallissa, ja silloin mallien on käytettävä samaa koordinaatistoa. Aukkoja ei lasketa.
- **Palvelimella**: Dataregiumista haetulle mallille (3.0.0:sta alkaen, kun palvelimen törmäystarkistus on päällä) *Missä*
  valitsee, laskeeko sovellus itse vai tekeekö palvelin saman tarkistuksen versioille. Palvelin työskentelee jonossa; sovellus
  odottaa ja näyttää raportin kuin omansa, samalla taulukolla, merkinnällä ja BCF-tiedostolla, ja *Lähetä asioina* antaa
  palvelimen tehdä asiat, kullekin oma näkymä. Toisen mallin on silloin oltava saman projektin versio.
- **Leikkaus** laskee parit, joissa toinen elementti ulottuu toiseen toleranssia syvemmälle (2 mm, ellei muuta anneta). Syvyys mitataan
  sen mukaan, kuinka syvälle kulmat ja särmät ulottuvat toiseen elementtiin, joten vain kohtaavia pintoja ei lasketa. *Sisältyminen*
  on elementti, joka on kokonaan toisen sisällä.
- **Vapaa etäisyys** laskee parit, jotka ovat etäisyyttä lähempänä toisiaan (50 mm, ellei muuta anneta), leikkaukset mukaan lukien.

Tulos on taulukko, jossa ovat molempien elementtien id, GlobalId, tyyppi ja nimi, laji, syvyys tai etäisyys millimetreinä ja piste
mallin omissa koordinaateissa. Siitä:

- *Merkitse malliin* merkitsee elementit mallinäkymään Muokkaa-tilassa.
- *Tallenna BCF:nä* tallentaa yhden asian törmäystä kohden BCF-tiedostoon, näkymä pisteeseen ja molemmat elementit merkittyinä ja
  värjättyinä. Kamera ja piste ovat mallin koordinaateissa Z ylöspäin, joten muut BCF-työkalut näyttävät saman paikan.
- *Lähetä asioina* luo asiat suoraan palvelimen projektiin BCF API:n kautta, kun malli on haettu CDE:stä. Siellä kaikki asiakkaat
  näkevät ne, esimerkiksi Bonsai.
- *Luo aineisto* tallentaa taulukon.

Viimeisin tulos näkyy Hallitse-tilan kortissa Validoi malli, ja siitä näkyy, tehtiinkö se sovelluksessa vai palvelimella. Mittaus edellyttää suljettuja pintoja: elementti, jonka pinnat ovat auki
tai rikki, voi antaa epävarmoja syvyyksiä. Kaarevat pinnat on jaettu kolmioihin, joten alle millimetrin toleranssi on epävarma. Elementit, joita 3D-näkymä ei pysty piirtämään, eivät ole mukana, ja tulos kertoo, kuinka monta niitä on; Teklan esimerkkimallissa se koski kaikkia raudoitustankoja.

## Alustava ilmastoselvitys

Työkalu **Ilmastoselvitys** Analysoi-tilassa (Määrät-välilehti) laskee mallista alustavan ilmastoselvityksen: ilmastovaikutuksen
vaiheille A1–A3, A4 ja A5 kg CO₂e luokittain ja rakennuksen kerroksittain. Se on suunnittelun apuväline, ei Boverketiin
rekisteröitävä selvitys.

**Luokka ja kerros.** Jokainen rakennusosa saa yhden Boverketin neljästä luokasta (kantavat rakenneosat – perustukset, kantavat
rakenneosat – muut, vaippa, väliseinät) tai luokan *Ei sisälly* sekä yhden rakennuksen kuudesta kerroksesta Boverketin raportin
2024:26 mukaan: 1 tontti ja perustukset, 2 runko ja muut kantavat rakenteet, 3 vaippa, yläpohja ja julkisivu, 4 talotekniikka,
5 sisäkatot, väliseinät ja sisäpinnat, 6 kiintokalusteet. Säännöt lukevat vain IFC-luokan, PredefinedTypen (rakennusosan tai sen
tyypin) sekä Pset_*Commonin LoadBearingin ja IsExternalin; luokitusjärjestelmää ei lueta. Ne noudattavat Boverketin luetteloa
mukaan kuuluvista rakennusosista: paalut, maarakenteet, talotekniikka, kiintokalusteet, siirrettävät väliseinät, sisäpinnat ja
aurinkosuojaus eivät sisälly; portaat, luiskat ja kaiteet ovat kantavia; sisäkatot, alakatot ja sisäovet kuuluvat väliseiniin.
Sarake *Sääntö* näyttää, mikä ratkaisi.

- **Epävarma**: rakennusosa sisältyy, mutta sen luokka on epävarma, esimerkiksi väliseinä ilman LoadBearingia tai ovi ilman
  IsExternalia. Se lasketaan näytettyyn luokkaan ja näkyy kohdassa *Ratkaistavat*. Ulkoseinä on vaippaa LoadBearingista riippumatta.
- **Ei voida ratkaista**: säännöt eivät kerro, sisältyykö rakennusosa, esimerkiksi proxy-elementti tai aurinkokennot (jotka
  sisältyvät vain, kun ne on integroitu kattoon tai julkisivuun). Sitä ei lasketa ennen kuin olet ratkaissut sen.
- **Johdettu IsExternal**: kun tiedosto ei ilmoita IsExternalia, ovi tai ikkuna saa arvon seinästä, jossa se on. *Johda IsExternal*
  lukee rakennuksen topologian sovelluksen Pythonilla, joka käynnistyy silloin (ensimmäisellä kerralla sen komponentit noudetaan
  suostumuksellasi): kerroksen ulkorajaa pitkin kulkevat seinät ovat ulkoseiniä, ja suljetussa kerroksessa huoneiden muut seinät
  ovat sisäseiniä. Sääntö kertoo, kun arvo on johdettu.
- Koottu rakennusosa, esimerkiksi kattolaatoista koottu katto, lasketaan osissaan, ja osa, jota säännöt eivät voi ratkaista, saa
  kokonaisuutensa luokan.

Kohdassa **Ratkaistavat** valitset luokan kokonaiselle ryhmälle rakennusosia, joilla on sama luokka, tyyppi ja sääntö. Valinta
tallennetaan rakennusosittain (GlobalId) selaimeen, kunnes annat sääntöjen ratkaista uudelleen.

**Määrät.** Tilavuus, pinta-ala ja paino otetaan tiedoston määristä, nettomitat ennen bruttomittoja ja seinän sivupinta-ala. Jos
tiedostossa ei ole määriä, tilavuus lasketaan geometriasta, kun rakennusosa on yksinkertainen pursotus: profiilin pinta-ala kertaa
syvyys (suorakaide, ympyrä, I-profiili, murtoviiva ja muita), myös tyypin esityksen kautta ja ennen leikkausta. Aukkoja ei silloin
vähennetä, ja sarake *Määrän lähde* kertoo sen. Ovet ja ikkunat lasketaan neliömetreittäin mitoistaan. Kerroksellinen rakennusosa
jaetaan materiaaleittain kerrosten paksuuksien mukaan. Muuten rivillä ei ole määrää, eikä sitä lasketa.

**Ilmastotiedot.** *Nouda ilmastotietokanta* noutaa Boverketin ilmastotietokannan (noin 0,9 MB) osoitteesta api.boverket.se API-haun
suostumuksellasi ja tallentaa sen selaimeen; mallista ei lähetetä mitään. Kohdassa *Materiaalit ja resurssit* valitset resurssin
jokaiselle materiaalille. Ehdotukset perustuvat ensin materiaalin IFC-luokkaan (IfcMaterial.Category, esimerkiksi concrete, steel,
wood, glass tai gypsum) ja sitten nimeen; ovia ja ikkunoita ehdotetaan tyypin nimen perusteella. *Hyväksy ehdotukset* tallentaa
ehdotukset valinnoiksesi, jotka koskevat kaikkia malleja. Ilmastovaikutus on massa (tilavuus kertaa tiheys tai pinta-ala kertaa
neliömetripaino) kertaa tietokannan arvot vaiheille A1–A3, A4 ja A5 (hukka). Boverketin mukaan rakennustuotteiden ilmastotiedot on
asetettu varovaisesti, noin 25 prosenttia keskiarvon yläpuolelle; työkalu laskee varovaisella arvolla ja näyttää tyypillisen
pyydettäessä.

Jokaisen näkymän voi tallentaa aineistoksi. Lähde: Boverket, ilmastotietokanta (avoin data, katso [licenser.md](licenser.md)).

## DXF-piirustukset

DXF-tiedostosta tulee taulukko, jossa on yksi piirustusobjekti riviä kohti (tyyppi, taso, väri, pituus, pinta-ala, teksti ja
sijainti), ja SVG-piirustus. Piirustus avautuu Muokkaa-tilassa, jossa zoomataan rullalla tai nipistämällä ja panoroidaan vetämällä; kun piirustus on aktiivinen, nuolet siirtävät, + ja − zoomaavat, Home näyttää kaiken ja F sovittaa merkittyyn objektiin. Taulukon rivi zoomaa objektiinsa. Tasot
kytketään päälle ja pois tarkastelijassa, ja napsautus valitsee objektin ja sen rivin. Määrät-välilehti antaa lukumäärän,
pituuden ja pinta-alan tasoittain ja tyypeittäin.

Viivat, kaaria sisältävät monikulmioviivat, ympyrät, kaaret, ellipsit, splinit, pisteet, tekstit, solidit, 3D-pinnat, lohkot ja
mitoitusten lohkot piirretään. Viivoitusta (HATCH) ei piirretä.

## Vienti

Vie-tila antaa alkuperäisen tiedoston, ominaisuudet ja määrät CSV-muodossa (yksi rivi arvoa kohti) ja piirustuksen SVG-muodossa
taulukon `data` tavallisten muotojen lisäksi. Mallien kaaviot viedään PNG-, SVG- ja PDF-muodossa; 3D-mallista tulee silloin kuva.

## Rajoitukset

- Taulukoita ei voi muokata suoraan. Mallia muutetaan IfcOpenShellin reseptivaiheilla ja *Muuta tekoälyllä* -toiminnolla, jotka
  kirjoittavat IFC-tiedostosta uuden version.
- Malli piirretään alkuperäisestä tiedostosta uudelleen jokaisessa uudessa istunnossa. Sovelluksella kokeiltu 57 Mt:n malli vie 4–6 sekuntia.
- Hyvin suuren mallin ensimmäinen piirto voi lukita sivun hetkeksi, kun näytönohjain vastaanottaa kolmioita.
- Määrät eivät ole minkään säännöstön mukainen määrälaskenta. Tarkista ne lähteestä ennen käyttöä.
- DXF luetaan kaksiulotteisena. DWG on ensin tallennettava DXF-muotoon.

## Uusi malli

Uusi, tyhjä malli luodaan Nouda-tilassa kohdasta *Uusi rakennusmalli*. Valitse skeema (IFC4X3_ADD2 on oletus; IFC4 ja IFC2X3 ovat
ohjelmille, jotka eivät lue uusinta) sekä projektin, tontin, rakennuksen ja ensimmäisen kerroksen nimet. Sovellus kirjoittaa mallin
IfcOpenShellillä sovelluksen Pythonissa, metreinä ja mallin konteksteineen, ja malli läpäisee skeematarkistuksen. Ensimmäisellä
kerralla Python ja IfcOpenShell noudetaan suostumuksen jälkeen.

Mallista tulee tavallinen malliaineisto. Avaa se Muokkaa-tilassa ja rakenna siihen *Muuta tekoälyllä* -toiminnolla, esimerkiksi
”kaksi kerrosta ja 6×4 m:n ruudukko, ulkoseinät ruudukon mukaan”. Sen voi viedä IFC-muodossa ja julkaista Dataregiumiin kuten
muutkin mallit.

## Uusi rakennus briefistä

Kirjoita brief lomakkeeseen *Uusi rakennusmalli* ("kaksikerroksinen talo 12 × 8 m harjakatolla, tiilijulkisivu, sisäänkäynti etelään …")
ja valitse *Rakenna briefistä tekoälyllä*, kun malli on luotu: malli avautuu Muokkaa-tilassa tekoälypaneelin tilassa **Rakenna
briefistä**. Siellä voit liittää valokuvia ja skannattuja piirustuksia (JPEG, PNG tai PDF; pohjapiirustus antaa oikeat mitat, valokuva
ulkonäön, materiaalit ja sen, miten osat liittyvät toisiinsa) tai lisätä kuvakokoelman kuvat, esimerkiksi Dataspatium Mobiililla
otetut. Tekoäly lukee tyhjän mallin, kertoo suunnitelmansa, kysyy paneelissa, kun brief jättää jotakin olennaista auki (pohja,
kerrosten määrä, kerroskorkeus, seinäpaksuudet, materiaalit), ja rakentaa sitten ryhmissä samoilla työkaluilla kuin *Muuta*:
kerrokset ja ruudukko, seinät kerroksittain, laatat, aukot, ominaisuudet ja materiaalit, esikatselulla ja korjauksilla jokaisen ryhmän
jälkeen. Malliin ei kirjoiteta mitään ennen kuin esikatselet ja hyväksyt muutosjoukon tavalliseen tapaan, ja voit täydentää uudella
briefillä samassa tilassa. Kuvat lähetetään toimittajalle briefin mukana toimittajan isännän suostumuksen jälkeen; kuvia näkevä
paikallinen malli pitää kaiken tietokoneella.
Toiminnolla *Tiedot tietoaineistosta* taulukon rivit lisätään briefiin tekstinä: kartalta (Avoin paikkatieto) haettu rakennusala muuttuu
kulmiksi metreinä lounaiskulmasta, jolloin seinät saavat oikeat mitat, ja Dataspatium Mobiilin kenttälomakkeen mitat ja muistiinpanot
muuttuvat riveiksi; kierros puhelimen kanssa voi sitten antaa lisää kuvia ja mittoja, ja briefiä täydennetään samassa tilassa.
Brief ja kuvat voidaan myös viedä palvelimelle mallin aineistoksi, kun malli on haettu CDE:stä: mallin projektin asia *Aineisto*
saa briefin tekstiasiakirjana ja jokaisen kuvan asiakirjana, jotta muut, jotka työstävät mallia omilla asiakasohjelmillaan, näkevät,
mistä se rakennettiin. Painike on *Vie aineisto palvelimelle*.
Paneelin yläosassa ovat *Rakennuksen tiedot* (mikä rakennus, kerrokset, pituus, leveys, korkeus, perustus, katto) ja *Tarkkuus*
(luonnos, pääpiirteet tai yksityiskohtainen): täytä se minkä tiedät, niin se aloittaa briefin ja tekoäly kysyy loput. Sanat ovat
tavallisia, mutta niiden takana ovat ISO 19650:n tietovaatimukset ja level of information need, ja malli on tarkoitettu rakennuksen
ylläpitomalliksi. Jokainen kuva liitetään valokuvana, pohjois-, itä-, etelä- tai länsijulkisivuna, sisätilana tai piirustuksena, ja
valokuva, jonka tiedostossa on sijainti ja ajankohta (EXIF), saa ne kuvatekstiinsä, jotta tekoäly tietää, mitä se näkee. Aineiston
tiedot antavat myös rakennuksen pohjan lounaiskulman kartalla, joten tekoäly sijoittaa mallin työkalulla `set_site` (sijainti, korkeus
ja SWEREF 99 TM), ja valinnalla *Maanpinnan korkeus kulmissa mukaan*, joka näkyy kun Lantmäterietin lähde on lisätty, maanpinnan
korkeuden jokaisessa kulmassa korkeusmallista: verkkokutsu avaimellasi suostumuksen jälkeen.
Kunkin kerroksen seinien jälkeen esikatselu lukee rakennuksen topologian: seinien keskilinjoista muodostuu huoneita, ja kerros on
suljettu, kun seinät rajaavat vähintään yhden huoneen eikä yksikään seinänpää jää avoimeksi; tekoäly korjaa avoimet päät siirtämällä
tai lisäämällä seiniä ennen kuin se lisää laatat. Ulkoseinät ilmansuuntineen antavat tekoälyn yhdistää eteläjulkisivun valokuvan
oikeisiin seiniin (lukutyökalu `get_topology`), ja sama topologia näkyy Tarkista-tilan kortilla *Topologia*.

## Tarkista tekoälyllä

Tekoälypaneelin tila **Tarkista** vertaa olemassa olevan rakennuksen mallia valokuviin vaurioista ja kulumisesta, jotka on otettu
Dataspatium Mobiililla, kameralla tai droonilla, sekä kenttälomakkeen mittoihin. Liitä valokuvat paneelissa julkisivun tai sisätilan
mukaan merkittyinä tai lisää Nouda-tilassa tuodun kuvakokoelman kuvat; valokuva, jonka tiedostossa on sijainti ja ajankohta (EXIF),
saa ne kuvatekstiinsä, ja *Tiedot tietoaineistosta* lisää kenttälomakkeen mitat ja muistiinpanot kysymykseen. Tekoäly lukee mallin
samoilla työkaluilla kuin *Kysy*, etsii elementin, jonka kukin valokuva näyttää, ja kirjaa jokaisesta vauriosta löydöksen, jossa on
otsikko, kuvaus, kunto (hyvä, tyydyttävä, huono tai kriittinen), prioriteetti (matala, keskitaso, korkea tai kiireellinen) ja
suositeltu toimenpide; valokuva, jossa ei näy vauriota, ei tuota löydöstä. Elementin kunto kirjataan ominaisuusjoukkoon Pset_Condition
(arviointipäivä, kunto ja lyhyt kuvaus) muutosjoukossa, jonka esikatselet ja hyväksyt kuten *Muuta*-tilassa, eikä elementtejä luoda,
siirretä tai poisteta. Löydökset luetellaan vastauksen alla, ja *Tallenna löydökset taulukkona* luo uuden aineiston, jossa on yksi
löydös riviä kohti: valokuva, elementti, otsikko, kuvaus, kunto, prioriteetti, toimenpide, päivämäärä ja kuvan sijainti. *Vie
BCF-muodossa* lataa BCF-tiedoston, jossa on yksi asia löydöstä kohti, valokuva näkymän tilannekuvana ja elementti merkittynä, ja kun
malli on haettu palvelimelta, jolle olet kirjautunut, *Luo asiat palvelimelle* luo samat asiat mallin projektiin vahvistuksen jälkeen.
Valokuvat lähetetään toimittajalle kysymyksen mukana toimittajan isännän suostumuksen jälkeen, ja ne lähtevät tietokoneelta uudelleen
vain, kun itse luot asiat palvelimelle.

## Kysy tekoälyltä mallista

Mallinäkymän painike *Kysy tekoälyltä* avaa tarkastelijaan paneelin, jossa esität kysymyksen avoinna olevasta IFC-mallista, esimerkiksi
"mistä ovista puuttuu paloluokka kerroksessa 2?". Tekoälymalli lukee työkaluilla (mallin yleiskuva, kerrokset, elementit luokan, kerroksen,
nimen ja ominaisuuden mukaan, yksi elementti kaikkine ominaisuuksineen, se, mitä olet merkinnyt 3D-näkymässä, sekä Dataregiumista
noudetulle mallille palvelimen nimetyt kyselyt) ja vastaa niillä
elementeillä, joihin se nojaa. *Merkitse n elementtiä* vie vastauksen elementit valintaan, jota 3D-näkymä, taulukko ja muut tilat seuraavat.
Paneeli näyttää jokaisen työkalukutsun ja kulutetut tokenit. Tekoäly voi vain lukea: mitään ei muuteta, tallenneta tai julkaista, ja
seuraava kysymys jatkaa keskustelua.

*Palvelut* lisää pilvipalvelun tai paikallisen mallin: Anthropic Messages tai OpenAI-yhteensopiva rajapinta (OpenAI, Gemini, Ollama, vLLM,
llama.cpp ja muut) osoitteineen, malleineen ja API-avaimineen. Avain säilytetään istunnossa tai salattuna salasanalauseellasi, ei koskaan
selväkielisenä eikä koskaan kysymyksessä. *Käytäntö* ratkaisee, mitä saa kutsua: *Kysy* pyytää suostumuksen palvelua kohden ensimmäisellä
kerralla, *Pilvi* sallii pilvipalvelut ja *Vain paikallinen* sallii vain omalla tietokoneella olevat mallit. Lähetettävää ovat kysymyksesi ja
mallin pyytämät työkaluvastaukset; työkaluvastaukset ovat mallin dataa, eivät koskaan ohjeita, ja ne katkaistaan, kun ne ovat suuria.

## Muuta tekoälyllä

Saman paneelin tila *Muuta* antaa tekoälyn ehdottaa muutoksia malliin, esimerkiksi "luo kaksi kerrosta ja 6×4 m moduuliverkko,
ulkoseinät verkon mukaan, yksi laatta kerrosta kohti ja ovi jokaiseen seinään kerroksessa 1". Tekoäly lukee mallia samoilla työkaluilla
kuin Kysy-tilassa ja kirjoittaa työkaluilla, jotka tekevät kerroksia ja moduuliverkon, seiniä, laattoja, aukkoja ovella tai ikkunalla,
ominaisuuksia, materiaaleja, siirtoja ja poistoja. Työkalu `set_site` asettaa mallin paikan maapallolla: tontin leveys- ja pituusasteen
ja korkeuden, ja EPSG-koodilla, kuten 3006 (SWEREF 99 TM), myös karttamuunnoksen eli mallin origon itä- ja pohjoiskoordinaatteina ja sen
kierron (ei IFC2X3:ssa, josta se puuttuu). Työkalu `create_roof` tekee kerroksen seinille (jos kerrosta ei anneta, ylimmän kerroksen
seinille) harjakaton, aumakaton, pulpettikaton tai tasakaton, jolla on kaltevuus, räystäs ja paksuus: IfcRoof-katon kattolaatoista
(IfcSlab, tyyppi ROOF), yksi kutakin lapetta kohti, seinien ympäröivän suorakulmion tai annetun suorakulmion päälle (muu ääriviiva
korvataan toistaiseksi sitä ympäröivällä suorakulmiolla). Työkalu `create_spaces` tekee seinien rajaamista huoneista tiloja (IfcSpace),
joiden nimet tulevat huoneohjelmasta ja jotka valitaan sisällä olevalla pisteellä tai topologian numerolla; tiloilla on korkeus
seuraavaan kerrokseen, pinta-alat (Qto_SpaceBaseQuantities) ja rajat seiniin sekä niiden oviin ja ikkunoihin. Työkalut eivät muuta
mitään: ne täyttävät muutosjoukon, jonka paneeli luettelee vaihe vaiheelta (mitat metreinä; uudet elementit saavat viitteet new-1,
new-2 …, kunnes tiedosto on antanut niille tunnisteet).

Työkalu `define_type` tekee seinä-, laatta- tai kattotyypin (IfcWallType, IfcSlabType tai kattolaattojen IfcSlabType tyyppiä ROOF),
jolla on materiaalikerrokset metreinä: seinällä oikealta puolelta vasemmalle alusta loppuun päin katsottuna, laatalla ja katolla
ylhäältä alas. Kullekin kerrokselle voi antaa materiaalin luokan (IFC:n suosittelemat: concrete, steel, aluminium, block, brick, stone,
wood, glass, gypsum, plastic ja earth) ja kerroksen tehtävän (kantava, eriste, sisä- tai ulkopinta), mutta vain kun ne tiedetään.
`create_wall`, `create_slab` ja `create_roof` ottavat tyypin: elementti saa tyypin (IfcRelDefinesByType), paksuutensa kerroksista ja
kerrokset sijoitettuina itseensä (IfcMaterialLayerSetUsage: seinän keskitettyinä linjalle, laatan alaspäin yläpinnasta kerroksen
korolla ja kattolaattojen ylöspäin alapinnasta), ja sen PredefinedType on tyypissä. Materiaalit ja yhteiset ominaisuudet kuuluvat
tyypille, ja tekoäly määrittää tyypit ensin. Kun muutosjoukko ajetaan, sen luomat seinät liitetään seiniin, jotka ne kohtaavat
(IfcRelConnectsPathElements): nurkassa paksumpi seinä (yhtä paksuista pidempi) jatkuu nurkan yli ja toinen päättyy sitä vasten, ja
toisen seinän linjalle päättyvä seinä päättyy sen kylkeen, joten nurkkiin ei jää rakoja eikä päällekkäisyyksiä eikä mitään tilavuutta
lasketa kahdesti. Seinien keskilinjat pysyvät piirrettyinä, ja muussa kuin suorassa kulmassa kohtaavat seinät liitetään sellaisinaan.
Lopuksi muutosjoukon luomat tai muuttamat seinät, laatat, katot, ovet ja ikkunat saavat perusmäärät (Qto_WallBaseQuantities,
Qto_SlabBaseQuantities, Qto_RoofBaseQuantities, Qto_DoorBaseQuantities ja Qto_WindowBaseQuantities) mitoista laskettuina, aukot
vähennettyinä ja skeeman mallien nimillä.

Työkalu `edit_element` muuttaa olemassa olevaa elementtiä paikallaan, niin että se säilyttää GlobalId-tunnuksensa koko elinkaarensa
ajan: seinän alun, lopun, paksuuden, korkeuden ja tyypin, laatan ääriviivan, paksuuden ja tyypin, aukon paikan, leveyden, korkeuden ja
alareunan yhdessä sen oven tai ikkunan kanssa, katon kaltevuuden, räystään ulottuman ja räystään korkeuden sekä minkä tahansa elementin
nimen. Mitat luetaan elementin omasta geometriasta (seinän alku ja loppu sen akselista), ja runko, akseli, kerrokset, perusmäärät ja
seinäliitokset tehdään uudelleen. Seinän aukot säilyttävät paikkansa seinän suunnassa niin kauan kuin seinä säilyttää suuntansa (muuten
etäisyytensä seinän alusta), ja niiden on mahduttava seinään; katto säilyttää suorakulmionsa. Tyypitetty seinä tai laatta saa
paksuutensa tyypistään, joten paksumpi seinä saa toisen tyypin. Elementin, jota ei ole piirretty kirjoitustyökalujen tapaan, voi vain
nimetä uudelleen, ja vastaus kertoo, mitä tekoäly voi tehdä sen sijaan. Tekoäly siis muuttaa elementtejä poistamatta ja luomatta niitä
uudelleen, ja poistaa vain, kun pyydät. Siirto työkalulla `transform_elements` tapahtuu kerroksen tasossa: ovi tai ikkuna siirtyy
aukkonsa mukana, siirretty seinä liitetään seiniin, jotka se kohtaa, yhtään pistettä ei jää käyttämättä, eikä tonttia, rakennusta tai
kerroksia koskaan siirretä, koska niiden paikka ja korkeudet koskevat koko hanketta ja muuttuvat vain sopimalla.

*Esikatsele* ajaa muutosjoukon mallin kopiolle IfcOpenShellillä sovelluksen Pythonissa (komponentit haetaan suostumuksen jälkeen
ensimmäisellä kerralla), piirtää tuloksen 3D:nä uudet vihreinä ja muutetut keltaisina ja näyttää, mitä luodaan, muutetaan ja poistetaan,
sekä skeematarkistuksen löydökset. *Hyväksy* tekee muutoksista reseptivaiheen *Tekoälymuutos*: malli saa uuden version työtilaan,
taulukot rakennetaan uudelleen ja vaihe voidaan kumota tarkasti. Vaihe kantaa alkuperätiedot (palvelu, malli ja kysymykset).
Muutosjoukkoa, jossa on skeemavirheitä, ei voi hyväksyä, poistot vahvistetaan vielä kerran, ja *Hylkää* heittää muutosjoukon pois
koskematta malliin. Tekoäly ei voi koskaan tallentaa tai julkaista: sen teet sinä painikkeilla.

Esikatselu tarkistaa myös mallin suhteet: aukko ilman seinää, ovi tai ikkuna ilman aukkoa, rakennusosa kerrosten ulkopuolella ja
suhde ilman sisältöä lasketaan virheiksi, mutta vain kun muutosjoukko on aiheuttanut ne; mallissa jo ollut ei estä mitään. Kun seinä
poistetaan, sen ovet ja ikkunat poistuvat mukana. Kun sovelluksen Python on jo käynnissä, tekoäly esikatselee muutosjoukkonsa itse
ennen kuin näet sen ja korjaa sen, minkä pyörä löytää, enintään kahdesti; hyväksyntä on edelleen sinun.

Dataregiumista haettu malli julkaistaan uutena versiona Jaa-tilassa asiakirjan perusversiolla, sillä versiolla, jonka hait. Jos
asiakirja on saanut sillä välin uudemman version, palvelin hylkää julkaisun (412 version_conflict); hae silloin uusin versio, tee
muutokset uudelleen ja julkaise uudelleen. Dataregiumista haetulle mallille *Esikatsele* kysyy myös palvelimen esitarkistusta
ehdokkaalle (skeema, buildingSMARTin säännöt ja projektin IDS), kun lähteeseen on kirjauduttu, ja projekti, joka ei ota vastaan
tiedostoja validointivirheineen, hylkää julkaisun (422) palvelimen löydöksillä viestissä ja kortilla Validoi malli.

*Ehdota palvelimella* lähettää esikatsellun muutosjoukon Dataregiumiin muutosehdotuksena julkaisemisen sijaan: projektiin BCF-asia,
jonka liitteenä muutokset ovat palvelimen muodossa (snippet-tyyppi DataregiumIfcChangeSet, jonka palvelin tarkistaa skeemaansa vasten).
Muoto ilmaisee olemassa olevien instanssien muutokset, yhden attribuuttia kohden: ominaisuusarvot, sijoittelut, kerrokseen kuulumisen
ja vastaavat, ja kantaa asiakirjan perusversion, nimesi palvelimella ja tekoälymallin alkuperätietoina. Uusia elementtejä, poistoja ja
uusia suhteita ei voi vielä ilmaista muodossa; paneeli laskee ne, ja ne ovat asian kuvauksessa. Painike näkyy Dataregiumista haetulle
mallille, kun palvelin ilmoittaa kyvykkyyden `ifc_changes`, eikä ehdotus muuta mallia. Jos palvelin kokeilee ehdotuksia (Dataregium,
jossa IFC-LPG-moduuli on päällä), paneeli näyttää kokeilun tuloksen asian alla: kuinka monta muutosta voitiin soveltaa perusversioon,
uudet löydökset perusversioon nähden ja jokainen muutos, jota ei voitu soveltaa, syineen (löydös lajia proposal), esimerkiksi että
arvo ei enää ole se, josta ehdotus lähti. Jos kokeilu on puhdas, projektin *manager* voi painaa *Hyväksy palvelimella*: palvelin tekee
ehdotuksesta asiakirjan seuraavan version (perusversio, ehdottaja ja hyväksyjä version metatiedoissa) ja sulkee asian. Sovelluksen
mallia se ei muuta; hae uusi versio Dataregiumista jatkaaksesi työtä sen parissa. Jos asiakirja on saanut uudempia versioita perusversion
jälkeen, palvelin kokeilee ehdotusta uudelleen uusinta vasten samassa vaiheessa ja hyväksyy sitä vasten, kun kokeilu on puhdas; jos
muutokset ovat ristiriidassa välissä tulleen kanssa, palvelin kieltäytyy (412) ja paneeli luettelee ristiriitaiset avaimet (instanssi
ja attribuutti) tai sanoo, että mikä tahansa on voinut muuttua, kun välissä on ladattu kokonainen tiedosto. Hae silloin uusin versio,
tee muutokset uudelleen ja ehdota uudelleen.
Mallinäkymän kortti *Muutosehdotukset palvelimella* näyttää Dataregiumista haetulle mallille kaikki asiakirjaan kohdistuvat ehdotukset,
kun palvelin ilmoittaa kyvykkyyden `ifc_proposals_url`: otsikon, tilan, ehdottajan, muutosten määrän ja version, jota vasten ne on
tehty; *Hyväksy* tekee kokeillusta ehdotuksesta seuraavan version sille, joka saa hyväksyä, jotta useampi henkilö omine
asiakasohjelmineen voi työskennellä saman mallin parissa. Palvelin, joka ilmoittaa muodon `ops_form` (`dataspatium-tools/1`), saa
lisäksi kirjoitustyökalujen toiminnot, joten uudet elementit, poistot ja suhteet tulevat mukaan ehdotukseen: palvelin rakentaa ne
perusversion päälle samalla koodilla kuin sovellus, ja ristiriitainen avain, josta luovut, lähetetään mukana nimellä `keep_theirs`.

Jos projektissa on tiimejä (kortti *Projektin jäsenet* Hallitse-tilassa), paneeli näyttää, mitä tiimejä muutos koskee. Jos se
koskee vain yhden tiimin osaa, tiimin vastuuhenkilö hyväksyy, myös toimittajan roolissa, ja palvelin kieltäytyy (403) projektin
vastuuhenkilöltä; jos se koskee usean tiimin osia tai ei minkään, projektin vastuuhenkilö hyväksyy kuten ennen. Kun IDS-asiakirja saa
uuden version, palvelin tarkistaa projektin uusimmat IFC-versiot uudelleen, ja niiden raportit ovat sillä aikaa odottavia.

Kun palvelin antaa arvot ristiriitaa kohden, paneeli näyttää kunkin ristiriidan arvon perusversiossa, välissä tulleen arvon ja
ehdotuksesi, ja valitset ristiriita kerrallaan, pidätkö ehdotuksesi vai otatko välissä tulleen. *Ehdota uudelleen valinnoillani*
lähettää ehdotuksen uusinta versiota vasten pidetyin muutoksin ja ilman poistettuja, ja palvelin kokeilee sen uudelleen ennen kuin
sen voi hyväksyä. Yhdistäminen tapahtuu palvelimella; selain käsittelee vain itse ristiriidat.

## Oikea IFC-luokka

IFC:ssä luokka on ensimmäinen luokitus: tarkin luokka PredefinedTypeineen, ObjectType vain kun PredefinedType on USERDEFINED, ja
tyyppiobjekti; muut luokitusjärjestelmät tulevat sen päälle. Tekoäly etsii asialle luokan lukutyökalulla `search_ifc_class`
englanninkielisillä IFC-sanoilla, kuten *sink* tai *handrail*, IfcOpenShellin mukana tulevasta mallin skeeman dokumentaatiosta, ja
muutosjoukko hyväksyy vain luokat, jotka ovat mallin skeemassa eivätkä ole abstrakteja, ja PredefinedTypen luokan luettelosta.
Tarkista-tilan kortti *IFC-luokat* (ja lukutyökalu `get_class_report`) laskee proxy-elementit (IfcBuildingElementProxy), nimettömät
USERDEFINED-arvot, tyypittömät elementit, PredefinedTypen sekä tyypissä että elementissä (sääntö OJT001) ja spatiaalisen rakenteen
ulkopuoliset elementit (SPS007) esimerkkeineen.

## Vertaa versioita

Mallinäkymän painike *Vertaa* vertaa avointa mallia saman aineiston tallennettuun versioon (Versiot Käsittele-tilassa) tai toiseen
työtilan IFC-malliin, esimerkiksi CDE:stä haettuun uudempaan versioon. Elementit yhdistetään GlobalId:n perusteella; paneeli luettelee,
mitä on vain täällä, vain toisessa ja mikä on muuttunut, attribuutti attribuutilta ja ominaisuus ominaisuudelta. 3D:ssä vain täällä
oleva värjätään vihreäksi ja muuttunut keltaiseksi; *Näytä toinen versio* piirtää sen sijaan toisen tiedoston, jossa vain siellä oleva on
punaista. *Merkitse* lisää erot valintaan. Mitään ei muuteta; sama vertailu saa myöhemmin lähteekseen Dataregiumin diff-rajapinnan.

Dataregiumista haetulle mallille paneeli näyttää myös *Palvelimen muutosjoukon*: muutokset, jotka tuottivat haetun version
palvelimella, kun se hyväksyttiin muutosehdotuksesta, asian, kuka ehdotti ja hyväksyi, perusversion (version, jota vasten ehdotusta
kokeiltiin) ja jokaisen muutoksen instansseineen, attribuutteineen sekä vanhoine ja uusine arvoineen. *Merkitse* merkitsee instanssit
malliin. Kokonaisena tiedostona ladatulla versiolla ei ole muutosjoukkoa. Se on kolmas lähde tilannekuvien ja muiden mallien rinnalla.

*Palvelimen versiot* hakee asiakirjan muut versiot Dataregiumista vaihtoehdoiksi luetteloon *Vertaa*. Kun valitset niistä yhden,
vertailun laskee palvelin (sen versioiden välinen diff GlobalId:n ja attribuutin mukaan, sijoittelu, muoto, säiliö ja tyyppi omina
kenttinään), ja se näytetään täällä samoina luetteloina ja väreinä, mutta ilman toisen version 3D-kuvaa; hae se versio nähdäksesi sen.
