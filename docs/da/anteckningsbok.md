# Notesbog

En notesbog blander tekst, R-kode og SQL i celler, der køres i rækkefølge, med output gemt under hver celle. Den findes
som tredje fane i tilstanden Analysér og er vejen fra analyse til færdig rapport uden at forlade appen.

## Opret og arbejd

Klik på plusset ved *Notesbøger* i objektpanelet (eller vælg *Ny notesbog* i kommandopaletten), giv notesbogen et navn,
og begynd i den første celle. En ny notesbog får en overskriftscelle, en R-celle, der læser det valgte datasæt med dets
kortnavn, og en SQL-celle. Det datasæt, SQL-cellerne køres mod, vælges i egenskabspanelet til højre.

Hver celle har en type (Tekst, R eller SQL), der kan skiftes, knapper til at køre, flytte op eller ned og slette, og et
resultatfelt. Ctrl+Enter kører den celle, du står i; *Kør alle* kører notesbogen fra top til bund. Celler tilføjes
nederst med knapperne *Tekst*, *R* og *SQL*. Alt gemmes automatisk, også output.

- **Tekstceller** skrives i Markdown (overskrifter med `#`, lister med `-`, `**fed**`, `*kursiv*`, links og tabeller) og
  vises formateret under redigeringsfeltet.
- **R-celler** køres i samme R-session som R-konsollen, så variabler lever videre mellem celler og kørsler, indtil R
  genstartes. Udskrifter, fejl, diagrammer og datasæt, der oprettes med `dm_write()`, samles under cellen. Diagrammer
  gemmes som PNG.
- **SQL-celler** køres mod tabellen `data` i notesbogens datasæt. SELECT-forespørgsler viser op til 1 000 rækker (de
  første 50 i visningen); UPDATE, DELETE og andre ændrende sætninger udføres som et trin i datasættets recept og logges
  der.

## Eksportér og del

*Eksportér* opretter et dokument af hele notesbogen: HTML (selvstændig side), Word, PDF, Markdown (med figurer i en ZIP,
når der er diagrammer) eller LaTeX (ZIP med `main.tex` og figurer). Tekstceller bliver brødtekst, kode bliver kodeblokke
(kan fravælges), tabeller bliver tabeller, og diagrammer bliver billeder. De samme byggere bruges som til
dokumentskabelonerne (se [dokumentmallar.md](dokumentmallar.md)).

*Del (fil)* downloader notesbogen som `*.nb.json` med celler og gemt output; en anden bruger indlæser filen med *Importér
notesbog (fil)*, og datasættet kobles via sit kortnavn eller navn. Notesbøgerne følger også med i backuppen, i pakker og i
den portable mappe.

## Begrænsninger

- R-kode kan ikke afbrydes under file://; brug *Genstart R* i R-fanen, hvis en celle hænger.
- Output gemmes i browseren sammen med notesbogen. Mange store diagrammer gør notesbogen større.
- Redigeringsfeltet til tekst har ingen syntaksfremhævning af Markdown.
