# Leyfi

Þetta er útskýring á íslensku. Allur leyfistextinn í [LICENSE](../../LICENSE) gildir. Textinn er ekki lögfræðiráðgjöf.

## Eigin kóði Dataspatium

Eigin kóði Dataspatium, skjölun og forstillingar (allt nema mappan `vendor/`) eru með leyfið **PolyForm Strict 1.0.0**
(<https://polyformproject.org/licenses/strict/1.0.0>). Leyfisveitandi er höfundur Dataspatium, sem næst í gegnum
GitHub-aðganginn [marwiss](https://github.com/marwiss).

Þetta máttu gera:

- Hlaða niður og nota forritið í óviðskiptalegum tilgangi: til einkanota, náms, rannsókna, kennslu og góðgerðarstarfa og innan
  stjórnvalda, sveitarfélaga, landshluta og annarra opinberra stofnana, óháð því hvernig starfsemin er fjármögnuð.
- Nota forritið á eins mörgum tölvum og þú vilt innan fyrirtækis þíns eða stofnunar.
- Búa til eigin gagnasöfn, uppskriftir, myndrit, R-skriftur, API-uppsetningar og skjalasnið með forritinu og deila þeim að
  vild. Þau eru þín eigin verk, ekki hluti af forritinu.

Þetta máttu ekki gera án skriflegs leyfis leyfisveitanda:

- Nota forritið í viðskiptalegri starfsemi, til dæmis í ráðgjafarverkefnum eða sem hluta af vöru eða þjónustu.
- Dreifa forritinu áfram, í heild eða að hluta, eða birta eigin afrit. (Notkunarskilmálar GitHub leyfa að geymslunni sé kvíslað
  á GitHub; það veitir engin réttindi umfram það.)
- Breyta kóðanum eða byggja eigin verk á honum.

Ef þú vilt nota Dataspatium á öðrum skilmálum skaltu stofna issue í geymslunni eða hafa samband við leyfisveitandann þar.

## Íhlutir þriðja aðila

Allt undir `vendor/` er kóði þriðja aðila með eigin leyfi sem leyfi Dataspatium hefur ekki áhrif á. Hvert safn, útgáfa þess og
leyfi eru í [THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md) ásamt leyfistextunum.

| Íhlutur | Leyfi | Hvað það þýðir |
|---|---|---|
| JavaScript-söfn (sql.js, Dexie, D3, Vega, PapaParse, SheetJS, docx, jsPDF, fflate, CodeMirror og fleiri) | MIT, BSD-3-Clause, Apache-2.0, ISC | Frjálst að nota og dreifa svo lengi sem leyfistexti og tilkynningar fylgja |
| Letrið Inter | SIL Open Font License 1.1 | Má fella inn í forritið; má ekki selja eitt og sér |
| Lucide-tákn (líka merki forritsins og favicon) | ISC | Eins og að ofan |
| webR (JavaScript-hlutinn) | MIT | Eins og að ofan |
| R (R.wasm og fleira) | GPL-2 eða GPL-3 | Frjáls hugbúnaður. Dreift óbreyttu á tvíundarformi; frumkóðinn fæst hjá R-verkefninu og webR-verkefninu í tilgreindum útgáfum |
| R-pakkar í `vendor/webr-repo` | Aðallega MIT; líka LGPL (DBI, RSQLite), MPL-2.0 (data.table), GPL (Rcpp, pxR, knitr, svglite og fleiri) | Dreift óbreyttum; frumkóðinn fæst á CRAN í tilgreindum útgáfum |
| Python (Pyodide, CPython og pakkar eins og numpy, pandas og matplotlib; sótt eftir þörfum, ekki í möppunni) | MPL-2.0 (Pyodide, micropip), PSF-2.0 (CPython), BSD-3-Clause (numpy, pandas), matplotlib-leyfið (byggt á PSF), MIT og sambærilegt fyrir hitt | Sótt óbreytt frá jsDelivr og vistað í vafranum; frumkóðinn er hjá Pyodide-verkefninu og á PyPI í þeim útgáfum sem skrá forritsins tilgreinir (Pyodide 314.0.7) |
| pdf.js 3.11 (les PDF-skrár) með staðalletri | Apache-2.0 (pdf.js), BSD-3-Clause (letur Foxit), SIL Open Font License 1.1 (Liberation Sans) | Frjálst að nota og dreifa með leyfistexta og tilkynningum; letrið má fella inn |
| Leaflet 1.9 (kort) og Turf 7 (landfræðitól) | BSD-2-Clause (Leaflet), MIT (Turf) | Frjálst að nota og dreifa með leyfistexta og tilkynningum |
| Cytoscape 3.34 með fcose, dagre og expand-collapse, sigma 3 og graphology (net) | MIT | Frjálst að nota og dreifa með leyfistexta og tilkynningum |
| neo4j-driver-lite 6.3 (Neo4j yfir Bolt) | Apache-2.0 | Frjálst að nota og dreifa með leyfistexta og tilkynningum |
| Planbestämmelsekatalog Boverket (innbyggt eintak, `presets/plan/`) | Opin gögn frá Boverket | Frjálst að nota og dreifa; tilgreina skal Boverket og Planbestämmelsekatalogen sem heimild |
| plotly.js (sótt eftir þörfum fyrir plotly-myndrit), seaborn og plotly (Python-hjól frá PyPI, sótt eftir þörfum) | MIT (plotly.js, plotly), BSD-3-Clause (seaborn) | Sótt óbreytt frá jsDelivr og PyPI, fest við útgáfu og prófsummu, og vistað í vafranum |

Kóði Dataspatium tengist ekki R. R keyrir sem sérstakur túlkur í worker og skiptist á R-kóða, SQLite-skrám og myndum við
forritið gegnum skilaboð; það er sú tegund samdreifingar („mere aggregation“) sem GPL leyfir, og R-hlutarnir halda öllum
GPL-réttindum sínum fyrir þig sem notanda. Sýnigögn í `presets/` koma frá opnum uppruna og halda upprunalegum leyfum sínum (CC0
eða CC BY eftir hverri stofnun). Sænsku sveitarfélaga- og lénamörkin í `presets/geo/` eru *Digitala gränser* SCB undir CC0 1.0,
umreiknuð í lengd og breidd. Dönsku mörkin eru DAGI 1:500 000 frá Geodatastyrelsen (nú Klimadatastyrelsen), frjáls gögn
sem nota má og deila með tilvísun í heimild; þau norsku koma úr N1000 Kartdata frá Kartverket og þau finnsku frá Hagstofu
Finnlands, bæði undir CC BY 4.0 (heimild „© Kartverket“ og „Tilastokeskus / Hagstofa Finnlands“). Sjá `presets/geo/KALLA.md`. Gögn sem sótt eru úr opnu vefþjónustunum falla undir leyfi hvers
útgefanda, sem birtist með upprunanum í forritinu.
