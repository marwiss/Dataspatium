# Bearbeid og SQL-konsollen

Modusen Bearbeid er alt ein gjer med tabellen via knappar og dialogar: rette celler, reinse tekst, endre typar, rekne ut nye
kolonnar, pivotere, kople datasett. Kvar handling blir logga som eit steg i oppskrifta til datasettet, kan angrast og kan spelast av
igjen på eit anna datasett. SQL-konsollen i modusen Analyser arbeider mot same datasett og loggar endringar på same måte.

## Tabellen

- Dobbeltklikk på ei celle, eller merk ei rad og trykk Enter eller F2 for å redigere. Enter lagrar, Esc avbryt, Tab går
  vidare til neste celle. Verdien blir tolka etter typen til kolonnen: skriv du tekst i ein talkolonne, får du ei feilmelding, og
  cella held på verdien sin. Tom tekst blir ein manglande verdi.
- Piltastane flyttar merkinga, Page Up/Page Down blar, Home/End hoppar til første eller siste rad.
- Klikk på ei kolonneoverskrift for å sortere (stigande, fallande, usortert). Eigenskapspanelet til høgre viser då
  kolonnestatistikk (tal, manglande, unike, minste, største, gjennomsnitt, sum, vanlegaste verdiar) og handlingane som
  passar typen til kolonnen. Skift-klikk viser statistikken utan å endre sorteringa.
- Filterfeltet søkjer i alle kolonnar. Redigering fungerer òg i eit filtrert utval.
- *Liste* i verktøylinja (blir vist når datasettet har lagra søk frå Søk) avgrensar tabellen til radene i lista;
  merket viser tal av totalen. Redigering og handlingar fungerer som vanleg.
- Tabellen er virtualisert: berre dei synlege radene finst i DOM-en til nettlesaren, resten ligg i SQLite. Ein million rader blir blaa
  like raskt som hundre.

**Kolonnar visinga treng.** Grafen treng id-en til noden, kartet geometrien sin og galleriet filnamna sine. Tabellen kan endrast fritt, men appen spør først om du er i ferd med å fjerne, gje nytt namn til eller endre typen for ein slik kolonne. Fjernar eit steg som ikkje kan føresjåast han, til dømes SQL eller ei pivotering, blir det vist ei melding med Angre.

## Handlingar

Knappen **Handlingar** opnar paletten. Kvar handling har ein dialog med felt som blir laga ut frå parametrane til handlinga, og der
det er mogleg, blir det vist ei førehandsvising av kor mange rader som blir påverka, og døme før og etter.

