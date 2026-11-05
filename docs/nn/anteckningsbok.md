# Notatbok

Ei notatbok blandar tekst, R-kode, Python-kode og SQL i celler som blir køyrde i rekkjefølgje, med utdata lagra under kvar celle. Ho finst
som tredje fane i modusen Analyser og er vegen frå analyse til ferdig rapport utan å forlate appen.

## Opprett og arbeid

Klikk på plussteiknet ved *Notatbøker* i objektpanelet (eller vel *Ny notatbok* i kommandopaletten), gje notatboka eit namn
og byrj i den første cella. Ei ny notatbok får ei overskriftscelle, ei R-celle som les det valde datasettet med
kortnamnet og ei SQL-celle. Datasettet som SQL-cellene blir køyrde mot, vel du i eigenskapspanelet til høgre.

Kvar celle har ein type (Tekst, R eller SQL) som kan bytast, knappar for å køyre, flytte opp eller ned og slette, og eit
resultatfelt. Ctrl+Enter køyrer cella du står i; *Køyr alle* køyrer notatboka ovanfrå og ned. Celler blir lagde til nedst
med knappane *Tekst*, *R*, *Python* og *SQL*. Alt blir lagra automatisk, òg utdata.

- **Tekstceller** blir skrivne i Markdown (overskrifter med `#`, lister med `-`, `**feit**`, `*kursiv*`, lenkjer og tabellar) og
  blir viste formaterte under redigeringsfeltet.
- **R-celler** blir køyrde i same R-sesjon som R-konsollen, så variablar lever vidare mellom celler og køyringar til R blir starta
  på nytt. Utskrifter, feil, diagram og datasett som blir laga med `dm_write()`, blir samla under cella. Diagram blir lagra som
  PNG.
- **Python-celler** blir køyrde i same Python-sesjon som Python-konsollen (Python blir henta første gongen, sjå
  [python.md](python.md)). Utdata, feil, matplotlib- og plotly-diagram og datasett frå `dm_write()` blir samla under cella.
- **SQL-celler** blir køyrde mot tabellen `data` i datasettet til notatboka. SELECT-spørjingar viser opptil 1 000 rader (dei første
  50 i visinga); UPDATE, DELETE og andre endrande setningar blir utførte som eit steg i oppskrifta til datasettet og logga der.

## Eksporter og del

*Eksporter* lagar eit dokument av heile notatboka: HTML (frittståande side), Word, PDF, Markdown (med figurar i ei ZIP-fil når
diagram er med) eller LaTeX (ZIP med `main.tex` og figurar). Tekstceller blir brødtekst, kode blir kodeblokker (kan
veljast bort), tabellar blir tabellar og diagram blir bilete. Dei same byggjarane blir brukte som for dokumentmalane (sjå
[dokumentmallar.md](dokumentmallar.md)).

*Del (fil)* lastar ned notatboka som `*.nb.json` med celler og lagra utdata; ein annan brukar lastar inn fila med
*Importer notatbok (fil)*, og datasettet blir kopla via kortnamnet eller namnet. Notatbøkene følgjer òg med i tryggingskopien,
i pakkar og i den portable mappa.

## Avgrensingar

- R-kode kan ikkje avbrytast under file://; bruk *Start R på nytt* i R-fana om ei celle heng. Køyrer appen frå ein
  webtenar, stoppar knappen *Avbryt* i R-fana òg ei celle som køyrer.
- Utdata blir lagra i nettlesaren saman med notatboka. Mange store diagram gjer notatboka større.
- Redigeringsfeltet for tekst har inga syntaksutheving for Markdown.
