# Regulære udtryk (Regex)

Et regulært udtryk er et mønster, der beskriver tekst: `^\d{4}$` beskriver et dansk postnummer, `\(([^)]*)\)` en
tekst i parentes. I Dataspatium bruges mønstrene til at analysere, rette og opdele værdier i datasæt. Fanen
**Regex** i tilstanden Analysér er stedet, hvor man afprøver mønstre på en kolonne og ser resultatet med det samme.
De samme mønstre virker også i Bearbejd (handlingsgruppen *Regulære udtryk*, *Søg og erstat*), i kvalitetsreglen
*Matcher mønster* og i SQL-konsollen.

## Hvilken standard?

Dataspatium bruger JavaScripts regulære udtryk efter standarden ECMAScript (ECMA-262) med Unicode-flaget slået til.
Begrundelsen:

- De er indbygget i browseren, så der kræves intet ekstra bibliotek, og alt virker fra `file://`.
- Den samme motor bruges overalt i appen: i Regex-fanen, i SQL-funktionerne i SQLite-motoren, i reglerne og i Søg
  og erstat. Et mønster, der virker ét sted, virker alle steder.
- De har det, data kræver: navngivne grupper `(?<navn>…)`, se frem og tilbage (`(?=…)`, `(?<=…)`), Unicode-klasser
  som `\p{L}` (alle bogstaver, også æ, ø, å, ä, ö, þ og ð) og flag for store og små bogstaver.
- Syntaksen er veldokumenteret (for eksempel på MDN) og ligger meget tæt på den, som R-pakken stringr (ICU) og
  PCRE bruger, så mønstre kan flyttes mellem Dataspatium, R og de fleste andre værktøjer.

