# Search

The Search mode finds and lists without code. It sits between Manage and Process: first you find what you are
looking for, then you process it. Three tabs: *Search* (free text with facets), *Query* (a visual query builder over
one or several datasets that shows the SQL it creates) and *Lists* (saved searches and queries).

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

**Open the hit** where it is. The button in the inspector takes you to the right page of a document, the right picture in a collection, the node with its neighbours in a graph, the element in a model, the object on a plan, the place on the map or the row in a table.

**Search by place.** Under *Search by place* you choose a municipality or region, or a point and a distance. You can search without words, and then everything in that place is shown. Only datasets with places take part. An area counts by its middle, so this is not an exact overlay. Exact overlays are done under Geo in Analyse.

**Side tables take part.** A word on an edge in a graph finds the nodes at both ends, and a value in an IFC property finds the element. This also applies to saved lists and selections.

## Query

The Query tab builds a query without you writing SQL, and shows the SQL it creates. The **Datasets** card chooses the
dataset to query and joins more with *Add join*: pick the dataset, whether only rows with a match in both or all
rows of the first should be included, and which columns must match (more keys can be added; joined datasets need
short names). **Columns** chooses what is shown, as a value or as a calculation (count, distinct count, sum, mean,
minimum, maximum) with an optional name in the result; when there is a calculation the rows are grouped by the other
columns automatically. **Conditions** are added in groups where all conditions must hold or one is enough (is, is
not, greater than, at least, less than, at most, contains, starts with, is one of, is between, is empty, is not
empty), and **Sorting and count** finish the query. *Run the query* shows the result as a table with the generated
SQL below; *Open in Analyse* puts the SQL in the SQL console, where it can be changed further. In the SQL the first
dataset is called `t0` and the joined ones `t1`, `t2` and so on.

*Save as list* saves the query under Lists, where it runs again on today's data, and *Save as dataset* turns the
result into a new dataset with the result's columns.

## Lists

A list is a saved search in a dataset: the text, the restrictions and the number of hits the last time it was run.
*Run* shows today's hits in the Search tab (the data may have changed since the list was saved), *Save as dataset*
turns the hits into a new dataset and *Delete* removes the list. Lists follow the dataset: if the dataset is
deleted, its lists disappear.

Lists are used elsewhere too. In Process, *List* in the table's toolbar picks a saved search that narrows the table
(the badge shows rows of the total), and in the chart builder *List* below the filters picks the rows a chart is
built on; the choice travels with the chart into dashboards and exports and runs again on today's data. Queries
saved from the Query tab are shown with their SQL under Lists and run in Query.

## The command palette

Ctrl+K finds objects and commands as before. The command *Search in data* opens Search with the search field in
focus.

## Keyboard

Enter in the search field searches. The facet buttons and the table rows are reached with Tab; a row opens in the
inspector with Enter.
