# Process and the SQL console

Process mode is everything you do with the table through buttons and dialogs: correct cells, clean text, change
types, calculate new columns, pivot, join datasets. Every action is logged as a step in the dataset's recipe, can be
undone and can be replayed on another dataset. The SQL console in Analyse mode works against the same dataset and
logs changes in the same way.

## The table

- Double-click a cell, or select a row and press Enter or F2, to edit. Enter saves, Esc cancels, Tab moves on to the
  next cell. The value is interpreted according to the column's type: if you type text in a number column you get an
  error message and the cell keeps its value. Empty text becomes a missing value.
- The arrow keys move the selection, Page Up/Page Down page through, Home/End jump to the first or last row.
- Click a column header to sort (ascending, descending, unsorted). The properties panel on the right then shows
  column statistics (count, missing, distinct, minimum, maximum, mean, sum, most common values) and the actions
  that suit the column's type. Shift-click shows the statistics without changing the sort.
- The filter field searches all columns. Editing works in a filtered selection too.
- *List* in the toolbar (shown when the dataset has saved searches from Search) narrows the table to the list's
  rows; the badge shows the count of the total. Editing and actions work as usual.
- The table is virtualised: only the visible rows exist in the browser's DOM, the rest stays in SQLite. A million
  rows browse as fast as a hundred.

## Actions

The **Actions** button opens the palette. Each action has a dialog with fields generated from the action's
parameters, and where possible a preview shows how many rows are affected and examples before and after.

| Group | Action | What it does |
|---|---|---|
| Columns | Rename column | New column name; the label follows if it was equal to the name |
| | Label, description and unit | The label is the display name in table headers and charts; description and unit are shown in the inspector and the codebook, travel with the SQLite file and reach R as the attributes `description` and `unit` |
| | Value labels | Names for the column's codes, one per line `code = label` (for example `1 = Man`); the values are not changed. The labels are shown in the inspector (also next to the most common values) and the codebook, reach R as `haven::labelled` and are written to .sav and .dta. Empty text removes them |
| | Delete columns | Removes the chosen columns |
| | Reorder columns | Move columns up and down |
| | Change type | Text to integer, decimal number, date, date and time or yes/no. Decimal separator and date format can be given; values that cannot be interpreted become empty and the count is reported |
| | Copy column | A copy with a new name, for example before the original is changed |
| | Clean column names | All names become lower-case letters, digits and underscores (`Folkmängd 2024` becomes `folkmangd_2024`), easy to type in SQL and R; the labels keep the original names |
| Values | Find and replace | Text or regular expression in chosen text columns, with preview |
| | Trim whitespace | Leading, trailing and (optionally) double spaces |
| | Change case | UPPER CASE, lower case or Title Case |
| | Repair character encoding | Fixes mojibake (Ã¶ becomes ö) that arose at import with the wrong encoding |
| | Replace value | One exact value for another; an empty value can be chosen as from or to |
| | Recode values | Several values at once from a list with one line per value, `old = new` (for example `01 = Stockholms län`); other values are kept or emptied |
| | Swap codes for labels | Replaces the column's codes with their value labels, or back again. The labels are kept, so .sav and .dta get the codes back on export; values without a label are left as they are, and back to codes the column becomes numbers if all codes are numbers |
| | Fill missing values | Constant value, the previous or next row's value, mean, median or most common value |
| | Round numbers | To a chosen number of decimals: to nearest (a half rounds away from zero), down, up or by dropping the decimals; a negative number rounds to tens (−1), hundreds (−2) and so on |
| | Pad with leading zeros | To a given length, for example the municipality code 114 to 0114; numbers become text so that the zeros are kept |
| | Remove characters | Keep only digits (phone and organisation numbers), keep only letters and spaces, remove punctuation and symbols, or remove all spaces |
| Rows | Delete rows | SQL condition, for example `befolkning < 1000`; choose Keep to keep only the matching rows instead |
| | Remove duplicates | On chosen columns or the whole row; the first occurrence is kept |
| | Remove empty rows and columns | Rows where every value is missing and, if you like, columns without any values |
| | Sort rows | Changes the order of the rows permanently, ascending or descending on one column, so that exports and documents get the same order; empty values go last |
| | Keep the top rows | The rows with the largest or smallest value, in total or per group (for example the three largest municipalities in each county) |
| | Random sample | A number of rows or a percentage; the same seed always gives the same sample so that the recipe can be replayed |
| Structure | New calculated column | SQL expression, for example `round(befolkning / 1000.0, 1)` or `case when andel > 5 then 'stor' else 'liten' end` |
| | Combine columns | Several columns into one text column with a separator |
| | Split column | One text column into several at a delimiter |
| | Extract part of text | A new column with a number of characters counted from the start or the end of the text, from a chosen position (the county code is the first two characters of the municipality code) |
| | Pivot to long format | Chosen columns become rows with name and value |
| | Pivot to wide format | The values in a name column become new columns |
| | SQL statement | Any UPDATE, DELETE or ALTER TABLE against the table `data` |
| Calculations | Share of total | Each value's share of the total as a percentage or a ratio, in total or per group (the municipality's share of the county's population) |
| | Rank | Place in the order, largest or smallest first, in total or per group; equal values get the same place (with or without a gap after) or consecutive places |
| | Running total | The cumulative sum in the order given by another column, in total or per group |
| | Change from previous | The difference or the percentage change from the previous row in the order given by another column, for example from the previous year per municipality |
| | Group into classes | Numbers into classes with your own lower limits (`0, 18, 65` gives `0–17`, `18–64` and `65–`), a number of equally wide classes or groups with equally many rows (quantiles) |
| | Standardise | z-scores (the distance from the mean in standard deviations, sample standard deviation) or the values scaled to 0–1 |
| | Extract date part | Year, quarter, month, ISO week, weekday (1 = Monday), day, day of year, year and month (`2024-03`) or hour from a date |
| | Time between dates | Number of whole days, weeks, months or years between two dates, for example age; without an end date it counts to today's date when the step runs |
| Regular expressions | Filter with a pattern | Keeps or removes rows depending on whether a column matches a regular expression |
| | Extract with a pattern | New columns from the pattern's groups or from the whole match, for example the year in a text |
| | Flag matches | A yes/no column that shows whether the value matches |
| | Count matches | A column with the number of matches in each value |
| | Split with a pattern | Splits a column into several where the pattern matches; the last part gets the rest of the text |
| New datasets | Group and aggregate | Sum, mean, minimum, maximum, count, distinct count or median per group, into a new dataset |
| | Join datasets | Left or inner join with another dataset on a key |
| | Append datasets | Stacks rows from several datasets; columns are matched by name |
| | Clean categories | Finds spelling variants of the same value (case, whitespace, accents) and merges them |

