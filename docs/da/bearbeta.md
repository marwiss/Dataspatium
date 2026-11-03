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
| | Kopiér kolonne | En kopi med et nyt navn, for eksempel før originalen ændres |
| | Ryd op i kolonnenavne | Alle navne bliver små bogstaver, cifre og understreger (`Folkmängd 2024` bliver `folkmangd_2024`), som er nemme at skrive i SQL og R; etiketterne beholder de oprindelige navne |
| Værdier | Søg og erstat | Tekst eller regulært udtryk i valgte tekstkolonner, med forhåndsvisning |
| | Fjern mellemrum | Indledende, afsluttende og (valgfrit) dobbelte mellemrum |
| | Skift store og små bogstaver | STORE BOGSTAVER, små bogstaver eller Stort Begyndelsesbogstav |
| | Reparér tegnkodning | Retter mojibake (Ã¸ bliver til ø), der er opstået ved import med forkert tegnkodning |
| | Erstat værdi | Én nøjagtig værdi med en anden; en tom værdi kan vælges som fra eller til |
| | Omkod værdier | Flere værdier på én gang efter en liste med én linje pr. værdi, `gammel = ny` (for eksempel `01 = Stockholms län`); øvrige værdier beholdes eller tømmes |
| | Udfyld manglende værdier | Konstant værdi, forrige eller næste rækkes værdi, gennemsnit, median eller hyppigste værdi |
| | Afrund tal | Til valgt antal decimaler: til nærmeste (en halv afrundes væk fra nul), nedad, opad eller ved at stryge decimalerne; et negativt antal afrunder til tiere (−1), hundreder (−2) og så videre |
| | Udfyld med foranstillede nuller | Til en bestemt længde, for eksempel kommunekoden 114 til 0114; tal bliver tekst, så nullerne bevares |
| | Fjern tegn | Behold kun cifre (telefon- og CVR-numre), behold kun bogstaver og mellemrum, fjern tegnsætning og symboler, eller fjern alle mellemrum |
| Rækker | Slet rækker | SQL-betingelse, for eksempel `befolkning < 1000`; vælg Behold for i stedet kun at beholde de rækker, der matcher |
| | Fjern dubletter | På valgte kolonner eller hele rækken; første forekomst beholdes |
| | Fjern tomme rækker og kolonner | Rækker, hvor alle værdier mangler, og om ønsket kolonner helt uden værdier |
| | Sortér rækker | Ændrer rækkernes rækkefølge permanent, stigende eller faldende på én kolonne, så eksporter og dokumenter får samme rækkefølge; tomme værdier kommer sidst |
| | Behold de øverste rækker | De rækker, der har størst eller mindst værdi, i alt eller pr. gruppe (for eksempel de tre største kommuner i hver region) |
| | Tilfældig stikprøve | Et antal rækker eller en andel i procent; samme frø giver altid samme stikprøve, så opskriften kan afspilles igen |
| Struktur | Ny beregnet kolonne | SQL-udtryk, for eksempel `round(befolkning / 1000.0, 1)` eller `case when andel > 5 then 'stor' else 'liten' end` |
| | Kombinér kolonner | Flere kolonner til én tekstkolonne med skilletegn |
| | Opdel kolonne | Én tekstkolonne til flere ved et skilletegn |
| | Udtræk del af tekst | En ny kolonne med et antal tegn regnet fra begyndelsen eller slutningen af teksten, fra en valgt position (lænskoden er de to første tegn i den svenske kommunekode) |
| | Pivotér til langt format | Valgte kolonner bliver rækker med navn og værdi |
| | Pivotér til bredt format | Værdierne i en navnekolonne bliver nye kolonner |
| | SQL-sætning | Vilkårlig UPDATE, DELETE eller ALTER TABLE mod tabellen `data` |
| Beregninger | Andel af summen | Hver værdis andel af summen i procent eller som brøk, i alt eller pr. gruppe (kommunens andel af regionens befolkning) |
| | Rangordn | Plads i rækkefølgen, størst eller mindst først, i alt eller pr. gruppe; lige værdier får samme plads (med eller uden hul bagefter) eller fortløbende plads |
| | Løbende sum | Den akkumulerede sum i den rækkefølge, en anden kolonne angiver, i alt eller pr. gruppe |
| | Ændring i forhold til forrige | Forskellen eller den procentvise ændring i forhold til forrige række i den rækkefølge, en anden kolonne angiver, for eksempel i forhold til året før pr. kommune |
| | Inddel i klasser | Tal i klasser med egne nedre grænser (`0, 18, 65` giver `0–17`, `18–64` og `65–`), et antal lige brede klasser eller grupper med lige mange rækker (kvantiler) |
| | Standardisér | z-værdier (afstanden fra gennemsnittet i standardafvigelser, stikprøvens standardafvigelse) eller værdierne skaleret til 0–1 |
| | Udtræk datodel | År, kvartal, måned, ISO-uge, ugedag (1 = mandag), dag, dag i året, år og måned (`2024-03`) eller time fra en dato |
| | Tid mellem datoer | Antal hele dage, uger, måneder eller år mellem to datoer, for eksempel alder; uden slutdato regnes til dags dato, når trinnet køres |
| Nye datasæt | Gruppér og aggregér | Sum, gennemsnit, mindste, største, antal, antal unikke eller median pr. gruppe, til et nyt datasæt |
| | Sammenkobl datasæt | Venstre eller indre sammenkobling med et andet datasæt på en nøgle |
| | Sammenlæg datasæt | Stabler rækker fra flere datasæt; kolonner matches på navn |
| | Rens kategorier | Finder stavevarianter af samme værdi (store/små bogstaver, mellemrum, accenter) og slår dem sammen |

