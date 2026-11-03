# Regular expressions (Regex)

A regular expression is a pattern that describes text: `^\d{3} ?\d{2}$` describes a Swedish postcode,
`\(([^)]*)\)` a text in parentheses. In Dataspatium the patterns are used to analyse, correct and split values in
datasets. The **Regex** tab in the Analyse mode is the place to try patterns on a column and see the result at once.
The same patterns also work in Process (the action group *Regular expressions*, *Find and replace*), in the quality
rule *Matches pattern* and in the SQL console.

## Which standard?

Dataspatium uses JavaScript's regular expressions as defined by the ECMAScript standard (ECMA-262), with the
Unicode flag on. The reasons:

- They are built into the browser, so no extra library is needed and everything works from `file://`.
- The same engine is used everywhere in the app: in the Regex tab, in the SQL functions of the SQLite engine, in
  the rules and in Find and replace. A pattern that works in one place works in all of them.
- They have what data work needs: named groups `(?<name>…)`, look-ahead and look-behind (`(?=…)`, `(?<=…)`),
  Unicode classes such as `\p{L}` (every letter, including å, ä, ö, æ, ø, þ and ð) and case flags.
- The syntax is well documented (for example on MDN) and very close to that of the R package stringr (ICU) and
  PCRE, so patterns move easily between Dataspatium, R and most other tools.

