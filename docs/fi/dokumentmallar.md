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
