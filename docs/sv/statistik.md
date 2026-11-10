# Statistik, tidsserier och modeller

Fliken **Statistik** i Analysera gör vanliga analyser med formulär. Formuläret skriver koden medan du fyller i det, så du ser
vad som körs och kan ta med dig koden. **Tidsserieåtgärderna** i Bearbeta förbereder serier från SDMX och PxWeb. En **modell**
från en regression kan sparas och användas som receptsteget *Prediktion* på nya data.

## Fliken Statistik

Välj en datamängd och ett verktyg, fyll i formuläret och tryck på *Kör*. R används som standard; välj Python i formuläret om du
hellre vill det. Koden visas under formuläret och kan öppnas i konsolen med *Öppna i konsolen*.

| Verktyg | Vad det ger |
|---|---|
| Beskrivande | Antal, saknade värden, medelvärde, standardavvikelse, kvartiler, minsta och största per kolumn, gärna per grupp; med en kolumn också ett histogram |
| Korstabell | Antal per två kategorier, gärna med procent, och ett chi²-test |
| Korrelation | Pearson eller Spearman mellan talkolumner, med en färgad tabell |
| Hypotestest | t-test (två grupper, mot ett värde, parat), Mann-Whitney, variansanalys och Kruskal-Wallis |
| Regression | Linjär eller logistisk, med koefficienter, medelfel och p-värden; textkolumner blir indikatorer |
| Klustring | k-means med valfritt antal kluster, och en ny datamängd med klustret som kolumn om du vill |

Över tabellen står en mening om vad resultatet säger. Den säger om en skillnad är statistiskt säkerställd, inte vad den betyder.
Statistiska metoder förutsätter sådant som formuläret inte kan se, till exempel hur data samlats in och om raderna är oberoende.
Bedömningen är din. Varje resultat kan sparas som datamängd, och koden följer med i beskrivningen.

Python startar först när du trycker på *Kör*, och scipy, statsmodels och scikit-learn hämtas första gången de behövs.

## Tidsserier i Bearbeta

Gruppen **Tidsserier** i åtgärderna är till för tabeller med en periodkolumn och eventuellt kolumner som skiljer serierna åt,
till exempel kommun eller kön. Varje åtgärd är ett receptsteg som kan ångras och spelas upp vid nästa hämtning.

| Åtgärd | Vad den gör |
|---|---|
| Tolka perioder | Gör enhetliga perioder (`2024-03`, `2024-Q1`, `2024`) av `2024M03`, `2024K1`, `2024-Q1`, `Q1 2024`, `202403`, `2024` och datum, och en datumkolumn för diagram |
| Periodisera | En rad per kvartal eller år, med summa, medelvärde, sista värdet, minsta eller största; tabellen ersätts |
| Förändring över tid | Skillnad eller procent mot föregående period eller samma period förra året |
| Index | Varje värde mot en basperiod som är 100; ett år som bas tar medelvärdet av årets månader eller kvartal |
| Glidande medelvärde | Medelvärdet av de senaste perioderna, eller centrerat; bara hela fönster ger ett värde |
| Säsongsrensa | Trend, säsong och rensat värde med R (`stl`); serien måste vara hel och minst två år lång, andra serier blir tomma |

Raderna behöver inte ligga i ordning, och serierna blandas inte ihop. Perioder med ett format som inte känns igen blir tomma, så
kontrollera antalet i förhandsgranskningen.

I Visualisera finns diagramtyperna **Tidsserie** (en linje per serie) och **Små multipler** (ett litet diagram per serie).

## Modeller och Prediktion

När en regression är klar kan du trycka på *Spara modellen*. Koefficienterna sparas i datamängden och följer med i paket och
säkerhetskopior. Verktyget *Modeller* i fliken Statistik listar dem med formeln.

Åtgärden **Prediktion från en modell** under Beräkningar i Bearbeta räknar en ny kolumn med modellen, på samma datamängd eller
någon annan som har samma kolumner. Beräkningen är vanlig SQL, så varken R eller Python behövs. Modellen kopieras in i receptsteget,
så receptet går att spela upp även om den ursprungliga datamängden är borta. Den nya kolumnens beskrivning i kodboken innehåller
modellens formel och anpassning.

- Saknas en kolumn som modellen behöver får du ett meddelande om vilken.
- En rad med tomt värde i en förklarande kolumn får ingen prediktion.
- Ett textvärde som modellen inte sett räknas som referensnivån, det vill säga utan tillägg.
- En logistisk modell ger sannolikheten för det sista utfallet i bokstavsordning.

Bara linjära och logistiska modeller kan sparas, eftersom de går att uttrycka som en formel. Modeller som kräver sitt
ursprungliga bibliotek går inte att köra som receptsteg.
