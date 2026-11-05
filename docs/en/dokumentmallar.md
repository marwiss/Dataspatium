# Documents and document templates

Under **Export › Documents** you create documents from a dataset: reports, codebooks and summaries per group. A
template is plain text in Markdown with placeholders. The same template gives HTML, Word (DOCX), PDF, Markdown and
LaTeX, and can be run in batch so that each municipality, year or other group gets its own document.

The placeholders and table keywords are Swedish words (`{{datamangd}}`, `kolumner`, `sortera`, …). They are part
of the template language and are the same whatever language the app is shown in; the built-in templates' texts
follow the app's language.

## How to do it

1. Choose a dataset in the object panel and open the **Documents** tab in Export.
2. Choose a template: **Report on a dataset**, **Codebook** or **Summary per group**, or a saved template of your own.
   The template is shown on the left and the preview on the right updates as you type.
3. Choose a format and press **Create document**. The file is downloaded.
4. **Batch per group** creates one document per value in a column and packs them into a ZIP file with a manifest.
5. **Save template** saves your changes in the workspace (built-in templates are saved as copies). **Export template
   (file)** gives a `*.doc.json` that a colleague can add with **Import template (file)**. Your own templates come
   along in the workspace backup.

## The template language

The template is Markdown: `#`, `##`, `###` for headings, empty lines between paragraphs, `-` for bullet lists, `1.` for
numbered lists, `**bold**`, `*italic*`, `` `code` ``, `[text](https://…)` for links, `---` for a line and tables
with pipes.

Placeholders are written with double curly braces (Mustache). Numbers get the format of the app's language (in
English 1,234.5; in Swedish 1 234,5).

| Placeholder | Content |
|---|---|
| `{{datamangd}}`, `{{beskrivning}}`, `{{kalla}}` | The dataset's name, description and source |
| `{{antal_rader}}`, `{{antal_kolumner}}` | Number of rows (after filters) and columns |
| `{{datum}}`, `{{tid}}`, `{{app}}` | Today's date, the time and the app version |
| `{{summor.kolumn}}`, `{{medel.kolumn}}`, `{{minsta.kolumn}}`, `{{storsta.kolumn}}` | Sum, mean, minimum and maximum of a number column (replace `kolumn` with the column name) |
| `{{grupp}}`, `{{gruppkolumn}}` | The group's value and column name in batch runs |
| `{{#rader}} … {{/rader}}` | Repeated for each row (at most 1,000); inside, the column names are used, for example `{{kommun}}` |
| `{{#kolumner}} … {{/kolumner}}` | Repeated for each column with `{{namn}}`, `{{typ}}`, `{{etikett}}`, `{{beskrivning}}`, `{{enhet}}` and `{{vardeetiketter}}` (for example `1 = Man; 2 = Woman`; the last three are empty unless set under Process) |
| `{{#beskrivning}} … {{/beskrivning}}` | Shown only if the value exists (Mustache section) |

Column names are written as in the table (cleaned names, for example `folkmangd`).

### Tables from the dataset

```
{{#tabell}}kolumner: kommun, folkmangd; sortera: folkmangd fallande; topp: 10; filter: lan = Skåne län; rubrik: The largest municipalities{{/tabell}}
```

All parts are optional: without `kolumner` all columns are included, without `topp` 50 rows are shown (at most
5,000), `sortera` takes `stigande` (ascending) or `fallande` (descending), `filter` takes conditions with `=`, `!=`,
`>`, `>=`, `<`, `<=` or `innehåller` (contains) that can be combined with `och` or `and`, and `rubrik` is the table's
caption. `kalla: kolumner` instead gives a table of the dataset's columns (name, type, label, description and unit, and value labels when a column has them).
Number columns are right-aligned.

### Charts

```
{{diagram "Population per county" | bredd: 600}}
```

Inserts a saved chart from Visualise (Vega-Lite or D3) as an image, rendered with the same filters as the document;
`bredd` is the width in pixels. In batch runs the chart is filtered on the group. R and Python charts are drawn by their engines when the document is created (a few seconds per chart).

### Page break and codebook

`{{bild "file.jpg" | bredd: 400}}` inserts a picture from an image collection (see [dokument.md](dokument.md)): the
picture is looked for first in the template's dataset and then in every image collection, the preview is used and
scaled to the given width (default at most 720 px; `hojd` can be given too). The tag works in every format and in
batch runs like `{{diagram}}`.
`{{sidbrytning}}` breaks the page in Word, PDF and LaTeX. The **Codebook** template uses extended column details:
`{{saknade}}`, `{{unika}}`, `{{minsta}}`, `{{storsta}}`, `{{medel}}`, `{{anmarkningar}}` and `{{ar_unik}}` per column
and `{{dubbletter}}`; they exist when the template is marked as a codebook (a copy of the built-in template keeps
that).

`{{karta "dataset"}}`, `{{graf "dataset"}}`, `{{modell "dataset"}}` and `{{plan "dataset"}}` insert the dataset's own picture without a saved chart. The dataset is given by name or short name, and width and height as for `{{diagram}}`. A template says so if the dataset is missing or cannot be drawn that way.

## Formats

| Format | What you get |
|---|---|
| HTML | A standalone page with built-in style and embedded images, opens in any browser and can be printed |
| Word (DOCX) | Headings, paragraphs, lists, tables with header row and images; font Arial; opens in Word and LibreOffice |
| PDF | A4 with page numbers, tables through jsPDF and jspdf-autotable; font Helvetica |
| Markdown | `.md`; with images a ZIP with `figures/` |
| LaTeX | ZIP with `main.tex` (article, booktabs, longtable, graphicx, hyperref, babel in the app's language) and `figures/`; compiled with pdflatex, xelatex or lualatex, or uploaded to Overleaf |

Text is always escaped for the target format: `&`, `<` and `>` in HTML, `&`, `%`, `_` and others in LaTeX, XML in DOCX.

## Limitations

- Templates are rendered in the browser; very large tables in documents take time, especially in PDF and Word.
- PDF and Word use standard fonts (Helvetica and Arial) instead of the app's Inter.
- The Markdown support is a selection: no footnotes, no nested lists, no headings below level four.
- LaTeX is not compiled in the browser.