| Gruppe | Handling | Kva ho gjer |
|---|---|---|
| Kolonnar | Gje kolonnen nytt namn | Nytt kolonnenamn; etiketten følgjer med om han var lik namnet |
| | Etikett, skildring og eining | Etiketten er visingsnamnet i tabelloverskrifter og diagram; skildring og eining blir viste i inspektøren og kodeboka, følgjer med SQLite-fila og når R som attributta `description` og `unit` |
| | Verdietikettar | Namn på kodane i kolonnen, éin per linje `kode = etikett` (til dømes `1 = Mann`); verdiane blir ikkje endra. Etikettane blir viste i eigenskapspanelet (òg ved dei vanlegaste verdiane) og kodeboka, når R som `haven::labelled` og blir skrivne til .sav og .dta. Tom tekst fjernar dei |
| | Slett kolonnar | Fjernar valde kolonnar |
| | Endre kolonnerekkjefølgja | Flytt kolonnar opp og ned |
| | Endre type | Tekst til heiltal, desimaltal, dato, dato og tid eller ja/nei. Desimalteikn og datoformat kan oppgjevast; verdiar som ikkje kan tolkast, blir tomme, og talet blir rapportert |
| | Kopier kolonne | Ein kopi med nytt namn, til dømes før originalen blir endra |
| | Rydd i kolonnenamn | Alle namn blir små bokstavar, siffer og understrekar (`Folkmängd 2024` blir `folkmangd_2024`), som er lette å skrive i SQL og R; etikettane held på dei opphavlege namna |
| Verdiar | Søk og erstatt | Tekst eller regulært uttrykk i valde tekstkolonnar, med førehandsvising |
| | Fjern mellomrom | Innleiande, avsluttande og (valfritt) doble mellomrom |
| | Endre store og små bokstavar | STORE BOKSTAVAR, små bokstavar eller Stor Forbokstav |
| | Reparer teiknkoding | Rettar mojibake (Ã¸ blir til ø) som har oppstått ved import med feil teiknkoding |
| | Erstatt verdi | Éin nøyaktig verdi med ein annan; ein tom verdi kan veljast som frå eller til |
| | Omkod verdiar | Fleire verdiar på éin gong etter ei liste med éi linje per verdi, `gammal = ny` (til dømes `01 = Stockholms län`); andre verdiar blir haldne eller tømde |
| | Byt kodar mot etikettar | Byter kodane i kolonnen mot verdietikettane deira, eller tilbake. Etikettane blir lagra, slik at .sav og .dta får kodane igjen ved eksport; verdiar utan etikett blir ståande som dei er, og tilbake til kodar blir kolonnen tal om alle kodane er tal |
| | Fyll inn manglande verdiar | Konstant verdi, verdien i førre eller neste rad, gjennomsnitt, median eller vanlegaste verdi |
| | Rund av tal | Til valt tal på desimalar: til nærmaste (ein halv blir runda bort frå null), nedover, oppover eller ved å stryke desimalane; eit negativt tal rundar av til tiarar (−1), hundrarar (−2) og så vidare |
| | Fyll ut med innleiande nullar | Til ei bestemt lengd, til dømes kommunekoden 114 til 0114; tal blir tekst, slik at nullane blir haldne |
| | Fjern teikn | Hald berre på siffer (telefon- og organisasjonsnummer), hald berre på bokstavar og mellomrom, fjern teiknsetjing og symbol, eller fjern alle mellomrom |
| Rader | Slett rader | SQL-vilkår, til dømes `befolkning < 1000`; vel Hald på for i staden berre å halde på radene som samsvarar |
| | Fjern duplikat | På valde kolonnar eller heile rada; første førekomst blir halden |
| | Fjern tomme rader og kolonnar | Rader der alle verdiar manglar, og om du vil, kolonnar heilt utan verdiar |
| | Sorter rader | Endrar rekkjefølgja på radene permanent, stigande eller fallande på éin kolonne, slik at eksportar og dokument får same rekkjefølgje; tomme verdiar kjem sist |
| | Hald på dei øvste radene | Radene med størst eller minst verdi, totalt eller per gruppe (til dømes dei tre største kommunane i kvart fylke) |
| | Tilfeldig utval | Eit tal på rader eller ein andel i prosent; same frø gjev alltid same utval, slik at oppskrifta kan spelast av igjen |
| Struktur | Ny utrekna kolonne | SQL-uttrykk, til dømes `round(befolkning / 1000.0, 1)` eller `case when andel > 5 then 'stor' else 'liten' end` |
| | Kombiner kolonnar | Fleire kolonnar til éin tekstkolonne med skiljeteikn |
| | Del opp kolonne | Éin tekstkolonne til fleire ved eit skiljeteikn |
| | Hent ut del av tekst | Ein ny kolonne med eit tal på teikn rekna frå byrjinga eller slutten av teksten, frå ein vald posisjon (fylkesnummeret er dei to første siffera i kommunenummeret) |
| | Pivoter til langt format | Valde kolonnar blir rader med namn og verdi |
| | Pivoter til breitt format | Verdiane i ein namnekolonne blir nye kolonnar |
| | SQL-setning | Vilkårleg UPDATE, DELETE eller ALTER TABLE mot tabellen `data` |
| Utrekningar | Andel av summen | Andelen kvar verdi har av summen i prosent eller som brøk, totalt eller per gruppe (andelen kommunen har av folketalet i fylket) |
| | Ranger | Plass i rekkjefølgja, størst eller minst først, totalt eller per gruppe; like verdiar får same plass (med eller utan hol etterpå) eller fortløpande plass |
| | Løpande sum | Den akkumulerte summen i den rekkjefølgja ein annan kolonne gjev, totalt eller per gruppe |
| | Endring frå førre | Differansen eller den prosentvise endringa frå førre rad i den rekkjefølgja ein annan kolonne gjev, til dømes frå året før per kommune |
| | Del inn i klassar | Tal i klassar med eigne nedre grenser (`0, 18, 65` gjev `0–17`, `18–64` og `65–`), eit tal på like breie klassar eller grupper med like mange rader (kvantilar) |
| | Standardiser | z-verdiar (avstanden frå gjennomsnittet i standardavvik, standardavviket i utvalet) eller verdiane skalerte til 0–1 |
| | Hent ut datodel | År, kvartal, månad, ISO-veke, vekedag (1 = måndag), dag, dag i året, år og månad (`2024-03`) eller time frå ein dato |
| | Tid mellom datoar | Talet på heile dagar, veker, månader eller år mellom to datoar, til dømes alder; utan sluttdato blir det rekna til dagens dato når steget blir køyrt |
| Regulære uttrykk | Filtrer med mønster | Held på eller fjernar rader avhengig av om ein kolonne samsvarar med eit regulært uttrykk |
| | Hent ut med mønster | Nye kolonnar av gruppene i mønsteret eller av heile treffet, til dømes årstalet i ein tekst |
| | Marker treff | Ein ja/nei-kolonne som viser om verdien samsvarar |
| | Tel treff | Ein kolonne med talet på treff i kvar verdi |
| | Del opp med mønster | Deler ein kolonne i fleire der mønsteret samsvarar; den siste delen får resten av teksten |
| Nye datasett | Grupper og aggreger | Sum, gjennomsnitt, minste, største, tal, tal på unike eller median per gruppe, til eit nytt datasett |
| | Kople datasett | Venstre- eller indre kopling med eit anna datasett på ein nøkkel |
| | Slå saman datasett | Stablar rader frå fleire datasett; kolonnar blir para på namn |
| | Reins kategoriar | Finn stavevariantar av same verdi (store/små bokstavar, mellomrom, aksentar) og slår dei saman |

