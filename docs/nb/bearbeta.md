# Bearbeid og SQL-konsollen

Modusen Bearbeid er alt man gjør med tabellen via knapper og dialoger: rette celler, rense tekst, endre typer, beregne nye
kolonner, pivotere, koble datasett. Hver handling logges som et trinn i datasettets oppskrift, kan angres og kan spilles av
igjen på et annet datasett. SQL-konsollen i modusen Analyser arbeider mot samme datasett og logger endringer på samme måte.

## Tabellen

- Dobbeltklikk på en celle, eller marker en rad og trykk Enter eller F2 for å redigere. Enter lagrer, Esc avbryter, Tab går
  videre til neste celle. Verdien tolkes etter kolonnens type: skriver du tekst i en tallkolonne, får du en feilmelding, og
  cellen beholder verdien sin. Tom tekst blir en manglende verdi.
- Piltastene flytter markeringen, Page Up/Page Down blar, Home/End hopper til første eller siste rad.
- Klikk på en kolonneoverskrift for å sortere (stigende, fallende, usortert). Egenskapspanelet til høyre viser da
  kolonnestatistikk (antall, manglende, unike, minste, største, gjennomsnitt, sum, vanligste verdier) og handlingene som
  passer kolonnens type. Skift-klikk viser statistikken uten å endre sorteringen.
- Filterfeltet søker i alle kolonner. Redigering fungerer også i et filtrert utvalg.
- *Liste* i verktøylinjen (vises når datasettet har lagrede søk fra Søk) avgrenser tabellen til listens rader;
  merket viser antall av totalen. Redigering og handlinger fungerer som vanlig.
- Tabellen er virtualisert: bare de synlige radene finnes i nettleserens DOM, resten ligger i SQLite. En million rader blas
  like raskt som hundre.

**Kolonner visningen trenger.** Grafen trenger nodens id, kartet sin geometri og galleriet sine filnavn. Tabellen kan endres fritt, men appen spør først hvis du er i ferd med å fjerne, gi nytt navn til eller endre typen for en slik kolonne. Fjerner et steg som ikke kan forutses den, for eksempel SQL eller en pivotering, vises en melding med Angre.

## Handlinger

Knappen **Handlinger** åpner paletten. Hver handling har en dialog med felter som lages ut fra handlingens parametere, og der
det er mulig, vises en forhåndsvisning av hvor mange rader som påvirkes, og eksempler før og etter.

