# Reguljära uttryck (Regex)

Ett reguljärt uttryck är ett mönster som beskriver text: `^\d{3} ?\d{2}$` beskriver ett svenskt postnummer,
`\(([^)]*)\)` en text inom parentes. I Dataspatium används mönstren för att analysera, rätta och dela upp
värden i datamängder. Fliken **Regex** i läget Analysera är platsen för att pröva mönster mot en kolumn och se
resultatet direkt. Samma mönster fungerar också i Bearbeta (åtgärdsgruppen *Reguljära uttryck*, *Sök och
ersätt*), i kvalitetsregeln *Matchar mönster* och i SQL-konsolen.

## Vilken standard?

Dataspatium använder JavaScripts reguljära uttryck enligt standarden ECMAScript (ECMA-262), med Unicode-flaggan
påslagen. Skälen:

- De finns inbyggda i webbläsaren, så inget extra bibliotek behövs och allt fungerar från `file://`.
- Samma motor används överallt i appen: i Regex-fliken, i SQL-funktionerna i SQLite-motorn, i reglerna och i Sök
  och ersätt. Ett mönster som fungerar på ett ställe fungerar på alla.
- De har det som behövs för data: namngivna grupper `(?<namn>…)`, se framåt och bakåt (`(?=…)`, `(?<=…)`),
  Unicode-klasser som `\p{L}` (alla bokstäver, även å, ä, ö, æ, ø, þ och ð) och flaggor för skiftläge.
- Syntaxen är väldokumenterad (till exempel på MDN) och ligger mycket nära den som R-paketet stringr (ICU) och
  PCRE använder, så mönster går att flytta mellan Dataspatium, R och de flesta andra verktyg.

Andra standarder som jämfördes: POSIX ERE (R:s standardmotor TRE) saknar se framåt och bakåt och Unicode-klasser.
PCRE (R med `perl = TRUE`) och ICU (stringr) är nära släktingar till JavaScript. RE2 garanterar att ett mönster
aldrig kan låsa sig, men finns inte i webbläsaren och saknar bakåtreferenser och se framåt och bakåt. Risken med
JavaScript, att vissa mönster kan ta mycket lång tid, hanteras i stället med en tidsgräns (se *Säkerhet och
prestanda*).

Dataspatiums regler utöver standarden:

- Unicode-flaggan läggs till när mönstret tillåter det. Ett äldre mönster som bara är giltigt utan den, till
  exempel `a\-b`, fungerar ändå, men då utan `\p{…}`.
- `(?i)`, `(?s)` och `(?m)` först i mönstret blir flaggor, som i R, Python och PCRE. `(?i)malmö` matchar MALMÖ.
- `\w`, `\d` och `\b` gäller bara a–z, A–Z, 0–9 och understreck. Använd `\p{L}` för bokstäver och `(?<!\p{L})`
  och `(?!\p{L})` som ordgräns i text med å, ä och ö.

## Fliken Regex

Fliken ligger i Analysera bredvid R, SQL och Anteckningsbok och har samma layout som resten av appen:

- **Vänster**: datamängderna, dina sparade mönster och mönsterbiblioteket.
- **Mitten**: kolumn, mönster, flaggor och vad som ska göras, med en förhandsgranskning.
- **Höger**: syntaxen i korthet och samma sak som SQL- och R-kod, som kan öppnas i SQL- eller R-fliken.

Gör så här:

1. Välj en datamängd i listan till vänster och en kolumn i fältet **Kolumn**.
2. Skriv ett mönster i fältet **Mönster**, eller klicka på ett mönster i biblioteket. Förhandsgranskningen visar
   kolumnens vanligaste värden (upp till 500 olika) med träffarna markerade, och raden under fältet berättar hur
   många rader som matchar.
3. Välj vid behov **Ignorera skiftläge**, **Hela värdet ska matcha** (mönstret omges av `^(?:` och `)$`) och
   **Punkt matchar radbrytning**.
4. Välj vad som ska göras under **Gör så här** och tryck **Tillämpa**.

