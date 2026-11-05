# Statistikk, tidsseriar og modellar

Fana **Statistikk** i Analyser gjer vanlege analysar med skjema. Skjemaet skriv koden medan du fyller det ut, så du ser kva som
blir køyrt og kan ta med deg koden. **Tidsserieoperasjonane** i Bearbeid førebur seriar frå SDMX og PxWeb. Ein **modell** frå ein regresjon
kan lagrast og brukast som oppskriftssteget *Prediksjon* på nye data.

## Fana Statistikk

Vel eit datasett og eit verktøy, fyll ut skjemaet og trykk på *Køyr*. R blir brukt som standard; vel Python i skjemaet om du heller vil
det. Koden blir vist under skjemaet og kan opnast i konsollen med *Opne i konsollen*.

| Verktøy | Kva det gjev |
|---|---|
| Skildrande | Tal, manglande verdiar, gjennomsnitt, standardavvik, kvartilar, minste og største per kolonne, gjerne per gruppe; med éin kolonne òg eit histogram |
| Krysstabell | Tal per to kategoriar, gjerne med prosent, og ein kji²-test |
| Korrelasjon | Pearson eller Spearman mellom talkolonnar med ein farga tabell |
| Hypotesetest | t-test (to grupper, mot ein verdi, para), Mann-Whitney, variansanalyse og Kruskal-Wallis |
| Regresjon | Lineær eller logistisk med koeffisientar, standardfeil og p-verdiar; tekstkolonnar blir indikatorar |
| Klyngeanalyse | k-means med valfritt tal på klynger og eit nytt datasett med klynga som kolonne om du vil |

Over tabellen står ei setning om kva resultatet viser. Ho seier om ein skilnad er statistisk signifikant, ikkje kva han tyder.
Statistiske metodar føreset ting skjemaet ikkje kan sjå, til dømes korleis data er samla inn og om radene er uavhengige.
Vurderinga er di. Kvart resultat kan lagrast som datasett, og koden følgjer med i skildringa.

Python startar først når du trykkjer på *Køyr*, og scipy, statsmodels og scikit-learn blir henta første gongen dei trengst.

## Tidsseriar i Bearbeid

Gruppa **Tidsseriar** blant operasjonane er for tabellar med ein periodekolonne og eventuelt kolonnar som skil seriane, til
dømes kommune eller kjønn. Kvar operasjon er eit oppskriftssteg som kan angrast og spelast av ved neste henting.

| Operasjon | Kva han gjer |
|---|---|
| Tolk periodar | Lagar einsarta periodar (`2024-03`, `2024-Q1`, `2024`) av `2024M03`, `2024K1`, `2024-Q1`, `Q1 2024`, `202403`, `2024` og datoar, og ein datokolonne for diagram |
| Periodiser | Éi rad per kvartal eller år med sum, gjennomsnitt, siste verdi, minste eller største; tabellen blir erstatta |
| Endring over tid | Skilnad eller prosent mot førre periode eller same periode i fjor |
| Indeks | Kvar verdi mot ein basisperiode som er 100; eit år som basis tek gjennomsnittet av månadene eller kvartala i året |
| Glidande gjennomsnitt | Gjennomsnittet av dei siste periodane eller sentrert; berre heile vindauge gjev ein verdi |
| Sesongjuster | Trend, sesong og justert verdi med R (`stl`); serien må vere heil og minst to år lang, andre blir tomme |

Radene treng ikkje liggje i rekkjefølgje, og seriane blir ikkje blanda saman. Periodar i eit format som ikkje blir kjent att, blir tomme, så
kontroller talet i førehandsvisinga.

I Visualiser finst diagramtypane **Tidsserie** (éi linje per serie) og **Små multiplar** (eitt lite diagram per serie).

## Modellar og Prediksjon

Når ein regresjon er ferdig, kan du trykkje på *Lagre modellen*. Koeffisientane blir lagra i datasettet og følgjer med i pakkar og
tryggingskopiar. Verktøyet *Modellar* i fana Statistikk viser dei med formelen.

Operasjonen **Prediksjon frå ein modell** under Utrekningar i Bearbeid reknar ut ein ny kolonne med modellen, på same datasett eller eit
anna med dei same kolonnane. Utrekninga er vanleg SQL, så verken R eller Python trengst. Modellen blir kopiert inn i oppskriftssteget, så
oppskrifta kan spelast av sjølv om det opphavlege datasettet er borte. Skildringa av den nye kolonnen i kodeboka inneheld formelen og
tilpassinga til modellen.

- Manglar ein kolonne som modellen krev, får du ei melding om kva for ein.
- Ei rad med ein tom verdi i ein forklarande kolonne får ingen prediksjon.
- Ein tekstverdi modellen ikkje har sett, tel som referansenivået, det vil seie utan tillegg.
- Ein logistisk modell gjev sannsynet for det siste utfallet i alfabetisk rekkjefølgje.

Berre lineære og logistiske modellar kan lagrast, sidan dei kan uttrykkjast som ein formel. Modellar som krev det opphavlege biblioteket sitt,
kan ikkje køyrast som oppskriftssteg.
