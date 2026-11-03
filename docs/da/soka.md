# Søg

Tilstanden Søg finder og lister uden kode. Den ligger mellem Håndter og Bearbejd: først finder du det, du leder
efter, derefter bearbejder du det. To faner findes fra 2.0, Søg og Lister; fanen Forespørgsel, en visuel
forespørgselsbygger, der viser den SQL, den laver, kommer i 2.2.

## Søg

Skriv et ord eller en sætning i søgefeltet, vælg, om du søger i alle datasæt eller kun i det valgte, og tryk på Søg
(eller Enter). Alle kolonner gennemsøges, uanset type, og hvert ord skal findes et sted på rækken. Store og små
bogstaver spiller ingen rolle, heller ikke for å, æ og ø. Tegn, der ellers har særlig betydning i mønstre (punktum,
parenteser, stjerne), betyder her kun sig selv; til mønstersøgning findes fanen Regex i Analysér.

Resultaterne vises pr. datasæt med antal. Hvert kort har:

- **Facetter**: for kolonner med få forskellige værdier blandt resultaterne vises de hyppigste værdier med antal.
  Klik på en værdi for at indsnævre søgningen til den; de aktive indsnævringer vises som mærkede knapper og fjernes
  med et klik. Kolonner, hvor hvert resultat har sin egen værdi (navne, identifikatorer), vises ikke som facetter,
  da de ikke indsnævrer noget.
- **En tabel** med de første hundrede resultater. Klik på en række for at se hele posten i inspektøren til højre,
  med rækkenummeret og knappen *Åbn i Bearbejd*.
- **Gem som liste** gemmer søgningen (tekst og indsnævringer) for det datasæt under fanen Lister.
- **Gem som datasæt** gør resultaterne til et nyt datasæt med samme kolonner og typer.
- **Åbn i Bearbejd** vælger datasættet og skifter tilstand.

Søgningen kører i SQLite i en worker, så siden fryser ikke. I et datasæt med en million rækker tager en søgning
omkring et sekund pr. ord.

## Lister

En liste er en gemt søgning i et datasæt: teksten, indsnævringerne og antallet af resultater, sidst den blev kørt.
*Kør* viser dagens resultater i fanen Søg (data kan have ændret sig, siden listen blev gemt), *Gem som datasæt* gør
resultaterne til et nyt datasæt, og *Slet* fjerner listen. Lister følger datasættet: slettes datasættet, forsvinder
dets lister.

## Kommandopaletten

Ctrl+K finder objekter og kommandoer som før. Kommandoen *Søg i data* åbner Søg med søgefeltet i fokus.

## Tastatur

Enter i søgefeltet søger. Facetternes knapper og tabellens rækker nås med Tab; en række åbnes i inspektøren med
Enter.
