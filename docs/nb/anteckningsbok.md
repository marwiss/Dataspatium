# Notatbok

En notatbok blander tekst, R-kode, Python-kode og SQL i celler som kjøres i rekkefølge, med utdata lagret under hver celle. Den finnes
som tredje fane i modusen Analyser og er veien fra analyse til ferdig rapport uten å forlate appen.

## Opprett og arbeid

Klikk på plusstegnet ved *Notatbøker* i objektpanelet (eller velg *Ny notatbok* i kommandopaletten), gi notatboken et navn
og begynn i den første cellen. En ny notatbok får en overskriftscelle, en R-celle som leser det valgte datasettet med
kortnavnet og en SQL-celle. Datasettet som SQL-cellene kjøres mot, velges i egenskapspanelet til høyre.

Hver celle har en type (Tekst, R eller SQL) som kan byttes, knapper for å kjøre, flytte opp eller ned og slette, og et
resultatfelt. Ctrl+Enter kjører cellen du står i; *Kjør alle* kjører notatboken ovenfra og ned. Celler legges til nederst
med knappene *Tekst*, *R*, *Python* og *SQL*. Alt lagres automatisk, også utdata.

- **Tekstceller** skrives i Markdown (overskrifter med `#`, lister med `-`, `**fet**`, `*kursiv*`, lenker og tabeller) og
  vises formatert under redigeringsfeltet.
- **R-celler** kjøres i samme R-sesjon som R-konsollen, så variabler lever videre mellom celler og kjøringer til R startes
  på nytt. Utskrifter, feil, diagrammer og datasett som lages med `dm_write()`, samles under cellen. Diagrammer lagres som
  PNG.
- **Python-celler** kjøres i samme Python-sesjon som Python-konsollen (Python hentes første gang, se
  [python.md](python.md)). Utdata, feil, matplotlib-diagrammer og datasett fra `dm_write()` samles under cellen.
- **SQL-celler** kjøres mot tabellen `data` i notatbokens datasett. SELECT-spørringer viser opptil 1 000 rader (de første
  50 i visningen); UPDATE, DELETE og andre endrende setninger utføres som et trinn i datasettets oppskrift og logges der.

## Eksporter og del

*Eksporter* lager et dokument av hele notatboken: HTML (frittstående side), Word, PDF, Markdown (med figurer i en ZIP når
diagrammer er med) eller LaTeX (ZIP med `main.tex` og figurer). Tekstceller blir brødtekst, kode blir kodeblokker (kan
velges bort), tabeller blir tabeller og diagrammer blir bilder. De samme byggerne brukes som for dokumentmalene (se
[dokumentmallar.md](dokumentmallar.md)).

*Del (fil)* laster ned notatboken som `*.nb.json` med celler og lagrede utdata; en annen bruker laster inn filen med
*Importer notatbok (fil)*, og datasettet kobles via kortnavnet eller navnet. Notatbøkene følger også med i sikkerhetskopien,
i pakker og i den portable mappen.

## Begrensninger

- R-kode kan ikke avbrytes under file://; bruk *Start R på nytt* i R-fanen hvis en celle henger. Kjører appen fra en
  nettserver, stopper knappen *Avbryt* i R-fanen også en celle som kjører.
- Utdata lagres i nettleseren sammen med notatboken. Mange store diagrammer gjør notatboken større.
- Redigeringsfeltet for tekst har ingen syntaksfremheving for Markdown.