Handlingar som lagar eit nytt datasett, lèt originalen vere urørd og vel det nye datasettet når det er ferdig.
Utrekningane legg til ein ny kolonne og lèt dei eksisterande vere urørde; dei byggjer på vindaugsfunksjonane i SQL og
blir eksporterte til R som dplyr-kode med `group_by()` og `mutate()`.
Handlingane med regulære uttrykk blir enklast prøvde i fana Regex i Analyser, der treffa blir viste medan mønsteret
blir skrive; der finst òg mønsterbiblioteket og mønsterprofilen (sjå [regex.md](regex.md)). Same JavaScript-syntaks
gjeld i *Søk og erstatt*, der `(?i)` først i mønsteret eller valet *Ignorer store og små bokstavar* gjer søket
uavhengig av store og små bokstavar.

## Angre

Knappen **Angre** tek tilbake det siste steget, opptil ti steg bakover i same sesjon. Celleredigeringar blir angra ved at den
gamle verdien blir skriven tilbake; andre handlingar ved at eit augneblinksbilete av datasettet blir gjenoppretta. For svært store
datasett tek augneblinksbiletet ei stund, og høgst 80 MB augneblinksbilete blir haldne i minnet. Angre etter at sida er lasta på
nytt, gjer du med versjonar.

## Datakvalitet

Knappen **Datakvalitet** profilerer datasettet: tal på rader og duplikat og per kolonne manglande verdiar, unike verdiar,
intervall og merknader. Merknadene peikar på ei handling som rettar dei med eitt klikk:

- mellomrom i byrjinga eller slutten, doble mellomrom: Fjern mellomrom
- tomme tekstar som ikkje er manglande verdiar: Erstatt verdi (tom til manglande)
- tal eller datoar lagra som tekst: Endre type
- sannsynleg kodingsskade: Reparer teiknkoding
- verdiar som berre skil seg i store og små bokstavar: Endre store og små bokstavar
- verdiar som ser ut som personnummer: Pseudonymiser
- kolonne med same verdi på alle rader (opplysning)

