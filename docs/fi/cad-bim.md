# CAD ja BIM: rakennusmallit ja piirustukset

Dataspatium avaa IFC-rakennusmallit ja DXF-piirustukset omana aineistotyyppinään. Malli piirretään 3D:nä, rakennusosista
tulee taulukko, ja ominaisuuksia ja määriä voi hakea, laskea ja viedä. Kaikki tapahtuu selaimessa: tiedosto ei koskaan
poistu tietokoneelta. Alkuperäinen tiedosto tallennetaan aineistoon ja kulkee pakettien ja varmuuskopioiden mukana.

## Mallin avaaminen

Pudota `.ifc`-, `.ifczip`- tai `.dxf`-tiedosto Nouda-tilaan. Tiedoston tiedot näytetään (skeema, projekti, ohjelma, kerrokset ja
lukumäärät tyypeittäin), ja *Tuo* luo aineiston. Tuettuja ovat IFC2X3, IFC4 ja IFC4X3 STEP-muodossa. Noin 50 Mt:n mallin tuonti
kestää noin neljännesminuutin, minkä jälkeen se avautuu muutamassa sekunnissa.

## Malli Muokkaa-tilassa

Malli avautuu 3D-näkymänä, jonka alla on rakennusosien taulukko. Kierrä vetämällä, zoomaa vierittämällä ja siirrä vetämällä
oikealla painikkeella. Kehyspainike näyttää koko mallin; yksittäisiä kaukana rakennuksesta olevia kohteita ei lasketa mukaan.

- **Valitse**: napsauta rakennusosaa mallissa tai riviä taulukossa. Valinta seuraa, ja tarkastelija näyttää tyypin, kerroksen,
  materiaalin, luokituksen, ominaisuudet ja määrät sekä geometriasta mitatun pinnan ja tilavuuden.
- **Suodata**: valitse tyyppi tai kerros tai hae nimeä, materiaalia tai ominaisuutta. Taulukko ja malli näyttävät saman valinnan.
- **Näytä taulukkona**: kaikki sarakkeet tavallisena taulukkona ja kaikki Muokkaa-tilan työkalut.
- **Tallenna kaaviona**: näkymästä suodattimineen ja kuvakulmineen tulee kaavio Visualisoi-tilaan.

Geometria lasketaan alkuperäisestä tiedostosta, kun malli avataan istunnossa ensimmäisen kerran, ja sitä käytetään vain
piirtämiseen ja mittaamiseen. Taulukot säilyvät, vaikka tietokoneesta puuttuisi WebGL; silloin 3D-näkymän tilalla näkyy viesti.

## Asiat CDE:stä

OpenCDE-palvelimelta haettu malli, tai mikä tahansa malli kun tällainen palvelin on lähteenä, voi näyttää asiansa: painike
*Asiat* mallinäkymässä avaa tarkastimeen paneelin, jossa ovat projektin BCF-asiat. Tämän mallin rakennusosiin osoittavat
asiat ovat ensin, tilan ja rakennusosien määrän kanssa. Napsauta asiaa, niin rakennusosat merkitään 3D-näkymässä ja paneeli
näyttää kuvauksen, tilannekuvan ja kommentit. Asiat haetaan pyynnöstä eikä niitä tallenneta aineistoon; laskeaksesi niistä
tallenna ne taulukkona Nouda-tilassa. Tämä on lukemista; asioiden luominen ja muuttaminen tulee seuraavassa versiossa.

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

Jokaisen tuloksen voi tallentaa aineistona.

## DXF-piirustukset

DXF-tiedostosta tulee taulukko, jossa on yksi piirustusobjekti riviä kohti (tyyppi, taso, väri, pituus, pinta-ala, teksti ja
sijainti), ja SVG-piirustus. Piirustus avautuu Muokkaa-tilassa, jossa zoomataan rullalla ja panoroidaan vetämällä. Tasot
kytketään päälle ja pois tarkastelijassa, ja napsautus valitsee objektin ja sen rivin. Määrät-välilehti antaa lukumäärän,
pituuden ja pinta-alan tasoittain ja tyypeittäin.

Viivat, kaaria sisältävät monikulmioviivat, ympyrät, kaaret, ellipsit, splinit, pisteet, tekstit, solidit, 3D-pinnat, lohkot ja
mitoitusten lohkot piirretään. Viivoitusta (HATCH) ei piirretä.

## Vienti

Vie-tila antaa alkuperäisen tiedoston, ominaisuudet ja määrät CSV-muodossa (yksi rivi arvoa kohti) ja piirustuksen SVG-muodossa
taulukon `data` tavallisten muotojen lisäksi. Mallien kaaviot viedään PNG-, SVG- ja PDF-muodossa; 3D-mallista tulee silloin kuva.

## Rajoitukset

- Mallia ei voi muokata, eikä uutta IFC-tiedostoa kirjoiteta. Taulukoiden muutokset eivät vaikuta alkuperäiseen tiedostoon.
- Malli piirretään alkuperäisestä tiedostosta uudelleen jokaisessa uudessa istunnossa. Sovelluksella kokeiltu 57 Mt:n malli vie 4–6 sekuntia.
- Hyvin suuren mallin ensimmäinen piirto voi lukita sivun hetkeksi, kun näytönohjain vastaanottaa kolmioita.
- Määrät eivät ole minkään säännöstön mukainen määrälaskenta. Tarkista ne lähteestä ennen käyttöä.
- DXF luetaan kaksiulotteisena. DWG on ensin tallennettava DXF-muotoon.
