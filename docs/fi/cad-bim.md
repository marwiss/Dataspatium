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

Mallin verkko palvelimella piirretään ja siihen kysytään kohdasta *Nouda*, ja painike *IFC–DB* (aiemmin IFC-LPG) vie sinut sinne, katso [grafer.md](grafer.md#ifcdb-dataregium-palvelimella).

Graafin malli, suhteet ja kyselyt Dataspatiumin puolelta ovat Dataregiumin tiedostossa [ifc-lpg.md](https://github.com/marwiss/Dataregium/blob/main/docs/fi/ifc-lpg.md).

### Asian kentät ja mallitiedosto

*Uusi asia* ottaa kentät, joita ruotsalainen tarkastuskäytäntö edellyttää, kaikki projektin omista luetteloista: tyyppi ja tila (aina
asetettu), prioriteetti, nimike, vastuuosapuoli, osoitettu, vaihe ja määräaika. BCF:ssä ei ole omaa kenttää vastuuosapuolelle, joten
se lisätään nimikkeenä. Tilannekuva on enintään 1 500 pikseliä pisimmältä sivultaan, kuten BCF määrää. Kun palvelin sallii, sovellus
liittää asian mallitiedostoon (BCF API:n `PUT /topics/{guid}/files`): projektin omalla merkinnällä siitä versiosta, josta malli
haettiin, ja muuten tiedoston nimellä, aikaleimalla ja IfcProjectilla IFC-tiedoston otsakkeesta.

### BCF-tiedostot

Sovellus kirjoittaa BCF-tiedostot BCF-XML 3.0 -muodossa, joka on buildingSMARTin asioiden muoto:

- Jokaisella asialla on tyyppi ja tila, otsikko, päivämäärä ja tekijä. Ilman tyyppiä tai tilaa niistä tulee Issue ja Open. Tekijä on
  tilisi palvelimella, kun olet kirjautunut, muuten nimi, jonka olet antanut kommentteja varten (*Nimesi*), muuten Dataspatium;
  sovellus ei koskaan keksi nimeä.
- Kommentit ja viewpointit ovat asian sisällä, ja nimikkeet, linkit, asiakirjaviittaukset ja liittyvät asiat ovat omissa
  luetteloissaan. Tiedostossa on `extensions.xml`, jossa ovat sen käyttämät tyypit, tilat, prioriteetit, nimikkeet, osoitetut ja
  vaiheet.
- Kunkin asian otsake nimeää mallitiedoston: nimen IFC-tiedoston otsakkeesta, tiedoston aikaleiman ja IfcProjectin GlobalId:n sekä
  palvelimelta haetun mallin osoitteen.
- Tilannekuvat ovat enintään 1 500 pikseliä pisimmältä sivultaan; suurempi kuva piirretään uudelleen siihen kokoon.
- Asiakirjat, kuten tekoälytarkistuksen valokuvat, ovat kansiossa Documents ja luettelossa `documents.xml`.

Sovellus lukee BCF 3.0:n ja 2.1:n muista ohjelmista sekä omat aiemmat tiedostonsa. Kommentit, viewpointit kameroineen ja
leikkauksineen, tilannekuvat, valitut, piilotetut ja värjätyt komponentit sekä asiakirjat tulevat mukaan. Lue BCF-tiedosto kohdassa
Nouda: asioista tulee taulukko, jonka viereen kommentit ja komponentit tulevat omiin taulukoihinsa, ja tiedosto tallennetaan asioiden
kanssa, joten kuvat ja näkymät säilyvät.

### Tarkastus ruotsalaisen käytännön mukaan

Ruotsalaisessa käytännössä, jossa malleja tarkastetaan BCF:llä, asialla on yksi kuudesta tilasta. Sovellus tunnistaa ne projektin
omasta tilaluettelosta ja antaa niille samat värit kuin muille tiloille:

- *Ny kommentar* (uusi kommentti) on avoin, kuten Open.
- *Ska åtgärdas* (korjattava) ja *Ny granskning* (uusi tarkastus) ovat käynnissä, kuten In progress: asia korjataan tai otetaan esiin
  seuraavassa tarkastuksessa.
- *Har åtgärdats* (korjattu), *Avvisad* (hylätty) ja *Godkänd* (hyväksytty) ovat valmiita: korjattu kuten Resolved, kaksi muuta kuten
  Closed.

Tiloja käytetään vain, kun palvelimen projektin luettelossa on ne; sovellus ei itse tarjoa niitä. Dataregium-projektissa on
oletuksena Open, In progress, Resolved ja Closed, jotka vastaavat niitä edellä kuvatulla tavalla. Dataregiumissa ylläpitäjä määrittää
projektin tilaluettelon (`topic_status`) projektin sivulla polun `/admin` alla. Siellä painike *Använd Praxis statusar* (käytä
Praxis-tiloja) asettaa tilaluetteloon edellä luetellut kuusi tilaa ja jättää projektin muut luettelot ennalleen. Tarkastusasian
kentät ovat kohdassa *Uusi asia* ja tekoälytarkistuksen kohdassa *Lisää asetuksia*: otsikko, kuvaus, tila, osoitettu, vastuuosapuoli
(nimikkeenä), vaihe ja määräaika, ja tarkastaja on kirjautunut henkilö.

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
- **Materiaali-inventointi**: pohja jätehuoltosuunnitelmalle mallista: uudelleenkäytettävät rakennustuotteet, jäte jakeittain ja
  kerroksittain sekä mallin ilmoittamat vaaralliset aineet, katso *Materiaali-inventointi jätehuoltosuunnitelmaa varten* alla.

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
  Kohdassa *Sovelluksen IDS* valitset sen sijaan jonkin sovelluksen omista IDS-tiedostoista, esimerkiksi *Avfallshantering* (katso
  *Materiaali-inventointi jätehuoltosuunnitelmaa varten*), joka tarkistetaan samalla tavalla; *Tallenna IDS-tiedosto* tallentaa
  valitun tietokoneelle.

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

## Materiaali-inventointi jätehuoltosuunnitelmaa varten

Työkalu **Materiaali-inventointi** Analysoi-tilassa (Määrät-välilehti) kokoaa sen, mitä malli tietää, pohjaksi
jätehuoltosuunnitelmalle (avfallshanteringsplan). Ruotsin PBL 10 kap. 8 a §:n mukaan, joka on voimassa 1.7.2026 alkaen,
rakennuttajan on huolehdittava, että on olemassa jätehuoltosuunnitelma, jossa kerrotaan

1. mitkä rakennustuotteet voidaan käyttää uudelleen ja miten ne käsitellään, ja
2. mitä jätettä toimenpiteestä voi syntyä ja miten se käsitellään, erityisesti miten rakennuttaja aikoo mahdollistaa a) laadukkaan
   materiaalikierrätyksen ja b) vaarallisten aineiden turvallisen käsittelyn ja poiston.

