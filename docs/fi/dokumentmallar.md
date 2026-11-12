# Asiakirjat ja asiakirjamallit

Kohdassa **Vie › Asiakirjat** luot asiakirjoja aineistosta: raportteja, koodikirjoja ja ryhmäkohtaisia yhteenvetoja. Malli on
tavallista Markdown-tekstiä paikkamerkein. Samasta mallista saa HTML-, Word- (DOCX), PDF-, Markdown- ja LaTeX-asiakirjan, ja
sen voi ajaa eräajona niin, että jokainen kunta, vuosi tai muu ryhmä saa oman asiakirjansa.

Paikkamerkit ja taulukon avainsanat ovat ruotsinkielisiä sanoja (`{{datamangd}}`, `kolumner`, `sortera`, …). Ne ovat osa
mallikieltä ja samat, millä kielellä sovellus näytetäänkin; valmiiden mallien tekstit noudattavat sovelluksen kieltä.

## Näin teet

1. Valitse aineisto kohdepaneelista ja avaa Vie-tilan välilehti **Asiakirjat**.
2. Valitse malli: **Raportti aineistosta**, **Koodikirja** tai **Yhteenveto ryhmittäin** tai oma tallennettu mallisi. Malli
   näkyy vasemmalla, ja oikeanpuoleinen esikatselu päivittyy kirjoittaessasi.
3. Valitse muoto ja paina **Luo asiakirja**. Tiedosto ladataan.
4. **Eräajo ryhmittäin** luo yhden asiakirjan sarakkeen jokaista arvoa kohden ja pakkaa ne ZIP-tiedostoon manifestin kera.
5. **Tallenna malli** tallentaa muutoksesi työtilaan (valmiit mallit tallennetaan kopioina). **Vie malli (tiedosto)** tuottaa
   `*.doc.json`-tiedoston, jonka kollega voi lisätä toiminnolla **Tuo malli (tiedosto)**. Omat mallit kulkevat mukana työtilan
   varmuuskopiossa.

## Mallikieli

Malli on Markdownia: `#`, `##`, `###` otsikoille, tyhjät rivit kappaleiden välissä, `-` luettelomerkeille, `1.` numeroiduille
luetteloille, `**lihavoitu**`, `*kursivoitu*`, `` `koodi` ``, `[teksti](https://…)` linkeille, `---` vaakaviivalle ja
taulukot pystyviivoin.

Kenoviiva merkin `*`, `_`, `` ` ``, `|`, `[`, `]` tai `#` edessä näyttää merkin sellaisenaan, myös taulukon solussa.

Paikkamerkit kirjoitetaan kaksinkertaisiin aaltosulkeisiin (Mustache). Luvut saavat sovelluksen kielen mukaisen muodon
(suomeksi 1 234,5).

| Paikkamerkki | Sisältö |
|---|---|
| `{{datamangd}}`, `{{beskrivning}}`, `{{kalla}}` | Aineiston nimi, kuvaus ja lähde |
| `{{antal_rader}}`, `{{antal_kolumner}}` | Rivien (suodattimien jälkeen) ja sarakkeiden määrä |
| `{{datum}}`, `{{tid}}`, `{{app}}` | Tämän päivän päivämäärä, kellonaika ja sovelluksen versio |
| `{{summor.kolumn}}`, `{{medel.kolumn}}`, `{{minsta.kolumn}}`, `{{storsta.kolumn}}` | Numerosarakkeen summa, keskiarvo, pienin ja suurin (korvaa `kolumn` sarakkeen nimellä) |
| `{{grupp}}`, `{{gruppkolumn}}` | Ryhmän arvo ja sarakkeen nimi eräajoissa |
| `{{#rader}} … {{/rader}}` | Toistetaan jokaiselle riville (enintään 1 000); sisällä käytetään sarakkeiden nimiä, esimerkiksi `{{kommun}}` |
| `{{#kolumner}} … {{/kolumner}}` | Toistetaan jokaiselle sarakkeelle: `{{namn}}`, `{{typ}}`, `{{etikett}}`, `{{beskrivning}}`, `{{enhet}}` ja `{{vardeetiketter}}` (esimerkiksi `1 = Mies; 2 = Nainen`; kolme viimeistä ovat tyhjiä, ellei niitä ole asetettu Muokkaa-tilassa) |
| `{{#beskrivning}} … {{/beskrivning}}` | Näytetään vain, jos arvo on olemassa (Mustache-osio) |

Sarakkeiden nimet kirjoitetaan kuten taulukossa (siistityt nimet, esimerkiksi `folkmangd`).

### Taulukot aineistosta

