# Search

The Search mode finds and lists without code. It sits between Manage and Process: first you find what you are
looking for, then you process it. Two tabs exist from 2.0, Search and Lists; the Query tab, a visual query builder
that shows the SQL it creates, comes in 2.2.

## Search

Type a word or a phrase in the search field, choose whether to search all datasets or only the selected one, and
press Search (or Enter). All columns are searched, whatever their type, and every word must occur somewhere on the
row. Case does not matter, nor for å, ä and ö. Characters that otherwise have a special meaning in patterns (dot,
parentheses, asterisk) here mean only themselves; for pattern search there is the Regex tab in Analyse.

Hits are shown per dataset with counts. Each card has:

- **Facets**: for columns with few distinct values among the hits, the most common values are shown with counts.
  Click a value to narrow the search to it; the active restrictions are shown as labelled buttons and are removed
  with a click. Columns where every hit has its own value (names, identifiers) are not shown as facets, since they
  do not narrow anything.
- **A table** with the first hundred hits. Click a row to see the whole record in the inspector on the right, with
  the row number and the button *Open in Process*.
- **Save as list** saves the search (text and restrictions) for that dataset under the Lists tab.
- **Save as dataset** turns the hits into a new dataset with the same columns and types.
- **Open in Process** selects the dataset and switches mode.

The search runs in SQLite in a worker, so the page does not lock up. In a dataset of a million rows a search takes
about a second per word.

## Lists

A list is a saved search in a dataset: the text, the restrictions and the number of hits the last time it was run.
*Run* shows today's hits in the Search tab (the data may have changed since the list was saved), *Save as dataset*
turns the hits into a new dataset and *Delete* removes the list. Lists follow the dataset: if the dataset is
deleted, its lists disappear.

## The command palette

Ctrl+K finds objects and commands as before. The command *Search in data* opens Search with the search field in
focus.

## Keyboard

Enter in the search field searches. The facet buttons and the table rows are reached with Tab; a row opens in the
inspector with Enter.