| Gruppe | Handling | Hva den gjør |
|---|---|---|
| Kolonner | Gi kolonnen nytt navn | Nytt kolonnenavn; etiketten følger med hvis den var lik navnet |
| | Etikett, beskrivelse og enhet | Etiketten er visningsnavnet i tabelloverskrifter og diagrammer; beskrivelse og enhet vises i inspektøren og kodeboken, følger med SQLite-filen og når R som attributtene `description` og `unit` |
| | Verdietiketter | Navn på kolonnens koder, én per linje `kode = etikett` (for eksempel `1 = Mann`); verdiene endres ikke. Etikettene vises i egenskapspanelet (også ved de vanligste verdiene) og kodeboken, når R som `haven::labelled` og skrives til .sav og .dta. Tom tekst fjerner dem |
| | Slett kolonner | Fjerner valgte kolonner |
| | Endre kolonnerekkefølgen | Flytt kolonner opp og ned |
| | Endre type | Tekst til heltall, desimaltall, dato, dato og tid eller ja/nei. Desimaltegn og datoformat kan angis; verdier som ikke kan tolkes, blir tomme, og antallet rapporteres |
| | Kopier kolonne | En kopi med nytt navn, for eksempel før originalen endres |
| | Rydd i kolonnenavn | Alle navn blir små bokstaver, sifre og understreker (`Folkmängd 2024` blir `folkmangd_2024`), som er lette å skrive i SQL og R; etikettene beholder de opprinnelige navnene |
| Verdier | Søk og erstatt | Tekst eller regulært uttrykk i valgte tekstkolonner, med forhåndsvisning |
| | Fjern mellomrom | Innledende, avsluttende og (valgfritt) doble mellomrom |
| | Endre store og små bokstaver | STORE BOKSTAVER, små bokstaver eller Stor Forbokstav |
| | Reparer tegnkoding | Retter mojibake (Ã¸ blir til ø) som har oppstått ved import med feil tegnkoding |
| | Erstatt verdi | Én nøyaktig verdi med en annen; en tom verdi kan velges som fra eller til |
| | Omkod verdier | Flere verdier på én gang etter en liste med én linje per verdi, `gammel = ny` (for eksempel `01 = Stockholms län`); andre verdier beholdes eller tømmes |
| | Bytt koder mot etiketter | Bytter kolonnens koder mot verdietikettene deres, eller tilbake. Etikettene lagres, slik at .sav og .dta får kodene igjen ved eksport; verdier uten etikett blir stående som de er, og tilbake til koder blir kolonnen tall hvis alle kodene er tall |
| | Fyll inn manglende verdier | Konstant verdi, forrige eller neste rads verdi, gjennomsnitt, median eller vanligste verdi |
| | Rund av tall | Til valgt antall desimaler: til nærmeste (en halv rundes bort fra null), nedover, oppover eller ved å stryke desimalene; et negativt antall runder av til tiere (−1), hundrere (−2) og så videre |
| | Fyll ut med innledende nuller | Til en bestemt lengde, for eksempel kommunekoden 114 til 0114; tall blir tekst, slik at nullene beholdes |
| | Fjern tegn | Behold bare sifre (telefon- og organisasjonsnumre), behold bare bokstaver og mellomrom, fjern tegnsetting og symboler, eller fjern alle mellomrom |
| Rader | Slett rader | SQL-betingelse, for eksempel `befolkning < 1000`; velg Behold for i stedet bare å beholde radene som matcher |
| | Fjern duplikater | På valgte kolonner eller hele raden; første forekomst beholdes |
| | Fjern tomme rader og kolonner | Rader der alle verdier mangler, og om du vil, kolonner helt uten verdier |
| | Sorter rader | Endrer radenes rekkefølge permanent, stigende eller synkende på én kolonne, slik at eksporter og dokumenter får samme rekkefølge; tomme verdier kommer sist |
| | Behold de øverste radene | Radene med størst eller minst verdi, totalt eller per gruppe (for eksempel de tre største kommunene i hvert fylke) |
| | Tilfeldig utvalg | Et antall rader eller en andel i prosent; samme frø gir alltid samme utvalg, slik at oppskriften kan spilles av igjen |
| Struktur | Ny beregnet kolonne | SQL-uttrykk, for eksempel `round(befolkning / 1000.0, 1)` eller `case when andel > 5 then 'stor' else 'liten' end` |
| | Kombiner kolonner | Flere kolonner til én tekstkolonne med skilletegn |
| | Del opp kolonne | Én tekstkolonne til flere ved et skilletegn |
| | Hent ut del av tekst | En ny kolonne med et antall tegn regnet fra begynnelsen eller slutten av teksten, fra en valgt posisjon (fylkesnummeret er de to første sifrene i kommunenummeret) |
| | Pivoter til langt format | Valgte kolonner blir rader med navn og verdi |
| | Pivoter til bredt format | Verdiene i en navnekolonne blir nye kolonner |
| | SQL-setning | Vilkårlig UPDATE, DELETE eller ALTER TABLE mot tabellen `data` |
| Beregninger | Andel av summen | Hver verdis andel av summen i prosent eller som brøk, totalt eller per gruppe (kommunens andel av fylkets befolkning) |
| | Ranger | Plass i rekkefølgen, størst eller minst først, totalt eller per gruppe; like verdier får samme plass (med eller uten hull etterpå) eller fortløpende plass |
| | Løpende sum | Den akkumulerte summen i den rekkefølgen en annen kolonne angir, totalt eller per gruppe |
| | Endring fra forrige | Differansen eller den prosentvise endringen fra forrige rad i den rekkefølgen en annen kolonne angir, for eksempel fra året før per kommune |
| | Del inn i klasser | Tall i klasser med egne nedre grenser (`0, 18, 65` gir `0–17`, `18–64` og `65–`), et antall like brede klasser eller grupper med like mange rader (kvantiler) |
| | Standardiser | z-verdier (avstanden fra gjennomsnittet i standardavvik, utvalgets standardavvik) eller verdiene skalert til 0–1 |
| | Hent ut datodel | År, kvartal, måned, ISO-uke, ukedag (1 = mandag), dag, dag i året, år og måned (`2024-03`) eller time fra en dato |
| | Tid mellom datoer | Antall hele dager, uker, måneder eller år mellom to datoer, for eksempel alder; uten sluttdato regnes det til dagens dato når steget kjøres |
| Regulære uttrykk | Filtrer med mønster | Beholder eller fjerner rader avhengig av om en kolonne matcher et regulært uttrykk |
| | Hent ut med mønster | Nye kolonner av mønsterets grupper eller av hele treffet, for eksempel årstallet i en tekst |
| | Marker treff | En ja/nei-kolonne som viser om verdien matcher |
| | Tell treff | En kolonne med antall treff i hver verdi |
| | Del opp med mønster | Deler en kolonne i flere der mønsteret matcher; den siste delen får resten av teksten |
| Nye datasett | Grupper og aggreger | Sum, gjennomsnitt, minste, største, antall, antall unike eller median per gruppe, til et nytt datasett |
| | Koble datasett | Venstre- eller indre kobling med et annet datasett på en nøkkel |
| | Slå sammen datasett | Stabler rader fra flere datasett; kolonner matches på navn |
| | Rens kategorier | Finner stavevarianter av samme verdi (store/små bokstaver, mellomrom, aksenter) og slår dem sammen |

