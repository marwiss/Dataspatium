# Skjöl og skjalasnið

Undir **Flytja út › Skjöl** býrðu til skjöl úr gagnasafni: skýrslur, kóðabækur og samantektir fyrir hvern hóp. Snið er
venjulegur texti í Markdown með staðgenglum. Sama sniðið gefur HTML, Word (DOCX), PDF, Markdown og LaTeX og má keyra í
hópkeyrslu svo hvert sveitarfélag, ár eða annar hópur fái sitt eigið skjal.

Staðgenglarnir og lykilorð taflnanna eru sænsk orð (`{{datamangd}}`, `kolumner`, `sortera`, …). Þau eru hluti af sniðmálinu og
eru þau sömu hvaða tungumál sem forritið er sýnt á; textar innbyggðu sniðanna fylgja tungumáli forritsins.

## Svona gerirðu

1. Veldu gagnasafn í hlutaspjaldinu og opnaðu flipann **Skjöl** í Flytja út.
2. Veldu snið: **Skýrsla um gagnasafn**, **Kóðabók** eða **Samantekt fyrir hvern hóp**, eða eigið vistað snið. Sniðið birtist
   til vinstri og forskoðunin til hægri uppfærist meðan þú skrifar.
3. Veldu snið skrárinnar og ýttu á **Búa til skjal**. Skránni er hlaðið niður.
4. **Hópkeyrsla eftir hópum** býr til eitt skjal fyrir hvert gildi í dálki og pakkar þeim í ZIP-skrá með skráarlista.
5. **Vista snið** vistar breytingarnar þínar í vinnusvæðinu (innbyggð snið eru vistuð sem afrit). **Flytja út snið (skrá)** gefur
   `*.doc.json` sem samstarfsmaður getur bætt við með **Flytja inn snið (skrá)**. Eigin snið fylgja afriti vinnusvæðisins.

## Sniðmálið

Sniðið er Markdown: `#`, `##`, `###` fyrir fyrirsagnir, auðar línur milli málsgreina, `-` fyrir punktalista, `1.` fyrir
númeraða lista, `**feitletrað**`, `*skáletrað*`, `` `kóði` ``, `[texti](https://…)` fyrir tengla, `---` fyrir línu og töflur
með lóðstrikum.

Öfugt skástrik á undan `*`, `_`, `` ` ``, `|`, `[`, `]` eða `#` sýnir stafinn eins og hann er, líka í töflureit.

Staðgenglar eru skrifaðir með tvöföldum slaufusvigum (Mustache). Tölur fá snið tungumáls forritsins (á íslensku 1.234,5).

| Staðgengill | Innihald |
|---|---|
| `{{datamangd}}`, `{{beskrivning}}`, `{{kalla}}` | Heiti, lýsing og uppruni gagnasafnsins |
| `{{antal_rader}}`, `{{antal_kolumner}}` | Fjöldi raða (eftir síur) og dálka |
| `{{datum}}`, `{{tid}}`, `{{app}}` | Dagsetning dagsins, klukkan og útgáfa forritsins |
| `{{summor.kolumn}}`, `{{medel.kolumn}}`, `{{minsta.kolumn}}`, `{{storsta.kolumn}}` | Summa, meðaltal, lægsta og hæsta gildi töludálks (skiptu `kolumn` út fyrir heiti dálksins) |
| `{{grupp}}`, `{{gruppkolumn}}` | Gildi hópsins og heiti dálksins í hópkeyrslum |
| `{{#rader}} … {{/rader}}` | Endurtekið fyrir hverja röð (að hámarki 1 000); innan þess eru dálkaheitin notuð, til dæmis `{{kommun}}` |
| `{{#kolumner}} … {{/kolumner}}` | Endurtekið fyrir hvern dálk með `{{namn}}`, `{{typ}}`, `{{etikett}}`, `{{beskrivning}}`, `{{enhet}}` og `{{vardeetiketter}}` (til dæmis `1 = Karl; 2 = Kona`; þrjú síðustu eru tóm nema þau hafi verið stillt undir Vinna) |
| `{{#beskrivning}} … {{/beskrivning}}` | Birtist aðeins ef gildið er til (Mustache-hluti) |

Dálkaheiti eru skrifuð eins og í töflunni (hreinsuð heiti, til dæmis `folkmangd`).

### Töflur úr gagnasafninu

