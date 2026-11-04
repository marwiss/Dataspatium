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
| Python (Pyodide, CPython ja paketit kuten numpy, pandas ja matplotlib; haetaan tarvittaessa, ei kansiossa) | MPL-2.0 (Pyodide, micropip), PSF-2.0 (CPython), BSD-3-Clause (numpy, pandas), matplotlib-lisenssi (PSF-pohjainen), MIT ja vastaavat muille | Haetaan muuttamattomina jsDelivristä ja tallennetaan selaimeen; lähdekoodi on Pyodide-projektilla ja PyPI:ssä sovelluksen luettelon versioina (Pyodide 314.0.7) |
| pdf.js 3.11 (lukee PDF-tiedostoja) vakiokirjasimineen | Apache-2.0 (pdf.js), BSD-3-Clause (Foxitin kirjasimet), SIL Open Font License 1.1 (Liberation Sans) | Vapaasti käytettäviä ja levitettäviä lisenssitekstin ja ilmoitusten kanssa; kirjasimet saa upottaa |
| Leaflet 1.9 (kartat) ja Turf 7 (paikkatietotyökalut) | BSD-2-Clause (Leaflet), MIT (Turf) | Vapaasti käytettäviä ja levitettäviä lisenssitekstin ja ilmoitusten kanssa |
| Cytoscape 3.34 (fcose, dagre, expand-collapse), sigma 3 ja graphology (verkot) | MIT | Vapaasti käytettäviä ja levitettäviä lisenssitekstin ja ilmoitusten kanssa |
| Boverketin Planbestämmelsekatalog (upotettu kopio, `presets/plan/`) | Boverketin avoin data | Vapaasti käytettävä ja levitettävä; lähteenä on mainittava Boverket ja Planbestämmelsekatalogen |
| plotly.js (haetaan tarvittaessa plotly-kaavioita varten), seaborn ja plotly (Python-wheelit PyPI:stä, haetaan tarvittaessa) | MIT (plotly.js, plotly), BSD-3-Clause (seaborn) | Haetaan muuttamattomina jsDelivristä ja PyPI:stä, lukittuina versioon ja tarkistesummaan, ja tallennetaan selaimeen |

Dataspatiumin koodi ei linkity R:ään. R toimii erillisenä tulkkina workerissa ja vaihtaa R-koodia, SQLite-tiedostoja ja kuvia
sovelluksen kanssa viestien välityksellä; tällaisen yhteisjakelun ("mere aggregation") GPL sallii, ja R:n osat säilyttävät
kaikki GPL-oikeutensa sinulle käyttäjänä. Kansion `presets/` esimerkkidata on peräisin avoimista lähteistä ja säilyttää
alkuperäiset lisenssinsä (CC0 tai CC BY kunkin viranomaisen mukaan). Kansion `presets/geo/` Ruotsin kuntien ja läänien rajat
ovat SCB:n *Digitala gränser* -aineistoa CC0 1.0 -lisenssillä, muunnettuna pituus- ja leveysasteiksi. Tanskan rajat ovat
Geodatastyrelsenin (nykyään Klimadatastyrelsen) DAGI 1:500 000 -aineistoa, avointa dataa, jota saa käyttää ja jakaa lähde
mainiten; Norjan rajat ovat Kartverketin N1000 Kartdata -aineistosta ja Suomen rajat Tilastokeskukselta, molemmat
CC BY 4.0 -lisenssillä (lähdemaininta "© Kartverket" ja "Tilastokeskus"). Ks. `presets/geo/KALLA.md`. Avoimista rajapinnoista noudettuun dataan sovelletaan kunkin julkaisijan lisenssiä, joka näytetään
lähteen yhteydessä sovelluksessa.
