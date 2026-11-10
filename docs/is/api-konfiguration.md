# Opnar vefþjónustur og API-uppsetningar

Dataspatium sækir gögn beint úr opnum vefþjónustum í vafrann þinn. Ekkert fer gegnum neinn þjón: köllin fara frá tölvunni þinni
til þjónustu stofnunarinnar, og svarið verður gagnasafn í vinnusvæðinu. Það krefst þess að þjónustan leyfi köll úr vöfrum
(CORS); allar forstillingar hér að neðan hafa verið athugaðar með tilliti til þess.

## Forstilltir upprunar

Listinn í Sækja er flokkaður eftir löndum. Landahnapparnir fyrir ofan hann (Svíþjóð, Danmörk, Noregur, Finnland, Ísland,
Færeyjar, Grænland, Álandseyjar, Norðurlönd, ESB, Alþjóðlegt) velja hvaða landa upprunar birtast; valið er vistað í vafranum. Heiti og
lýsingar upprunanna fylgja tungumáli forritsins, og PxWeb-þjónustur sem eru á fleiri tungumálum (Hagstofa Íslands, SCB, SSB,
Hagstofa Finnlands, Hagstofa Grænlands, ÅSUB) eru skoðaðar á tungumáli forritsins þegar þjónustan býður upp á það. Allir upprunar
hér að neðan voru athugaðir með tilliti til CORS í nóvember 2026, og aðeins tveir síðustu sænsku krefjast lykils.

| Land | Uppruni | Hvað | Svona sækirðu |
|---|---|---|---|
| Ísland | Hagstofa Íslands | Opinberar hagtölur, á íslensku og ensku | Flettu í gagnasöfnunum, veldu gildi; 10 000 reitir í hverju kalli |
| Ísland | Veðurstofa Íslands | Veðurathuganir eftir stöðvum | Gefðu upp stöðvanúmer |
| Danmörk | Danmarks Statistik Statistikbanken | Opinberar hagtölur (api.statbank.dk) | Flettu í efnistrénu, veldu töflu og gildi fyrir hverja breytu; breytur sem ekki eru valdar eru lagðar saman |
| Danmörk | Open Data DK | Gagnagátt danskra sveitarfélaga og landshluta | Leitaðu að gagnasöfnum, ein röð fyrir hverja skrá, fluttu skrána inn með Af vefslóð |
| Noregur | SSB Statistikkbanken (API v1 og v2) | Opinberar hagtölur, á norsku og ensku | Flettu í efnistrénu eða leitaðu að töflu, veldu gildi; 800 000 reitir í hverju kalli |
| Noregur | FHI Statistikk | Lýðheilsutölur úr skrám og hagtölubönkum Lýðheilsustofnunar Noregs | Veldu uppruna, töflu og gildi fyrir hverja vídd (mælikvarðarnir í MEASURE_TYPE) |
| Noregur | Enhetsregisteret (Brønnøysundregistrene) | Fyrirtæki og samtök | Leitaðu eftir heiti, sveitarfélagi, rekstrarformi eða atvinnugreinakóða |
| Noregur | Kartverket kommuneinfo | Sveitarfélög og fylki | Sæktu listana, líka sveitarfélög eftir fylkjum |
| Noregur | MET Norway Locationforecast | Veðurspá fyrir hnit | Gefðu upp breidd og lengd |
| Finnland | Hagstofa Finnlands StatFin | Opinberar hagtölur, á finnsku, sænsku og ensku | Flettu í efnistrénu, veldu gildi; 100 000 reitir í hverju kalli |
| Finnland | Lykiltölur sveitarfélaga (Hagstofa Finnlands) | Lykiltölur eftir sveitarfélögum og velferðarsvæðum | Flettu, veldu gildi |
| Finnland | Sotkanet (THL) | Vísar fyrir heilsu og velferð | Sæktu vísa og svæði, síðan gildi fyrir vísi og ár |
| Finnland | YTJ fyrirtækjaskrá (PRH) | Fyrirtæki | Leitaðu eftir heiti, stað, fyrirtækjanúmeri eða atvinnugrein |
| Finnland | Digitraffic vegveður (Fintraffic) | Vegveðurstöðvar og mælingar | Sæktu stöðvar (punktakort) og nýjustu mælingar |
| Finnland | Veðurstofa Finnlands FMI | Veðurathuganir eftir stað eða stöð | Gefðu upp stað eða auðkenni stöðvar, breytur og tímabil |
| Finnland | Avoindata.fi | Gagnagátt Finnlands | Leitaðu að gagnasöfnum, ein röð fyrir hverja skrá |
| Grænland | Grønlands Statistik | Opinberar hagtölur, á dönsku og ensku | Flettu, veldu gildi |
| Færeyjar | Hagstova Føroya | Opinberar hagtölur, á ensku | Flettu, veldu gildi |
| Álandseyjar | ÅSUB | Opinberar hagtölur, á sænsku og ensku | Flettu, veldu gildi |
| Norðurlönd | Nordic Statistics database | Samanburðarhæfar norrænar hagtölur, á ensku | Flettu, veldu gildi |
| ESB | Eurostat | Hagtölur ESB | Gefðu upp kóða gagnasafnsins og síur |
| ESB | Seðlabanki Evrópu (ECB) | Gengi gjaldmiðla og hagtölur ECB (SDMX) | Veldu gjaldmiðla og tíðni fyrir gengið, eða gefðu upp gagnaflæði og raðlykil |
| Alþjóðlegt | OECD | Atvinnuleysi, hagvöxtur og aðrar hagtölur OECD (SDMX) | Veldu lönd, eða gefðu upp gagnaflæði og raðlykil |
| Svíþjóð | SCB Statistikdatabasen (API v1 og v2) | Opinberar hagtölur | Flettu eða leitaðu, veldu gildi |
| Svíþjóð | Folkhälsomyndigheten, Socialstyrelsen, Kolada, SMHI, Naturvårdsverket, landupplýsingaskrá Lantmäteriet, gagnagátt Svíþjóðar | Lýðheilsa, heilbrigði, lykiltölur sveitarfélaga, veður, loftgæði, verndarsvæði, landupplýsingar | Sjá sænsku leiðbeiningarnar |
| Svíþjóð | Lantmäteriet Direkt, Boverket | Örnefni, orkuvottorð | Krefjast lykils |