```
{{#tabell}}kolumner: kommun, folkmangd; sortera: folkmangd fallande; topp: 10; filter: lan = Skåne län; rubrik: Stærstu sveitarfélögin{{/tabell}}
```

Allir hlutar eru valfrjálsir: án `kolumner` eru allir dálkar teknir með, án `topp` eru 50 raðir sýndar (að hámarki 5 000),
`sortera` tekur `stigande` (vaxandi) eða `fallande` (minnkandi), `filter` tekur skilyrði með `=`, `!=`, `>`, `>=`, `<`, `<=`
eða `innehåller` (inniheldur) sem má sameina með `och` eða `and`, og `rubrik` er fyrirsögn töflunnar. `kalla: kolumner` gefur
í staðinn töflu yfir dálka gagnasafnsins (heiti, gerð, merkimiði, lýsing og eining, og gildismerkimiðar þegar einhver dálkur hefur þá). Töludálkar eru hægrijafnaðir.

### Myndrit

```
{{diagram "Mannfjöldi eftir lénum" | bredd: 600}}
```

Setur inn vistað myndrit úr Myndgera (Vega-Lite eða D3) sem mynd, teiknað með sömu síum og skjalið; `bredd` er breiddin í
pixlum. Í hópkeyrslum er myndritið síað á hópinn. R- og Python-myndrit eru teiknuð af vélum sínum þegar skjalið er búið til (nokkrar sekúndur á myndrit).

### Síðuskil og kóðabók

`{{bild "skra.jpg" | bredd: 400}}` setur inn mynd úr myndasafni (sjá [dokument.md](dokument.md)): myndin er fyrst
leituð í gagnasafni sniðmátsins og síðan í öllum myndasöfnum, forskoðunin er notuð og skölud í gefna breidd
(sjálfgefið mest 720 px; `hojd` má einnig gefa). Merkið virkar í öllum sniðum og í hópkeyrslum eins og `{{diagram}}`.
`{{sidbrytning}}` brýtur síðu í Word, PDF og LaTeX. Sniðið **Kóðabók** notar útvíkkaðar dálkaupplýsingar: `{{saknade}}`,
`{{unika}}`, `{{minsta}}`, `{{storsta}}`, `{{medel}}`, `{{anmarkningar}}` og `{{ar_unik}}` fyrir hvern dálk auk
`{{dubbletter}}`; þær eru til þegar sniðið er merkt sem kóðabók (afrit af innbyggða sniðinu heldur því).

`{{karta "gagnasafn"}}`, `{{graf "gagnasafn"}}`, `{{modell "gagnasafn"}}` og `{{plan "gagnasafn"}}` setja inn eigin mynd gagnasafnsins án vistaðs myndrits. Gagnasafnið er gefið með nafni eða stuttnafni, og breidd og hæð eins og fyrir `{{diagram}}`. Sniðmát lætur vita ef gagnasafnið vantar eða ekki er hægt að teikna það þannig.

## Skoðunarskýrsla og viðhaldsáætlun

Atriðin úr *Athuga með gervigreind* (sjá [cad-bim.md](cad-bim.md)) verða að skoðunarskýrslu eða viðhaldsáætlun með innbyggðu
sniðunum **Skoðunarskýrsla** og **Viðhaldsáætlun**. *Gera skýrslu* og *Gera viðhaldsáætlun* í gervigreindarspjaldinu, og kortið
*Skýrsla og viðhaldsáætlun* í Athuga þegar tafla með atriðum er valin, opna flipann Skjöl með töfluna valda og sniðið tilbúið; í
gervigreindarspjaldinu eru atriðin fyrst vistuð sem tafla ef þau eru ekki þegar vistuð. Efst eru upplýsingar um bygginguna úr
líkaninu: bygging, verkefni, lóð, hæðir, líkan, skrá og IFC-skema, og auðkenni byggingarinnar og byggingarár þegar
Pset_BuildingCommon hefur þau. Síðan koma atriðin eftir byggingarhluta, sex lögum byggingarinnar eftir reglum loftslagsyfirlýsingarinnar
(IFC-klasi einingarinnar, IsExternal og LoadBearing), með ljósmynd, ástandi, forgangi og ráðlagðri aðgerð; innan byggingarhluta kemur
það sem liggur mest á fyrst. Byggingarhlutinn er í dálkinum `byggdel` (1–6) í töflunni með atriðum og má leiðrétta hann undir Vinna.
Ljósmyndirnar fylgja töflunni án EXIF-upplýsinga sinna, og staðsetning ljósmyndarinnar kemur aðeins í skjalið ef þú bætir sjálf(ur)
við `{{plats}}`.