Actions that create a new dataset leave the original untouched and select the new dataset when done.
The calculations add a new column and leave the existing ones untouched; they build on SQL window functions and are
exported to R as dplyr code with `group_by()` and `mutate()`.
The actions with regular expressions are easiest to try in the Regex tab in Analyse, where the matches show as the
pattern is typed; the pattern library and the pattern profile are there too (see [regex.md](regex.md)). The same
JavaScript syntax applies in *Find and replace*, where `(?i)` at the start of the pattern or the choice *Ignore case*
makes the search case-insensitive.

## Undo

The **Undo** button takes back the latest step, up to ten steps back within the same session. Cell edits are undone
by writing back the old value; other actions by restoring a snapshot of the dataset. For very large datasets the
snapshot takes a while and at most 80 MB of snapshots are kept in memory. Undo after reloading the page is done with
versions.

## Data quality

The **Data quality** button profiles the dataset: number of rows and duplicates, and per column missing values,
distinct values, range and findings. The findings point at an action that fixes them in one click:

- whitespace at the start or end, double spaces: Trim whitespace
- empty texts that are not missing values: Replace value (empty to missing)
- numbers or dates stored as text: Change type
- probable encoding damage: Repair character encoding
- values that differ only in case: Change case
- values that look like personal identity numbers: Pseudonymise
- column with the same value on every row (information)

## Rules

The **Rules** button opens the dataset's quality rules: what must hold for the data to be correct. The rule types are:

| Rule type | Broken by |
|---|---|
| Must not be missing | Missing values |
| Unique | Values (or combinations of several columns) that occur more than once |
| Within range | Numbers, dates or text outside the limits |
| In list | Values that are not in the list |
| No forbidden values | Values that are in the list, for example `unknown` or `-99` |
| Matches pattern | Text that does not match the regular expression |
| Has a format | Text that is not an e-mail address, a web address, an ISO date, a postcode (Swedish, Danish, Norwegian, Finnish or Icelandic) or a Swedish municipality or county code |
| Text length | Text that is shorter or longer than the limits |
| No surplus spaces | Text with spaces at the start or end, or double spaces |
| Can be read as a type | Text that cannot be read as an integer, decimal number, date, date and time or yes/no |
| Valid identity number | Numbers with the wrong form, an invalid date or a wrong check digit, see below |
| Compare two columns | Rows where the condition between two columns does not hold, for example that the start date is less than or equal to the end date |
| Found in another dataset | Values missing from a column in another dataset (referential integrity, like a foreign key) |
| Share of filled-in values | The column as a whole, when the share of filled-in values is below the threshold (for example 95 %) |
| No outliers | Numbers further from the quartiles than a chosen number of interquartile ranges (default 1.5), or further from the mean than a chosen number of standard deviations (default 3) |
| SQL condition | Rows where the free SQL condition is not true |