Handlinger som lager et nytt datasett, lar originalen være urørt og velger det nye datasettet når det er ferdig.
Beregningene legger til en ny kolonne og lar de eksisterende være urørt; de bygger på SQLs vindusfunksjoner og
eksporteres til R som dplyr-kode med `group_by()` og `mutate()`.
Handlingene med regulære uttrykk prøves enklest i fanen Regex i Analyser, der treffene vises mens mønsteret
skrives; der finnes også mønsterbiblioteket og mønsterprofilen (se [regex.md](regex.md)). Samme JavaScript-syntaks
gjelder i *Søk og erstatt*, der `(?i)` først i mønsteret eller valget *Ignorer store og små bokstaver* gjør søket
uavhengig av store og små bokstaver.

## Angre

Knappen **Angre** tar tilbake det siste trinnet, opptil ti trinn bakover i samme sesjon. Celleredigeringer angres ved at den
gamle verdien skrives tilbake; øvrige handlinger ved at et øyeblikksbilde av datasettet gjenopprettes. For svært store
datasett tar øyeblikksbildet en stund, og høyst 80 MB øyeblikksbilder holdes i minnet. Angre etter at siden er lastet på
nytt, gjør du med versjoner.

## Datakvalitet

Knappen **Datakvalitet** profilerer datasettet: antall rader og duplikater og per kolonne manglende verdier, unike verdier,
intervall og merknader. Merknadene peker på en handling som retter dem med ett klikk:

- mellomrom i begynnelsen eller slutten, doble mellomrom: Fjern mellomrom
- tomme tekster som ikke er manglende verdier: Erstatt verdi (tom til manglende)
- tall eller datoer lagret som tekst: Endre type
- sannsynlig kodingsskade: Reparer tegnkoding
- verdier som bare skiller seg i store og små bokstaver: Endre store og små bokstaver
- verdier som ser ut som personnumre: Pseudonymiser
- kolonne med samme verdi på alle rader (opplysning)

## Regler

Knappen **Regler** åpner datasettets kvalitetsregler: hva som skal gjelde for at dataene skal være riktige.
Regeltypene er:

| Regeltype | Brytes av |
|---|---|
| Må ikke mangle | Manglende verdier |
| Unik | Verdier (eller kombinasjoner av flere kolonner) som forekommer mer enn én gang |
| Innenfor intervall | Tall, datoer eller tekst utenfor grensene |
| I liste | Verdier som ikke står i listen |
| Har ikke forbudte verdier | Verdier som står i listen, for eksempel `ukjent` eller `-99` |
| Matcher mønster | Tekst som ikke matcher det regulære uttrykket |
| Har et bestemt format | Tekst som ikke er en e-postadresse, en nettadresse, en ISO-dato, et postnummer (svensk, dansk, norsk, finsk eller islandsk) eller en svensk kommune- eller lenskode |
| Tekstlengde | Tekst som er kortere eller lengre enn grensene |
| Ingen overflødige mellomrom | Tekst med mellomrom i begynnelsen eller slutten, eller doble mellomrom |
| Kan leses som type | Tekst som ikke kan leses som heltall, desimaltall, dato, dato og tid eller ja/nei |
| Gyldig identitetsnummer | Numre med feil form, ugyldig dato eller feil kontrollsiffer, se nedenfor |
| Sammenlign to kolonner | Rader der betingelsen mellom to kolonner ikke gjelder, for eksempel at startdatoen er mindre enn eller lik sluttdatoen |
| Finnes i annet datasett | Verdier som mangler i en kolonne i et annet datasett (referanseintegritet, som en fremmednøkkel) |
| Andel utfylte verdier | Kolonnen som helhet, når andelen utfylte verdier er lavere enn terskelen (for eksempel 95 %) |
| Ingen avvikende verdier | Tall lenger fra kvartilene enn et valgt antall kvartilavstander (standard 1,5), eller lenger fra gjennomsnittet enn et valgt antall standardavvik (standard 3) |
| SQL-betingelse | Rader der den frie SQL-betingelsen ikke er sann |

