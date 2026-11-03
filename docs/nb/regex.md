# Regulære uttrykk (Regex)

Et regulært uttrykk er et mønster som beskriver tekst: `^\d{4}$` beskriver et norsk postnummer, `\(([^)]*)\)` en
tekst i parentes. I Dataspatium brukes mønstrene til å analysere, rette og dele opp verdier i datasett. Fanen
**Regex** i modusen Analyser er stedet der man prøver mønstre på en kolonne og ser resultatet med en gang. De samme
mønstrene virker også i Bearbeid (handlingsgruppen *Regulære uttrykk*, *Søk og erstatt*), i kvalitetsregelen
*Matcher mønster* og i SQL-konsollen.

## Hvilken standard?

Dataspatium bruker JavaScripts regulære uttrykk etter standarden ECMAScript (ECMA-262), med Unicode-flagget slått
på. Begrunnelsen:

- De er innebygd i nettleseren, så det trengs ikke noe ekstra bibliotek, og alt virker fra `file://`.
- Den samme motoren brukes overalt i appen: i Regex-fanen, i SQL-funksjonene i SQLite-motoren, i reglene og i Søk
  og erstatt. Et mønster som virker ett sted, virker alle steder.
- De har det data krever: navngitte grupper `(?<navn>…)`, se fremover og bakover (`(?=…)`, `(?<=…)`),
  Unicode-klasser som `\p{L}` (alle bokstaver, også æ, ø, å, ä, ö, þ og ð) og flagg for store og små bokstaver.
- Syntaksen er godt dokumentert (for eksempel på MDN) og ligger svært nær den som R-pakken stringr (ICU) og PCRE
  bruker, så mønstre kan flyttes mellom Dataspatium, R og de fleste andre verktøy.

Andre standarder som ble sammenlignet: POSIX ERE (R sin standardmotor TRE) mangler se fremover og bakover og
Unicode-klasser. PCRE (R med `perl = TRUE`) og ICU (stringr) er nære slektninger av JavaScript. RE2 garanterer at
et mønster aldri kan henge seg opp, men finnes ikke i nettleseren og mangler tilbakereferanser og se fremover og
bakover. Risikoen med JavaScript, at visse mønstre kan ta svært lang tid, håndteres i stedet med en tidsgrense (se
*Sikkerhet og ytelse*).

Dataspatiums regler i tillegg til standarden:

- Unicode-flagget legges til når mønsteret tillater det. Et eldre mønster som bare er gyldig uten det, for eksempel
  `a\-b`, virker fortsatt, men da uten `\p{…}`.
- `(?i)`, `(?s)` og `(?m)` først i mønsteret blir flagg, som i R, Python og PCRE. `(?i)tromsø` matcher TROMSØ.
- `\w`, `\d` og `\b` gjelder bare a–z, A–Z, 0–9 og understrek. Bruk `\p{L}` for bokstaver og `(?<!\p{L})` og
  `(?!\p{L})` som ordgrense i tekst med æ, ø og å.

## Fanen Regex

Fanen ligger i Analyser ved siden av R, SQL og Notatbok og har samme oppsett som resten av appen:

- **Venstre**: datasettene, de lagrede mønstrene dine og mønsterbiblioteket.
- **Midten**: kolonne, mønster, flagg og hva som skal gjøres, med en forhåndsvisning.
- **Høyre**: syntaksen i korte trekk og det samme som SQL- og R-kode, som kan åpnes i SQL- eller R-fanen.

Slik gjør du:

1. Velg et datasett i listen til venstre og en kolonne i feltet **Kolonne**.
2. Skriv et mønster i feltet **Mønster**, eller klikk på et mønster i biblioteket. Forhåndsvisningen viser
   kolonnens vanligste verdier (opptil 500 ulike) med treffene markert, og linjen under feltet forteller hvor mange
   rader som matcher.
3. Velg ved behov **Ignorer store og små bokstaver**, **Hele verdien skal matche** (mønsteret omgis av `^(?:` og
   `)$`) og **Punktum matcher linjeskift**.
4. Velg hva som skal gjøres under **Gjør slik**, og trykk **Bruk**.

