# Lisenssit

Tämä on suomenkielinen selitys. Tiedoston [LICENSE](../../LICENSE) täydellinen lisenssiteksti on voimassa. Teksti ei ole
oikeudellista neuvontaa.

## Dataspatiumin oma koodi

Dataspatiumin oma koodi, dokumentaatio ja valmisasetukset (kaikki paitsi kansio `vendor/`) on lisensoitu
**PolyForm Strict 1.0.0** -lisenssillä (<https://polyformproject.org/licenses/strict/1.0.0>). Lisenssinantaja on Dataspatiumin
tekijä, jonka tavoittaa GitHub-tililtä [marwiss](https://github.com/marwiss).

Saat:

- Ladata ja käyttää sovellusta ei-kaupallisiin tarkoituksiin: yksityisesti, opiskeluun, tutkimukseen, koulutukseen ja
  hyväntekeväisyyteen sekä viranomaisissa, kunnissa, hyvinvointialueilla ja muissa julkisissa laitoksissa riippumatta siitä,
  miten toiminta rahoitetaan.
- Käyttää sovellusta niin monella tietokoneella kuin haluat organisaatiossasi.
- Luoda sovelluksella omia aineistoja, reseptejä, kaavioita, R-skriptejä, API-määrityksiä ja asiakirjamalleja ja jakaa niitä
  haluamallasi tavalla. Ne ovat omia teoksiasi, eivät osa sovellusta.

Et saa ilman lisenssinantajan kirjallista lupaa:

- Käyttää sovellusta kaupallisessa toiminnassa, esimerkiksi konsulttitoimeksiannoissa tai osana tuotetta tai palvelua.
- Levittää sovellusta edelleen kokonaan tai osittain tai julkaista omia kopioita. (GitHubin käyttöehdot sallivat
  repositorion haarautuksen GitHubissa; se ei anna muita oikeuksia.)
- Muuttaa koodia tai rakentaa sen pohjalle omia teoksia.

Jos haluat käyttää Dataspatiumia muilla ehdoilla, avaa issue repositoriossa tai ota yhteyttä lisenssinantajaan siellä.

## Kolmannen osapuolen osat

Kaikki kansiossa `vendor/` on kolmannen osapuolen koodia omine lisensseineen, joihin Dataspatiumin lisenssi ei vaikuta.
Jokainen kirjasto, sen versio ja lisenssi ovat tiedostossa [THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md) yhdessä
lisenssitekstien kanssa.

| Osa | Lisenssi | Mitä se tarkoittaa |
|---|---|---|
| JavaScript-kirjastot (sql.js, Dexie, D3, Vega, PapaParse, SheetJS, docx, jsPDF, fflate, CodeMirror ja muut) | MIT, BSD-3-Clause, Apache-2.0, ISC | Vapaasti käytettävissä ja levitettävissä, kunhan lisenssiteksti ja ilmoitukset tulevat mukana |
| Inter-fontti | SIL Open Font License 1.1 | Saa upottaa sovellukseen; ei saa myydä erikseen |
| Lucide-kuvakkeet (myös sovelluksen tunnus ja favicon) | ISC | Kuten yllä |
| webR (JavaScript-osa) | MIT | Kuten yllä |
| R (R.wasm ja muut) | GPL-2 tai GPL-3 | Vapaa ohjelmisto. Levitetään muuttamattomana binäärimuodossa; lähdekoodi on saatavilla R-projektilta ja webR-projektilta mainituissa versioissa |
| R-paketit kansiossa `vendor/webr-repo` | Enimmäkseen MIT; myös LGPL (DBI, RSQLite), MPL-2.0 (data.table), GPL (Rcpp, pxR, knitr, svglite ja muut) | Levitetään muuttamattomina; lähdekoodi on saatavilla CRANista mainituissa versioissa |
| Python (Pyodide, CPython ja paketit kuten numpy, pandas ja matplotlib; haetaan tarvittaessa, ei kansiossa) | MPL-2.0 (Pyodide, micropip), PSF-2.0 (CPython), BSD-3-Clause (numpy, pandas), matplotlib-lisenssi (PSF-pohjainen), MIT ja vastaavat muille | Haetaan muuttamattomina jsDelivristä ja tallennetaan selaimeen; lähdekoodi on Pyodide-projektilla ja PyPI:ssä sovelluksen luettelon versioina (Pyodide 0.29.5) |
| pdf.js 3.11 (lukee PDF-tiedostoja) vakiokirjasimineen | Apache-2.0 (pdf.js), BSD-3-Clause (Foxitin kirjasimet), SIL Open Font License 1.1 (Liberation Sans) | Vapaasti käytettäviä ja levitettäviä lisenssitekstin ja ilmoitusten kanssa; kirjasimet saa upottaa |
| Leaflet 1.9 (kartat) ja Turf 7 (paikkatietotyökalut) | BSD-2-Clause (Leaflet), MIT (Turf) | Vapaasti käytettäviä ja levitettäviä lisenssitekstin ja ilmoitusten kanssa |
| proj4js 2.22 ja Proj4Leaflet 1.0 (kaavakartta kaavan omassa koordinaattijärjestelmässä) | MIT (proj4js), BSD-2-Clause (Proj4Leaflet) | Vapaasti käytettäviä ja levitettäviä lisenssitekstin ja ilmoitusten kanssa |
| Cytoscape 3.34 (fcose, dagre, expand-collapse), sigma 3 ja graphology (verkot) | MIT | Vapaasti käytettäviä ja levitettäviä lisenssitekstin ja ilmoitusten kanssa |
| neo4j-driver-lite 6.3 (Neo4j Boltin yli) | Apache-2.0 | Vapaasti käytettävä ja levitettävä lisenssitekstin ja ilmoitusten kanssa |
| web-ifc 0.0.78 (geometria IFC:stä; muuttamattomat tiedostot, lähdekoodi osoitteessa https://github.com/ThatOpen/engine_web-ifc) | MPL-2.0 | Vapaasti käytettävä ja levitettävä; kirjaston omien tiedostojen muutokset jaetaan samalla lisenssillä |
| buildingSMARTin BCF-XML 3.0- ja 2.1-skeemat (XSD; vain testeissä kansiossa `tests/fixtures/bcf-schemas/`, eivät kuulu kansioon) | CC BY-ND 4.0, © buildingSMART International Ltd. | Kopioitu muuttamattomina lähteen ja lisenssin kanssa, ja niillä vain testataan sovelluksen BCF-tiedostoja; sovellus itse ei käytä niitä. Muutettuja skeemoja ei saa levittää |
| three.js 0.187 (3D-piirto), dxf-parser 1.1 (DXF) | MIT | Vapaasti käytettäviä ja levitettäviä lisenssitekstin ja ilmoitusten kanssa |
| Boverketin Planbestämmelsekatalog (upotettu kopio, `presets/plan/`) | Boverketin avoin data | Vapaasti käytettävä ja levitettävä; lähteenä on mainittava Boverket ja Planbestämmelsekatalogen |
| Boverketin ilmastotietokanta (noudetaan tarvittaessa osoitteesta api.boverket.se, ei kansiossa) | Avoin data Boverketin käyttöehtojen mukaan (dnr 5913/2024, perustuu ruotsalaiseen API-lisenssiin) | Vapaasti käytettävissä; lähteeksi on mainittava Boverket ja ilmastotietokanta, tavaramerkki vain lähdeviitteessä, ja tietoja käytetään omalla vastuulla |
| Tesseract ja tesseract.js-core (lukee tekstin kuvista; haetaan tarvittaessa, ei ole kansiossa), kielitiedot tessdata_best-aineistosta | Apache-2.0 (Tesseract, tesseract.js-core, kielitiedot) | Haetaan muuttamattomina jsDelivristä, lukittuina versioon ja tarkistussummaan, ja tallennetaan selaimeen |
| plotly.js (haetaan tarvittaessa plotly-kaavioita varten), seaborn ja plotly (Python-wheelit PyPI:stä, haetaan tarvittaessa) | MIT (plotly.js, plotly), BSD-3-Clause (seaborn) | Haetaan muuttamattomina jsDelivristä ja PyPI:stä, lukittuina versioon ja tarkistesummaan, ja tallennetaan selaimeen |
| IfcOpenShell 0.9.1 (lukee, tarkistaa ja muokkaa IFC-malleja Pythonissa; haetaan tarvittaessa WebAssembly-wheel-paketteina IfcOpenShellin omasta luettelosta, ei kansiossa) sekä OpenCASCADE-ydin, lark ja isodate | LGPL-3.0 (IfcOpenShell; lähdekoodi https://github.com/IfcOpenShell/IfcOpenShell), LGPL-2.1 poikkeuksin (OpenCASCADE), MIT (lark), BSD-3-Clause (isodate) | Haetaan muuttamattomina, lukittuina versioon ja tarkistesummaan, ja tallennetaan selaimeen. IfcOpenShell toimii erillisenä Python-pakettina workerissa ja on vaihdettavissa toiseen versioon; sovelluksen koodi ei linkitä siihen |
| ifctester 0.9.0 (IDS-tarkistus IfcOpenShellistä; kansiossa `vendor/ifctester/`, verkkosovellus `ifctester/webapp` poistettu wheel-paketista Dataspatiumin toimesta 2026-11-06), sekä xmlschema 4.3.2 ja elementpath 5.1.4 | LGPL-3.0 (ifctester; lähdekoodi https://github.com/IfcOpenShell/IfcOpenShell/tree/v0.9.0/src/ifctester), MIT (xmlschema, elementpath) | ifctester on muutettu LGPL-teos: muutos (vain verkkosovelluksen poisto, RECORD kirjoitettu uudelleen) ilmoitetaan tässä ja vendor/vendor.json-tiedostossa, lisenssitekstit ovat mukana ja lähde on paketin tiedostot; alkuperäisen tarkistesumma on vendor-src-kansiossa. Toimii erillisenä Python-pakettina workerissa ja on vaihdettavissa; sovelluksen koodi ei linkitä siihen |
| buildingSMARTin säännöt, ifc-gherkin-rules (valikoima siirretty sovelluksen Pythoniin tiedostossa `python/dataspatium.py`) | MIT, Copyright (c) buildingSMART International Ltd | Vapaita käyttää ja muuttaa; tekijänoikeusilmoitus ja lisenssiteksti ovat koodin vieressä tiedostossa |

Perustiedot-kortti perustuu BIM Alliancen Praxi-ohjeen sääntöihin omin sanoin kerrottuina; sovellukseen ei sisälly Praxin tekstejä, arvoluetteloita tai malleja. Sovelluksen IDS-tiedostot kansiossa `presets/ids/` ovat Dataspatiumin kirjoittamia ja kuuluvat sovelluksen lisenssin piiriin.

Dataspatiumin koodi ei linkity R:ään. R toimii erillisenä tulkkina workerissa ja vaihtaa R-koodia, SQLite-tiedostoja ja kuvia
sovelluksen kanssa viestien välityksellä; tällaisen yhteisjakelun ("mere aggregation") GPL sallii, ja R:n osat säilyttävät
kaikki GPL-oikeutensa sinulle käyttäjänä. Kansion `presets/` esimerkkidata on peräisin avoimista lähteistä ja säilyttää
alkuperäiset lisenssinsä (CC0 tai CC BY kunkin viranomaisen mukaan). Kansion `presets/geo/` Ruotsin kuntien ja läänien rajat
ovat SCB:n *Digitala gränser* -aineistoa CC0 1.0 -lisenssillä, muunnettuna pituus- ja leveysasteiksi. Tanskan rajat ovat
Geodatastyrelsenin (nykyään Klimadatastyrelsen) DAGI 1:500 000 -aineistoa, avointa dataa, jota saa käyttää ja jakaa lähde
mainiten; Norjan rajat ovat Kartverketin N1000 Kartdata -aineistosta ja Suomen rajat Tilastokeskukselta, molemmat
CC BY 4.0 -lisenssillä (lähdemaininta "© Kartverket" ja "Tilastokeskus"). Ks. `presets/geo/KALLA.md`. Avoimista rajapinnoista noudettuun dataan sovelletaan kunkin julkaisijan lisenssiä, joka näytetään
lähteen yhteydessä sovelluksessa.

Taustakartan valinnan ortokuvat eivät sisälly sovellukseen: selaimesi hakee kuvat julkaisijoiden palveluista, kun valitset ne,
suostumuksen jälkeen. Kaikki kolme ovat CC BY 4.0 -lisenssillä: GeoDanmark ortofoto forår Klimadatastyrelsenilta (lähdemaininta
"GeoDanmark ortofoto forår © Klimadatastyrelsen"), Ortokuva Maanmittauslaitokselta ("Ortokuva © Maanmittauslaitos") ja Grunnkort –
Loftmynd Náttúrufræðistofnunilta ("Grunnkort – Loftmynd © Náttúrufræðistofnun"). Lähdemaininta ja lisenssi näytetään kartan kulmassa,
ja niiden on seurattava kartasta otettua kuvaa, jota käytät edelleen. Esiasetukset ovat tiedostossa
`presets/geodata/orthophotos.json`; ks. [kartor.md](kartor.md#ortokuvat).

## Dataregium ja Dataspatium

[Dataregium OpenCDE server](https://github.com/marwiss/Dataregium) on erillinen teos AGPL-3.0-lisenssillä eikä osa Dataspatiumia. Sama henkilö omistaa molempien teosten tekijänoikeuden ja on 2026-11-05 sallinut kaksi asiaa niiden välillä: Dataregium toistaa Dataspatiumin ulkoasun (tiedoston `src/ui/design/tokens.css` suunnittelumuuttujat ja komponenttien tyylit on kirjoitettu sinne AGPL:n alaisina, jotta kaksi näyttävät yhdeltä tuotteelta), ja Dataspatium saa käyttää Dataregiumin koodia ja resursseja, esimerkiksi testitiedostoja, esimerkkitekstejä ja API-kuvauksia. Kummankin teoksen lisenssit pysyvät muuten muuttumattomina; kaikki muu yhteinen (sanasto, README-rakenne, virhekoodit, kyvykkyysdokumentti) luodaan uudelleen faktoina kumpaankin repositorioon.
