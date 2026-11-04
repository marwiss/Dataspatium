# Statistik, tidsserier og modeller

Fanen **Statistik** i Analysér laver almindelige analyser med formularer. Formularen skriver koden, mens du udfylder den, så du ser,
hvad der køres, og kan tage koden med. **Tidsserieoperationerne** i Bearbejd forbereder serier fra SDMX og PxWeb. En **model** fra en
regression kan gemmes og bruges som recepttrinnet *Prædiktion* på nye data.

## Fanen Statistik

Vælg et datasæt og et værktøj, udfyld formularen, og tryk på *Kør*. R bruges som standard; vælg Python i formularen, hvis du hellere
vil det. Koden vises under formularen og kan åbnes i konsollen med *Åbn i konsollen*.

| Værktøj | Hvad det giver |
|---|---|
| Beskrivende | Antal, manglende værdier, middelværdi, standardafvigelse, kvartiler, mindste og største pr. kolonne, gerne pr. gruppe; med én kolonne også et histogram |
| Krydstabel | Antal pr. to kategorier, gerne med procent, og en chi²-test |
| Korrelation | Pearson eller Spearman mellem talkolonner med en farvet tabel |
| Hypotesetest | t-test (to grupper, mod en værdi, parret), Mann-Whitney, variansanalyse og Kruskal-Wallis |
| Regression | Lineær eller logistisk med koefficienter, standardfejl og p-værdier; tekstkolonner bliver indikatorer |
| Klyngeanalyse | k-means med valgfrit antal klynger og et nyt datasæt med klyngen som kolonne, hvis du vil |

Over tabellen står en sætning om, hvad resultatet viser. Den siger, om en forskel er statistisk signifikant, ikke hvad den betyder.
Statistiske metoder forudsætter ting, formularen ikke kan se, for eksempel hvordan data er indsamlet, og om rækkerne er uafhængige.
Vurderingen er din. Hvert resultat kan gemmes som datasæt, og koden følger med i beskrivelsen.

Python starter først, når du trykker på *Kør*, og scipy, statsmodels og scikit-learn hentes første gang, de skal bruges.

## Tidsserier i Bearbejd

Gruppen **Tidsserier** blandt operationerne er til tabeller med en periodekolonne og eventuelt kolonner, der adskiller serierne,
for eksempel kommune eller køn. Hver operation er et recepttrin, der kan fortrydes og afspilles ved næste hentning.

| Operation | Hvad den gør |
|---|---|
| Tolk perioder | Laver ensartede perioder (`2024-03`, `2024-Q1`, `2024`) af `2024M03`, `2024K1`, `2024-Q1`, `Q1 2024`, `202403`, `2024` og datoer og en datokolonne til diagrammer |
| Periodisér | Én række pr. kvartal eller år med sum, middelværdi, sidste værdi, mindste eller største; tabellen erstattes |
| Ændring over tid | Forskel eller procent mod forrige periode eller samme periode sidste år |
| Indeks | Hver værdi mod en basisperiode, der er 100; et år som basis tager middelværdien af årets måneder eller kvartaler |
| Glidende gennemsnit | Middelværdien af de seneste perioder eller centreret; kun hele vinduer giver en værdi |
| Sæsonkorrigér | Trend, sæson og korrigeret værdi med R (`stl`); serien skal være hel og mindst to år lang, andre forbliver tomme |

Rækkerne behøver ikke ligge i rækkefølge, og serierne blandes ikke sammen. Perioder i et format, der ikke genkendes, forbliver tomme,
så kontrollér antallet i forhåndsvisningen.

I Visualisér findes diagramtyperne **Tidsserie** (én linje pr. serie) og **Små multipler** (ét lille diagram pr. serie).

## Modeller og Prædiktion

Når en regression er færdig, kan du trykke på *Gem modellen*. Koefficienterne gemmes i datasættet og følger med i pakker og
sikkerhedskopier. Værktøjet *Modeller* i fanen Statistik viser dem med formlen.

Operationen **Prædiktion fra en model** under Beregninger i Bearbejd beregner en ny kolonne med modellen, på samme datasæt eller et
andet med de samme kolonner. Beregningen er almindelig SQL, så hverken R eller Python er nødvendig. Modellen kopieres ind i
recepttrinnet, så recepten kan afspilles, selv om det oprindelige datasæt er væk. Den nye kolonnes beskrivelse i kodebogen indeholder
modellens formel og tilpasning.

- Mangler en kolonne, som modellen kræver, får du en besked om hvilken.
- En række med en tom værdi i en forklarende kolonne får ingen prædiktion.
- En tekstværdi, modellen ikke har set, tæller som referenceniveauet, det vil sige uden tillæg.
- En logistisk model giver sandsynligheden for det sidste udfald i alfabetisk rækkefølge.

Kun lineære og logistiske modeller kan gemmes, da de kan udtrykkes som en formel. Modeller, der kræver deres oprindelige bibliotek,
kan ikke køres som recepttrin.