## Reglar

Knappen **Reglar** opnar kvalitetsreglane til datasettet: kva som skal gjelde for at dataa skal vere rette.
Regeltypane er:

| Regeltype | Blir broten av |
|---|---|
| Må ikkje mangle | Manglande verdiar |
| Unik | Verdiar (eller kombinasjonar av fleire kolonnar) som førekjem meir enn éin gong |
| Innanfor intervall | Tal, datoar eller tekst utanfor grensene |
| I liste | Verdiar som ikkje står i lista |
| Har ikkje forbodne verdiar | Verdiar som står i lista, til dømes `ukjend` eller `-99` |
| Samsvarar med mønster | Tekst som ikkje samsvarar med det regulære uttrykket |
| Har eit bestemt format | Tekst som ikkje er ei e-postadresse, ei nettadresse, ein ISO-dato, eit postnummer (svensk, dansk, norsk, finsk eller islandsk) eller ein svensk kommune- eller länskode |
| Tekstlengd | Tekst som er kortare eller lengre enn grensene |
| Ingen overflødige mellomrom | Tekst med mellomrom i byrjinga eller slutten, eller doble mellomrom |
| Kan lesast som type | Tekst som ikkje kan lesast som heiltal, desimaltal, dato, dato og tid eller ja/nei |
| Gyldig identitetsnummer | Nummer med feil form, ugyldig dato eller feil kontrollsiffer, sjå nedanfor |
| Samanlikn to kolonnar | Rader der vilkåret mellom to kolonnar ikkje gjeld, til dømes at startdatoen er mindre enn eller lik sluttdatoen |
| Finst i anna datasett | Verdiar som manglar i ein kolonne i eit anna datasett (referanseintegritet, som ein framandnøkkel) |
| Andel utfylte verdiar | Kolonnen som heilskap, når andelen utfylte verdiar er lågare enn terskelen (til dømes 95 %) |
| Ingen avvikande verdiar | Tal lenger frå kvartilane enn eit valt tal på kvartilavstandar (standard 1,5), eller lenger frå gjennomsnittet enn eit valt tal på standardavvik (standard 3) |
| SQL-vilkår | Rader der det frie SQL-vilkåret ikkje er sant |

Identitetsnummera blir kontrollerte slik: svensk personnummer og samordningsnummer (10 eller 12 siffer, gyldig dato, dag
pluss 60 for samordningsnummer, kontrollsiffer etter Luhn), svensk organisasjonsnummer (tredje siffer minst 2, Luhn),
norsk fødselsnummer og D-nummer (begge kontrollsiffera etter modulus 11), dansk CPR-nummer (gyldig dato; modulus 11
blir ikkje kontrollert fordi han ikkje har gjeldt alle nummer sidan 2007), finsk personbeteckning (hundreårsmarkør og
kontrollteikn) og islandsk kennitala (kontrollsiffer etter modulus 11, gyldig dato, hundreårssiffer). Kontrollen seier
berre at nummeret kan finnast, ikkje at det tilhøyrer nokon.

**Føreslå reglar** legg til reglar frå datakvalitetsprofilen: kolonnar utan manglande verdiar, unike kolonnar og
kodar med fast lengd. Kolonnar med personnummer, organisasjonsnummer, CPR, fødselsnummer, henkilötunnus eller
kennitala i namnet får ein regel for den typen identitetsnummer som minst halvparten av verdiane består, kolonnar med
postnummer i namnet ein regel for postnummerformatet flest verdiar følgjer, og kolonnar med e-post i namnet ein regel
for e-postadresser.

**Køyr reglar** tel radene som bryt kvar regel, viser andelen og nokre døme og loggar køyringa i historikken til datasettet.
For ein broten regel kan dei feilande radene lagrast som eit eige datasett, og heile resultatet kan lastast ned som ein
HTML-rapport. Reglane blir lagra i metadataa til datasettet og følgjer difor med i tryggingskopiar, pakkar og den portable mappa.