The identity numbers are checked like this: Swedish personal identity number and coordination number (10 or 12
digits, valid date, day plus 60 for coordination numbers, check digit by Luhn), Swedish organisation number (third
digit at least 2, Luhn), Norwegian fødselsnummer and D-number (both check digits by modulus 11), Danish CPR number
(valid date; modulus 11 is not checked because it has not applied to all numbers since 2007), Finnish personal
identity code (century sign and check character) and Icelandic kennitala (check digit by modulus 11, valid date,
century digit). The check only says that the number can exist, not that it belongs to anyone.

**Suggest rules** adds rules from the data quality profile: columns without missing values, unique columns and codes
of fixed length. Columns whose names contain personnummer, organisationsnummer, CPR, fødselsnummer, henkilötunnus or
kennitala get a rule for the kind of identity number that at least half of the values pass, columns with postnummer
in the name a rule for the postcode format most values follow, and columns with e-mail (or e-post) in the name a rule
for e-mail addresses.

**Run rules** counts the rows that break each rule, shows the share and some examples, and logs the run in the
dataset's history. For a broken rule the failing rows can be saved as a dataset of their own, and the whole result
can be downloaded as an HTML report. The rules are stored in the dataset's metadata and therefore travel with
backups, bundles and the portable folder.

## Pseudonymise

The action **Pseudonymise** (group Values, also in the column menu and the command palette) replaces identifiers
such as personal identity numbers or customer numbers before sharing. Three methods:

- **Hash**: SHA-256 of a salt and the value, shortened to any length (default 16 characters). The same value gives
  the same hash, so joins between tables survive if the same salt is used. The salt is a secret text that you
  choose; it is never stored in the log or the recipe (there it reads `***`), and a recipe with such a step cannot
  be replayed without giving the salt again.
- **Mask characters**: keeps any number of characters at the start and end plus separators, and replaces the rest
  with `*` (`19800101-1234` becomes `198001**-****` with six characters at the start).
- **Running number**: each distinct value gets a running number with a prefix in sorted order (`P0001`, `P0002`).

Hashing with a salt is pseudonymisation, not anonymisation: whoever knows the salt can test candidates, and
combinations of other columns may still single out persons. Remove or coarsen other sensitive columns, and never
share the salt together with the data. The recipe export to SQL uses Dataspatium's functions `dm_hash` and
`dm_mask`; the export to R uses the package digest for hashes.

## Geodata

The action group *Geodata* works with geometry columns (GeoJSON or WKT as text, in longitude/latitude or
SWEREF 99 TM) and coordinate columns:

- **Centroid from geometry** adds longitude and latitude (WGS 84) for the centre of each area or line, for example to
  draw municipalities as bubbles in a point map.
- **Area from geometry** adds the area in square kilometres (planar for SWEREF 99 TM, on the globe for
  longitude/latitude; holes are subtracted).
- **Reproject coordinates** converts two columns between SWEREF 99 TM (east, north) and WGS 84 (longitude,
  latitude) into new columns, with Lantmäteriet's formulas.
- **Municipality and county from coordinates** looks up which Swedish municipality and county each point lies in
  with SCB's bundled boundaries and adds `kommunkod`, `kommun`, `lanskod` and `lan` (or only the county).
  Coordinates in SWEREF 99 TM are recognised. The boundaries are SCB's simplified land boundaries for thematic maps:
  points in lakes, the sea or outside Sweden become empty, and points very close to a boundary may end up in the
  neighbouring municipality.

All four are recipe steps that can be undone and replayed. In the SQL export they appear as calls to Dataspatium's
functions (`dm_geo_lon`, `dm_geo_area`, `dm_to_lon`, `dm_region` and others); the R export gives corresponding code
with the package sf.

## Versions

The **Versions** button (also in Manage) saves a snapshot of the dataset with a description. A version can be
compared with the current state (number of rows, added, removed and retyped columns), restored or deleted. Versions
are stored in the browser's database and come along in the workspace backup. Save a version before larger changes.

## Recipe

The **Recipe** button shows all steps done with the dataset, in order. From here you can:

- copy the recipe as R code (`dm_read()` with the short name, dplyr/tidyr/stringr calls, `dm_write()`) or as SQL
  against the table `data`,
