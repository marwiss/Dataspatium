# Søk

Modusen Søk finner og lister uten kode. Den ligger mellom Håndter og Bearbeid: først finner du det du leter etter,
så bearbeider du det. Tre faner: *Søk* (fritekst med fasetter), *Spørring* (en visuell spørringsbygger over ett
eller flere datasett som viser SQL-koden den lager) og *Lister* (lagrede søk og spørringer).

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

## Spørring

Fanen Spørring bygger en spørring uten at du skriver SQL, og viser SQL-koden som lages. Kortet **Datasett** velger
datasettet det spørres i, og kobler på flere med *Legg til kobling*: velg datasett, om bare rader med treff i begge
eller alle rader i det første skal være med, og hvilke kolonner som skal matche (flere nøkler kan legges til; koblede
datasett trenger kortnavn). **Kolonner** velger hva som vises, som verdi eller som beregning (antall, antall unike,
sum, gjennomsnitt, minste, største) med valgfritt navn i resultatet; finnes det en beregning, grupperes radene
automatisk etter de øvrige kolonnene. **Betingelser** legges i grupper der alle betingelser må gjelde eller én er
nok (er, er ikke, er større enn, er minst, er mindre enn, er høyst, inneholder, begynner med, er en av, er mellom,
er tom, er ikke tom), og **Sortering og antall** avslutter. *Kjør spørringen* viser resultatet som tabell med den
genererte SQL-koden under; *Åpne i Analyser* legger SQL-koden i SQL-konsollen, der den kan endres videre. I
SQL-koden heter det første datasettet `t0` og de koblede `t1`, `t2` og så videre.

*Lagre som liste* lagrer spørringen under Lister, der den kjøres igjen på dagens data, og *Lagre som datasett* gjør
resultatet til et nytt datasett med resultatets kolonner.

## Lister

En liste er et lagret søk i et datasett: teksten, avgrensningene og antall treff sist den ble kjørt. *Kjør* viser
dagens treff i fanen Søk (dataene kan ha endret seg siden listen ble lagret), *Lagre som datasett* gjør treffene til
et nytt datasett, og *Slett* fjerner listen. Lister følger datasettet: slettes datasettet, forsvinner listene dens.

Lister brukes også andre steder. I Bearbeid velger *Liste* i tabellens verktøylinje et lagret søk som avgrenser
tabellen (merket viser antall rader av totalen), og i diagrambyggeren velger *Liste* under filtrene hvilke rader et
diagram bygger på; valget følger med diagrammet i dashbord og eksporter og kjøres igjen på dagens data. Spørringer
lagret fra fanen Spørring vises med SQL-koden sin under Lister og kjøres i Spørring.

## Kommandopaletten

Ctrl+K finner objekter og kommandoer som før. Kommandoen *Søk i data* åpner Søk med søkefeltet i fokus.

## Tastatur

Enter i søkefeltet søker. Fasettenes knapper og tabellens rader nås med Tab; en rad åpnes i inspektøren med Enter.