## Pseudonymiser

Handlinga **Pseudonymiser** (gruppa Verdiar, òg i kolonnemenyen og kommandopaletten) erstattar identifikatorar som
personnummer eller kundenummer før deling. Tre metodar:

- **Hash**: SHA-256 av eit salt og verdien, korta til valfri lengd (standard 16 teikn). Same verdi gjev same hashverdi,
  så koplingar mellom tabellar overlever om same salt blir brukt. Saltet er ein løynleg tekst som du vel; han blir aldri lagra
  i loggen eller oppskrifta (der står `***`), og ei oppskrift med eit slikt steg kan ikkje spelast av utan at saltet blir oppgjeve
  på nytt.
- **Masker teikn**: held på eit valfritt tal på teikn i byrjinga og slutten og dessutan skiljeteikn og erstattar resten med `*`
  (`19800101-1234` blir `198001**-****` med seks teikn i byrjinga).
- **Løpenummer**: kvar unike verdi får eit løpenummer med prefiks i sortert rekkjefølgje (`P0001`, `P0002`).

Hashing med salt er pseudonymisering, ikkje anonymisering: den som kjenner saltet, kan teste kandidatar, og kombinasjonar av
andre kolonnar kan framleis peike ut personar. Fjern eller grovinndel andre sensitive kolonnar, og del aldri saltet saman
med dataa. SQL-eksporten av oppskrifta brukar funksjonane `dm_hash` og `dm_mask` i Dataspatium; R-eksporten brukar pakken
digest for hashverdiar.

## Geodata

Handlingsgruppa *Geodata* arbeider med geometrikolonnar (GeoJSON eller WKT som tekst, i lengd/breidd eller SWEREF 99 TM)
og koordinatkolonnar:

- **Sentroide frå geometri** legg til lengde- og breiddegrad (WGS 84) for midtpunktet av kvart område eller kvar linje,
  til dømes for å teikne kommunar som bobler i eit punktkart.
- **Areal frå geometri** legg til arealet i kvadratkilometer (plant for SWEREF 99 TM, på kloten for lengd/breidd; hol
  blir trekte frå).
- **Omprojiser koordinatar** reknar om to kolonnar mellom SWEREF 99 TM (aust, nord) og WGS 84 (lengd, breidd) til nye
  kolonnar med formlane frå Lantmäteriet.
- **Kommune og län frå koordinatar** slår opp kva svensk kommune og kva län kvart punkt ligg i, med grensene frå SCB som
  følgjer med og legg til `kommunkod`, `kommun`, `lanskod` og `lan` (eller berre län). Koordinatar i SWEREF 99 TM
  blir kjende att. Grensene er dei forenkla landgrensene frå SCB for tematiske kart: punkt i innsjøar, havet eller utanfor Sverige
  blir tomme, og punkt svært nær ei grense kan hamne i nabokommunen.
- **Høgd frå terrengmodellen** legg til høgda i meter (RH 2000) for kvart punkt frå terrengmodellen til Lantmäteriet med
  nøkkelen til *Lantmäteriet geodata med nøkkel (STAC)*. Koordinatane kan vere i WGS 84 eller SWEREF 99 TM; høgst 5 000
  punkt om gongen, og eit punkt utanfor modellen får inga høgd.
- **Høgder langs geometrien** legg til lågaste, høgaste og gjennomsnittleg høgd langs kvar linje og polygonkant, med
  eitt punkt kvar tiande meter som standard (høgst 200 per geometri), i kolonnane `hojd_min`, `hojd_max` og
  `hojd_medel`.

Alle fire er steg i oppskrifta som kan angrast og spelast av igjen. I SQL-eksporten blir dei viste som kall til funksjonane i
Dataspatium (`dm_geo_lon`, `dm_geo_area`, `dm_to_lon`, `dm_region` med fleire); R-eksporten gjev tilsvarande kode med pakken sf.

## Versjonar