```
{{#tabell}}kolumner: kommun, folkmangd; sortera: folkmangd fallande; topp: 10; filter: lan = Skåne län; rubrik: Suurimmat kunnat{{/tabell}}
```

Kaikki osat ovat valinnaisia: ilman `kolumner`-osaa mukaan tulevat kaikki sarakkeet, ilman `topp`-osaa näytetään 50 riviä
(enintään 5 000), `sortera` saa arvon `stigande` (nouseva) tai `fallande` (laskeva), `filter` saa ehtoja operaattoreilla `=`,
`!=`, `>`, `>=`, `<`, `<=` tai `innehåller` (sisältää), joita voi yhdistää sanoilla `och` tai `and`, ja `rubrik` on taulukon
otsikko. `kalla: kolumner` tuottaa sen sijaan taulukon aineiston sarakkeista (nimi, tyyppi, selite, kuvaus ja yksikkö sekä arvoselitteet, jos jollakin sarakkeella on niitä).
Numerosarakkeet tasataan oikealle.

### Kaaviot

```
{{diagram "Väestö lääneittäin" | bredd: 600}}
```

Lisää tallennetun Visualisoi-tilan kaavion (Vega-Lite tai D3) kuvana, piirrettynä samoilla suodattimilla kuin asiakirja;
`bredd` on leveys pikseleinä. Eräajoissa kaavio suodatetaan ryhmän mukaan. R- ja Python-kaaviot piirtävät moottorinsa, kun asiakirja luodaan (muutama sekunti kaaviota kohden).

### Sivunvaihto ja koodikirja

`{{bild "tiedosto.jpg" | bredd: 400}}` lisää kuvan kuvakokoelmasta (katso [dokument.md](dokument.md)): kuvaa etsitään
ensin mallin aineistosta ja sitten kaikista kuvakokoelmista, esikatselukuvaa käytetään ja se skaalataan annettuun
leveyteen (oletuksena enintään 720 px; myös `hojd` voidaan antaa). Tunniste toimii kaikissa muodoissa ja eräajoissa
kuten `{{diagram}}`.
`{{sidbrytning}}` vaihtaa sivua Wordissa, PDF:ssä ja LaTeXissa. **Koodikirja**-malli käyttää laajennettuja saraketietoja:
`{{saknade}}`, `{{unika}}`, `{{minsta}}`, `{{storsta}}`, `{{medel}}`, `{{anmarkningar}}` ja `{{ar_unik}}` sarakkeittain sekä
`{{dubbletter}}`; ne ovat käytettävissä, kun malli on merkitty koodikirjaksi (valmiin mallin kopio säilyttää merkinnän).

`{{karta "aineisto"}}`, `{{graf "aineisto"}}`, `{{modell "aineisto"}}` ja `{{plan "aineisto"}}` lisäävät aineiston oman kuvan ilman tallennettua kaaviota. Aineisto annetaan nimellä tai lyhytnimellä, ja leveys ja korkeus kuten kohdassa `{{diagram}}`. Malli kertoo, jos aineisto puuttuu tai sitä ei voi piirtää niin.

## Tarkastusraportti ja kunnossapitosuunnitelma

Toiminnon *Tarkista tekoälyllä* löydöksistä (katso [cad-bim.md](cad-bim.md)) tulee tarkastusraportti tai kunnossapitosuunnitelma
sisäänrakennetuilla malleilla **Tarkastusraportti** ja **Kunnossapitosuunnitelma**. Tekoälypaneelin *Tee raportti* ja *Tee
kunnossapitosuunnitelma* sekä Tarkista-tilan kortti *Raportti ja kunnossapitosuunnitelma*, kun löydöstaulukko on valittuna, avaavat
Asiakirjat-välilehden taulukko valittuna ja malli valmiina; tekoälypaneelissa löydökset tallennetaan ensin taulukkona, jos niitä ei
ole jo tallennettu. Ylimpänä ovat rakennuksen tiedot mallista: rakennus, projekti, tontti, kerrokset, malli, tiedosto ja IFC-skeema,
sekä rakennuksen tunnus ja rakennusvuosi, kun ne ovat Pset_BuildingCommonissa. Sitten tulevat löydökset rakennusosittain, rakennuksen
kuusi kerrosta ilmastoselvityksen sääntöjen mukaan (elementin IFC-luokka, IsExternal ja LoadBearing), valokuvan, kunnon, prioriteetin
ja suositellun toimenpiteen kanssa; rakennusosan sisällä kiireellisin tulee ensin. Rakennusosa on löydöstaulukon sarakkeessa
`byggdel` (1–6), ja sen voi korjata Muokkaa-tilassa. Valokuvat kulkevat löydöstaulukon mukana ilman EXIF-tietojaan, ja valokuvan
sijainti tulee asiakirjaan vain, jos lisäät itse `{{plats}}`.