Andre standarder, der blev sammenlignet: POSIX ERE (R's standardmotor TRE) mangler se frem og tilbage og
Unicode-klasser. PCRE (R med `perl = TRUE`) og ICU (stringr) er nære slægtninge til JavaScript. RE2 garanterer, at
et mønster aldrig kan hænge, men findes ikke i browseren og mangler tilbagereferencer og se frem og tilbage.
Risikoen ved JavaScript, at visse mønstre kan tage meget lang tid, håndteres i stedet med en tidsgrænse (se
*Sikkerhed og ydeevne*).

Dataspatiums regler ud over standarden:

- Unicode-flaget tilføjes, når mønsteret tillader det. Et ældre mønster, der kun er gyldigt uden det, for eksempel
  `a\-b`, virker stadig, men så uden `\p{…}`.
- `(?i)`, `(?s)` og `(?m)` først i mønsteret bliver til flag, som i R, Python og PCRE. `(?i)næstved` matcher NÆSTVED.
- `\w`, `\d` og `\b` gælder kun a–z, A–Z, 0–9 og understreg. Brug `\p{L}` for bogstaver og `(?<!\p{L})` og
  `(?!\p{L})` som ordgrænse i tekst med æ, ø og å.

## Fanen Regex

Fanen ligger i Analysér ved siden af R, SQL og Notesbog og har samme layout som resten af appen:

- **Venstre**: datasættene, dine gemte mønstre og mønsterbiblioteket.
- **Midten**: kolonne, mønster, flag og hvad der skal gøres, med en forhåndsvisning.
- **Højre**: syntaksen i korte træk og det samme som SQL- og R-kode, der kan åbnes i SQL- eller R-fanen.

Sådan gør du:

1. Vælg et datasæt i listen til venstre og en kolonne i feltet **Kolonne**.
2. Skriv et mønster i feltet **Mønster**, eller klik på et mønster i biblioteket. Forhåndsvisningen viser
   kolonnens hyppigste værdier (op til 500 forskellige) med træfferne markeret, og linjen under feltet fortæller,
   hvor mange rækker der matcher.
3. Vælg efter behov **Ignorér store og små bogstaver**, **Hele værdien skal matche** (mønsteret omgives af `^(?:`
   og `)$`) og **Punktum matcher linjeskift**.
4. Vælg, hvad der skal gøres, under **Gør sådan**, og tryk **Anvend**.

| Gør sådan | Hvad der sker |
|---|---|
| Test og vis træffere | Viser træfferne, antallet pr. værdi og om ønsket kun værdier med eller uden træf. Intet ændres |
| Mønsterprofil | Viser værdiernes former: `A` er et stort bogstav, `a` et andet bogstav og `9` et ciffer, så `114 55` har formen `999 99`. *Forenkl gentagelser* skriver en række som `9+`. **Brug** laver et mønster af formen. Intet ændres |
| Filtrér rækker | Beholder de rækker, der matcher, eller fjerner dem |
| Udtræk til nye kolonner | En ny kolonne pr. gruppe i mønsteret, eller én kolonne med hele træffet, hvis mønsteret ikke har grupper. Navngivne grupper giver kolonnenavnene; andre navne kan angives. *Alle træffere* samler alle træffere med et skilletegn |
| Erstat | Erstatter træfferne i tekstkolonner. `$1`, `$2` og `$<navn>` indsætter en gruppe, `$&` hele træffet |
| Opdel i kolonner | Opdeler værdien, hvor mønsteret matcher, i et valgt antal kolonner; den sidste får resten af teksten |
| Markér træffere i ny kolonne | En ja/nej-kolonne, der viser, om værdien matcher |
| Tæl træffere i ny kolonne | En kolonne med antallet af træffere i hver værdi |
| Opret kvalitetsregel | Tilføjer reglen *Matcher mønster* for kolonnen; den køres under Regler i Bearbejd |

Det, der ændrer datasættet, bliver et opskriftstrin ligesom handlingerne i Bearbejd: det kan fortrydes der, afspilles
på et andet datasæt og eksporteres som SQL (med Dataspatiums funktioner `dm_regex_*`) og som R-kode (med pakken
stringr). De samme trin findes i Bearbejd under **Handlinger** i gruppen *Regulære udtryk*.

Værdier, der ikke er tekst, for eksempel tal og datoer, afprøves i deres tekstform (`2.5`, `2024-01-31`).

## Mønsterbiblioteket

Biblioteket har færdige mønstre i tre grupper. *Sverige*: personnummer, organisationsnummer, postnummer,
kommunekode, telefonnummer og registreringsnummer for bil. *Norden*: CPR-nummer, norsk fødselsnummer, finsk
henkilötunnus, islandsk kennitala og nordiske postnumre. *Generelt*: e-mailadresse, webadresse i tekst, datoer som
ÅÅÅÅ-MM-DD og D.M.ÅÅÅÅ, klokkeslæt, årstal i tekst, tal med decimalkomma, beløb i kroner, tekst i parentes, ord,
overflødige mellemrum og hashtags.

Biblioteksmønstrene kontrollerer formen, ikke om et nummer er gyldigt. Kontrolcifre og datoer i identitetsnumre
kontrolleres af reglen *Gyldigt identitetsnummer* i Bearbejd.

## Gemte mønstre

**Gem mønster** gemmer mønsteret og flagene under et navn. Gemte mønstre vises til venstre og følger, ligesom R- og
SQL-scripts, med i backup, i pakker (når *Gemte scripts og mønstre* er valgt) og i den portable mappe som filer
`scripts/<id>.script.json`.

## Syntaks i korte træk

| Mønster | Betyder | Eksempel |
|---|---|---|
| `.` | et vilkårligt tegn | `a.c` matcher abc og a-c |
| `\d` | ciffer 0–9 | `\d{4}` matcher 2024 |
| `\p{L}`, `\p{Lu}`, `\p{Ll}` | bogstav, stort, lille | `\p{Lu}\p{Ll}+` matcher Næstved |
| `\s` | mellemrum, tabulator eller linjeskift | `\s{2,}` matcher dobbelte mellemrum |
| `[abc]`, `[^abc]`, `[a-z]` | et af tegnene, ingen af dem, et interval | `[.,]` matcher punktum eller komma |
| `a\|b` | a eller b | `kr\|DKK` |
| `*`, `+`, `?` | nul eller flere, en eller flere, nul eller en | `\d+` |
| `{n}`, `{n,m}`, `{n,}` | præcis n, n til m, mindst n gange | `\d{3,4}` |
| `^`, `$` | begyndelsen og slutningen af værdien | `^\d+$` er kun cifre |
| `(…)` | gruppe, bruges som `$1` | `(\d{2})(\d{2})` |
| `(?<navn>…)` | navngiven gruppe, bruges som `$<navn>` | `(?<aar>\d{4})` |
| `(?:…)` | gruppe, der ikke fanges | `(?:kr\|DKK)` |
| `(?=…)`, `(?!…)` | efterfølges af, efterfølges ikke af | `\d+(?= kr)` |
| `(?<=…)`, `(?<!…)` | forudgås af, forudgås ikke af | `(?<=nr\. )\d+` |
| `\` | gør et specialtegn almindeligt | `\.` er et punktum, `\(` en parentes |

## Eksempler

| Opgave | Mønster | Gør sådan |
|---|---|---|
| Årstal fra en tekst som *Folketal 2024* | `(?<aar>(?:19\|20)\d{2})` | Udtræk; ny kolonne `aar` |
| Kode i parentes, *Region Hovedstaden (84)* | `\((\d{2})\)` | Udtræk; angiv navnet `kode` |
| Svensk postnummer med mellemrum | `^(\d{3}) ?(\d{2})$` | Erstat med `$1 $2` |
| Efternavn og fornavn fra *Berg, Anna* | `, ?` | Opdel i 2 kolonner |
| Rækker med en e-mailadresse i fritekst | `[^\s@]+@[^\s@]+\.[^\s@]+` | Markér træffere eller Filtrér rækker |
| Blandede datoformater | (intet) | Mønsterprofil viser for eksempel `9999-99-99` og `99/99/9999`; ret derefter med Skift type i Bearbejd |
| Telefonnumre med kun cifre | `[^\d+]` | Erstat med intet (eller handlingen Fjern tegn) |

## I SQL og R

SQL-konsollen har de samme mønstre gennem Dataspatiums funktioner:

| Funktion | Giver |
|---|---|
| `x regexp 'mønster'`, `regexp('mønster', x)` | 1 hvis x matcher, ellers 0 |
| `regexp_replace(x, 'mønster', 'erstatning', 'gi')` | x med træfferne erstattet (`g` alle, `i` uden hensyn til store og små bogstaver) |
| `dm_regex_test(x, 'mønster', 'i')` | 1, 0 eller tomt for en tom værdi |
| `dm_regex_extract(x, 'mønster', gruppe, '')` | gruppen (nummer eller navn, 0 for hele træffet) i første træf |
| `dm_regex_all(x, 'mønster', gruppe, ', ', '')` | gruppen i alle træffere med skilletegn |
| `dm_regex_count(x, 'mønster', '')` | antallet af træffere |
| `dm_regex_split(x, 'mønster', del, antal, '')` | del nummer `del` af `antal`, når x opdeles ved mønsteret |
| `dm_shape(x, 0)` | formen i mønsterprofilen (1 forenkler gentagelser) |

```sql
select kommune, dm_regex_extract(navn, '\((\d{2})\)', 1, '') as kode
from data
where dm_regex_test(postnr, '^\d{4}$', '') = 0
```

I R bruges pakken stringr, hvis syntaks (ICU) er næsten den samme: `stringr::str_detect(df$postnr,
stringr::regex("^\\d{4}$"))`. Forskellene, man skal kende: i R skrives hver `\` dobbelt inde i en streng, en
gruppe i en erstatning skrives `\\1` i stedet for `$1` (opskriftseksporten gør det for dig), og se tilbage skal have
en begrænset længde. `\d` matcher alle Unicode-cifre i ICU, men kun 0–9 i JavaScript.

## Sikkerhed og ydeevne

Visse mønstre kan tage ekstremt lang tid på visse værdier, for eksempel `(a+)+$` på en lang række a efterfulgt af
et andet tegn (*katastrofal backtracking*). Derfor afprøves mønstrene i en separat baggrundstråd med en tidsgrænse
på to sekunder. Når tiden løber ud, stoppes tråden, der vises en meddelelse, og intet ændres. Før et trin ændrer et
datasæt, afprøves mønsteret på samme måde på alle kolonnens værdier. Gør i så fald mønsteret enklere: undgå
indlejrede gentagelser som `(a+)+` og `(\w*)*`, og vær så specifik som muligt, for eksempel `[^,]*` i stedet for
`.*`.

Forhåndsvisningen viser de 500 hyppigste forskellige værdier. Antallet af træffere tælles præcist, når kolonnen har
højst 20.000 forskellige værdier, ellers på de 20.000 hyppigste, hvilket så står under mønsterfeltet.

## Begrænsninger

- Erstat virker på tekstkolonner; skift først typen til tekst for andre kolonner.
- En opskrift, der afspilles på et andet datasæt, afprøver mønsteret på det datasæts værdier, før den køres.
- R-eksporten bruger stringr. Usædvanlig syntaks, som se tilbage med ubegrænset længde, kan give et andet
  resultat i R.
