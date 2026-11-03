# Bearbejd og SQL-konsollen

Tilstanden Bearbejd er alt, hvad man gør med tabellen via knapper og dialoger: rette celler, rense tekst, ændre typer,
beregne nye kolonner, pivotere, sammenkoble datasæt. Hver handling logges som et trin i datasættets recept, kan fortrydes
og kan afspilles igen på et andet datasæt. SQL-konsollen i tilstanden Analysér arbejder mod samme datasæt og logger
ændringer på samme måde.

## Tabellen

- Dobbeltklik på en celle, eller markér en række, og tryk Enter eller F2 for at redigere. Enter gemmer, Esc afbryder, Tab
  går videre til næste celle. Værdien fortolkes efter kolonnens type: skriver du tekst i en talkolonne, får du en
  fejlmeddelelse, og cellen beholder sin værdi. Tom tekst bliver en manglende værdi.
- Piletasterne flytter markeringen, Page Up/Page Down bladrer, Home/End springer til første eller sidste række.
- Klik på en kolonneoverskrift for at sortere (stigende, faldende, usorteret). Egenskabspanelet til højre viser så
  kolonnestatistik (antal, manglende, unikke, mindste, største, gennemsnit, sum, hyppigste værdier) og de handlinger, der
  passer til kolonnens type. Skift-klik viser statistikken uden at ændre sorteringen.
- Filterfeltet søger i alle kolonner. Redigering fungerer også i et filtreret udvalg.
- Tabellen er virtualiseret: kun de synlige rækker findes i browserens DOM, resten ligger i SQLite. En million rækker
  gennemses lige så hurtigt som hundrede.

## Handlinger

Knappen **Handlinger** åbner paletten. Hver handling har en dialog med felter, der dannes ud fra handlingens parametre,
og hvor det er muligt, vises en forhåndsvisning af, hvor mange rækker der påvirkes, og eksempler før og efter.

| Gruppe | Handling | Hvad den gør |
|---|---|---|
| Kolonner | Omdøb kolonne | Nyt kolonnenavn; etiketten følger med, hvis den var lig med navnet |
| | Etiket, beskrivelse og enhed | Etiketten er visningsnavnet i tabeloverskrifter og diagrammer; beskrivelse og enhed vises i inspektøren og kodebogen, følger med SQLite-filen og når R som attributterne `description` og `unit` |
| | Slet kolonner | Fjerner valgte kolonner |
| | Ændr kolonnernes rækkefølge | Flyt kolonner op og ned |
| | Skift type | Tekst til heltal, decimaltal, dato, dato og tid eller ja/nej. Decimaltegn og datoformat kan angives; værdier, der ikke kan fortolkes, bliver tomme, og antallet rapporteres |
| Værdier | Søg og erstat | Tekst eller regulært udtryk i valgte tekstkolonner, med forhåndsvisning |
| | Fjern mellemrum | Indledende, afsluttende og (valgfrit) dobbelte mellemrum |
| | Skift store og små bogstaver | STORE BOGSTAVER, små bogstaver eller Stort Begyndelsesbogstav |
| | Reparér tegnkodning | Retter mojibake (Ã¸ bliver til ø), der er opstået ved import med forkert tegnkodning |
| | Erstat værdi | Én nøjagtig værdi med en anden; en tom værdi kan vælges som fra eller til |
| | Udfyld manglende værdier | Konstant værdi eller forrige rækkes værdi |
| Rækker | Slet rækker | SQL-betingelse, for eksempel `befolkning < 1000`; vælg Behold for i stedet kun at beholde de rækker, der matcher |
| | Fjern dubletter | På valgte kolonner eller hele rækken; første forekomst beholdes |
| Struktur | Ny beregnet kolonne | SQL-udtryk, for eksempel `round(befolkning / 1000.0, 1)` eller `case when andel > 5 then 'stor' else 'liten' end` |
| | Kombinér kolonner | Flere kolonner til én tekstkolonne med skilletegn |
| | Opdel kolonne | Én tekstkolonne til flere ved et skilletegn |
| | Pivotér til langt format | Valgte kolonner bliver rækker med navn og værdi |
| | Pivotér til bredt format | Værdierne i en navnekolonne bliver nye kolonner |
| | SQL-sætning | Vilkårlig UPDATE, DELETE eller ALTER TABLE mod tabellen `data` |
| Nye datasæt | Gruppér og aggregér | Sum, gennemsnit, mindste, største, antal, antal unikke eller median pr. gruppe, til et nyt datasæt |
| | Sammenkobl datasæt | Venstre eller indre sammenkobling med et andet datasæt på en nøgle |
| | Sammenlæg datasæt | Stabler rækker fra flere datasæt; kolonner matches på navn |
| | Rens kategorier | Finder stavevarianter af samme værdi (store/små bogstaver, mellemrum, accenter) og slår dem sammen |

Handlinger, der opretter et nyt datasæt, lader originalen være urørt og vælger det nye datasæt, når det er færdigt.

## Fortryd