| Gjør slik | Hva som skjer |
|---|---|
| Test og vis treff | Viser treffene, antallet per verdi og om du vil bare verdier med eller uten treff. Ingenting endres |
| Mønsterprofil | Viser verdienes former: `A` er en stor bokstav, `a` en annen bokstav og `9` et siffer, så `114 55` har formen `999 99`. *Forenkle gjentakelser* skriver en rekke som `9+`. **Bruk** lager et mønster av formen. Ingenting endres |
| Filtrer rader | Beholder radene som matcher, eller fjerner dem |
| Hent ut til nye kolonner | En ny kolonne per gruppe i mønsteret, eller én kolonne med hele treffet hvis mønsteret ikke har grupper. Navngitte grupper gir kolonnenavnene; andre navn kan angis. *Alle treff* samler alle treff med et skilletegn |
| Erstatt | Erstatter treffene i tekstkolonner. `$1`, `$2` og `$<navn>` setter inn en gruppe, `$&` hele treffet |
| Del opp i kolonner | Deler verdien der mønsteret matcher, i et valgt antall kolonner; den siste får resten av teksten |
| Marker treff i ny kolonne | En ja/nei-kolonne som viser om verdien matcher |
| Tell treff i ny kolonne | En kolonne med antall treff i hver verdi |
| Lag kvalitetsregel | Legger til regelen *Matcher mønster* for kolonnen; den kjøres under Regler i Bearbeid |

Det som endrer datasettet, blir et oppskriftssteg akkurat som handlingene i Bearbeid: det kan angres der, spilles av
på et annet datasett og eksporteres som SQL (med Dataspatiums funksjoner `dm_regex_*`) og som R-kode (med pakken
stringr). De samme stegene finnes i Bearbeid under **Handlinger** i gruppen *Regulære uttrykk*.

Verdier som ikke er tekst, for eksempel tall og datoer, prøves i tekstformen sin (`2.5`, `2024-01-31`).

## Mønsterbiblioteket

Biblioteket har ferdige mønstre i tre grupper. *Sverige*: personnummer, organisasjonsnummer, postnummer,
kommunenummer, telefonnummer og registreringsnummer for bil. *Norden*: dansk CPR-nummer, fødselsnummer, finsk
henkilötunnus, islandsk kennitala og nordiske postnumre. *Generelt*: e-postadresse, nettadresse i tekst, datoer som
ÅÅÅÅ-MM-DD og D.M.ÅÅÅÅ, klokkeslett, årstall i tekst, tall med desimalkomma, beløp i kroner, tekst i parentes, ord,
overflødige mellomrom og emneknagger.

Biblioteksmønstrene kontrollerer formen, ikke om et nummer er gyldig. Kontrollsifre og datoer i identitetsnumre
kontrolleres av regelen *Gyldig identitetsnummer* i Bearbeid.

## Lagrede mønstre

**Lagre mønster** lagrer mønsteret og flaggene med et navn. Lagrede mønstre vises til venstre og følger, som R- og
SQL-skript, med i sikkerhetskopien, i pakker (når *Lagrede skript og mønstre* er valgt) og i den portable mappen,
som filer `scripts/<id>.script.json`.

## Syntaks i korte trekk

