# Statistikk, tidsserier og modeller

Fanen **Statistikk** i Analyser gjør vanlige analyser med skjemaer. Skjemaet skriver koden mens du fyller det ut, så du ser hva som
kjøres og kan ta med deg koden. **Tidsserieoperasjonene** i Bearbeid forbereder serier fra SDMX og PxWeb. En **modell** fra en regresjon
kan lagres og brukes som reseptsteget *Prediksjon* på nye data.

## Fanen Statistikk

Velg et datasett og et verktøy, fyll ut skjemaet og trykk på *Kjør*. R brukes som standard; velg Python i skjemaet hvis du heller vil
det. Koden vises under skjemaet og kan åpnes i konsollen med *Åpne i konsollen*.

| Verktøy | Hva det gir |
|---|---|
| Beskrivende | Antall, manglende verdier, gjennomsnitt, standardavvik, kvartiler, minste og største per kolonne, gjerne per gruppe; med én kolonne også et histogram |
| Krysstabell | Antall per to kategorier, gjerne med prosent, og en kji²-test |
| Korrelasjon | Pearson eller Spearman mellom tallkolonner med en farget tabell |
| Hypotesetest | t-test (to grupper, mot en verdi, paret), Mann-Whitney, variansanalyse og Kruskal-Wallis |
| Regresjon | Lineær eller logistisk med koeffisienter, standardfeil og p-verdier; tekstkolonner blir indikatorer |
| Klyngeanalyse | k-means med valgfritt antall klynger og et nytt datasett med klyngen som kolonne hvis du vil |

Over tabellen står en setning om hva resultatet viser. Den sier om en forskjell er statistisk signifikant, ikke hva den betyr.
Statistiske metoder forutsetter ting skjemaet ikke kan se, for eksempel hvordan data er samlet inn og om radene er uavhengige.
Vurderingen er din. Hvert resultat kan lagres som datasett, og koden følger med i beskrivelsen.

Python starter først når du trykker på *Kjør*, og scipy, statsmodels og scikit-learn hentes første gang de trengs.

## Tidsserier i Bearbeid

Gruppen **Tidsserier** blant operasjonene er for tabeller med en periodekolonne og eventuelt kolonner som skiller seriene, for
eksempel kommune eller kjønn. Hver operasjon er et reseptsteg som kan angres og spilles av ved neste henting.

| Operasjon | Hva den gjør |
|---|---|
| Tolk perioder | Lager ensartede perioder (`2024-03`, `2024-Q1`, `2024`) av `2024M03`, `2024K1`, `2024-Q1`, `Q1 2024`, `202403`, `2024` og datoer, og en datokolonne for diagrammer |
| Periodiser | Én rad per kvartal eller år med sum, gjennomsnitt, siste verdi, minste eller største; tabellen erstattes |
| Endring over tid | Forskjell eller prosent mot forrige periode eller samme periode i fjor |
| Indeks | Hver verdi mot en basisperiode som er 100; et år som basis tar gjennomsnittet av årets måneder eller kvartaler |
| Glidende gjennomsnitt | Gjennomsnittet av de siste periodene eller sentrert; bare hele vinduer gir en verdi |
| Sesongjuster | Trend, sesong og justert verdi med R (`stl`); serien må være hel og minst to år lang, andre forblir tomme |

Radene trenger ikke ligge i rekkefølge, og seriene blandes ikke sammen. Perioder i et format som ikke gjenkjennes, forblir tomme, så
kontroller antallet i forhåndsvisningen.

I Visualiser finnes diagramtypene **Tidsserie** (én linje per serie) og **Små multipler** (ett lite diagram per serie).

## Modeller og Prediksjon

Når en regresjon er ferdig, kan du trykke på *Lagre modellen*. Koeffisientene lagres i datasettet og følger med i pakker og
sikkerhetskopier. Verktøyet *Modeller* i fanen Statistikk viser dem med formelen.

Operasjonen **Prediksjon fra en modell** under Beregninger i Bearbeid beregner en ny kolonne med modellen, på samme datasett eller et
annet med de samme kolonnene. Beregningen er vanlig SQL, så verken R eller Python trengs. Modellen kopieres inn i reseptsteget, så
resepten kan spilles av selv om det opprinnelige datasettet er borte. Den nye kolonnens beskrivelse i kodeboken inneholder modellens
formel og tilpasning.

- Mangler en kolonne som modellen krever, får du en melding om hvilken.
- En rad med en tom verdi i en forklarende kolonne får ingen prediksjon.
- En tekstverdi modellen ikke har sett, teller som referansenivået, det vil si uten tillegg.
- En logistisk modell gir sannsynligheten for det siste utfallet i alfabetisk rekkefølge.

Bare lineære og logistiske modeller kan lagres, siden de kan uttrykkes som en formel. Modeller som krever sitt opprinnelige bibliotek,
kan ikke kjøres som reseptsteg.