Knappen **Versjonar** (finst òg i Handter) lagrar eit augneblinksbilete av datasettet med ei skildring. Ein versjon kan
samanliknast med notilstanden (tal på rader, nye, fjerna og omtypa kolonnar), gjenopprettast eller slettast. Versjonar
blir lagra i databasen til nettlesaren og følgjer med i tryggingskopien av arbeidsområdet. Lagre ein versjon før større endringar.

## Oppskrift

Knappen **Oppskrift** viser alle steg som er gjorde med datasettet, i rekkjefølgje. Herifrå kan du:

- kopiere oppskrifta som R-kode (`dm_read()` med kortnamnet, dplyr/tidyr/stringr-kall, `dm_write()`) eller som SQL mot
  tabellen `data`,
- laste ned oppskrifta som JSON for å dele henne med andre,
- køyre dei same stega på eit anna datasett i arbeidsområdet,
- køyre ei oppskrift frå ei JSON-fil på det valde datasettet.

Avspelinga stoppar ved det første steget som mislukkast (til dømes ein kolonne som ikkje finst), og fortel kor mange
steg som vart utførte. Oppskriftsfila har forma

```json
{ "app": "Dataspatium", "kind": "recipe", "version": "0.3.0", "name": "Reinsing av kommunar",
  "steps": [ { "op": "trim", "params": { "columns": ["kommun"], "squish": true }, "description": "Fjern mellomrom i kommun" } ] }
```

## Kodesteg

Gruppa **Kode** i paletten har to handlingar som køyrer ein funksjon på heile tabellen: **Python-steg**
(`def step(df):` med pandas, sjå [python.md](python.md)) og **R-steg** (`function(df) { ... }`, sjå
[r-guide.md](r-guide.md)). Det funksjonen returnerer, blir den nye tabellen med typar frå resultatet; etikettar og
einingar følgjer med kolonnar som held på namnet sitt. *Førehandsvis* køyrer funksjonen på dei første 200 radene og
viser kolonnar og nokre rader. Steget blir logga i oppskrifta med koden sin, kan angrast og spelast av på andre datasett;
i SQL-eksporten står koden som kommentar, i R-eksporten blir R-steget køyrt som kode og Python-steget står som kommentar.
Python blir henta første gongen.

## Dokument, bilete og kart

Dokument- og biletsamlingar blir opna i Bearbeid i ei eiga vising (lesevising og galleri), og datasett med
geometri eller koordinatar som eit kart å zoome og panorere i; knappen *Vis som tabell* gjev den vanlege tabellen. Alle
handlingar her gjeld tabellen: filtrere avsnitt eller objekt, rette tekst, slette rader, leggje til utrekna
kolonnar. Sjå [dokument.md](dokument.md) og [kartor.md](kartor.md).

## SQL-konsollen

Kvart datasett har eit **kortnamn** (blir vist under namnet i objektpanelet og under Handter, der det kan endrast saman med
namnet): små bokstavar a–z, siffer og understrek, høgst 20 teikn og helst høgst 15, aldri eit reservert ord i SQL eller R.
Forslaget blir danna av namnet utan småord og med årstal som ending: *Folketal per kommune 2024* blir `befolkning_2024`.
Kortnamna til dømedataa som følgjer med er faste (`befolkning_2024`, `kommungranser`, `lansgranser`) på alle språk.
I SQL-konsollen heiter det valde datasettet `data`, men blir òg nådd med kortnamnet sitt, og andre datasett blir nådde med kortnamna
sine, slik at éi spørjing kan kople fleire datasett:

```sql
select k.kommun, k.lan, b.folkmangd
from befolkning_2024 b
join kommungranser k on k.kommunkod = b.kommunkod
order by b.folkmangd desc
```

Andre datasett er skriveverna i spørjinga; UPDATE, DELETE og ALTER gjeld det valde datasettet, men kan lese dei andre
(til dømes `update data set lan = (select lan from kommungranser k where k.kommunkod = data.kommunkod)`). Høgst ni andre
datasett kan inngå i same spørjing. Resultatet kan lagrast som eit nytt datasett. Kortnamna fungerer òg i R
(`dm_read("kortnamn")`; knappen *Set inn dm_read()*, R-døma, nye notatbøker og R-eksporten av oppskriftene brukar
kortnamnet) og blir brukte når diagram og notatbøker blir kopla til datasett ved import.