Ekki með: opingogn.is hefur ekki lengur leitarvefþjónustu; DMI í Danmörku og Frost (MET) í Noregi krefjast lykils; Energi Data
Service og data.norge.no hafa ekki CORS. Uppruna án CORS er ekki hægt að ná beint úr vafranum; þeir krefjast eigin milliþjóns,
sjá hér að neðan.

Landupplýsingauppsprettur (fjölskyldan `geodata` með `kind` `wfs`, `ogcapi` eða `arcgis`) koma án endapunkta: lögin eru
lesin úr þjónustunni þegar uppsprettan er opnuð og vistuð í þínu eintaki af stillingunni. Forstillt: opin
landupplýsingagögn SCB, SGU, Havs- och vattenmyndigheten, Riksantikvarieämbetet, Skogsstyrelsen (ArcGIS), Kartverket
(stjórnsýslueiningar, fasteignakort), Hagstofa Finnlands, SYKE (ArcGIS) og, með lykli, landupplýsingavettvangur
Lantmäteriet (deiliskipulag). Uppsprettan *Geodataportalen (sök geodata)* (fjölskyldan `geoportal`, svarsniðið
`geonetwork`) leitar í sænsku landsskránni. Sjá [kallor.md](kallor.md#opin-landupplýsingagögn).

## Svona gerirðu

1. Opnaðu haminn **Sækja** og veldu uppruna undir **Opnar vefþjónustur** í hlutaspjaldinu. Landahnapparnir fyrir ofan listann
   takmarka hann við valin lönd.
2. Ef uppruninn krefst lykils gefurðu hann upp undir **Auðkenning**. Veldu **Nota í þessari setu** (gleymist þegar síðunni er
   lokað) eða **Vista dulkóðað** með lykilsetningu.
3. Flettu eða leitaðu að því sem þú vilt. Fyrir PxWeb-þjónusturnar (Hagstofa Íslands, hinar norrænu hagstofurnar,
   Folkhälsomyndigheten), Danmarks Statistik, FHI og Socialstyrelsen velurðu gildi fyrir hverja breytu; fjöldi reita birtist,
   og vali sem fer yfir mörk þjónustunnar er sjálfkrafa skipt í fleiri köll. Fyrir aðra uppruna fyllirðu út breytur kallsins.
   Listar (stöðvar, sveitarfélög, vörur) eru sóttir frá þjónustunni þegar þú opnar reitinn.
4. Ýttu á **Sækja**. Framvindan birtist og hætta má við. **Forskoða fyrstu síðu** sækir aðeins eitt kall.
5. Farðu yfir töfluna og ýttu á **Vista sem gagnasafn**, eða bættu röðunum við fyrirliggjandi gagnasafn (bæta við eða skipta
   út). Gagnasafnið fær upprunann í lýsingu sína: útgefanda, töflu, vistfang og leyfi.

Eiginleikaspjaldið sýnir útgefanda, leyfi, beiðnamörk og nýjustu köllin með stöðu og svartíma.

## Uppfæra sótt gagnasafn

Gagnasöfn sem koma úr vefþjónustu muna upprunann og valið. Undir **Vistaðar sóknir** í Sækja eru þau sýnd með uppruna, síðustu
sókn og fjölda raða. **Uppfæra** sækir sömu gögn aftur, skiptir út röðunum og keyrir uppskrift gagnasafnsins aftur, svo að
hreinsanir og reiknaðir dálkar koma aftur; **Uppfæra allt** gerir það fyrir þau öll í röð, og skipanaspjaldið og Umsjón bjóða
það sama sem **Sækja API-gagnasöfn aftur**. Ef sóknin eða skref í uppskriftinni mistekst helst gagnasafnið eins og það var og
villan birtist. Skref í uppskrift sem þarf leyndarmál (til dæmis lykil fyrir dulnefningu) er ekki hægt að keyra sjálfkrafa. Í
**Umsjón** er líka **Sækja aftur**, þar sem þú velur á milli þess að uppfæra og að setja nýju raðirnar aftast án þess að keyra
uppskriftina.

## Lyklar og öryggi

- Lyklar eru aldrei vistaðir í hreinum texta. Sjálfgefið eru þeir aðeins í minni meðan setan stendur.
- **Vista dulkóðað** dulkóðar lykilinn með lykilsetningu (PBKDF2 og AES-GCM) í gagnagrunni vafrans. Sama lykilsetning gildir
  um alla vistaða lykla. Lykilsetningin er ekki vistuð; ef þú gleymir henni þarftu að slá lyklana inn aftur.
- Þegar forritið er opnað aftur eru vistaðir lyklar læstir þar til þú gefur upp lykilsetninguna (**Aflæsa vistuðum lyklum**).
- Lyklar eru aðeins sendir á það vistfang sem uppsetningin tilgreinir og fylgja aldrei með þegar uppsetning er flutt út eða afrit
  tekið af vinnusvæðinu.
- Undir file:// deila allar staðbundið opnaðar HTML-síður geymslu í Chromium. Þess vegna er dulkóðun sjálfgefin fyrir vistaða
  lykla.

## Milliþjónn fyrir þjónustur án CORS

Undir **Fleiri valkostir** í eiginleikaspjaldinu geturðu gefið upp vistfang milliþjóns sem þú rekur sjálf(ur), til dæmis
`https://minn-proxy.daemi/?url={url}`. `{url}` er skipt út fyrir kóðaða markvistfangið; ef `{url}` vantar er markvistfanginu
bætt við aftast. Dataspatium afhendir engan milliþjón og sendir aldrei neitt á annan þjón en þann sem þú gefur sjálf(ur) upp.

## Snið uppsetninga

Uppruna er lýst með JSON-skrá með endingunni `.api.json`. Eigin uppsetningum er bætt við með **Bæta við API úr skrá** og má
flytja út með **Flytja út uppsetningu** til að deila þeim. Forstillingarnar eru í `presets/api/` í forritsmöppunni og eru góður
upphafspunktur. Grunntungumál skrárinnar er sænska; þýðingum er bætt í reitinn `i18n` fyrir hvert tungumál, og forritið sýnir
textana á sínu eigin tungumáli. Sniðinu er lýst að fullu í [ensku leiðbeiningunum](../en/api-konfiguration.md) og
[þeim sænsku](../sv/api-konfiguration.md); reitirnir eru:

- efsta stig: `format`, `id`, `name`, `publisher`, `description`, `docs`, `license`, `notes`, `level` (1 = enginn lykill,
  2 = lykill), `country` (`SE`, `DK`, `NO`, `FI`, `IS`, `FO`, `GL`, `AX`, `NORDIC`, `EU`, `INT`), `i18n`, `baseUrl`, `headers`, `auth`,
  `rateLimit`, `family` (`pxweb`, `statbank`, `fhi`, `socialstyrelsen`) og `endpoints`;
- endapunktur: `id`, `name`, `description`, `method`, `path`, `headers`, `params`, `body`, `bodyType`, `pagination`, `response`,
  `dataset`;
- breyta: `name`, `in`, `type`, `label`, `help`, `example`, `required`, `default`, `hidden`, `raw`, `template`, `optionsFrom`.

## Skrifa eigin uppsetningu

1. Lestu skjölun þjónustunnar og prófaðu kall í vafranum eða með `curl`.
2. Athugaðu CORS: `curl -s -D - -o /dev/null -H "Origin: null" "https://api.daemi.is/..."` á að sýna
   `Access-Control-Allow-Origin: *` (eða `null`). Ef línan er ekki til virkar þjónustan aðeins gegnum milliþjón.
3. Byrjaðu á forstillingu í `presets/api/`, breyttu henni og vistaðu sem `min-thjonusta.api.json`.
4. Bættu skránni við í Sækja. Villur í uppsetningunni birtast með heitum reita; sniðið er athugað gagnvart skema
   (`src/api/schema.js`).
5. Deildu skránni. Hún inniheldur aldrei lykla.

## Takmarkanir

- Skilmálar MET Norway krefjast þess að forrit sem kalla auðkenni sig með User-Agent. Vafrar senda eigin auðkenningu, sem
  þjónustan samþykkir í dag; haltu fjölda kalla lágum.
- SDMX er lesið sem SDMX-JSON 1.0 eða 2.0 (gagnaskeyti; Seðlabanki Evrópu og OECD senda það með færibreytunni
  `format=jsondata` eða `Accept`-haus). SDMX-ML og SDMX-CSV eru ekki þáttuð. JSON-stat 1.x (Danmarks Statistik) og 2.0
  eru bæði lesin.
- PX-skrár eru ekki þáttaðar í JavaScript; sæktu JSON-stat eða notaðu pakkann pxR í R.
- Stór svör (hundruð þúsunda raða) taka tíma að þátta í vafranum. Takmarkaðu valið eða notaðu `maxPages`.
- Köll eru aðeins gerð þegar þú ýtir á Sækja eða opnar reit með valkostum frá þjónustunni.
