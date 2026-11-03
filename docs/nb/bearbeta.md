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
- Tabellen er virtualisert: bare de synlige radene finnes i nettleserens DOM, resten ligger i SQLite. En million rader blas
  like raskt som hundre.

## Handlinger

Knappen **Handlinger** åpner paletten. Hver handling har en dialog med felter som lages ut fra handlingens parametere, og der
det er mulig, vises en forhåndsvisning av hvor mange rader som påvirkes, og eksempler før og etter.

| Gruppe | Handling | Hva den gjør |
|---|---|---|
| Kolonner | Gi kolonnen nytt navn | Nytt kolonnenavn; etiketten følger med hvis den var lik navnet |
| | Etikett, beskrivelse og enhet | Etiketten er visningsnavnet i tabelloverskrifter og diagrammer; beskrivelse og enhet vises i inspektøren og kodeboken, følger med SQLite-filen og når R som attributtene `description` og `unit` |
| | Slett kolonner | Fjerner valgte kolonner |
| | Endre kolonnerekkefølgen | Flytt kolonner opp og ned |
| | Endre type | Tekst til heltall, desimaltall, dato, dato og tid eller ja/nei. Desimaltegn og datoformat kan angis; verdier som ikke kan tolkes, blir tomme, og antallet rapporteres |
| Verdier | Søk og erstatt | Tekst eller regulært uttrykk i valgte tekstkolonner, med forhåndsvisning |
| | Fjern mellomrom | Innledende, avsluttende og (valgfritt) doble mellomrom |
| | Endre store og små bokstaver | STORE BOKSTAVER, små bokstaver eller Stor Forbokstav |
| | Reparer tegnkoding | Retter mojibake (Ã¸ blir til ø) som har oppstått ved import med feil tegnkoding |
| | Erstatt verdi | Én nøyaktig verdi med en annen; en tom verdi kan velges som fra eller til |
| | Fyll inn manglende verdier | Konstant verdi eller forrige rads verdi |
| Rader | Slett rader | SQL-betingelse, for eksempel `befolkning < 1000`; velg Behold for i stedet bare å beholde radene som matcher |
| | Fjern duplikater | På valgte kolonner eller hele raden; første forekomst beholdes |
| Struktur | Ny beregnet kolonne | SQL-uttrykk, for eksempel `round(befolkning / 1000.0, 1)` eller `case when andel > 5 then 'stor' else 'liten' end` |
| | Kombiner kolonner | Flere kolonner til én tekstkolonne med skilletegn |
| | Del opp kolonne | Én tekstkolonne til flere ved et skilletegn |
| | Pivoter til langt format | Valgte kolonner blir rader med navn og verdi |
| | Pivoter til bredt format | Verdiene i en navnekolonne blir nye kolonner |
| | SQL-setning | Vilkårlig UPDATE, DELETE eller ALTER TABLE mot tabellen `data` |
| Nye datasett | Grupper og aggreger | Sum, gjennomsnitt, minste, største, antall, antall unike eller median per gruppe, til et nytt datasett |
| | Koble datasett | Venstre- eller indre kobling med et annet datasett på en nøkkel |
| | Slå sammen datasett | Stabler rader fra flere datasett; kolonner matches på navn |
| | Rens kategorier | Finner stavevarianter av samme verdi (store/små bokstaver, mellomrom, aksenter) og slår dem sammen |

Handlinger som lager et nytt datasett, lar originalen være urørt og velger det nye datasettet når det er ferdig.

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

Knappen **Regler** åpner datasettets kvalitetsregler: hva som skal gjelde for at dataene skal være riktige. Det finnes sju
regeltyper: må ikke mangle, unik (én eller flere kolonner sammen), innenfor intervall (tall, datoer eller tekst), i liste,
matcher mønster (regulært uttrykk), tekstlengde og en fri SQL-betingelse som skal være sann for hver rad. **Foreslå regler**
legger til regler fra datakvalitetsprofilen: kolonner uten manglende verdier, unike kolonner og koder med fast lengde.

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
  `dm_upper`, `dm_lower`, `dm_title`, `dm_squish`.
- SQL-skript lagres i objektpanelet på samme måte som R-skript.

SQLite-dialekten gjelder: `||` for tekstsammenslåing, `cast(x as integer)`, `strftime()` for datoer, `group_concat()`,
vindusfunksjoner som `row_number() over (partition by …)`.

## Begrensninger

- Angre gjelder innenfor sesjonen; bruk versjoner for å gå tilbake etter at siden er lastet på nytt.
- Handlinger som bygger om en kolonne (Endre type, Del opp kolonne, pivotering), eksporterer datasettet for angre først. På
  datasett over noen hundre MB tar det merkbar tid.
- Oppskriftenes R-eksport dekker de innebygde handlingene; fri SQL eksporteres som kommentar, fordi den ikke kan oversettes
  til R automatisk.