SQL-konsollen ligg i modusen Analyser under fana SQL og arbeider mot det valde datasettet, der tabellen heiter `data`.
Ctrl+Enter køyrer heile skriptet, merkt tekst blir køyrd åleine.

- `SELECT`, `WITH`, `VALUES`, `PRAGMA` og `EXPLAIN` viser resultatet i ein tabell (dei første 5 000 radene). **Lagre resultatet
  som datasett** lagar eit nytt datasett av heile resultatet utan radgrense.
- `UPDATE`, `DELETE`, `ALTER TABLE` og andre setningar endrar datasettet, blir logga som oppskriftssteget SQL-setning og kan
  angrast i Bearbeid.
- Eigenskapspanelet viser kolonnane i datasettet (eit klikk set inn namnet), kortnamna til alle datasett og dei ekstra
  SQL-funksjonane Dataspatium legg til: `regexp`, `regexp_replace`, `dm_parse_number`, `dm_parse_date`, `dm_fix_encoding`,
  `dm_upper`, `dm_lower`, `dm_title`, `dm_squish`, `dm_round`, `dm_pad`, `dm_date_part`, `dm_date_diff` og
  `dm_valid_id` (til dømes `select * from data where dm_valid_id(fodselsnummer, 'no_fnr') = 0`), og
  regex-funksjonane `dm_regex_test`, `dm_regex_extract`, `dm_regex_all`, `dm_regex_count`, `dm_regex_split` og
  `dm_shape` som er skildra i [regex.md](regex.md).
- SQL-skript blir lagra i objektpanelet på same måte som R-skript.

SQLite-dialekten gjeld: `||` for tekstsamanslåing, `cast(x as integer)`, `strftime()` for datoar, `group_concat()`,
vindaugsfunksjonar som `row_number() over (partition by …)`.

## Avgrensingar

- Angre gjeld innanfor sesjonen; bruk versjonar for å gå tilbake etter at sida er lasta på nytt.
- Handlingar som byggjer om ein kolonne (Endre type, Del opp kolonne, pivotering), eksporterer datasettet for angre først. På
  datasett over nokre hundre MB tek det merkbar tid.
- R-eksporten av oppskriftene dekkjer dei innebygde handlingane; fri SQL blir eksportert som kommentar, fordi han ikkje kan setjast om
  til R automatisk.

## Etter slaget til datasettet

- **Kommentarar på det du ser på.** I inspektøren kan du kommentere ei side, eit bilete, ein node, eit element, eit planobjekt eller ein stad på kartet. Under Kommentarar i Handter ser du alle, og *Vis* tek deg tilbake til det kommentaren gjeld.
- **Bilete.** Du set etikettar, som kan søkjast på, og ein stad, som gjer at biletet blir vist på kartet.
- **Dokument.** Merk eit avsnitt for å rette teksten. Rettinga gjeld teksten i datasettet, og originalfila blir ikkje endra. Eit dokument kan få etikettar, og *Masker personopplysningar* gøymer det som ser ut som personopplysningar, i teksten. Originalfila inneheld dei framleis, så fjern henne frå kopien når du deler.
- **Kart.** *Reparer geometriar* fjernar gjentekne punkt og lukkar flater. Verdiar som ikkje kan lesast som form, blir tømde. *Koordinatar frå eit anna system* legg til kolonnar i grader. Eit utval frå ein annan modus blir merkt på kartet.
- **Grafar.** *Finn duplikat* viser nodar med same etikett og namn, der store og små bokstavar, aksentar og teiknsetjing ikkje tel. Du vel kva for nokre som blir slått saman.
- **Modellar.** *Klassifiser* set ei klassifisering på elementa som blir viste, til dømes alt av éin type på éin etasje.
- **Planar.** *Endre status* held orden på status, dato og eit notat.
- **Tabellar.** Ei rad som namngjev bilete, viser dei i inspektøren.

Endringar i dataa kan angrast.
