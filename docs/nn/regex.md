# Regulære uttrykk (Regex)

Eit regulært uttrykk er eit mønster som skildrar tekst: `^\d{4}$` skildrar eit norsk postnummer, `\(([^)]*)\)` ein
tekst i parentes. I Dataspatium blir mønstera brukte til å analysere, rette og dele opp verdiar i datasett. Fana
**Regex** i modusen Analyser er staden der ein prøver mønster på ein kolonne og ser resultatet med ein gong. Dei same
mønstera verkar òg i Bearbeid (handlingsgruppa *Regulære uttrykk*, *Søk og erstatt*), i kvalitetsregelen
*Samsvarar med mønster* og i SQL-konsollen.

## Kva standard?

Dataspatium brukar dei regulære uttrykka i JavaScript etter standarden ECMAScript (ECMA-262), med Unicode-flagget slått
på. Grunngjevinga:

- Dei er innebygde i nettlesaren, så det trengst ikkje noko ekstra bibliotek, og alt verkar frå `file://`.
- Den same motoren blir brukt overalt i appen: i Regex-fana, i SQL-funksjonane i SQLite-motoren, i reglane og i Søk
  og erstatt. Eit mønster som verkar éin stad, verkar alle stader.
- Dei har det data krev: namngjevne grupper `(?<namn>…)`, sjå framover og bakover (`(?=…)`, `(?<=…)`),
  Unicode-klassar som `\p{L}` (alle bokstavar, òg æ, ø, å, ä, ö, þ og ð) og flagg for store og små bokstavar.
- Syntaksen er godt dokumentert (til dømes på MDN) og ligg svært nær den som R-pakken stringr (ICU) og PCRE
  brukar, så mønster kan flyttast mellom Dataspatium, R og dei fleste andre verktøy.

Andre standardar som vart samanlikna: POSIX ERE (standardmotoren TRE i R) manglar sjå framover og bakover og
Unicode-klassar. PCRE (R med `perl = TRUE`) og ICU (stringr) er nære slektningar av JavaScript. RE2 garanterer at
eit mønster aldri kan hengje seg opp, men finst ikkje i nettlesaren og manglar tilbakereferansar og sjå framover og
bakover. Risikoen med JavaScript, at visse mønster kan ta svært lang tid, blir handtert i staden med ei tidsgrense (sjå
*Tryggleik og yting*).

Reglane i Dataspatium i tillegg til standarden:

- Unicode-flagget blir lagt til når mønsteret tillèt det. Eit eldre mønster som berre er gyldig utan det, til dømes
  `a\-b`, verkar framleis, men då utan `\p{…}`.
- `(?i)`, `(?s)` og `(?m)` først i mønsteret blir flagg, som i R, Python og PCRE. `(?i)tromsø` samsvarar med TROMSØ.
- `\w`, `\d` og `\b` gjeld berre a–z, A–Z, 0–9 og understrek. Bruk `\p{L}` for bokstavar og `(?<!\p{L})` og
  `(?!\p{L})` som ordgrense i tekst med æ, ø og å.

## Fana Regex

Fana ligg i Analyser ved sida av R, SQL og Notatbok og har same oppsett som resten av appen:

- **Venstre**: datasetta, dei lagra mønstera dine og mønsterbiblioteket.
- **Midten**: kolonne, mønster, flagg og kva som skal gjerast, med ei førehandsvising.
- **Høgre**: syntaksen i korte trekk og det same som SQL- og R-kode, som kan opnast i SQL- eller R-fana.

Slik gjer du:

1. Vel eit datasett i lista til venstre og ein kolonne i feltet **Kolonne**.
2. Skriv eit mønster i feltet **Mønster**, eller klikk på eit mønster i biblioteket. Førehandsvisinga viser
   dei vanlegaste verdiane i kolonnen (opptil 500 ulike) med treffa merkte, og linja under feltet fortel kor mange
   rader som samsvarar.
3. Vel ved behov **Ignorer store og små bokstavar**, **Heile verdien skal samsvare** (mønsteret blir omgjeve av `^(?:` og
   `)$`) og **Punktum samsvarar med linjeskift**.
4. Vel kva som skal gjerast under **Gjer slik**, og trykk **Bruk**.

