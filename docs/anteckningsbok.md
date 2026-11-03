# Anteckningsbok

En anteckningsbok blandar text, R-kod och SQL i celler som körs i ordning, med utdata sparat under varje cell.
Den finns som tredje flik i läget Analysera och är vägen från analys till färdig rapport utan att lämna appen.

## Skapa och arbeta

Klicka på plustecknet vid *Anteckningsböcker* i objektpanelen (eller välj *Ny anteckningsbok* i kommandopaletten),
ge boken ett namn och börja i den första cellen. En ny bok får en rubrikcell, en R-cell som läser den valda
datamängden och en SQL-cell. Datamängden som SQL-cellerna körs mot väljs i egenskapspanelen till höger.

Varje cell har en typ (Text, R eller SQL) som kan bytas, knappar för att köra, flytta upp eller ned och ta bort,
och ett resultatfält. Ctrl+Enter kör cellen du står i; *Kör alla* kör boken uppifrån och ned. Celler läggs till
längst ned med knapparna *Text*, *R* och *SQL*. Allt sparas automatiskt, även utdata.

- **Textceller** skrivs i Markdown (rubriker med `#`, listor med `-`, `**fet**`, `*kursiv*`, länkar och tabeller)
  och visas formaterade under redigeringsfältet.
- **R-celler** körs i samma R-session som R-konsolen, så variabler lever kvar mellan celler och körningar tills R
  startas om. Utskrifter, fel, diagram och datamängder som skapas med `dm_write()` samlas under cellen. Diagram
  sparas som PNG.
- **SQL-celler** körs mot tabellen `data` i bokens datamängd. SELECT-frågor visar upp till 1 000 rader (de första
  50 i vyn); UPDATE, DELETE och andra ändrande satser utförs som ett receptsteg i datamängden och loggas där.

## Exportera och dela

*Exportera* skapar ett dokument av hela boken: HTML (fristående sida), Word, PDF, Markdown (med figurer i en
ZIP när diagram ingår) eller LaTeX (ZIP med `main.tex` och figurer). Textceller blir brödtext, kod blir kodblock
(kan väljas bort), tabeller blir tabeller och diagram blir bilder. Samma byggare används som för dokumentmallarna
(se [dokumentmallar.md](dokumentmallar.md)).

*Dela (fil)* laddar ned boken som `*.nb.json` med celler och sparade utdata; en annan användare läser in filen
med *Importera anteckningsbok (fil)*, och datamängden kopplas via sitt namn. Anteckningsböckerna följer också med i
säkerhetskopian, delningspaket och den portabla mappen.

## Begränsningar

- R-kod kan inte avbrytas under file://; använd *Starta om R* i R-fliken om en cell hänger sig.
- Utdata lagras i webbläsaren tillsammans med boken. Många stora diagram gör boken större.
- Redigeringsfältet för text har ingen syntaxmarkering för Markdown.