Viðhaldsáætlunin setur ár á hverja aðgerð eftir reglunni í sniðinu:

```
{{#underhallsregel}}prioritet: urgent 0, high 1, medium 3, low 5; skick: critical 0, poor 1, fair 3, good 10; intervall: 5{{/underhallsregel}}
```

Ár aðgerðarinnar er ár skoðunarinnar (dagsetning atriðisins) að viðbættum lægsta fjölda ára sem forgangur og ástand gefa, svo að
alvarlegt ástand gengur fyrir litlum forgangi, og næsta athugun kemur `intervall` árum eftir aðgerðina. Stigin eru skrifuð með
kóðanum eða orðinu (brýnn, mikill, miðlungs og lítill; alvarlegt, lélegt, viðunandi og gott). Breyttu tölunum í afriti af sniðinu;
merkið sést ekki í skjalinu.

| Staðgengill | Innihald |
|---|---|
| `{{#byggdelar}} … {{/byggdelar}}` | Einn hópur fyrir hvern byggingarhluta með `{{namn}}`, `{{antal}}` og atriðunum í `{{#fynd}} … {{/fynd}}` |
| `{{#klasser}}`, `{{#plan}}` | Sams konar hópar eftir IFC-klasa og eftir ári aðgerðar |
| `{{#fynd}}`, `{{#tidsplan}}` | Öll atriði í röð töflunnar eða eftir ári aðgerðar |
| `{{nr}}`, `{{titel}}`, `{{beskrivning}}`, `{{element}}`, `{{ifc_klass}}`, `{{vaning}}`, `{{byggdel}}` | Atriðið og eining þess |
| `{{skick}}`, `{{prioritet}}`, `{{atgard}}`, `{{datum}}`, `{{foto}}`, `{{bild}}` | Ástand og forgangur í orðum, aðgerðin, dagsetningin, heiti ljósmyndarinnar og ljósmyndin sem mynd |
| `{{ar}}`, `{{nasta_kontroll}}` | Ár aðgerðarinnar og ár næstu athugunar |
| `{{#fakta}}`, `{{byggnad.namn}}` | Upplýsingar um bygginguna, með `{{namn}}` og `{{varde}}` í `{{#fakta}}` |
| `{{antal_fynd}}`, `{{besiktningsdatum}}`, `{{#per_skick}}`, `{{#per_prioritet}}` | Fjöldi atriða, dagsetningar skoðunarinnar og fjöldi eftir ástandi og forgangi (`{{ord}}`, `{{antal}}`) |

Texti atriðanna kemur með eins og hann stendur: stafir eins og `*`, `_` og `|` verða aldrei að sniði.

## Snið skráa

| Snið | Hvað þú færð |
|---|---|
| HTML | Sjálfstæða síðu með innbyggðum stíl og innfelldum myndum, opnast í hvaða vafra sem er og má prenta |
| Word (DOCX) | Fyrirsagnir, málsgreinar, lista, töflur með fyrirsagnaröð og myndir; letur Arial; opnast í Word og LibreOffice |
| PDF | A4 með blaðsíðutölum, töflur gegnum jsPDF og jspdf-autotable; letur Helvetica |
| Markdown | `.md`; með myndum ZIP með `figures/` |
| LaTeX | ZIP með `main.tex` (article, booktabs, longtable, graphicx, hyperref, babel á tungumáli forritsins) og `figures/`; þýtt með pdflatex, xelatex eða lualatex, eða hlaðið upp á Overleaf |

Texti er alltaf varinn fyrir markmiðssniðið: `&`, `<` og `>` í HTML, `&`, `%`, `_` og fleiri í LaTeX, XML í DOCX.

## Takmarkanir

- Snið eru birt í vafranum; mjög stórar töflur í skjölum taka tíma, einkum í PDF og Word.
- PDF og Word nota staðalletur (Helvetica og Arial) í stað Inter forritsins.
- Markdown-stuðningurinn er úrval: engar neðanmálsgreinar, engir hreiðraðir listar, engar fyrirsagnir undir fjórða stigi.
- LaTeX er ekki þýtt í vafranum.