Identitetsnumrene kontrolleres slik: svensk personnummer og samordningsnummer (10 eller 12 sifre, gyldig dato, dag
pluss 60 for samordningsnumre, kontrollsiffer etter Luhn), svensk organisasjonsnummer (tredje siffer minst 2, Luhn),
norsk fødselsnummer og D-nummer (begge kontrollsifrene etter modulus 11), dansk CPR-nummer (gyldig dato; modulus 11
kontrolleres ikke fordi den ikke har gjeldt alle numre siden 2007), finsk personbeteckning (århundremarkør og
kontrolltegn) og islandsk kennitala (kontrollsiffer etter modulus 11, gyldig dato, århundresiffer). Kontrollen sier
bare at nummeret kan finnes, ikke at det tilhører noen.

**Foreslå regler** legger til regler fra datakvalitetsprofilen: kolonner uten manglende verdier, unike kolonner og
koder med fast lengde. Kolonner med personnummer, organisasjonsnummer, CPR, fødselsnummer, henkilötunnus eller
kennitala i navnet får en regel for den typen identitetsnummer som minst halvparten av verdiene består, kolonner med
postnummer i navnet en regel for postnummerformatet flest verdier følger, og kolonner med e-post i navnet en regel
for e-postadresser.

**Kjør regler** teller radene som bryter hver regel, viser andelen og noen eksempler og logger kjøringen i datasettets
historikk. For en brutt regel kan de feilende radene lagres som et eget datasett, og hele resultatet kan lastes ned som en
HTML-rapport. Reglene lagres i datasettets metadata og følger derfor med i sikkerhetskopier, pakker og den portable mappen.

## Pseudonymiser

Handlingen **Pseudonymiser** (gruppen Verdier, også i kolonnemenyen og kommandopaletten) erstatter identifikatorer som
personnumre eller kundenumre før deling. Tre metoder:

- **Hash**: SHA-256 av et salt og verdien, forkortet til valgfri lengde (standard 16 tegn). Samme verdi gir samme hashverdi,
  så koblinger mellom tabeller overlever hvis samme salt brukes. Saltet er en hemmelig tekst som du velger; den lagres aldri
  i loggen eller oppskriften (der står `***`), og en oppskrift med et slikt trinn kan ikke spilles av uten at saltet angis
  på nytt.
- **Masker tegn**: beholder et valgfritt antall tegn i begynnelsen og slutten samt skilletegn og erstatter resten med `*`
  (`19800101-1234` blir `198001**-****` med seks tegn i begynnelsen).
- **Løpenummer**: hver unike verdi får et løpenummer med prefiks i sortert rekkefølge (`P0001`, `P0002`).

Hashing med salt er pseudonymisering, ikke anonymisering: den som kjenner saltet, kan teste kandidater, og kombinasjoner av
andre kolonner kan fortsatt peke ut personer. Fjern eller grovinndel øvrige sensitive kolonner, og del aldri saltet sammen
med dataene. Oppskriftens SQL-eksport bruker Dataspatiums funksjoner `dm_hash` og `dm_mask`; R-eksporten bruker pakken
digest for hashverdier.

## Geodata

Handlingsgruppen *Geodata* arbeider med geometrikolonner (GeoJSON eller WKT som tekst, i lengde/bredde eller SWEREF 99 TM)
og koordinatkolonner:

- **Sentroide fra geometri** legger til lengde- og breddegrad (WGS 84) for midtpunktet av hvert område eller hver linje,
  for eksempel for å tegne kommuner som bobler i et punktkart.
- **Areal fra geometri** legger til arealet i kvadratkilometer (plant for SWEREF 99 TM, på kloden for lengde/bredde; hull
  trekkes fra).
- **Omprojiser koordinater** regner om to kolonner mellom SWEREF 99 TM (øst, nord) og WGS 84 (lengde, bredde) til nye
  kolonner med Lantmäteriets formler.