| Mønster | Betyr | Eksempel |
|---|---|---|
| `.` | et hvilket som helst tegn | `a.c` matcher abc og a-c |
| `\d` | siffer 0–9 | `\d{4}` matcher 2024 |
| `\p{L}`, `\p{Lu}`, `\p{Ll}` | bokstav, stor, liten | `\p{Lu}\p{Ll}+` matcher Tromsø |
| `\s` | mellomrom, tabulator eller linjeskift | `\s{2,}` matcher doble mellomrom |
| `[abc]`, `[^abc]`, `[a-z]` | ett av tegnene, ingen av dem, et intervall | `[.,]` matcher punktum eller komma |
| `a\|b` | a eller b | `kr\|NOK` |
| `*`, `+`, `?` | null eller flere, én eller flere, null eller én | `\d+` |
| `{n}`, `{n,m}`, `{n,}` | nøyaktig n, n til m, minst n ganger | `\d{3,4}` |
| `^`, `$` | begynnelsen og slutten av verdien | `^\d+$` er bare sifre |
| `(…)` | gruppe, brukes som `$1` | `(\d{2})(\d{2})` |
| `(?<navn>…)` | navngitt gruppe, brukes som `$<navn>` | `(?<aar>\d{4})` |
| `(?:…)` | gruppe som ikke fanges | `(?:kr\|NOK)` |
| `(?=…)`, `(?!…)` | etterfølges av, etterfølges ikke av | `\d+(?= kr)` |
| `(?<=…)`, `(?<!…)` | innledes av, innledes ikke av | `(?<=nr\. )\d+` |
| `\` | gjør et spesialtegn vanlig | `\.` er et punktum, `\(` en parentes |

## Eksempler

| Oppgave | Mønster | Gjør slik |
|---|---|---|
| Årstall fra en tekst som *Folkemengde 2024* | `(?<aar>(?:19\|20)\d{2})` | Hent ut; ny kolonne `aar` |
| Nummer i parentes, *Troms (55)* | `\((\d{2})\)` | Hent ut; angi navnet `fylkesnummer` |
| Svensk postnummer med mellomrom | `^(\d{3}) ?(\d{2})$` | Erstatt med `$1 $2` |
| Etternavn og fornavn fra *Berg, Anna* | `, ?` | Del opp i 2 kolonner |
| Rader med en e-postadresse i fritekst | `[^\s@]+@[^\s@]+\.[^\s@]+` | Marker treff eller Filtrer rader |
| Blandede datoformater | (ingen) | Mønsterprofil viser for eksempel `9999-99-99` og `99/99/9999`; rett deretter med Endre type i Bearbeid |
| Telefonnumre med bare sifre | `[^\d+]` | Erstatt med ingenting (eller handlingen Fjern tegn) |

## I SQL og R

SQL-konsollen har de samme mønstrene gjennom Dataspatiums funksjoner:

| Funksjon | Gir |
|---|---|
| `x regexp 'mønster'`, `regexp('mønster', x)` | 1 hvis x matcher, ellers 0 |
| `regexp_replace(x, 'mønster', 'erstatning', 'gi')` | x med treffene erstattet (`g` alle, `i` uavhengig av store og små bokstaver) |
| `dm_regex_test(x, 'mønster', 'i')` | 1, 0 eller tomt for en tom verdi |
| `dm_regex_extract(x, 'mønster', gruppe, '')` | gruppen (nummer eller navn, 0 for hele treffet) i første treff |
| `dm_regex_all(x, 'mønster', gruppe, ', ', '')` | gruppen i alle treff med skilletegn |
| `dm_regex_count(x, 'mønster', '')` | antall treff |
| `dm_regex_split(x, 'mønster', del, antall, '')` | del nummer `del` av `antall` når x deles ved mønsteret |
| `dm_shape(x, 0)` | formen i mønsterprofilen (1 forenkler gjentakelser) |

```sql
select kommune, dm_regex_extract(navn, '\((\d{2})\)', 1, '') as fylkesnummer
from data
where dm_regex_test(postnr, '^\d{4}$', '') = 0
```

I R brukes pakken stringr, der syntaksen (ICU) er nesten den samme: `stringr::str_detect(df$postnr,
stringr::regex("^\\d{4}$"))`. Forskjellene du bør kjenne til: i R skrives hver `\` dobbelt inne i en streng, en
gruppe i en erstatning skrives `\\1` i stedet for `$1` (oppskriftseksporten gjør det for deg), og se bakover må ha
en begrenset lengde. `\d` matcher alle Unicode-sifre i ICU, men bare 0–9 i JavaScript.

## Sikkerhet og ytelse

Visse mønstre kan ta ekstremt lang tid på visse verdier, for eksempel `(a+)+$` på en lang rekke a fulgt av et annet
tegn (*katastrofal backtracking*). Derfor prøves mønstrene i en egen bakgrunnstråd med en tidsgrense på to
sekunder. Når tiden går ut, stoppes tråden, det vises en melding, og ingenting endres. Før et steg endrer et
datasett, prøves mønsteret på samme måte på alle verdiene i kolonnen. Gjør i så fall mønsteret enklere: unngå
nøstede gjentakelser som `(a+)+` og `(\w*)*`, og vær så spesifikk som mulig, for eksempel `[^,]*` i stedet for `.*`.

Forhåndsvisningen viser de 500 vanligste ulike verdiene. Antall treff telles nøyaktig når kolonnen har høyst 20 000
ulike verdier, ellers på de 20 000 vanligste, noe som da står under mønsterfeltet.

## Begrensninger

- Erstatt virker på tekstkolonner; endre først typen til tekst for andre kolonner.
- En oppskrift som spilles av på et annet datasett, prøver mønsteret på det datasettets verdier før den kjøres.
- R-eksporten bruker stringr. Uvanlig syntaks, som se bakover med ubegrenset lengde, kan gi et annet resultat i R.