Knappen **Fortryd** tager det seneste trin tilbage, op til ti trin tilbage i samme session. Celleredigeringer fortrydes ved
at skrive den gamle værdi tilbage; øvrige handlinger ved at gendanne et øjebliksbillede af datasættet. For meget store
datasæt tager øjebliksbilledet et stykke tid, og højst 80 MB øjebliksbilleder holdes i hukommelsen. Fortryd efter
genindlæsning af siden gør du med versioner.

## Datakvalitet

Knappen **Datakvalitet** profilerer datasættet: antal rækker og dubletter og pr. kolonne manglende værdier, unikke
værdier, interval og bemærkninger. Bemærkningerne peger på en handling, der retter dem med ét klik:

- mellemrum i begyndelsen eller slutningen, dobbelte mellemrum: Fjern mellemrum
- tomme tekster, der ikke er manglende værdier: Erstat værdi (tom til manglende)
- tal eller datoer gemt som tekst: Skift type
- sandsynlig kodningsskade: Reparér tegnkodning
- værdier, der kun adskiller sig i store og små bogstaver: Skift store og små bogstaver
- værdier, der ligner personnumre: Pseudonymisér
- kolonne med samme værdi i alle rækker (oplysning)

## Regler

Knappen **Regler** åbner datasættets kvalitetsregler: hvad der skal gælde, for at data er korrekte. Der findes syv
regeltyper: må ikke mangle, unik (en eller flere kolonner sammen), inden for interval (tal, datoer eller tekst), i liste,
matcher mønster (regulært udtryk), tekstlængde og en fri SQL-betingelse, der skal være sand for hver række. **Foreslå
regler** tilføjer regler fra datakvalitetsprofilen: kolonner uden manglende værdier, unikke kolonner og koder med fast
længde.

**Kør regler** tæller de rækker, der bryder hver regel, viser andelen og nogle eksempler og logger kørslen i datasættets
historik. For en brudt regel kan de fejlende rækker gemmes som et selvstændigt datasæt, og hele resultatet kan downloades
som en HTML-rapport. Reglerne gemmes i datasættets metadata og følger derfor med i backup, pakker og den portable mappe.

## Pseudonymisér

Handlingen **Pseudonymisér** (gruppen Værdier, også i kolonnemenuen og kommandopaletten) erstatter identifikatorer som
personnumre eller kundenumre før deling. Tre metoder:

- **Hash**: SHA-256 af et salt og værdien, forkortet til valgfri længde (standard 16 tegn). Samme værdi giver samme
  hashværdi, så sammenkoblinger mellem tabeller overlever, hvis samme salt bruges. Saltet er en hemmelig tekst, du vælger;
  den gemmes aldrig i loggen eller recepten (der står `***`), og en recept med et sådant trin kan ikke afspilles, uden at
  saltet angives igen.
- **Maskér tegn**: beholder et valgfrit antal tegn i begyndelsen og slutningen samt skilletegn og erstatter resten med `*`
  (`19800101-1234` bliver til `198001**-****` med seks tegn i begyndelsen).
- **Løbenummer**: hver unik værdi får et løbenummer med præfiks i sorteret rækkefølge (`P0001`, `P0002`).

Hashing med salt er pseudonymisering, ikke anonymisering: den, der kender saltet, kan afprøve kandidater, og kombinationer
af andre kolonner kan stadig udpege personer. Fjern eller grovinddel øvrige følsomme kolonner, og del aldrig saltet sammen
med data. Receptens SQL-eksport bruger Dataspatiums funktioner `dm_hash` og `dm_mask`; R-eksporten bruger pakken digest til
hashværdier.

## Geodata

Handlingsgruppen *Geodata* arbejder med geometrikolonner (GeoJSON eller WKT som tekst, i længde/bredde eller SWEREF 99 TM)
og koordinatkolonner:

- **Centroide fra geometri** tilføjer længde- og breddegrad (WGS 84) for midtpunktet af hvert område eller hver linje,
  for eksempel for at tegne kommuner som bobler i et punktkort.
- **Areal fra geometri** tilføjer arealet i kvadratkilometer (plant for SWEREF 99 TM, på kloden for længde/bredde; huller
  trækkes fra).
- **Omprojicér koordinater** omregner to kolonner mellem SWEREF 99 TM (øst, nord) og WGS 84 (længde, bredde) til nye
  kolonner med Lantmäteriets formler.
- **Kommune og län fra koordinater** slår op, hvilken svensk kommune og hvilket län hvert punkt ligger i, med SCB's
  medfølgende grænser og tilføjer `kommunkod`, `kommun`, `lanskod` og `lan` (eller kun län). Koordinater i SWEREF 99 TM
  genkendes. Grænserne er SCB's forenklede landgrænser til tematiske kort: punkter i søer, havet eller uden for Sverige
  bliver tomme, og punkter meget tæt på en grænse kan havne i nabokommunen.

