# Søk

Modusen Søk finner og lister uten kode. Den ligger mellom Håndter og Bearbeid: først finner du det du leter etter,
så bearbeider du det. To faner finnes fra 2.0, Søk og Lister; fanen Spørring, en visuell spørringsbygger som viser
SQL-koden den lager, kommer i 2.2.

## Søk

Skriv et ord eller en frase i søkefeltet, velg om du søker i alle datasett eller bare i det valgte, og trykk på Søk
(eller Enter). Alle kolonner søkes gjennom, uansett type, og hvert ord må finnes et sted på raden. Store og små
bokstaver spiller ingen rolle, heller ikke for å, æ og ø. Tegn som ellers har særskilt betydning i mønstre (punktum,
parenteser, stjerne) betyr her bare seg selv; for mønstersøk finnes fanen Regex i Analyser.

Treffene vises per datasett med antall. Hvert kort har:

- **Fasetter**: for kolonner med få ulike verdier blant treffene vises de vanligste verdiene med antall. Klikk på en
  verdi for å avgrense søket til den; de aktive avgrensningene vises som merkede knapper og fjernes med et klikk.
  Kolonner der hvert treff har sin egen verdi (navn, identifikatorer), vises ikke som fasetter, siden de ikke
  avgrenser noe.
- **En tabell** med de første hundre treffene. Klikk på en rad for å se hele posten i inspektøren til høyre, med
  radnummeret og knappen *Åpne i Bearbeid*.
- **Lagre som liste** lagrer søket (tekst og avgrensninger) for det datasettet under fanen Lister.
- **Lagre som datasett** gjør treffene til et nytt datasett med samme kolonner og typer.
- **Åpne i Bearbeid** velger datasettet og bytter modus.

Søket kjøres i SQLite i en worker, så siden låser seg ikke. I et datasett med en million rader tar et søk omtrent
ett sekund per ord.

## Lister

En liste er et lagret søk i et datasett: teksten, avgrensningene og antall treff sist den ble kjørt. *Kjør* viser
dagens treff i fanen Søk (dataene kan ha endret seg siden listen ble lagret), *Lagre som datasett* gjør treffene til
et nytt datasett, og *Slett* fjerner listen. Lister følger datasettet: slettes datasettet, forsvinner listene dens.

## Kommandopaletten

Ctrl+K finner objekter og kommandoer som før. Kommandoen *Søk i data* åpner Søk med søkefeltet i fokus.

## Tastatur

Enter i søkefeltet søker. Fasettenes knapper og tabellens rader nås med Tab; en rad åpnes i inspektøren med Enter.