Other standards that were compared: POSIX ERE (R's default engine TRE) lacks look-around and Unicode classes. PCRE
(R with `perl = TRUE`) and ICU (stringr) are close relatives of JavaScript. RE2 guarantees that a pattern can never
hang, but is not available in the browser and lacks back-references and look-around. The risk with JavaScript, that
some patterns can take a very long time, is handled with a time limit instead (see *Safety and performance*).

Dataspatium's rules on top of the standard:

- The Unicode flag is added when the pattern allows it. An older pattern that is only valid without it, for
  example `a\-b`, still works, but then without `\p{…}`.
- `(?i)`, `(?s)` and `(?m)` at the start of the pattern become flags, as in R, Python and PCRE. `(?i)malmö`
  matches MALMÖ.
- `\w`, `\d` and `\b` only cover a–z, A–Z, 0–9 and underscore. Use `\p{L}` for letters, and `(?<!\p{L})` and
  `(?!\p{L})` as a word boundary in text with å, ä and ö.

## The Regex tab

The tab sits in Analyse next to R, SQL and Notebook and has the same layout as the rest of the app:

- **Left**: the datasets, your saved patterns and the pattern library.
- **Centre**: column, pattern, flags and what to do, with a preview.
- **Right**: the syntax in brief and the same thing as SQL and R code, which can be opened in the SQL or R tab.

How to use it:

1. Choose a dataset in the list on the left and a column in the **Column** field.
2. Type a pattern in the **Pattern** field, or click a pattern in the library. The preview shows the column's most
   common values (up to 500 distinct ones) with the matches marked, and the line below the field tells how many
   rows match.
3. Choose **Ignore case**, **The whole value must match** (the pattern is wrapped in `^(?:` and `)$`) and **Dot
   matches line breaks** as needed.
4. Choose what to do under **What to do** and press **Apply**.

| What to do | What happens |
|---|---|
| Test and show matches | Shows the matches, the number per value and, if you like, only values with or without a match. Nothing changes |
| Pattern profile | Shows the shapes of the values: `A` is an upper-case letter, `a` another letter and `9` a digit, so `114 55` has the shape `999 99`. *Simplify repetitions* writes a run as `9+`. **Use** makes a pattern from the shape. Nothing changes |
| Filter rows | Keeps the rows that match, or removes them |
| Extract into new columns | A new column per group in the pattern, or one column with the whole match if the pattern has no groups. Named groups give the column names; other names can be given. *All matches* collects every match with a separator |
| Replace | Replaces the matches in text columns. `$1`, `$2` and `$<name>` insert a group, `$&` the whole match |
| Split into columns | Splits the value where the pattern matches, into a chosen number of columns; the last one gets the rest of the text |
| Flag matches in a new column | A yes/no column that shows whether the value matches |
| Count matches in a new column | A column with the number of matches in each value |
| Create a quality rule | Adds the rule *Matches pattern* for the column; it runs under Rules in Process |

Whatever changes the dataset becomes a recipe step, just like the actions in Process: it can be undone there,
replayed on another dataset and exported as SQL (with Dataspatium's `dm_regex_*` functions) and as R code (with the
package stringr). The same steps are in Process under **Actions** in the group *Regular expressions*.

Values that are not text, such as numbers and dates, are tried in their text form (`2.5`, `2024-01-31`).

## The pattern library

The library has ready-made patterns in three groups. *Sweden*: personal identity number, organisation number,
postcode, municipality code, phone number and car registration number. *Nordic countries*: Danish CPR number,
Norwegian fødselsnummer, Finnish personal identity code, Icelandic kennitala and Nordic postcodes. *General*:
e-mail address, web address in text, dates as YYYY-MM-DD and D.M.YYYY, time of day, year in text, number with
decimal comma, amount in kronor, text in parentheses, words, surplus spaces and hashtags.

The library patterns check the form, not whether a number is valid. Check digits and dates in identity numbers are
checked by the rule *Valid identity number* in Process.

## Saved patterns

**Save pattern** saves the pattern and the flags under a name. Saved patterns are listed on the left and, like R
and SQL scripts, travel in the backup, in bundles (when *Saved scripts and patterns* is chosen) and in the portable
folder, as files `scripts/<id>.script.json`.

## Syntax in brief

| Pattern | Means | Example |
|---|---|---|
| `.` | any character | `a.c` matches abc and a-c |
| `\d` | digit 0–9 | `\d{4}` matches 2024 |
| `\p{L}`, `\p{Lu}`, `\p{Ll}` | letter, upper case, lower case | `\p{Lu}\p{Ll}+` matches Malmö |
| `\s` | space, tab or line break | `\s{2,}` matches double spaces |
| `[abc]`, `[^abc]`, `[a-z]` | one of the characters, none of them, a range | `[.,]` matches a full stop or a comma |
| `a\|b` | a or b | `kr\|SEK` |
| `*`, `+`, `?` | zero or more, one or more, zero or one | `\d+` |
| `{n}`, `{n,m}`, `{n,}` | exactly n, n to m, at least n times | `\d{3,4}` |
| `^`, `$` | start and end of the value | `^\d+$` is digits only |
| `(…)` | group, used as `$1` | `(\d{3}) ?(\d{2})` |
| `(?<name>…)` | named group, used as `$<name>` | `(?<year>\d{4})` |
| `(?:…)` | group that is not captured | `(?:kr\|SEK)` |
| `(?=…)`, `(?!…)` | followed by, not followed by | `\d+(?= kr)` |
| `(?<=…)`, `(?<!…)` | preceded by, not preceded by | `(?<=no )\d+` |
| `\` | makes a special character ordinary | `\.` is a full stop, `\(` a parenthesis |

## Examples

| Task | Pattern | What to do |
|---|---|---|
| Year from a text such as *Folkmängd 2024* | `(?<year>(?:19\|20)\d{2})` | Extract; new column `year` |
| County code in parentheses, *Stockholms län (01)* | `\((\d{2})\)` | Extract; give the name `county_code` |
| Postcode with a space | `^(\d{3}) ?(\d{2})$` | Replace with `$1 $2` |
| Surname and first name from *Berg, Anna* | `, ?` | Split into 2 columns |
| Rows with an e-mail address in free text | `[^\s@]+@[^\s@]+\.[^\s@]+` | Flag matches or Filter rows |
| Mixed date formats | (none) | Pattern profile shows for example `9999-99-99` and `99/99/9999`; then fix with Change type in Process |
| Phone numbers with digits only | `[^\d+]` | Replace with nothing (or the action Remove characters) |

## In SQL and R

The SQL console has the same patterns through Dataspatium's functions:

| Function | Gives |
|---|---|
| `x regexp 'pattern'`, `regexp('pattern', x)` | 1 if x matches, otherwise 0 |
| `regexp_replace(x, 'pattern', 'replacement', 'gi')` | x with the matches replaced (`g` all, `i` ignoring case) |
| `dm_regex_test(x, 'pattern', 'i')` | 1, 0 or empty for an empty value |
| `dm_regex_extract(x, 'pattern', group, '')` | the group (number or name, 0 for the whole match) of the first match |
| `dm_regex_all(x, 'pattern', group, ', ', '')` | the group of every match with a separator |
| `dm_regex_count(x, 'pattern', '')` | the number of matches |
| `dm_regex_split(x, 'pattern', part, parts, '')` | part number `part` of `parts` when x is split at the pattern |
| `dm_shape(x, 0)` | the shape in the pattern profile (1 simplifies repetitions) |

```sql
select kommun, dm_regex_extract(namn, '\((\d{2})\)', 1, '') as county_code
from data
where dm_regex_test(postnr, '^\d{3} ?\d{2}$', '') = 0
```

In R the package stringr is used, whose syntax (ICU) is almost the same: `stringr::str_detect(df$postnr,
stringr::regex("^\\d{3} ?\\d{2}$"))`. The differences to know: in R every `\` is written twice inside a string, a
group in a replacement is written `\\1` instead of `$1` (the recipe export converts it for you), and look-behind must
have a bounded length. `\d` matches every Unicode digit in ICU but only 0–9 in JavaScript.

## Safety and performance

Some patterns can take an extremely long time on some values, for example `(a+)+$` on a long run of a followed by
another character (*catastrophic backtracking*). Patterns are therefore tried in a background thread of their own
with a time limit of two seconds. When the time runs out the thread is stopped, a message is shown and nothing is
changed. Before a step changes a dataset, the pattern is tried on every value of the column in the same way. In
that case make the pattern simpler: avoid nested repetitions such as `(a+)+` and `(\w*)*`, and be as specific as
possible, for example `[^,]*` instead of `.*`.

The preview shows the 500 most common distinct values. The number of matches is counted exactly when the column
has at most 20,000 distinct values, otherwise over the 20,000 most common ones, which is then stated below the
pattern field.

## Limitations

- Replace works on text columns; change the type to text first for other columns.
- A recipe replayed on another dataset tries the pattern on that dataset's values before it runs.
- The R export uses stringr. Unusual syntax, such as look-behind of unbounded length, can give a different result
  in R.