Alle fire er trin i recepten, der kan fortrydes og afspilles igen. I SQL-eksporten vises de som kald til Dataspatiums
funktioner (`dm_geo_lon`, `dm_geo_area`, `dm_to_lon`, `dm_region` med flere); R-eksporten giver tilsvarende kode med pakken
sf.

## Versioner

Knappen **Versioner** (findes også i Håndter) gemmer et øjebliksbillede af datasættet med en beskrivelse. En version kan
sammenlignes med den nuværende tilstand (antal rækker, tilføjede, fjernede og omtypede kolonner), gendannes eller slettes.
Versioner gemmes i browserens database og følger med i backuppen af arbejdsområdet. Gem en version før større ændringer.

## Recept

Knappen **Recept** viser alle trin, der er udført på datasættet, i rækkefølge. Herfra kan du:

- kopiere recepten som R-kode (`dm_read()` med kortnavnet, dplyr/tidyr/stringr-kald, `dm_write()`) eller som SQL mod
  tabellen `data`,
- downloade recepten som JSON for at dele den med andre,
- køre de samme trin på et andet datasæt i arbejdsområdet,
- køre en recept fra en JSON-fil på det valgte datasæt.

Afspilningen stopper ved det første trin, der mislykkes (for eksempel en kolonne, der ikke findes), og fortæller, hvor mange
trin der blev udført. Receptfilen har formen

```json
{ "app": "Dataspatium", "kind": "recipe", "version": "0.3.0", "name": "Rensning af kommuner",
  "steps": [ { "op": "trim", "params": { "columns": ["kommun"], "squish": true }, "description": "Fjern mellemrum i kommun" } ] }
```

## SQL-konsollen

Hvert datasæt har et **kortnavn** (vises under navnet i objektpanelet og under Håndter, hvor det kan ændres sammen med
navnet): små bogstaver a–z, cifre og understregning, højst 20 tegn og helst højst 15, aldrig et reserveret ord i SQL eller R.
Forslaget dannes af navnet uden småord og med årstal som endelse: *Befolkning pr. kommune 2024* bliver til
`befolkning_2024`. Kortnavnene på de medfølgende eksempeldata er faste (`befolkning_2024`, `kommungranser`, `lansgranser`)
på alle sprog. I SQL-konsollen hedder det valgte datasæt `data`, men nås også med sit kortnavn, og andre datasæt nås med
deres kortnavne, så én forespørgsel kan sammenkoble flere datasæt:

```sql
select k.kommun, k.lan, b.folkmangd
from befolkning_2024 b
join kommungranser k on k.kommunkod = b.kommunkod
order by b.folkmangd desc
```

Andre datasæt er skrivebeskyttede i forespørgslen; UPDATE, DELETE og ALTER gælder det valgte datasæt, men må læse de andre
(for eksempel `update data set lan = (select lan from kommungranser k where k.kommunkod = data.kommunkod)`). Højst ni andre
datasæt kan indgå i samme forespørgsel. Resultatet kan gemmes som et nyt datasæt. Kortnavnene fungerer også i R
(`dm_read("kortnavn")`; knappen *Indsæt dm_read()*, R-eksemplerne, nye notesbøger og recepternes R-eksport bruger
kortnavnet) og bruges, når diagrammer og notesbøger kobles til datasæt ved import.

SQL-konsollen ligger i tilstanden Analysér under fanen SQL og arbejder mod det valgte datasæt, hvis tabel hedder `data`.
Ctrl+Enter kører hele scriptet, markeret tekst køres alene.

- `SELECT`, `WITH`, `VALUES`, `PRAGMA` og `EXPLAIN` viser resultatet i en tabel (de første 5 000 rækker). **Gem resultatet
  som datasæt** opretter et nyt datasæt af hele resultatet uden rækkegrænse.
- `UPDATE`, `DELETE`, `ALTER TABLE` og andre sætninger ændrer datasættet, logges som receptens trin SQL-sætning og kan
  fortrydes i Bearbejd.
- Egenskabspanelet viser datasættets kolonner (et klik indsætter navnet), alle datasæts kortnavne og de ekstra
  SQL-funktioner, Dataspatium tilføjer: `regexp`, `regexp_replace`, `dm_parse_number`, `dm_parse_date`, `dm_fix_encoding`,
  `dm_upper`, `dm_lower`, `dm_title`, `dm_squish`.
- SQL-scripts gemmes i objektpanelet på samme måde som R-scripts.

SQLite-dialekten gælder: `||` til tekstsammenkædning, `cast(x as integer)`, `strftime()` til datoer, `group_concat()`,
vinduesfunktioner som `row_number() over (partition by …)`.

## Begrænsninger

- Fortryd gælder inden for sessionen; brug versioner for at gå tilbage efter genindlæsning.
- Handlinger, der genopbygger en kolonne (Skift type, Opdel kolonne, pivotering), eksporterer datasættet til fortryd først.
  På datasæt over nogle hundrede MB tager det mærkbar tid.
- Recepternes R-eksport dækker de indbyggede handlinger; fri SQL eksporteres som kommentar, da den ikke kan oversættes til
  R automatisk.