| Gjer slik | Kva som skjer |
|---|---|
| Test og vis treff | Viser treffa, talet per verdi og om du vil berre verdiar med eller utan treff. Ingenting blir endra |
| Mønsterprofil | Viser formene til verdiane: `A` er ein stor bokstav, `a` ein annan bokstav og `9` eit siffer, så `114 55` har forma `999 99`. *Forenkle gjentakingar* skriv ei rekkje som `9+`. **Bruk** lagar eit mønster av forma. Ingenting blir endra |
| Filtrer rader | Held på radene som samsvarar, eller fjernar dei |
| Hent ut til nye kolonnar | Ein ny kolonne per gruppe i mønsteret, eller éin kolonne med heile treffet om mønsteret ikkje har grupper. Namngjevne grupper gjev kolonnenamna; andre namn kan oppgjevast. *Alle treff* samlar alle treff med eit skiljeteikn |
| Erstatt | Erstattar treffa i tekstkolonnar. `$1`, `$2` og `$<namn>` set inn ei gruppe, `$&` heile treffet |
| Del opp i kolonnar | Deler verdien der mønsteret samsvarar, i eit valt tal på kolonnar; den siste får resten av teksten |
| Marker treff i ny kolonne | Ein ja/nei-kolonne som viser om verdien samsvarar |
| Tel treff i ny kolonne | Ein kolonne med talet på treff i kvar verdi |
| Lag kvalitetsregel | Legg til regelen *Samsvarar med mønster* for kolonnen; han blir køyrd under Reglar i Bearbeid |

Det som endrar datasettet, blir eit oppskriftssteg akkurat som handlingane i Bearbeid: det kan angrast der, spelast av
på eit anna datasett og eksporterast som SQL (med funksjonane `dm_regex_*` i Dataspatium) og som R-kode (med pakken
stringr). Dei same stega finst i Bearbeid under **Handlingar** i gruppa *Regulære uttrykk*.

Verdiar som ikkje er tekst, til dømes tal og datoar, blir prøvde i tekstforma si (`2.5`, `2024-01-31`).

## Mønsterbiblioteket

Biblioteket har ferdige mønster i tre grupper. *Sverige*: personnummer, organisasjonsnummer, postnummer,
kommunenummer, telefonnummer og registreringsnummer for bil. *Norden*: dansk CPR-nummer, fødselsnummer, finsk
henkilötunnus, islandsk kennitala og nordiske postnummer. *Generelt*: e-postadresse, nettadresse i tekst, datoar som
ÅÅÅÅ-MM-DD og D.M.ÅÅÅÅ, klokkeslett, årstal i tekst, tal med desimalkomma, beløp i kroner, tekst i parentes, ord,
overflødige mellomrom og emneknaggar.

Biblioteksmønstera kontrollerer forma, ikkje om eit nummer er gyldig. Kontrollsiffer og datoar i identitetsnummer
blir kontrollerte av regelen *Gyldig identitetsnummer* i Bearbeid.

## Lagra mønster

**Lagre mønster** lagrar mønsteret og flagga med eit namn. Lagra mønster blir viste til venstre og følgjer, som R- og
SQL-skript, med i tryggingskopien, i pakkar (når *Lagra skript og mønster* er valt) og i den portable mappa,
som filer `scripts/<id>.script.json`.

## Syntaks i korte trekk