Suunnitelmaa ei vaadita, kun se ei selvästikään ole tarpeen, ja vastaavalla tarkastajalla (kontrollansvarig) on sen suhteen sama
tehtävä kuin tarkastussuunnitelman. Boverket ehdotti suunnitelmaa raportissa 2024:26 nimellä resurssienhallintasuunnitelma. Työkalu
antaa pohjan; suunnitelma ja arviot ovat rakennuttajan. Näkymät seuraavat säännöksen kahta kohtaa.

**1. Uudelleenkäytettävät rakennustuotteet.** Rakennusosat, joilla on tyyppi, tuotetietoja sisältävät ensin: valmistaja
(Manufacturer), malli (ModelLabel) ja GTIN (GlobalTradeItemNumber) joukosta Pset_ManufacturerTypeInformation, mieluiten tyypissä,
sekä sarjanumero (SerialNumber) ja viivakoodi (BarCode) joukosta Pset_ManufacturerOccurrence rakennusosassa. GTIN:n tarkistusnumero
tarkistetaan GS1:n säännöllä; virhe näytetään mutta sitä ei koskaan korjata. Jokaisella rivillä on rakennuksen kerros, materiaalit,
jakeet ja mallin ilmoittamat vaaralliset aineet. IFC2X3:ssa ei ole GTIN:ää.

**2 a. Jäte jakeittain sekä kerroksittain ja jakeittain.** Jokaisen rakennusosan jokainen materiaali saa jätejakeen Ruotsin
jäteasetuksen (avfallsförordningen 3 kap. 10 §) mukaan; asetus edellyttää vaarallisen jätteen lisäksi puun, mineraalien (betoni,
tiili, klinkkeri, keramiikka ja kivi), metallin, lasin, muovin ja kipsin lajittelua. Jae otetaan ensin materiaalin luokasta IFC:ssä
(IfcMaterial.Category, esimerkiksi concrete, steel, wood, glass, gypsum tai plastic) ja muuten materiaalin nimestä (betoni,
liimapuu, kipsilevy, eristyslasi ja vastaavat pohjoismaisilla kielillä ja englanniksi). Mineraalivilla, lasivilla ja kivivilla eivät
kuulu mineraaleihin eivätkä lasiin, ja komposiitit kuten lasikuituvahvisteinen muovi, nimet, jotka ilmoittavat useita jakeita
(puu/alumiini) tai ei yhtään, sekä rakennusosat ilman materiaalia saavat jakeen *Muu / ratkaistava*. Sarake *Sääntö* näyttää, mikä
ratkaisi. Summat antavat rakennusosat, rivit, tilavuuden, pinta-alan ja massan jakeittain sekä rakennuksen kerroksittain
(ilmastoselvityksen kuusi kerrosta) ja jakeittain. Luokitusjärjestelmiä ei lueta.

**2 b. Vaaralliset aineet.** Vain se, mitä mallin ominaisuus sanoo: ominaisuus, jonka nimi tai joukko koskee vaarallisia aineita tai
vaarallista jätettä (esimerkiksi Pset_EnvironmentalImpactValues.HazardousWaste tai oma joukko, jossa on asbesti tai PCB), ja jonka
arvo sanoo kyllä, rakennusosassa, tyypissä tai materiaalissa. Sovellus ei koskaan arvaa. Jos malli ei ilmoita vaarallisia aineita,
työkalu kertoo sen, ja haitta-ainekartoitus tarvitaan silti.

**Kaikki rakennusosat ja materiaalit** ovat summien taustalla olevat rivit: määrä, materiaalin luokka, paksuus, jae sääntöineen,
kerros, tiheys ja massa.

**Määrät ja massa.** Määrät ovat ilmastoselvityksen: tiedoston määrät, muuten yksinkertaisten pursotusten geometria, ja
materiaalikerroksista koostuva rakennusosa jaetaan kerrosten paksuuden mukaan; ovet ja ikkunat lasketaan tässä materiaaleittain.
Massa on tiedoston paino, muuten tilavuus kertaa materiaalin tiheys (Pset_MaterialCommon.MassDensity, kg/m³). Ilman tiheyttä rivillä
ei ole massaa, ja huomautus kertoo, kuinka monta riviä tämä koskee.