Handlinger, der opretter et nyt datasæt, lader originalen være urørt og vælger det nye datasæt, når det er færdigt.
Beregningerne tilføjer en ny kolonne og lader de eksisterende være urørte; de bygger på SQL's vinduesfunktioner og
eksporteres til R som dplyr-kode med `group_by()` og `mutate()`.

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

Knappen **Regler** åbner datasættets kvalitetsregler: hvad der skal gælde, for at data er korrekte. Regeltyperne er:

| Regeltype | Brydes af |
|---|---|
| Må ikke mangle | Manglende værdier |
| Unik | Værdier (eller kombinationer af flere kolonner), der forekommer mere end én gang |
| Inden for interval | Tal, datoer eller tekst uden for grænserne |
| I liste | Værdier, der ikke står i listen |
| Har ikke forbudte værdier | Værdier, der står i listen, for eksempel `ukendt` eller `-99` |
| Matcher mønster | Tekst, der ikke matcher det regulære udtryk |
| Har et bestemt format | Tekst, der ikke er en e-mailadresse, en webadresse, en ISO-dato, et postnummer (svensk, dansk, norsk, finsk eller islandsk) eller en svensk kommune- eller lænskode |
| Tekstlængde | Tekst, der er kortere eller længere end grænserne |
| Ingen overflødige mellemrum | Tekst med mellemrum i begyndelsen eller slutningen eller dobbelte mellemrum |
| Kan læses som type | Tekst, der ikke kan læses som heltal, decimaltal, dato, dato og tid eller ja/nej |
| Gyldigt identitetsnummer | Numre med forkert form, ugyldig dato eller forkert kontrolciffer, se nedenfor |
| Sammenlign to kolonner | Rækker, hvor betingelsen mellem to kolonner ikke gælder, for eksempel at startdatoen er mindre end eller lig med slutdatoen |
| Findes i andet datasæt | Værdier, der mangler i en kolonne i et andet datasæt (referentiel integritet, som en fremmednøgle) |
| Andel udfyldte værdier | Kolonnen som helhed, når andelen af udfyldte værdier er lavere end tærsklen (for eksempel 95 %) |
| Ingen afvigende værdier | Tal længere fra kvartilerne end et valgt antal kvartilafstande (standard 1,5) eller længere fra gennemsnittet end et valgt antal standardafvigelser (standard 3) |
| SQL-betingelse | Rækker, hvor den frie SQL-betingelse ikke er sand |

Identitetsnumrene kontrolleres sådan: svensk personnummer og samordningsnummer (10 eller 12 cifre, gyldig dato, dag
plus 60 for samordningsnumre, kontrolciffer efter Luhn), svensk organisationsnummer (tredje ciffer mindst 2, Luhn),
norsk fødselsnummer og D-nummer (begge kontrolcifre efter modulus 11), dansk CPR-nummer (gyldig dato; modulus 11
kontrolleres ikke, fordi den ikke har gældt alle numre siden 2007), finsk personbeteckning (århundredemarkør og
kontroltegn) og islandsk kennitala (kontrolciffer efter modulus 11, gyldig dato, århundredeciffer). Kontrollen siger
kun, at nummeret kan findes, ikke at det tilhører nogen.

**Foreslå regler** tilføjer regler fra datakvalitetsprofilen: kolonner uden manglende værdier, unikke kolonner og
koder med fast længde. Kolonner, hvis navne indeholder personnummer, organisationsnummer, CPR, fødselsnummer,
henkilötunnus eller kennitala, får en regel for den slags identitetsnummer, som mindst halvdelen af værdierne
består, kolonner med postnummer i navnet en regel for det postnummerformat, flest værdier følger, og kolonner med
e-mail (eller e-post) i navnet en regel for e-mailadresser.

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
  `dm_upper`, `dm_lower`, `dm_title`, `dm_squish`, `dm_round`, `dm_pad`, `dm_date_part`, `dm_date_diff` og
  `dm_valid_id` (for eksempel `select * from data where dm_valid_id(cpr, 'dk_cpr') = 0`).
- SQL-scripts gemmes i objektpanelet på samme måde som R-scripts.

SQLite-dialekten gælder: `||` til tekstsammenkædning, `cast(x as integer)`, `strftime()` til datoer, `group_concat()`,
vinduesfunktioner som `row_number() over (partition by …)`.

## Begrænsninger

- Fortryd gælder inden for sessionen; brug versioner for at gå tilbage efter genindlæsning.
- Handlinger, der genopbygger en kolonne (Skift type, Opdel kolonne, pivotering), eksporterer datasættet til fortryd først.
  På datasæt over nogle hundrede MB tager det mærkbar tid.
- Recepternes R-eksport dækker de indbyggede handlinger; fri SQL eksporteres som kommentar, da den ikke kan oversættes til
  R automatisk.