| Mønster | Tyder | Døme |
|---|---|---|
| `.` | eit kva som helst teikn | `a.c` samsvarar med abc og a-c |
| `\d` | siffer 0–9 | `\d{4}` samsvarar med 2024 |
| `\p{L}`, `\p{Lu}`, `\p{Ll}` | bokstav, stor, liten | `\p{Lu}\p{Ll}+` samsvarar med Tromsø |
| `\s` | mellomrom, tabulator eller linjeskift | `\s{2,}` samsvarar med doble mellomrom |
| `[abc]`, `[^abc]`, `[a-z]` | eitt av teikna, ingen av dei, eit intervall | `[.,]` samsvarar med punktum eller komma |
| `a\|b` | a eller b | `kr\|NOK` |
| `*`, `+`, `?` | null eller fleire, éin eller fleire, null eller éin | `\d+` |
| `{n}`, `{n,m}`, `{n,}` | nøyaktig n, n til m, minst n gonger | `\d{3,4}` |
| `^`, `$` | byrjinga og slutten av verdien | `^\d+$` er berre siffer |
| `(…)` | gruppe, blir brukt som `$1` | `(\d{2})(\d{2})` |
| `(?<namn>…)` | namngjeven gruppe, blir brukt som `$<namn>` | `(?<aar>\d{4})` |
| `(?:…)` | gruppe som ikkje blir fanga | `(?:kr\|NOK)` |
| `(?=…)`, `(?!…)` | blir følgd av, blir ikkje følgd av | `\d+(?= kr)` |
| `(?<=…)`, `(?<!…)` | blir innleidd av, blir ikkje innleidd av | `(?<=nr\. )\d+` |
| `\` | gjer eit spesialteikn vanleg | `\.` er eit punktum, `\(` ein parentes |

## Døme

| Oppgåve | Mønster | Gjer slik |
|---|---|---|
| Årstal frå ein tekst som *Folkemengd 2024* | `(?<aar>(?:19\|20)\d{2})` | Hent ut; ny kolonne `aar` |
| Nummer i parentes, *Troms (55)* | `\((\d{2})\)` | Hent ut; oppgje namnet `fylkesnummer` |
| Svensk postnummer med mellomrom | `^(\d{3}) ?(\d{2})$` | Erstatt med `$1 $2` |
| Etternamn og fornamn frå *Berg, Anna* | `, ?` | Del opp i 2 kolonnar |
| Rader med ei e-postadresse i fritekst | `[^\s@]+@[^\s@]+\.[^\s@]+` | Marker treff eller Filtrer rader |
| Blanda datoformat | (ingen) | Mønsterprofil viser til dømes `9999-99-99` og `99/99/9999`; rett deretter med Endre type i Bearbeid |
| Telefonnummer med berre siffer | `[^\d+]` | Erstatt med ingenting (eller handlinga Fjern teikn) |

## I SQL og R

SQL-konsollen har dei same mønstera gjennom funksjonane i Dataspatium:

| Funksjon | Gjev |
|---|---|
| `x regexp 'mønster'`, `regexp('mønster', x)` | 1 om x samsvarar, elles 0 |
| `regexp_replace(x, 'mønster', 'erstatning', 'gi')` | x med treffa erstatta (`g` alle, `i` uavhengig av store og små bokstavar) |
| `dm_regex_test(x, 'mønster', 'i')` | 1, 0 eller tomt for ein tom verdi |
| `dm_regex_extract(x, 'mønster', gruppe, '')` | gruppa (nummer eller namn, 0 for heile treffet) i første treff |
| `dm_regex_all(x, 'mønster', gruppe, ', ', '')` | gruppa i alle treff med skiljeteikn |
| `dm_regex_count(x, 'mønster', '')` | tal på treff |
| `dm_regex_split(x, 'mønster', del, tal, '')` | del nummer `del` av `tal` når x blir delt ved mønsteret |
| `dm_shape(x, 0)` | forma i mønsterprofilen (1 forenklar gjentakingar) |

```sql
select kommune, dm_regex_extract(navn, '\((\d{2})\)', 1, '') as fylkesnummer
from data
where dm_regex_test(postnr, '^\d{4}$', '') = 0
```

I R blir pakken stringr brukt, der syntaksen (ICU) er nesten den same: `stringr::str_detect(df$postnr,
stringr::regex("^\\d{4}$"))`. Skilnadene du bør kjenne til: i R blir kvar `\` skriven dobbelt inne i ein streng, ei
gruppe i ei erstatning blir skriven `\\1` i staden for `$1` (oppskriftseksporten gjer det for deg), og sjå bakover må ha
ei avgrensa lengd. `\d` samsvarar med alle Unicode-siffer i ICU, men berre 0–9 i JavaScript.

## Tryggleik og yting

Visse mønster kan ta ekstremt lang tid på visse verdiar, til dømes `(a+)+$` på ei lang rekkje a følgd av eit anna
teikn (*katastrofal backtracking*). Difor blir mønstera prøvde i ein eigen bakgrunnstråd med ei tidsgrense på to
sekund. Når tida går ut, blir tråden stoppa, det blir vist ei melding, og ingenting blir endra. Før eit steg endrar eit
datasett, blir mønsteret prøvd på same måte på alle verdiane i kolonnen. Gjer i så fall mønsteret enklare: unngå
nøsta gjentakingar som `(a+)+` og `(\w*)*`, og ver så spesifikk som mogleg, til dømes `[^,]*` i staden for `.*`.

Førehandsvisinga viser dei 500 vanlegaste ulike verdiane. Tal på treff blir telt nøyaktig når kolonnen har høgst 20 000
ulike verdiar, elles på dei 20 000 vanlegaste, noko som då står under mønsterfeltet.

## Avgrensingar

- Erstatt verkar på tekstkolonnar; endre først typen til tekst for andre kolonnar.
- Ei oppskrift som blir spela av på eit anna datasett, prøver mønsteret på verdiane i det datasettet før ho blir køyrd.
- R-eksporten brukar stringr. Uvanleg syntaks, som sjå bakover med uavgrensa lengd, kan gje eit anna resultat i R.
