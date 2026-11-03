# R Dataspatiumissa

*Analysoi*-tilassa on R-konsoli. R toimii selaimessa WebR:n (R 4.5) avulla täysin ilman asennusta. Kaikki tarvittava on
sovelluskansiossa: R, valikoima paketteja ja Dataspatiumin apufunktiot.

## Aloita

1. Avaa *Analysoi*. R käynnistyy automaattisesti; ensimmäisellä kerralla se kestää pari sekuntia.
2. Kirjoita koodia editoriin ja paina Ctrl+Enter (Macissa Cmd+Enter). Koko skripti suoritetaan; jos tekstiä on valittuna,
   suoritetaan vain valinta. Tulosteet, viestit, virheet ja kaaviot näytetään editorin alla.
3. Tallenna skriptit toiminnolla *Tallenna skripti*. Tallennetut skriptit ovat vasemmassa paneelissa ja kulkevat mukana
   varmuuskopioissa.

## Dataspatiumin funktiot

| Funktio | Tekee |
|---|---|
| `dm_list()` | Näyttää istunnon aineistot: nimi, lyhytnimi, rivit, sarakkeet, muutettu, id. |
| `dm_read("lyhytnimi")` | Lukee aineiston `data.frame`-muodossa oikein tyypein: päivämääristä tulee `Date`, päivämäärästä ja ajasta `POSIXct`, kyllä/ei-arvoista `logical`, kokonaisluvuista `integer`. Argumentti on mieluiten lyhytnimi (esimerkiksi `dm_read("befolkning_2024")`, jonka painike *Lisää dm_read()* kirjoittaa), mutta se voi olla myös id, tarkka nimi, nimi kirjainkoosta riippumatta tai yksiselitteinen alkuosa; `dm_list()` näyttää lyhytnimet. |
| `dm_read("lyhytnimi", columns = c("a", "b"), where = "a > 10", n = 1000)` | Lukee vain tietyt sarakkeet, SQL-ehdon täyttävät rivit tai rajatun määrän rivejä. |
| `attr(df$sarake, "label")`, `"description"`, `"unit"` | Sarakkeen selite, kuvaus ja yksikkö sovelluksesta tulevat mukana attribuutteina (kun ne on asetettu); `dm_write()` vie ne takaisin, tai argumenttien `labels`, `descriptions` ja `units` kautta. |
| `dm_write(df, "Uusi nimi", description = "…")` | Lähettää `data.frame`-olion sovellukseen uutena aineistona. Se ilmestyy luetteloon, kun komento on valmis. |
| `theme_dataspatium()` | ggplot2-teema sovelluksen ulkoasulla. Asetetaan automaattisesti, kun `library(ggplot2)` suoritetaan. |
| `dm_palette()` | Sovelluksen väripaletti (Okabe-Ito, värisokeille sopiva). Myös `scale_colour_dataspatium()` ja `scale_fill_dataspatium()` ovat käytettävissä. |

Esimerkki (mukana tuleva esimerkkiaineisto, jonka sarakkeilla on ruotsinkieliset nimet):

```r
df <- dm_read("befolkning_2024")
library(dplyr)
per_lan <- df |>
  group_by(lan) |>
  summarise(folkmangd = sum(folkmangd), kommuner = n()) |>
  arrange(desc(folkmangd))
per_lan
dm_write(per_lan, "Väestö lääneittäin 2024")

library(ggplot2)
ggplot(per_lan, aes(x = reorder(lan, folkmangd), y = folkmangd / 1000)) +
  geom_col(fill = dm_palette()[1]) +
  coord_flip() +
  labs(title = "Väestö lääneittäin 2024", x = NULL, y = "Tuhatta")
```

## Kaaviot

Kaaviot piirretään piirtoalustalle ja näytetään konsolissa. Jokaisen kaavion alla on painikkeet vientiin SVG- (vektori, hyvä
Wordiin ja verkkoon), PNG- ja PDF-muotoon. Vienti käyttää samaa koodia, joka piirsi kaavion, joten ggplot2-kaaviot ovat
teräviä kaikissa muodoissa. Oletuskoko on 7 × 5 tuumaa; PNG viedään 150 dpi:n tarkkuudella.

## Paketit

Seuraavat paketit ovat sovelluskansiossa, ja ne voi ladata `library()`-funktiolla ilman internetiä: ggplot2, dplyr, tidyr,
readr, stringr, lubridate, forcats, data.table, haven (SPSS, Stata, SAS), readxl, writexl, nanoparquet (Parquet), svglite,
jsonlite, RSQLite, DBI ja knitr sekä niiden riippuvuudet (muun muassa tibble, purrr, rlang, cli, stringi). `library(paketti)`
asentaa paketin sisäänrakennetusta arkistosta ensimmäisellä käyttökerralla.

Muita CRAN-paketteja ei voi asentaa, koska sovellus ei nouda mitään internetistä. Jos tarvitset lisää paketteja, avaa issue,
niin ne voidaan lisätä seuraavaan julkaisuun.

## Miten data siirtyy sovelluksen ja R:n välillä

Aineistot ovat SQLite-tiedostoja. Kun suoritat koodia, sovellus kopioi aineistot, joihin koodi viittaa `dm_read()`-funktiolla,
R:n virtuaaliseen tiedostojärjestelmään kansioon `/data` hakemiston kera. `dm_read()` lukee tiedoston RSQLitellä ja palauttaa
saraketyypit taulusta `_columns`. `dm_write()` kirjoittaa uuden SQLite-tiedoston kansioon `/data/out`, josta sovellus noutaa
sen ja lisää työtilaan, kun komento on valmis. Jos haluat käyttää RSQLiteä suoraan, se onnistuu:
`DBI::dbConnect(RSQLite::SQLite(), "/data/<id>.sqlite")`, jossa id näkyy `dm_list()`-funktion tulosteessa.

Yli 50 Mt:n aineistot peilataan vain, kun koodissa viitataan niihin.

## Kieli

`dm_list()`-, `dm_read()`- ja `dm_write()`-funktioiden viestit noudattavat sovelluksen kieltä (ruotsi, tanska, norja, suomi,
islanti tai englanti); `dm_list()`-funktion sarakkeiden nimet ovat sen sijaan aina samat (`namn`, `kortnamn`, `rader`,
`kolumner`, `ändrad`, `id`), joten skriptit toimivat kielestä riippumatta.

## Rajoitukset

- R-koodia ei voi keskeyttää sen ollessa käynnissä (selaimesta puuttuu tämä toiminto, kun sovellus avataan kansiosta). Jos
  jokin jumittuu: *Käynnistä R uudelleen*. Tallennetut skriptit säilyvät, mutta R-istunnon objektit katoavat.
- Muistia rajoittavat selain ja WebAssembly; pidä R:ssä käsiteltävät aineistot alle muutaman sadan megatavun.
- Syöte suorituksen aikana (`readline()`, `menu()`) ei toimi.
- Grafiikkaikkunat, järjestelmäkomennot, verkkokutsut ja virtuaalisen tiedostojärjestelmän ulkopuoliset tiedostot eivät ole
  käytettävissä.
- Ohjesivut ovat mukana: `?dplyr::mutate` tulostaa ohjetekstin konsoliin.