- **Kommune og län fra koordinater** slår opp hvilken svensk kommune og hvilket län hvert punkt ligger i, med SCBs
  medfølgende grenser og legger til `kommunkod`, `kommun`, `lanskod` og `lan` (eller bare län). Koordinater i SWEREF 99 TM
  gjenkjennes. Grensene er SCBs forenklede landgrenser for tematiske kart: punkter i innsjøer, havet eller utenfor Sverige
  blir tomme, og punkter svært nær en grense kan havne i nabokommunen.

Alle fire er trinn i oppskriften som kan angres og spilles av igjen. I SQL-eksporten vises de som kall til Dataspatiums
funksjoner (`dm_geo_lon`, `dm_geo_area`, `dm_to_lon`, `dm_region` med flere); R-eksporten gir tilsvarende kode med pakken sf.

## Versjoner

Knappen **Versjoner** (finnes også i Håndter) lagrer et øyeblikksbilde av datasettet med en beskrivelse. En versjon kan
sammenlignes med nåtilstanden (antall rader, nye, fjernede og omtypede kolonner), gjenopprettes eller slettes. Versjoner
lagres i nettleserens database og følger med i sikkerhetskopien av arbeidsområdet. Lagre en versjon før større endringer.

## Oppskrift

Knappen **Oppskrift** viser alle trinn som er gjort med datasettet, i rekkefølge. Herfra kan du:

- kopiere oppskriften som R-kode (`dm_read()` med kortnavnet, dplyr/tidyr/stringr-kall, `dm_write()`) eller som SQL mot
  tabellen `data`,
- laste ned oppskriften som JSON for å dele den med andre,
- kjøre de samme trinnene på et annet datasett i arbeidsområdet,
- kjøre en oppskrift fra en JSON-fil på det valgte datasettet.

Avspillingen stopper ved det første trinnet som mislykkes (for eksempel en kolonne som ikke finnes), og forteller hvor mange
trinn som ble utført. Oppskriftsfilen har formen

```json
{ "app": "Dataspatium", "kind": "recipe", "version": "0.3.0", "name": "Rensing av kommuner",
  "steps": [ { "op": "trim", "params": { "columns": ["kommun"], "squish": true }, "description": "Fjern mellomrom i kommun" } ] }
```

## Kodesteg

Gruppen **Kode** i paletten har to handlinger som kjører en funksjon på hele tabellen: **Python-steg**
(`def step(df):` med pandas, se [python.md](python.md)) og **R-steg** (`function(df) { ... }`, se
[r-guide.md](r-guide.md)). Det funksjonen returnerer, blir den nye tabellen med typer fra resultatet; etiketter og
enheter følger med kolonner som beholder navnet sitt. *Forhåndsvis* kjører funksjonen på de første 200 radene og
viser kolonner og noen rader. Steget logges i oppskriften med koden sin, kan angres og spilles av på andre datasett;
i SQL-eksporten står koden som kommentar, i R-eksporten kjøres R-steget som kode og Python-steget står som kommentar.
Python hentes første gang.

## Dokumenter, bilder og kart

Dokument- og bildesamlinger åpnes i Bearbeid i en egen visning (lesevisning respektive galleri), og datasett med
geometri eller koordinater som et kart å zoome og panorere i; knappen *Vis som tabell* gir den vanlige tabellen. Alle
handlinger her gjelder tabellen: filtrere avsnitt eller objekter, rette tekst, slette rader, legge til beregnede
kolonner. Se [dokument.md](dokument.md) og [kartor.md](kartor.md).

## SQL-konsollen

Hvert datasett har et **kortnavn** (vises under navnet i objektpanelet og under Håndter, der det kan endres sammen med
navnet): små bokstaver a–z, sifre og understrek, høyst 20 tegn og helst høyst 15, aldri et reservert ord i SQL eller R.
Forslaget dannes av navnet uten småord og med årstall som endelse: *Befolkning per kommune 2024* blir `befolkning_2024`.
Kortnavnene til de medfølgende eksempeldataene er faste (`befolkning_2024`, `kommungranser`, `lansgranser`) på alle språk.
I SQL-konsollen heter det valgte datasettet `data`, men nås også med kortnavnet sitt, og andre datasett nås med kortnavnene
sine, slik at én spørring kan koble flere datasett:

```sql
select k.kommun, k.lan, b.folkmangd
from befolkning_2024 b
join kommungranser k on k.kommunkod = b.kommunkod
order by b.folkmangd desc
```