| Gör så här | Vad som händer |
|---|---|
| Testa och visa träffar | Visar träffarna, antalet per värde och, om du vill, bara värden med eller utan träff. Ingenting ändras |
| Mönsterprofil | Visar värdenas former: `A` är en versal, `a` en annan bokstav och `9` en siffra, så `114 55` har formen `999 99`. *Förenkla upprepningar* skriver en följd som `9+`. **Använd** gör ett mönster av formen. Ingenting ändras |
| Filtrera rader | Behåller raderna som matchar, eller tar bort dem |
| Extrahera till nya kolumner | En ny kolumn per grupp i mönstret, eller en kolumn med hela träffen om mönstret saknar grupper. Namngivna grupper ger kolumnnamnen; andra namn kan anges. *Alla träffar* samlar alla träffar med en avgränsare |
| Ersätt | Ersätter träffarna i textkolumner. `$1`, `$2` och `$<namn>` sätter in en grupp, `$&` hela träffen |
| Dela upp i kolumner | Delar värdet där mönstret matchar, i ett valt antal kolumner; den sista får resten av texten |
| Markera träffar i ny kolumn | En ja/nej-kolumn som visar om värdet matchar |
| Räkna träffar i ny kolumn | En kolumn med antalet träffar i varje värde |
| Skapa kvalitetsregel | Lägger till regeln *Matchar mönster* för kolumnen; den körs under Regler i Bearbeta |

Det som ändrar datamängden blir ett receptsteg, precis som åtgärderna i Bearbeta: det kan ångras där, spelas upp
på en annan datamängd och exporteras som SQL (med Dataspatiums funktioner `dm_regex_*`) och som R-kod (med
paketet stringr). Samma steg finns i Bearbeta under **Åtgärder** i gruppen *Reguljära uttryck*.

Värden som inte är text, till exempel tal och datum, prövas i sin textform (`2.5`, `2024-01-31`).

## Mönsterbiblioteket

Biblioteket har färdiga mönster i tre grupper. *Sverige*: personnummer, organisationsnummer, postnummer,
kommunkod, telefonnummer och registreringsnummer för bil. *Norden*: danskt CPR-nummer, norskt fødselsnummer, finsk
henkilötunnus, isländsk kennitala och nordiska postnummer. *Allmänt*: e-postadress, webbadress i text, datum som
ÅÅÅÅ-MM-DD och D.M.ÅÅÅÅ, klockslag, årtal i text, tal med decimalkomma, belopp i kronor, text inom parentes, ord,
överflödiga blanksteg och hashtaggar.

Biblioteksmönstren kontrollerar formen, inte om ett nummer är giltigt. Kontrollsiffror och datum i
identitetsnummer kontrolleras av regeln *Giltigt identitetsnummer* i Bearbeta.

## Sparade mönster

**Spara mönster** sparar mönstret och flaggorna med ett namn. Sparade mönster listas till vänster och följer, som
R- och SQL-skript, med i säkerhetskopian, i delningspaket (när *Sparade skript och mönster* är valt) och i den
portabla mappen, som filer `scripts/<id>.script.json`.

## Syntax i korthet