**Jätehuollon IDS.** *IDS Jätehuolto* avaa IDS-tarkistuksen sovelluksen IDS-tiedostolla `SE-Dataspatium_Avfallshantering.ids` ja
tarkistaa mallin sitä vasten sovelluksen Pythonissa: jokaisella rakennusosalla materiaali, jolla on jokin IFC:n suosittelemista
luokista; tilavuuden perusmäärä seinissä, laatoissa, palkeissa, pilareissa, sauvoissa ja levyissä (IfcMember ja IfcPlate),
anturoissa ja porrassyöksyissä sekä pinta-alan perusmäärä ovissa, ikkunoissa, verhouksissa, katoissa ja lasijulkisivuissa;
valmistaja ja malli ovissa, ikkunoissa ja laitteissa sekä GTIN oikeassa muodossa, jos sellainen on. Tiedosto koskee IFC4:ää ja
IFC4.3:a, koska IFC2X3:sta puuttuvat materiaaliluokka, perusmäärien mallipohjat ja GTIN. ifctester hyväksyy materiaalivaatimuksen,
kun ainakin yhdellä rakennusosan materiaalilla on luokka, ja kootut rakennusosat (katot, portaat, rampit ja lasijulkisivut)
tarkistetaan osissaan.

Jokaisen näkymän voi tallentaa aineistoksi. Verkosta ei haeta mitään.

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

### Tunnukset, numerot ja sijainti

Lomakkeen kohdassa *Tunnukset* täytät sen, minkä tiedät; vain se kirjoitetaan tiedostoon:
- *Kiinteistötunnus* tulee tontin nimeksi (IfcSite.Name) ja sen kiinteistötunnukseksi (Pset_LandRegistration.LandID); kohtaan
  *Tontti* kirjoittamasi tulee silloin tontin pitkäksi nimeksi.
- *Rakennusnumero* tulee rakennuksen nimeksi (IfcBuilding.Name) ja *Rakennuksen nimi* sen pitkäksi nimeksi (LongName).
- *Kansallinen rakennustunnus* kirjoitetaan kenttään Pset_BuildingCommon.BuildingID yhdessä IsPermanentID:n kanssa, jotta malli ja
  rekisterit tarkoittavat samaa rakennusta.
- *Ensimmäisen kerroksen kuvaus* tulee kerroksen kuvaukseksi (Description), esimerkiksi että se on sisäänkäyntikerros.
- *Tekijä* ja *Organisaatio* kirjoitetaan IFC-tiedoston otsakkeeseen vain, jos täytät ne; nimi on henkilötieto.

Malli saa myös seinien akseleiden Axis-kontekstin alusta alkaen, ja raportti muistuttaa, että mallista puuttuu
koordinaattijärjestelmä (buildingSMARTin sääntö GRF003), kunnes `set_site` on antanut sen.

Tekoäly numeroi kerrokset korkeusjärjestyksessä koko projektille (Plan 1, Plan 2 …) ja kirjoittaa sisäänkäyntikerroksen kerroksen
kuvaukseen; `create_storeys_and_grid` ottaa kerroksittain kentät `description` ja `long_name`. `create_spaces` ottaa jokaiselle
huoneelle numeron (`number`), joka on yksilöllinen rakennuksessa: numerosta tulee huoneen Name, huoneen nimestä sen LongName ja
kentästä `long_name` sen kuvaus, ja huonetyyppi (`room_type`) kirjoitetaan ObjectType-kenttään PredefinedType-arvolla USERDEFINED.
Ilman numeroa nimet toimivat kuten ennen.

`set_site` tuntee yhdistetyt EPSG-koodit SWEREF 99:lle korkeuksin RH 2000 -järjestelmässä: 5845 SWEREF 99 TM:lle ja 5846–5857
kahdelletoista paikalliselle vyöhykkeelle samassa järjestyksessä kuin 3007–3018 (esimerkiksi 5850 SWEREF 99 18 00 + RH 2000).
Ruotsissa sijaitsevalle rakennukselle tekoäly suosii paikallista vyöhykettä, kun koordinaatit ovat siinä; se ei koskaan muunna
koordinaatteja itse. Koordinaattijärjestelmä (IfcProjectedCRS) saa selväkielisen kuvauksen ja, kun koodi ei kerro
korkeusjärjestelmää, VerticalDatum-arvoksi RH 2000 (muun kentällä `vertical_datum`). Karttayksikkö on aina metri ja muunnoksen
Scale tiedoston pituusyksikkö metreinä (GRF005), joten millimetreissä oleva malli saa Scale-arvon 0,001. Jokainen ylätason
konteksti (Model, Plan) saa oman IfcMapConversionin samoin arvoin (GRF001). Rakennuksen korkeus merenpinnasta on muunnoksen
OrthogonalHeight; IFC4:ssä ja IFC2X3:ssa myös IfcBuilding.ElevationOfRefHeight, jonka IFC4X3 on poistanut käytöstä.

Tiedoston otsake: jokainen IFC-tiedosto, jonka sovellus kirjoittaa tai tallentaa, saa FILE_DESCRIPTION-osan näkymämäärittelyineen
ja tasolla 2;1 sekä FILE_NAME-osan, jossa ovat tiedoston nimi, aika ISO 8601 -muodossa, esikäsittelijä (Dataspatium ja
IfcOpenShell versioineen) ja alkuperäinen ohjelma muodossa *Dataspatium - Dataspatium - versio*. Näkymämäärittely on
CoordinationView_V2.0 IFC2X3:lle ja ReferenceView_V1.2 IFC4:lle. IFC4X3:lle ei ole virallista näkymää koko skeeman mallille
(Reference View jättää pois muun muassa pursotetut kappaleet), joten otsakkeessa lukee `notYetAssigned` sellaisen näkymän sijaan,
jota tiedosto ei noudata; buildingSMARTin validointipalvelu merkitsee sen, ja vastaanottaja, joka vaatii näkymän, nimeää sen.
Tiedosto, jota sovellus muuttaa, säilyttää oman tekijänsä, organisaationsa ja alkuperäisen ohjelmansa sekä näkymänsä, kun
validointipalvelu hyväksyy sen.