- download the recipe as JSON to share with others,
- run the same steps on another dataset in the workspace,
- run a recipe from a JSON file on the selected dataset.

Replay stops at the first step that fails (for example a column that does not exist) and tells how many steps were
performed. The recipe file has the form

```json
{ "app": "Dataspatium", "kind": "recipe", "version": "0.3.0", "name": "Cleaning municipalities",
  "steps": [ { "op": "trim", "params": { "columns": ["kommun"], "squish": true }, "description": "Trim kommun" } ] }
```

## Code steps

The **Code** group in the palette has two actions that run a function on the whole table: **Python step**
(`def step(df):` with pandas, see [python.md](python.md)) and **R step** (`function(df) { ... }`, see
[r-guide.md](r-guide.md)). What the function returns becomes the new table, with types from the result; labels and
units follow columns that keep their name. *Preview* runs the function on the first 200 rows and shows the columns
and a few rows. The step is logged in the recipe with its code, can be undone and replayed on other datasets; in the
SQL export the code is a comment, in the R export the R step runs as code and the Python step is a comment. Python
is fetched the first time.

## Documents and images

Datasets of the kinds documents and images open in Process in a view of their own (a reading view and a gallery) with
the button *Show as table* for the ordinary table. Every action here applies to the table: filter paragraphs, correct
text, remove rows, add computed columns. See [dokument.md](dokument.md).

## The SQL console

Every dataset has a **short name** (shown below the name in the object panel and under Manage, where it can be changed
together with the name): lower-case letters a–z, digits and underscores, at most 20 characters and preferably at most
15, never a reserved word in SQL or R. The suggestion is formed from the name without filler words and with a year as
suffix: *Population per municipality 2024* becomes `population_2024`. The short names of the bundled example data are
fixed in every language (`befolkning_2024`, `kommungranser`, `lansgranser`), so shared charts and recipes find them.
In the SQL console the selected dataset is called `data` but is also reached by its short name, and other datasets
are reached by their short names, so that one query can join several datasets:

```sql
select k.kommun, k.lan, b.folkmangd
from befolkning_2024 b
join kommungranser k on k.kommunkod = b.kommunkod
order by b.folkmangd desc
```

Other datasets are read-only in the query; UPDATE, DELETE and ALTER apply to the selected dataset but may read the
others (for example `update data set lan = (select lan from kommungranser k where k.kommunkod = data.kommunkod)`).
At most nine other datasets can take part in the same query. The result can be saved as a new dataset. The short
names also work in R (`dm_read("shortname")`; the button *Insert dm_read()*, the R examples, new notebooks and the
recipes' R export use the short name) and are used when charts and notebooks are linked to datasets at import.

The SQL console is in Analyse mode under the SQL tab and works against the selected dataset, whose table is called
`data`. Ctrl+Enter runs the whole script, selected text runs on its own.

- `SELECT`, `WITH`, `VALUES`, `PRAGMA` and `EXPLAIN` show the result in a table (the first 5,000 rows).
  **Save the result as a dataset** creates a new dataset from the whole result, without a row limit.
- `UPDATE`, `DELETE`, `ALTER TABLE` and other statements change the dataset, are logged as the recipe step SQL
  statement and can be undone in Process.
- The properties panel lists the dataset's columns (a click inserts the name), the short names of all datasets and
  the extra SQL functions Dataspatium adds: `regexp`, `regexp_replace`, `dm_parse_number`, `dm_parse_date`,
  `dm_fix_encoding`, `dm_upper`, `dm_lower`, `dm_title`, `dm_squish`, `dm_round`, `dm_pad`, `dm_date_part`, `dm_date_diff` and
  `dm_valid_id` (for example `select * from data where dm_valid_id(personnummer, 'se_pnr') = 0`), and the regex
  functions `dm_regex_test`, `dm_regex_extract`, `dm_regex_all`, `dm_regex_count`, `dm_regex_split` and `dm_shape`
  described in [regex.md](regex.md).
- SQL scripts are saved in the object panel in the same way as R scripts.

The SQLite dialect applies: `||` for text concatenation, `cast(x as integer)`, `strftime()` for dates,
`group_concat()`, window functions such as `row_number() over (partition by …)`.

## Limitations

- Undo applies within the session; use versions to go back after reloading.
- Actions that rebuild a column (Change type, Split column, pivoting) export the dataset for undo first. On datasets
  above a few hundred MB that takes noticeable time.
- The recipes' R export covers the built-in actions; free SQL is exported as a comment since it cannot be translated
  to R automatically.