| Mönster | Betyder | Exempel |
|---|---|---|
| `.` | valfritt tecken | `a.c` matchar abc och a-c |
| `\d` | siffra 0–9 | `\d{4}` matchar 2024 |
| `\p{L}`, `\p{Lu}`, `\p{Ll}` | bokstav, versal, gemen | `\p{Lu}\p{Ll}+` matchar Malmö |
| `\s` | blanksteg, tabb eller radbrytning | `\s{2,}` matchar dubbla blanksteg |
| `[abc]`, `[^abc]`, `[a-z]` | ett av tecknen, inget av dem, ett intervall | `[.,]` matchar punkt eller komma |
| `a\|b` | a eller b | `kr\|SEK` |
| `*`, `+`, `?` | noll eller fler, en eller fler, noll eller en | `\d+` |
| `{n}`, `{n,m}`, `{n,}` | exakt n, n till m, minst n gånger | `\d{3,4}` |
| `^`, `$` | början och slutet av värdet | `^\d+$` är bara siffror |
| `(…)` | grupp, nås som `$1` | `(\d{3}) ?(\d{2})` |
| `(?<namn>…)` | namngiven grupp, nås som `$<namn>` | `(?<ar>\d{4})` |
| `(?:…)` | grupp som inte fångas | `(?:kr\|SEK)` |
| `(?=…)`, `(?!…)` | följs av, följs inte av | `\d+(?= kr)` |
| `(?<=…)`, `(?<!…)` | föregås av, föregås inte av | `(?<=nr )\d+` |
| `\` | gör ett specialtecken vanligt | `\.` är en punkt, `\(` en parentes |

## Exempel

| Uppgift | Mönster | Gör så här |
|---|---|---|
| Årtal ur en text som *Folkmängd 2024* | `(?<ar>(?:19\|20)\d{2})` | Extrahera; ny kolumn `ar` |
| Länskod inom parentes, *Stockholms län (01)* | `\((\d{2})\)` | Extrahera; ange namnet `lanskod` |
| Postnummer med mellanslag | `^(\d{3}) ?(\d{2})$` | Ersätt med `$1 $2` |
| Efternamn och förnamn ur *Berg, Anna* | `, ?` | Dela upp i 2 kolumner |
| Rader med en e-postadress i fritext | `[^\s@]+@[^\s@]+\.[^\s@]+` | Markera träffar eller Filtrera rader |
| Blandade datumformat | (ingen) | Mönsterprofil visar till exempel `9999-99-99` och `99/99/9999`; rätta sedan med Ändra typ i Bearbeta |
| Telefonnummer med bara siffror | `[^\d+]` | Ersätt med tomt (eller åtgärden Ta bort tecken) |

## I SQL och R

SQL-konsolen har samma mönster genom Dataspatiums funktioner:

| Funktion | Ger |
|---|---|
| `x regexp 'mönster'`, `regexp('mönster', x)` | 1 om x matchar, annars 0 |
| `regexp_replace(x, 'mönster', 'ersättning', 'gi')` | x med träffarna ersatta (`g` alla, `i` utan skiftläge) |
| `dm_regex_test(x, 'mönster', 'i')` | 1, 0 eller tomt för ett tomt värde |
| `dm_regex_extract(x, 'mönster', grupp, '')` | gruppen (nummer eller namn, 0 för hela träffen) i första träffen |
| `dm_regex_all(x, 'mönster', grupp, ', ', '')` | gruppen i alla träffar med avgränsare |
| `dm_regex_count(x, 'mönster', '')` | antalet träffar |
| `dm_regex_split(x, 'mönster', del, antal, '')` | del nummer `del` av `antal` när x delas vid mönstret |
| `dm_shape(x, 0)` | formen i mönsterprofilen (1 förenklar upprepningar) |

```sql
select kommun, dm_regex_extract(namn, '\((\d{2})\)', 1, '') as lanskod
from data
where dm_regex_test(postnr, '^\d{3} ?\d{2}$', '') = 0
```

I R används paketet stringr, vars syntax (ICU) är nästan densamma: `stringr::str_detect(df$postnr,
stringr::regex("^\\d{3} ?\\d{2}$"))`. Skillnaderna att känna till: i R skrivs varje `\` dubbelt inne i en sträng,
en grupp i en ersättning skrivs `\\1` i stället för `$1` (receptexporten gör om det åt dig), och se bakåt måste ha
en begränsad längd. `\d` matchar alla Unicode-siffror i ICU men bara 0–9 i JavaScript.

## Säkerhet och prestanda

Vissa mönster kan ta extremt lång tid på vissa värden, till exempel `(a+)+$` på en lång rad a följd av ett annat
tecken (*katastrofal backtracking*). Därför prövas mönstren i en egen bakgrundstråd med en tidsgräns på två
sekunder. Går tiden ut stoppas tråden, ett meddelande visas och ingenting ändras. Innan ett steg ändrar en
datamängd prövas mönstret på kolumnens alla värden på samma sätt. Gör i så fall mönstret enklare: undvik nästlade
upprepningar som `(a+)+` och `(\w*)*`, och var så specifik som möjligt, till exempel `[^,]*` i stället för `.*`.

Förhandsgranskningen visar de 500 vanligaste olika värdena. Antalet träffar räknas exakt när kolumnen har högst
20 000 olika värden, annars på de 20 000 vanligaste, vilket då står under mönsterfältet.

## Begränsningar

- Ersätt fungerar på textkolumner; ändra först typen till text för andra kolumner.
- Ett recept som spelas upp på en annan datamängd prövar mönstret på den datamängdens värden innan det körs.
- R-exporten använder stringr. Ovanlig syntax, som se bakåt med obegränsad längd, kan ge annat resultat i R.