## Uusi rakennus toimeksiannon kuvauksesta

Kirjoita toimeksiannon kuvaus lomakkeeseen *Uusi rakennusmalli* ("kaksikerroksinen talo 12 × 8 m harjakatolla, tiilijulkisivu, sisäänkäynti etelään …")
ja valitse *Rakenna toimeksiannon kuvauksesta tekoälyllä*, kun malli on luotu: malli avautuu Muokkaa-tilassa tekoälypaneelin tilassa **Rakenna
kuvauksesta**. Siellä voit liittää valokuvia ja skannattuja piirustuksia (JPEG, PNG tai PDF; pohjapiirustus antaa oikeat mitat, valokuva
ulkonäön, materiaalit ja sen, miten osat liittyvät toisiinsa) tai lisätä kuvakokoelman kuvat, esimerkiksi Dataspatium Mobiililla
otetut. Tekoäly lukee tyhjän mallin, kertoo suunnitelmansa, kysyy paneelissa, kun kuvaus jättää jotakin olennaista auki (pohja,
kerrosten määrä, kerroskorkeus, seinäpaksuudet, materiaalit), ja rakentaa sitten ryhmissä samoilla työkaluilla kuin *Muuta*:
kerrokset ja ruudukko, seinät kerroksittain, laatat, aukot, ominaisuudet ja materiaalit, esikatselulla ja korjauksilla jokaisen ryhmän
jälkeen. Malliin ei kirjoiteta mitään ennen kuin esikatselet ja hyväksyt muutosjoukon tavalliseen tapaan, ja voit täydentää uudella
kuvauksella samassa tilassa. Kuvat lähetetään toimittajalle kuvauksen mukana toimittajan isännän suostumuksen jälkeen; kuvia näkevä
paikallinen malli pitää kaiken tietokoneella.
Toiminnolla *Tiedot tietoaineistosta* taulukon rivit lisätään kuvaukseen tekstinä: kartalta (Avoin paikkatieto) haettu rakennusala muuttuu
kulmiksi metreinä lounaiskulmasta, jolloin seinät saavat oikeat mitat, ja Dataspatium Mobiilin kenttälomakkeen mitat ja muistiinpanot
muuttuvat riveiksi; kierros puhelimen kanssa voi sitten antaa lisää kuvia ja mittoja, ja kuvausta täydennetään samassa tilassa.
Toimeksiannon kuvaus ja kuvat voidaan myös viedä palvelimelle mallin aineistoksi, kun malli on haettu CDE:stä: mallin projektin asia *Aineisto*
saa kuvauksen tekstiasiakirjana ja jokaisen kuvan asiakirjana, jotta muut, jotka työstävät mallia omilla asiakasohjelmillaan, näkevät,
mistä se rakennettiin. Painike on *Vie aineisto palvelimelle*.
Paneelin yläosassa ovat *Rakennuksen tiedot* (mikä rakennus, kerrokset, pituus, leveys, korkeus, perustus, katto) ja *Tarkkuus*
(luonnos, pääpiirteet tai yksityiskohtainen): täytä se minkä tiedät, niin se aloittaa kuvauksen ja tekoäly kysyy loput. Sanat ovat
tavallisia, mutta niiden takana ovat ISO 19650:n tietovaatimukset ja level of information need, ja malli on tarkoitettu rakennuksen
ylläpitomalliksi. Jokainen kuva liitetään valokuvana, pohjois-, itä-, etelä- tai länsijulkisivuna, sisätilana tai piirustuksena, ja
valokuva, jonka tiedostossa on sijainti ja ajankohta (EXIF), saa ne kuvatekstiinsä, jotta tekoäly tietää, mitä se näkee. Aineiston
tiedot antavat myös rakennuksen pohjan lounaiskulman kartalla, joten tekoäly sijoittaa mallin työkalulla `set_site` (sijainti, korkeus
ja SWEREF 99 TM), ja valinnalla *Maanpinnan korkeus kulmissa mukaan*, joka näkyy kun Lantmäterietin lähde on lisätty, maanpinnan
korkeuden jokaisessa kulmassa korkeusmallista: verkkokutsu avaimellasi suostumuksen jälkeen.
Kun aineisto on valittu, *Paikka kartalla* näyttää rakennuksen pohjan läheltä, ja taustakartan valinnassa on paikan kattava ortokuva:
näet rakennuksen ylhäältä, kun sijoitat sen. Kartta piirretään, kun avaat sen, ja kuvat haetaan vasta, kun valitset taustan ja annat
suostumuksen. Tanskalla, Suomella ja Islannilla on avoimet ortokuvat ruutuina; Ruotsissa sovellus lukee Lantmäterietin ortokuvan
paikalle ja 250 m sen ympäriltä Lantmäterietin tiedostoista Geotorget-avaimellasi (sama kuin maanpinnan korkeudelle); Norjalla ei ole
avointa ortokuvaa (katso [kartor.md](kartor.md#ortokuvat)).
Kunkin kerroksen seinien jälkeen esikatselu lukee rakennuksen topologian: seinien keskilinjoista muodostuu huoneita, ja kerros on
suljettu, kun seinät rajaavat vähintään yhden huoneen eikä yksikään seinänpää jää avoimeksi; tekoäly korjaa avoimet päät siirtämällä
tai lisäämällä seiniä ennen kuin se lisää laatat. Ulkoseinät ilmansuuntineen antavat tekoälyn yhdistää eteläjulkisivun valokuvan
oikeisiin seiniin (lukutyökalu `get_topology`), ja sama topologia näkyy Tarkista-tilan kortilla *Topologia*.

### Käyttötarkoitus, vaihe ja vaatimukset

*Rakennuksen tiedot* sisältävät myös kentät *Käyttötarkoitus*, *Vaihe* ja *Vaatimukset (IDS)*. Käyttötarkoitus kertoo, mihin mallia
käytetään, ja se valitsee tarkkuuden ja vaatimukset, joita voit muuttaa jälkikäteen:

| Käyttötarkoitus | Tarkkuus | Vaatimukset |
|---|---|---|
| Massoittelututkimus | Luonnos | SE-Dataspatium_Grund |
| Rakennuslupa | Pääpiirteet | SE-Dataspatium_Grund |
| Ilmastoselvitys | Pääpiirteet | SE-Dataspatium_Klimatdeklaration |
| Ylläpito | Yksityiskohtainen | SE-Dataspatium_Grund |
| Jätehuolto | Yksityiskohtainen | SE-Dataspatium_Avfallshantering |
| Muu (omalla tekstillä) | Pääpiirteet | ei mitään |

Vaihe kertoo, mihin rakennuksen elinkaaren kohtaan malli kuuluu: esiselvitys, ehdotus, toteutussuunnitelmat, rakenteilla tai olemassa
oleva rakennus. Käyttötarkoitus, vaihe ja vaatimukset aloittavat toimeksiannon kuvauksen. Kun vaatimukset on valittu, jokainen esikatselu, tekoälyn
oma ja sinun, koettelee ehdokasta IDS-tiedostoa vasten, ja tekoäly saa täyttymättömät spesifikaatiot korjattavakseen. Vaatimukset
eivät estä hyväksymistä; paneeli näyttää, kuinka moni spesifikaatio täyttyy ja mitkä eivät.

Tarkkuus noudattaa ISO 7817-1:n tietotarvetta (luku 6), joka jakaa sen geometriaan, aakkosnumeeriseen tietoon ja dokumentaatioon.
Sovelluksen omin sanoin kolme tasoa tarkoittavat näkökohdittain seuraavaa:

| Näkökohta | Luonnos | Pääpiirteet | Yksityiskohtainen |
|---|---|---|---|
| Yksityiskohtaisuus | kerrokset, ulkoseinät ja laatat yksinkertaisina kappaleina, ei aukkoja | kaikki seinät tyyppien paksuisina, laatat, katon muoto ja aukot järkevin mitoin | kerrokset tyypeittäin, ovet ja ikkunat karmeineen ja puitteineen, nurkissa kohtaavat seinät |
| Ulottuvuudet | kappaleet 3D:nä ja seinän akseli | kuten luonnos | kuten luonnos; tasosymbolit voivat tulla myöhemmin |
| Sijainti | kerrosten korot, ruudukko ja tontti, kun se tiedetään | mitat piirustuksesta tai toimeksiannon kuvauksesta, georeferoitu, kun tiedot ovat olemassa | mitatut tai mitoitetut sijainnit, aukot tarkalla paikallaan |
| Ulkoasu | oletusvärit | väri materiaalin luokan mukaan | pintatyyli materiaalia kohden, erillään materiaalista |
| Parametrinen käyttäytyminen | ekstruusiot, joiden mittoja voi muuttaa | tyypit (vaihda tyyppi, niin kaikki muuttuvat) ja kerrokset | liitokset, jotka laskevat nurkat uudelleen, parametriset ovet ja ikkunat |
| Tunnistaminen | nimi, IFC-luokka PredefinedTypeineen ja GlobalId | nimetyt tyypit, huoneet numeroineen ja nimineen | osat ja tilaluokat, Tag ovissa ja ikkunoissa |
| Tietosisältö | kerrokset ja korot | IsExternal, LoadBearing ja materiaalit tyypeissä, perusmäärät | palo, U-arvo ja ilmastotiedot tyypeittäin tai materiaaleittain, olemassa olevan rakennuksen kunto |
| Dokumentaatio | toimeksiannon kuvaus | toimeksiannon kuvaus ja kuvat mallin aineistona | EPD-viitteet ja tuotekortit |

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
BCF-muodossa* lataa BCF-tiedoston, jossa on yksi asia löydöstä kohti, näkymä elementtiin merkittynä ja värjättynä, mallin kuva tilannekuvana ja valokuva asiakirjana, ja kun
malli on haettu palvelimelta, jolle olet kirjautunut, *Luo asiat palvelimelle* luo samat asiat mallin projektiin vahvistuksen jälkeen; siellä valokuvasta tulee projektin asiakirja, tai oma viewpoint pelkällä valokuvalla, jos et saa lisätä asiakirjoja, ja asiat liitetään mallitiedostoon, kun palvelin sallii sen. Kohdassa *Lisää asetuksia* annat asioille tilan, osoitetun henkilön, vastuuosapuolen, vaiheen ja määräajan, palvelimella projektin luetteloista.
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

Työkalu `create_element` tekee rakennusosat, joilla ei ole omaa työkalua, tarkimmasta IFC-luokasta eikä koskaan
IfcBuildingElementProxy-luokkana: pilarit (IfcColumn), palkit (IfcBeam), sauvat kuten tolpat ja kattotuolien osat (IfcMember), anturat
(IfcFooting), paalut (IfcPile), verhoukset kuten lattiapäällysteet, alakatot, julkisivuverhoukset, kattopäällysteet ja eristeet
(IfcCovering), kaiteet (IfcRailing), savupiiput (IfcChimney), aurinkosuojat (IfcShadingDevice), saniteettikalusteet
(IfcSanitaryTerminal), kalusteet (IfcFurniture, IFC2X3:ssa IfcFurnishingElement) ja suorat portaat (IfcStair). Luokka ja sen
PredefinedType tarkistetaan mallin skeemaa vasten kuten muissakin työkaluissa. Kappale on pursotettu profiili: suorakaide, ympyrä tai
ääriviiva kerroksen tasossa, pystyssä ylöspäin korkeudelta kerroksen yläpuolella (pilarit, anturat, verhoukset, kalusteet) tai
vaakasuorassa johonkin suuntaan (palkit, sauvat ja kaiteet). Elementti on kerroksessa tai osa kokonaisuutta (`part_of`), esimerkiksi
portaan kaide, ja on silloin kokonaisuudessa ja sen kerroksessa mutta ei suoraan kerroksessa. Verhous voi kertoa, mitä se verhoaa
(`host`): rakennusosan tai tilan. IFC4:ssä ja myöhemmin siitä tulee rakennusosan osa (IfcRelAggregates) tai se on tilassa; vain
IFC2X3:ssa se saa suhteen IfcRelCoversBldgElements tai IfcRelCoversSpaces. Suora porras (STRAIGHT_RUN_STAIR) on kalteva porrassyöksy
(IfcStairFlight, STRAIGHT), jonka askelmien määrä, nousu, etenemä ja leveys ovat attribuutteina ja Pset_StairFlightCommonissa, ja
pyydettäessä ylhäällä lepotaso (IfcSlab, LANDING); viimeinen nousu on lepotason tai yläpuolisen laatan etureuna.

`define_type` tekee myös tyypit verhouksille (kerroksineen kuten laattatyyppi), pilareille, palkeille, anturoille, kaiteille, oville ja
ikkunoille (IfcCoveringType, IfcColumnType, IfcBeamType, IfcFootingType, IfcRailingType, IfcDoorType ja IfcWindowType; IFC2X3:ssa
IfcDoorStyle ja IfcWindowStyle) materiaaleineen. Ovityypillä on avautumistapansa (OperationType, esimerkiksi SINGLE_SWING_LEFT, saranat
vasemmalla oven avautumissuuntaan katsottuna), ikkunatyypillä jakonsa (PartitioningType, esimerkiksi SINGLE_PANEL tai
DOUBLE_PANEL_VERTICAL), ja molemmilla leveys, korkeus ja karmin syvyys. IfcOpenShell piirtää geometrian karmeineen, ovilehtineen tai
puitteineen ja laseineen kerran tyypille, ja jokainen tyypin ovi ja ikkuna käyttää sitä uudelleen (kuvattu geometria), ja tyyppi saa
karmin ja ovilehtien ominaisuudet (IfcDoorLiningProperties, IfcDoorPanelProperties, IfcWindowLiningProperties). `create_opening` ottaa
tyypin: ovi tai ikkuna saa tyypin koon ja geometrian ja on samassa tasossa seinän vasemman pinnan kanssa seinän alusta sen loppuun
katsottuna (vastapäivään piirretyn ulkoseinän sisäpinta), ja ovi avautuu sille puolelle, vasenkätinen ovi saranat aukon sillä reunalla,
joka on lähinnä seinän alkua. Arvolla `side: right` se käännetään: samaan tasoon oikean pinnan kanssa ja avautumaan sitä kohti. Seinän
paksuinen karmi täyttää koko aukon pielen.
Työkalu `edit_element` muuttaa olemassa olevaa elementtiä paikallaan, niin että se säilyttää GlobalId-tunnuksensa koko elinkaarensa
ajan: seinän alun, lopun, paksuuden, korkeuden ja tyypin, laatan ääriviivan, paksuuden ja tyypin, aukon paikan, leveyden, korkeuden ja
alareunan yhdessä sen oven tai ikkunan kanssa, katon kaltevuuden, räystään ulottuman ja räystään korkeuden sekä minkä tahansa elementin
nimen. Mitat luetaan elementin omasta geometriasta (seinän alku ja loppu sen akselista), ja runko, akseli, kerrokset, perusmäärät ja
seinäliitokset tehdään uudelleen. Lukutyökalu `get_parameters` näyttää tekoälylle mitat, joita `edit_element` muuttaa, samalla tavalla
luettuina, jotta se voi muuttaa myös elementtiä, jota se ei ole itse luonut. Seinän aukot säilyttävät paikkansa seinän suunnassa niin
kauan kuin seinä säilyttää suuntansa (muuten etäisyytensä seinän alusta), ja niiden on mahduttava seinään; katto säilyttää
suorakulmionsa. Tyypitetty seinä tai laatta saa paksuutensa tyypistään, joten paksumpi seinä saa toisen tyypin. Elementin, jota ei ole
piirretty kirjoitustyökalujen tapaan, voi vain nimetä uudelleen, ja vastaus kertoo, mitä tekoäly voi tehdä sen sijaan. Tekoäly siis
muuttaa elementtejä poistamatta ja luomatta niitä uudelleen, ja poistaa vain, kun pyydät. Siirto työkalulla `transform_elements`
tapahtuu kerroksen tasossa: ovi tai ikkuna siirtyy aukkonsa mukana, siirretty seinä liitetään seiniin, jotka se kohtaa, yhtään pistettä
ei jää käyttämättä, eikä tonttia, rakennusta tai kerroksia koskaan siirretä, koska niiden paikka ja korkeudet koskevat koko hanketta ja
muuttuvat vain sopimalla.
Tuotetunnisteet tekoäly kirjoittaa vain, kun annat ne, eikä se koskaan keksi niitä: GTIN (GlobalTradeItemNumber), valmistaja
(Manufacturer) ja malli (ModelLabel) joukossa Pset_ManufacturerTypeInformation tyypissä sekä sarjanumero (SerialNumber) ja
viivakoodi (BarCode) joukossa Pset_ManufacturerOccurrence rakennusosassa. IFC2X3:ssa ei ole GTIN:ää.
**Kantavuus, tila ja ominaisuudet.** `create_wall` ja `create_slab` ottavat `load_bearing`-arvon (kantava tai ei), ja ne sekä
`create_roof` ottavat `status`-arvon (NEW uusi, EXISTING olemassa oleva, DEMOLISH purettava, TEMPORARY tilapäinen), mutta vain kun
toimeksiannon kuvaus tai sinä sanot sen: tekoäly ei koskaan arvaa, ja olemassa olevan rakennuksen digitaalinen kaksonen saa arvon EXISTING. Arvot
kirjoitetaan LoadBearing- ja Status-ominaisuuksina joukkoihin Pset_WallCommon, Pset_SlabCommon ja Pset_RoofCommon, tyyppiin kun kaikki
tyypin elementit sanovat saman ja muuten elementtiin; IFC2X3:ssa ei ole Statusta, ja raportti kertoo sen. Kun muutosjoukko ajetaan,
sovellus asettaa itse IsExternal-arvon topologian perusteella seinille, jotka se on luonut tai joita se on muuttanut: tosi kerroksen
ulkorajalla ja epätosi rakennuksen sisällä, ja seinien ovet ja ikkunat saavat seinänsä arvon. Katot ja kattolaatat ovat ulkoisia.
Kerros, jonka seinät eivät sulkeudu, ei saa IsExternal-arvoa, ja raportti ja tekoälyn esikatselu kertovat miksi; mallissa jo ollut
arvo säilyy. Juuri LoadBearingin ja IsExternalin avulla ilmastoselvitys erottaa luokat toisistaan.
`set_properties` tarkistaa ominaisuusjoukon, jonka nimi on Pset_… tai Qto_…, IfcOpenShellin mallin skeeman pohjia vasten: joukko tai
ominaisuus, jota pohjassa ei ole, hylätään lähimpien nimien kera, toden ja epätoden, mittojen ja luetteloarvojen on oltava oikeaa
tyyppiä, ja luku, jonka arvoon on kirjoitettu yksikkö ("40 dB"), hylätään. Anna pelkkä luku, pituudet metreinä, alat neliömetreinä,
tilavuudet kuutiometreinä ja kulmat asteina, niin sovellus kirjoittaa ne tiedoston yksiköissä. Joukosta, jonka nimi on Qto_…, tulee
määräjoukko (IfcElementQuantity). Oma ominaisuusjoukko ei saa alkaa Pset_- tai Qto_-etuliitteellä, ja tekoäly saa neuvon nimetä sen
muotoon maa-alkuperä-projekti_Nimi, esimerkiksi SE-ACME-42_Akustiikka, ominaisuusnimet PascalCase-muodossa ilman å-, ä- ja
ö-kirjaimia. Ominaisuudet kirjoitetaan elementin omaan joukkoon, ei koskaan tyypin joukkoon. `assign` ottaa materiaalin luokan
(IfcMaterial.Category, samat yksitoista kuin `define_type`-työkalussa).

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
jossa IFC–DB-moduuli on päällä), paneeli näyttää kokeilun tuloksen asian alla: kuinka monta muutosta voitiin soveltaa perusversioon,
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

## buildingSMARTin säännöt esikatselussa

Esikatselu koettelee myös sen, mitä muutosjoukko luo tai muuttaa, buildingSMARTin normatiivisten sääntöjen valikoimaa vasten. Ne ovat
samoja sääntöjä, joita buildingSMARTin validointipalvelu käyttää (ifc-gherkin-rules), siirrettyinä sovelluksen omaan Pythoniin:

- **IFC102**: ei tiedoston skeemassa vanhentuneita entiteettejä, attribuutteja tai arvoja, kuten IfcWallStandardCase, seinä STANDARD
  tai IfcBuildingStorey.Elevation IFC 4.3:ssa;
- **GEM111**: ei toistuvia pisteitä murtoviivoissa ja monikulmiosilmukoissa, ja suljettu murtoviiva päättyy omaan ensimmäiseen
  pisteeseensä;
- **SWE001**: profiilit, jotka eivät leikkaa itseään (koeteltu shapelyllä);
- **PSE001** ja **PSE002**: standardijoukolla (Pset_) on skeeman mallin nimi, ominaisuudet, tyypit ja luokat, eikä oma joukko ala kuten
  Pset;
- **QTY001**: määräjoukko (Qto_) noudattaa malliaan ja sillä on MethodOfMeasurement BaseQuantities;
- **GRF001**, **GRF003** ja **GRF005**: kaikilla konteksteilla on sama koordinaattioperaatio, rakennuksen sisältävällä mallilla on
  koordinaattijärjestelmä, ja karttamuunnoksen mittakaava sopii yksiköihin;
- **SPS007**: rakennusosat ovat tilarakenteessa, eikä rakennusosan osa ole samalla kerroksessa;
- **OJT001**: PredefinedType on tyypissä tai elementissä, ei molemmissa, ja USERDEFINED-arvolla on nimi;
- **PJS003**: jokaisessa GlobalIdissä on 22 sallittua merkkiä ja se alkaa numerolla 0–3, eikä samaa GlobalIdiä käytetä kahdesti.

Jokainen havainto kantaa sääntönsä koodia. Se, minkä buildingSMART laskee sopimuksiksi, antaa virheitä, jotka estävät hyväksymisen
kuten skeemavirheet; alan käytäntö (PSE002, GRF003 ja GRF005) antaa varoituksia, jotka näytetään erikseen. Vain se, minkä muutosjoukko
aiheuttaa, lasketaan: mallissa jo ollut ei estä mitään. Tekoäly saa pettävät säännöt jokaisen esikatselun jälkeen ja korjaa ne, kuten
topologiankin. Sovelluksessa ei ole koko sääntösarjaa: GRF005 tuntee koordinaattijärjestelmän yksikön sovelluksen kirjoittamille
pohjoismaisille koodeille tai sen MapUnitista, ja SWE001 seuraa murtoviivoja, indeksoituja käyriä ja niistä koottuja käyriä. Koko sarja
kuuluu palvelimelle.

Siksi sovellus ei itsekään kirjoita sitä, minkä IFC102 vanhentaa. IFC4:ssä ja myöhemmin `host`-kohteen saanut verhous tulee
peittämänsä rakennusosan osaksi (IfcRelAggregates) tai on tilassa, IfcRelCoversBldgElements- ja IfcRelCoversSpaces-suhteiden sijaan,
ja portaan askelmien määrä ja mitat ovat vain joukossa Pset_StairFlightCommon. IFC 4.3:ssa karmin ja ovilehtien ominaisuudet ovat
joukoissa Pset_DoorLiningProperties, Pset_DoorPanelProperties ja Pset_WindowLiningProperties, jotka korvaavat IfcDoorLiningPropertiesin
ja muut.
Vasta IFC4:n mukana tullut standardijoukko, kuten Pset_Condition IFC2X3-tiedostossa, antaa PSE001:ltä vain varoituksen.

*Hyväksy* ajaa lisäksi skeeman EXPRESS-säännöt (WHERE-säännöt ja funktiot) IfcOpenShellillä; pytest haetaan niitä varten komponenttina
ensimmäisellä kerralla. Muutosjoukkoa, joka rikkoo säännön, jonka malli täytti aiemmin, ei hyväksytä, ja viesti nimeää säännön; pyydä
tekoälyä korjaamaan muutosjoukko ja hyväksy uudelleen. Mallissa, jossa on yli 300 000 instanssia, EXPRESS-säännöt ohitetaan, ja loki
kertoo sen.

## Perustiedot

**Perustiedot**-kortti Tarkista-tilassa koettelee mallia BIM Alliancen IFC-ohjeen Praxin perussääntöjä vasten, tässä sovelluksen omin
sanoin; mitään Praxin tekstejä, arvoluetteloita tai malleja ei ole sovelluksessa. Kortti lukee mallin, kun painat sen painiketta:

- tiedoston otsake kertoo näkymän (MVD), tiedoston kirjoittaneen ohjelman, esikäsittelijän ja ajan (tekijää ja organisaatiota ei
  näytetä);
- mallilla on projisoitu koordinaattijärjestelmä yhdellä EPSG-koodilla, karttamuunnos ja korkeusjärjestelmä;
- projektilla, tontilla, rakennuksella ja kerroksilla on nimet, rakennuksella myös pitkä nimi ja kerroksilla kuvaus;
- jokaisella huoneella on numero kentässä Name, eikä samaa numeroa käytetä kahdesti samassa rakennuksessa;
- oma ominaisuusjoukko ei ala kuten IFC:n (Pset_, Qto_), alkaa maakoodilla (SE-…), sisältää vain merkit A–Z, numerot, - ja _, ja sen
  ominaisuuksien nimet ovat PascalCase-muotoisia ilman kirjaimia å, ä ja ö;
- mikään arvo ei sisällä yksikköään: 40, ei "40 dB".

Jokainen tarkistus näytetään täyttyneenä, tarkistettavana tai virheenä ensimmäisine esimerkkeineen. IDS ei voi koetella tiedoston
otsaketta eikä sitä, että jokin on yksilöllinen, joten tämä on oma korttinsa.

## Sovelluksen IDS-tiedostot

Sovelluksella on omat IDS-tiedostot kansiossa `presets/ids/`, kirjoitettuina avoimien sääntöjen pohjalta:

- **SE-Dataspatium_Grund.ids**: nimet tontilla, rakennuksella, kerroksilla ja huoneilla, ei proxy-elementtejä, ja PredefinedType
  laatoilla, katoilla, ovilla, ikkunoilla ja verhouksilla (USERDEFINED hyväksytään nimen kanssa).
- **SE-Dataspatium_Klimatdeklaration.ids**: LoadBearing seinissä, laatoissa, katoissa, pilareissa ja palkeissa, IsExternal seinissä,
  ovissa ja ikkunoissa, materiaalit rakennusosissa, luokka jokaisella materiaalilla ja perusmäärät: se, mitä alustava ilmastoselvitys
  lukee.

IDS nimeää luokan ilman sen aliluokkia, joten IFC4:n …StandardCase-luokilla on omat spesifikaationsa, ja spesifikaatio koskee vain
mainitsemiaan IFC-versioita. Toimeksiannon kuvaus valitsee tiedoston käyttötarkoituksen mukaan, ja Analysoi-tilan IDS-tarkistus voi ajaa ne.

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
