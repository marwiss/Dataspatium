# R í Dataspatium

Hamurinn *Greina* inniheldur R-stjórnborð. R keyrir í vafranum með WebR (R 4.5), alveg án uppsetningar. Allt sem þú þarft er í
forritsmöppunni: R, úrval pakka og hjálparföll Dataspatium.

## Hafist handa

1. Opnaðu *Greina*. R ræsist sjálfkrafa; það tekur nokkrar sekúndur í fyrsta skipti.
2. Skrifaðu kóða í ritilinn og ýttu á Ctrl+Enter (Cmd+Enter á Mac). Öll skriftan keyrir; ef texti er valinn keyrir aðeins
   valið. Úttak, skilaboð, villur og myndrit birtast undir ritlinum.
3. Vistaðu skriftur með *Vista skriftu*. Vistaðar skriftur eru í spjaldinu til vinstri og fylgja afritum.

## Föll Dataspatium

| Fall | Gerir |
|---|---|
| `dm_list()` | Sýnir gagnasöfnin í setunni: heiti, stuttheiti, mappa, raðir, dálkar, breytt, auðkenni. |
| `dm_read("stuttheiti")` | Les gagnasafn sem `data.frame` með réttum gerðum: dagsetningar verða `Date`, dagsetning og tími `POSIXct`, já/nei `logical`, heiltölur `integer`. Viðfangið er helst stuttheitið (til dæmis `dm_read("befolkning_2024")`, sem er það sem hnappurinn *Setja inn dm_read()* skrifar) en getur líka verið auðkenni, nákvæmt heiti, heiti óháð há- og lágstöfum eða ótvírætt forskeyti; `dm_list()` sýnir stuttheitin. Liggi gagnasafnið í möppu virka líka `dm_read("Mappa/Heiti")` og `dm_read("Mappa/stuttheiti")`. |
| `dm_read("stuttheiti", columns = c("a", "b"), where = "a > 10", n = 1000)` | Les aðeins tiltekna dálka, raðir sem uppfylla SQL-skilyrði eða takmarkaðan fjölda raða. |
| `attr(df$dálkur, "label")`, `"description"`, `"unit"` | Merkimiði, lýsing og eining dálksins úr forritinu fylgja sem eigindir (þegar þær eru stilltar); `dm_write()` tekur þær til baka, eða gegnum viðföngin `labels`, `descriptions` og `units`. |
| `dm_value_labels(x, c("Karl" = 1, "Kona" = 2), to = "labels")` | Gildismerkimiðar. Dálkur með kóðum og merkimiðum verður `haven::labelled` í `dm_read()` (dálkur sem þegar hefur merkimiðana sem texta heldur kóðunum í eigindinni `value_labels`), og `dm_write()` vistar þá. `dm_value_labels()` stillir merkimiða (`to = NULL`), skiptir kóðum út fyrir merkimiða (`"labels"`) eða til baka (`"codes"`); án merkimiða eru þeir fjarlægðir. |
| `dm_write(df, "Nýtt heiti", description = "…")` | Sendir `data.frame` til forritsins sem nýtt gagnasafn. Það birtist í listanum þegar skipuninni er lokið. |
| `theme_dataspatium()` | ggplot2-þema með útliti forritsins. Stillt sjálfkrafa þegar `library(ggplot2)` keyrir. |
| `dm_palette()` | Litaspjald forritsins (Okabe-Ito, hentar litblindum). `scale_colour_dataspatium()` og `scale_fill_dataspatium()` eru líka til. |

Dæmi (meðfylgjandi sýnigögn, þar sem dálkarnir hafa sænsk heiti):

```r
df <- dm_read("befolkning_2024")
library(dplyr)
per_lan <- df |>
  group_by(lan) |>
  summarise(folkmangd = sum(folkmangd), kommuner = n()) |>
  arrange(desc(folkmangd))
per_lan
dm_write(per_lan, "Mannfjöldi eftir lénum 2024")

library(ggplot2)
ggplot(per_lan, aes(x = reorder(lan, folkmangd), y = folkmangd / 1000)) +
  geom_col(fill = dm_palette()[1]) +
  coord_flip() +
  labs(title = "Mannfjöldi eftir lénum 2024", x = NULL, y = "Þúsundir")
```