Andre datasett er skrivebeskyttet i spørringen; UPDATE, DELETE og ALTER gjelder det valgte datasettet, men kan lese de andre
(for eksempel `update data set lan = (select lan from kommungranser k where k.kommunkod = data.kommunkod)`). Høyst ni andre
datasett kan inngå i samme spørring. Resultatet kan lagres som et nytt datasett. Kortnavnene fungerer også i R
(`dm_read("kortnavn")`; knappen *Sett inn dm_read()*, R-eksemplene, nye notatbøker og oppskriftenes R-eksport bruker
kortnavnet) og brukes når diagrammer og notatbøker kobles til datasett ved import.

SQL-konsollen ligger i modusen Analyser under fanen SQL og arbeider mot det valgte datasettet, der tabellen heter `data`.
Ctrl+Enter kjører hele skriptet, markert tekst kjøres alene.

- `SELECT`, `WITH`, `VALUES`, `PRAGMA` og `EXPLAIN` viser resultatet i en tabell (de første 5 000 radene). **Lagre resultatet
  som datasett** lager et nytt datasett av hele resultatet uten radgrense.
- `UPDATE`, `DELETE`, `ALTER TABLE` og andre setninger endrer datasettet, logges som oppskriftstrinnet SQL-setning og kan
  angres i Bearbeid.
- Egenskapspanelet viser datasettets kolonner (et klikk setter inn navnet), alle datasetts kortnavn og de ekstra
  SQL-funksjonene Dataspatium legger til: `regexp`, `regexp_replace`, `dm_parse_number`, `dm_parse_date`, `dm_fix_encoding`,
  `dm_upper`, `dm_lower`, `dm_title`, `dm_squish`, `dm_round`, `dm_pad`, `dm_date_part`, `dm_date_diff` og
  `dm_valid_id` (for eksempel `select * from data where dm_valid_id(fodselsnummer, 'no_fnr') = 0`), og
  regex-funksjonene `dm_regex_test`, `dm_regex_extract`, `dm_regex_all`, `dm_regex_count`, `dm_regex_split` og
  `dm_shape` som er beskrevet i [regex.md](regex.md).
- SQL-skript lagres i objektpanelet på samme måte som R-skript.

SQLite-dialekten gjelder: `||` for tekstsammenslåing, `cast(x as integer)`, `strftime()` for datoer, `group_concat()`,
vindusfunksjoner som `row_number() over (partition by …)`.

## Begrensninger

- Angre gjelder innenfor sesjonen; bruk versjoner for å gå tilbake etter at siden er lastet på nytt.
- Handlinger som bygger om en kolonne (Endre type, Del opp kolonne, pivotering), eksporterer datasettet for angre først. På
  datasett over noen hundre MB tar det merkbar tid.
- Oppskriftenes R-eksport dekker de innebygde handlingene; fri SQL eksporteres som kommentar, fordi den ikke kan oversettes
  til R automatisk.

## Etter datasettets slag

- **Kommentarer på det du ser på.** I inspektøren kan du kommentere en side, et bilde, en node, et element, et planobjekt eller et sted på kartet. Under Kommentarer i Håndter ser du alle, og *Vis* tar deg tilbake til det kommentaren gjelder.
- **Bilder.** Du setter etiketter, som kan søkes på, og et sted, som gjør at bildet vises på kartet.
- **Dokumenter.** Merk et avsnitt for å rette teksten. Rettelsen gjelder teksten i datasettet, og originalfilen endres ikke. Et dokument kan få etiketter, og *Masker personopplysninger* skjuler det som ser ut som personopplysninger, i teksten. Originalfilen inneholder dem fortsatt, så fjern den fra kopien når du deler.
- **Kart.** *Reparer geometrier* fjerner gjentatte punkter og lukker flater. Verdier som ikke kan leses som form, tømmes. *Koordinater fra et annet system* legger til kolonner i grader. Et utvalg fra en annen modus markeres på kartet.
- **Grafer.** *Finn duplikater* viser noder med samme etikett og navn, der store og små bokstaver, aksenter og tegnsetting ikke teller. Du velger hvilke som slås sammen.
- **Modeller.** *Klassifiser* setter en klassifisering på elementene som vises, for eksempel alt av én type på én etasje.
- **Planer.** *Endre status* holder orden på status, dato og et notat.
- **Tabeller.** En rad som navngir bilder, viser dem i inspektøren.

Endringer i dataene kan angres.
