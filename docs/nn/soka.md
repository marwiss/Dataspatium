# Søk

Modusen Søk finn og listar utan kode. Han ligg mellom Handter og Bearbeid: først finn du det du leitar etter,
så bearbeider du det. Tre faner: *Søk* (fritekst med fasettar), *Spørjing* (ein visuell spørjingsbyggjar over eitt
eller fleire datasett som viser SQL-koden han lagar) og *Lister* (lagra søk og spørjingar).

## Søk

Skriv eit ord eller ein frase i søkjefeltet, vel om du søkjer i alle datasett eller berre i det valde, og trykk på Søk
(eller Enter). Alle kolonnar blir søkte gjennom, uansett type, og kvart ord må finnast ein stad på rada. Store og små
bokstavar speler inga rolle, heller ikkje for å, æ og ø. Teikn som elles har særskild tyding i mønster (punktum,
parentesar, stjerne) tyder her berre seg sjølv; for mønstersøk finst fana Regex i Analyser.

Treffa blir viste per datasett med tal. Kvart kort har:

- **Fasettar**: for kolonnar med få ulike verdiar blant treffa blir dei vanlegaste verdiane viste med tal. Klikk på ein
  verdi for å avgrense søket til han; dei aktive avgrensingane blir viste som merkte knappar og fjerna med eit klikk.
  Kolonnar der kvart treff har sin eigen verdi (namn, identifikatorar), blir ikkje viste som fasettar, sidan dei ikkje
  avgrensar noko.
- **Ein tabell** med dei første hundre treffa. Klikk på ei rad for å sjå heile posten i inspektøren til høgre, med
  radnummeret og knappen *Opne i Bearbeid*.
- **Lagre som liste** lagrar søket (tekst og avgrensingar) for det datasettet under fana Lister.
- **Lagre som datasett** gjer treffa til eit nytt datasett med same kolonnar og typar.
- **Opne i Bearbeid** vel datasettet og byter modus.

Søket blir køyrt i SQLite i ein worker, så sida låser seg ikkje. I eit datasett med ein million rader tek eit søk om lag
eitt sekund per ord.

**Opne treffet** der det er. Knappen i inspektøren tek deg til rett side i eit dokument, rett bilete i ei samling, noden med naboane i ein graf, elementet i ein modell, objektet på ein plan, staden på kartet eller rada i ein tabell.

**Søk etter stad.** Under *Søk etter stad* vel du ein kommune eller region, eller eit punkt og ein avstand. Du kan søkje utan ord, og då blir alt på staden vist. Berre datasett med stader er med. Ei flate tel etter midtpunktet, så det er ikkje eit nøyaktig overlegg. Nøyaktige overlegg gjer du under Geo i Analyser.

**Sidetabellar er med.** Eit ord på ein kant i ein graf finn nodane i begge endar, og ein verdi i ein IFC-eigenskap finn elementet. Det gjeld òg lagra lister og utval.

## Spørjing

Fana Spørjing byggjer ei spørjing utan at du skriv SQL, og viser SQL-koden som blir laga. Kortet **Datasett** vel
datasettet det blir spurt i, og koplar på fleire med *Legg til kopling*: vel datasett, om berre rader med treff i begge
eller alle rader i det første skal vere med, og kva kolonnar som skal samsvare (fleire nøklar kan leggjast til; kopla
datasett treng kortnamn). **Kolonnar** vel kva som blir vist, som verdi eller som utrekning (tal, tal på unike,
sum, gjennomsnitt, minste, største) med valfritt namn i resultatet; finst det ei utrekning, blir radene gruppert
automatisk etter dei andre kolonnane. **Vilkår** blir lagde i grupper der alle vilkår må gjelde eller eitt er
nok (er, er ikkje, er større enn, er minst, er mindre enn, er høgst, inneheld, byrjar med, er ein av, er mellom,
er tom, er ikkje tom), og **Sortering og tal** avsluttar. *Køyr spørjinga* viser resultatet som tabell med den
genererte SQL-koden under; *Opne i Analyser* legg SQL-koden i SQL-konsollen, der han kan endrast vidare. I
SQL-koden heiter det første datasettet `t0` og dei kopla `t1`, `t2` og så vidare.

*Lagre som liste* lagrar spørjinga under Lister, der ho blir køyrd igjen på dagens data, og *Lagre som datasett* gjer
resultatet til eit nytt datasett med kolonnane i resultatet.

**Vilkår etter slag.** Ein modell kan spørjast om ein eigenskap, til dømes veggar med brannklasse EI60. Ein graf kan spørjast om naboar til ein node og om nodar innan nokre steg, der noden blir oppgjeven med id eller namn. Eit datasett med stader kan spørjast om ein stad. Vilkåra kan blandast med vanlege vilkår, og spørjinga kan lagrast som liste eller bli eit datasett.

## Lister

Ei liste er eit lagra søk i eit datasett: teksten, avgrensingane og talet på treff sist ho vart køyrd. *Køyr* viser
dagens treff i fana Søk (dataa kan ha endra seg sidan lista vart lagra), *Lagre som datasett* gjer treffa til
eit nytt datasett, og *Slett* fjernar lista. Lister følgjer datasettet: blir datasettet sletta, forsvinn listene hans.

Lister blir òg brukte andre stader. I Bearbeid vel *Liste* i verktøylinja til tabellen eit lagra søk som avgrensar
tabellen (merket viser tal på rader av totalen), og i diagrambyggjaren vel *Liste* under filtera kva rader eit
diagram byggjer på; valet følgjer med diagrammet i dashbord og eksportar og blir køyrt igjen på dagens data. Spørjingar
lagra frå fana Spørjing blir viste med SQL-koden sin under Lister og køyrde i Spørjing.

## Kommandopaletten

Ctrl+K finn objekt og kommandoar som før. Kommandoen *Søk i data* opnar Søk med søkjefeltet i fokus.

## Tastatur

Enter i søkjefeltet søkjer. Knappane til fasettane og radene i tabellen blir nådde med Tab; ei rad blir opna i inspektøren med Enter.