## Myndrit

Myndrit eru teiknuð á striga og birtast í stjórnborðinu. Undir hverju myndriti eru hnappar til útflutnings í SVG (vigur, gott
fyrir Word og vef), PNG og PDF. Útflutningurinn notar sama kóða og teiknaði myndritið, svo ggplot2-myndrit verða skörp í öllum
sniðum. Sjálfgefin stærð er 7 × 5 tommur; PNG er flutt út með 150 dpi.

## Pakkar

Eftirfarandi pakkar fylgja í forritsmöppunni og má hlaða með `library()` án nets: ggplot2, dplyr, tidyr, readr, stringr,
lubridate, forcats, data.table, haven (SPSS, Stata, SAS), readxl, writexl, nanoparquet (Parquet), svglite, jsonlite, RSQLite, DBI
og knitr, auk þeirra pakka sem þeir byggja á (meðal annars tibble, purrr, rlang, cli, stringi). `library(pakki)` setur pakkann
upp úr innbyggða safninu í fyrsta skipti sem hann er notaður.

Aðrir pakkar eru sóttir eftir þörfum úr pakkasafni webR (repo.r-wasm.org, yfir 20 000 CRAN-pakkar byggðir fyrir
vafrann): kalli kóðinn á `library()`, `require()` eða `pakki::` fyrir pakka utan úrvalsins er hann sóttur með því sem
hann byggir á áður en kóðinn keyrir. Í fyrsta skipti spyr forritið um leyfi til að hafa samband við netið fyrir
íhluti; síðan eru pakkarnir vistaðir í vafranum, eru enn til við næstu ræsingu og birtast undir *Umsjón → Vinnusvæði
→ Íhlutir*, þar sem þá má líka fjarlægja. Án nets, eða ef þú svarar nei, fær kóðinn venjulegu villuna um að pakkann
vanti. Pakka sem krefjast kerfissafna sem ekki eru til í vafranum getur vantað í pakkasafnið.

## Hvernig gögn flytjast milli forritsins og R

Gagnasöfnin eru SQLite-skrár. Þegar þú keyrir kóða afritar forritið þau gagnasöfn sem kóðinn vísar í með `dm_read()` í sýndar-
skráakerfi R undir `/data`, ásamt skrá yfir þau. `dm_read()` les skrána með RSQLite og endurheimtir dálkgerðirnar úr töflunni
`_columns`. `dm_write()` skrifar nýja SQLite-skrá í `/data/out` sem forritið sækir og bætir við vinnusvæðið þegar skipuninni er
lokið. Viljirðu nota RSQLite beint gengur það vel: `DBI::dbConnect(RSQLite::SQLite(), "/data/<auðkenni>.sqlite")`, þar sem
auðkennið birtist í `dm_list()`.

Gagnasöfn stærri en 50 MB eru aðeins spegluð þegar vísað er í þau í kóðanum.

## Tungumál

Skilaboð frá `dm_list()`, `dm_read()` og `dm_write()` fylgja tungumáli forritsins (sænsku, dönsku, norsku, finnsku, íslensku eða
ensku); dálkaheitin í `dm_list()` eru hins vegar alltaf þau sömu (`namn`, `kortnamn`, `mapp`, `rader`, `kolumner`, `ändrad`, `id`), svo
skriftur virka óháð tungumáli.

## Takmarkanir

- Þegar forritið er opnað úr möppu (file://) er ekki hægt að stöðva R-kóða meðan hann keyrir. Ef eitthvað frýs:
  *Endurræsa R*. Vistaðar skriftur verða ekki fyrir áhrifum, en hlutir í R-setunni hverfa. Keyri forritið af vefþjóni
  (localhost eða https) stöðvar hnappurinn *Stöðva* kóðann og heldur lotunni (sjá [faq.md](faq.md)).
- Vafrinn og WebAssembly takmarka minnið; haltu gagnasöfnum í R undir nokkrum hundruðum megabæta.
- Inntak meðan á keyrslu stendur (`readline()`, `menu()`) virkar ekki.
- Grafíkgluggar, kerfisskipanir, netköll og skrár utan sýndarskráakerfisins eru ekki aðgengileg.
- Hjálparsíður fylgja: `?dplyr::mutate` prentar hjálpartextann í stjórnborðið.