Kunnossapitosuunnitelma antaa jokaiselle toimenpiteelle vuoden mallin säännön mukaan:

```
{{#underhallsregel}}prioritet: urgent 0, high 1, medium 3, low 5; skick: critical 0, poor 1, fair 3, good 10; intervall: 5{{/underhallsregel}}
```

Toimenpiteen vuosi on tarkastuksen vuosi (löydöksen päivämäärä) lisättynä pienimmällä vuosimäärällä, jonka prioriteetti ja kunto
antavat, joten kriittinen kunto menee matalan prioriteetin edelle, ja seuraava tarkastus tulee `intervall` vuotta toimenpiteen
jälkeen. Tasot kirjoitetaan koodilla tai sanalla (kiireellinen, korkea, keskitaso ja matala; kriittinen, huono, tyydyttävä ja
hyvä). Muuta lukuja mallin kopiossa; tagi ei näy asiakirjassa.

| Paikkamerkki | Sisältö |
|---|---|
| `{{#byggdelar}} … {{/byggdelar}}` | Yksi ryhmä rakennusosaa kohden: `{{namn}}`, `{{antal}}` ja löydökset kohdassa `{{#fynd}} … {{/fynd}}` |
| `{{#klasser}}`, `{{#plan}}` | Samanlaiset ryhmät IFC-luokittain ja toimenpiteen vuoden mukaan |
| `{{#fynd}}`, `{{#tidsplan}}` | Kaikki löydökset taulukon järjestyksessä tai toimenpiteen vuoden mukaan |
| `{{nr}}`, `{{titel}}`, `{{beskrivning}}`, `{{element}}`, `{{ifc_klass}}`, `{{vaning}}`, `{{byggdel}}` | Löydös ja sen elementti |
| `{{skick}}`, `{{prioritet}}`, `{{atgard}}`, `{{datum}}`, `{{foto}}`, `{{bild}}` | Kunto ja prioriteetti sanoina, toimenpide, päivämäärä, valokuvan nimi ja valokuva kuvana |
| `{{ar}}`, `{{nasta_kontroll}}` | Toimenpiteen vuosi ja seuraavan tarkastuksen vuosi |
| `{{#fakta}}`, `{{byggnad.namn}}` | Rakennuksen tiedot, `{{namn}}` ja `{{varde}}` kohdassa `{{#fakta}}` |
| `{{antal_fynd}}`, `{{besiktningsdatum}}`, `{{#per_skick}}`, `{{#per_prioritet}}` | Löydösten määrä, tarkastuksen päivämäärät ja määrä kunnoittain ja prioriteeteittain (`{{ord}}`, `{{antal}}`) |

Löydösten teksti tulee mukaan sellaisenaan: merkit kuten `*`, `_` ja `|` eivät koskaan muutu muotoiluksi.

## Muodot

| Muoto | Mitä saat |
|---|---|
| HTML | Itsenäinen sivu sisäänrakennetulla tyylillä ja upotetuilla kuvilla; aukeaa missä tahansa selaimessa ja on tulostettavissa |
| Word (DOCX) | Otsikot, kappaleet, luettelot, otsikkorivilliset taulukot ja kuvat; fontti Arial; aukeaa Wordissa ja LibreOfficessa |
| PDF | A4 sivunumeroin, taulukot jsPDF:n ja jspdf-autotablen avulla; fontti Helvetica |
| Markdown | `.md`; kuvien kanssa ZIP, jossa `figures/` |
| LaTeX | ZIP, jossa `main.tex` (article, booktabs, longtable, graphicx, hyperref, babel sovelluksen kielellä) ja `figures/`; käännetään pdflatexilla, xelatexilla tai lualatexilla tai ladataan Overleafiin |

Teksti suojataan aina kohdemuodon mukaan: `&`, `<` ja `>` HTML:ssä, `&`, `%`, `_` ja muut LaTeXissa, XML DOCX:ssä.

## Rajoitukset

- Mallit muodostetaan selaimessa; hyvin suuret taulukot asiakirjoissa vievät aikaa, erityisesti PDF:ssä ja Wordissa.
- PDF ja Word käyttävät vakiofontteja (Helvetica ja Arial) sovelluksen Interin sijaan.
- Markdown-tuki on valikoima: ei alaviitteitä, ei sisäkkäisiä luetteloita, ei neljättä tasoa alempia otsikoita.
- LaTeXia ei käännetä selaimessa.
