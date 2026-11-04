# Søg

Tilstanden Søg finder og lister uden kode. Den ligger mellem Håndter og Bearbejd: først finder du det, du leder
efter, derefter bearbejder du det. Tre faner: *Søg* (fritekst med facetter), *Forespørgsel* (en visuel
forespørgselsbygger over et eller flere datasæt, der viser den SQL, den laver) og *Lister* (gemte søgninger og
forespørgsler).

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

**Åbn fundet**, hvor det er. Knappen i inspektøren fører dig til den rigtige side i et dokument, det rigtige billede i en samling, noden med dens naboer i en graf, elementet i en model, objektet på en plan, stedet på kortet eller rækken i en tabel.

## Forespørgsel

Fanen Forespørgsel bygger en forespørgsel, uden at du skriver SQL, og viser den SQL, der laves. Kortet **Datasæt**
vælger det datasæt, der spørges i, og kobler flere på med *Tilføj kobling*: vælg datasæt, om kun rækker med match i
begge eller alle rækker i det første skal med, og hvilke kolonner der skal matche (flere nøgler kan tilføjes; koblede
datasæt skal have kortnavne). **Kolonner** vælger, hvad der vises, som værdi eller som beregning (antal, antal
unikke, sum, gennemsnit, mindste, største) med valgfrit navn i resultatet; er der en beregning, grupperes rækkerne
automatisk efter de øvrige kolonner. **Betingelser** lægges i grupper, hvor alle betingelser skal gælde, eller én er
nok (er, er ikke, er større end, er mindst, er mindre end, er højst, indeholder, begynder med, er en af, er mellem,
er tom, er ikke tom), og **Sortering og antal** afslutter. *Kør forespørgslen* viser resultatet som tabel med den
genererede SQL nedenunder; *Åbn i Analysér* lægger SQL'en i SQL-konsollen, hvor den kan ændres videre. I SQL'en
hedder det første datasæt `t0` og de koblede `t1`, `t2` og så videre.

*Gem som liste* gemmer forespørgslen under Lister, hvor den køres igen på dagens data, og *Gem som datasæt* gør
resultatet til et nyt datasæt med resultatets kolonner.

## Lister

En liste er en gemt søgning i et datasæt: teksten, indsnævringerne og antallet af resultater, sidst den blev kørt.
*Kør* viser dagens resultater i fanen Søg (data kan have ændret sig, siden listen blev gemt), *Gem som datasæt* gør
resultaterne til et nyt datasæt, og *Slet* fjerner listen. Lister følger datasættet: slettes datasættet, forsvinder
dets lister.

Lister bruges også andre steder. I Bearbejd vælger *Liste* i tabellens værktøjslinje en gemt søgning, der
indsnævrer tabellen (mærket viser antal rækker af det samlede antal), og i diagrambyggeren vælger *Liste* under
filtrene, hvilke rækker et diagram bygger på; valget følger med diagrammet i dashboards og eksporter og køres igen på
dagens data. Forespørgsler gemt fra fanen Forespørgsel vises med deres SQL under Lister og køres i Forespørgsel.

## Kommandopaletten

Ctrl+K finder objekter og kommandoer som før. Kommandoen *Søg i data* åbner Søg med søgefeltet i fokus.

## Tastatur

Enter i søgefeltet søger. Facetternes knapper og tabellens rækker nås med Tab; en række åbnes i inspektøren med
Enter.
