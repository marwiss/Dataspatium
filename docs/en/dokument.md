# Documents and images

Dataspatium reads documents as **document collections** and pictures as **image collections**. A document collection
opens as a reading view and an image collection as a gallery. Underneath, both are datasets of their own kinds, with
one paragraph or one picture per row and the files themselves in the dataset, so everything that applies to tables
applies here too: filters, Search, rules, recipes, SQL, R and Python, export, bundles and sharing. On top of that come
the tools **Text** and **Images** in Analyse, which work without code.

## Document collections

| Format | Recognised by | Paragraphs | Headings | Pages |
|---|---|---|---|---|
| PDF | .pdf | Text lines are joined into paragraphs by line spacing | Lines set in a clearly larger font than the page's text | Real pages |
| Word | .docx | Paragraphs and table rows | Paragraph styles named Heading, Rubrik, Title | Page breaks and Word's saved page breaks |
| OpenDocument | .odt | Paragraphs, lists and table rows | `text:h` elements | Soft page breaks |
| Markdown | .md, .markdown | Blocks separated by a blank line; bullet lists on one line | Lines starting with `#` | Everything is page 1 |
| Text | .txt (choose the format *Documents*) | Blocks separated by a blank line | None | Everything is page 1 |

Every document collection has the columns `dokument` (file name), `sida` (page), `stycke` (running number
in the document), `typ` (`rubrik`, `stycke` or `tabell`), `text` and `tecken` (characters). Rows from tables get
their cells separated by ` | `. The original files are stored in the dataset, so that PDF pages can be shown and the
files downloaded again; they count towards the dataset's size under Manage.

PDF files are read with pdf.js in a background thread, so the app stays responsive while a long report is read;
200 pages take about a second. Scanned PDF files without a text layer give no paragraphs (text recognition comes in a
later version).

### Importing

Drop one or several files in Import. Several documents at once become **one** dataset with all paragraphs, and the
settings step shows the file list, the name and a progress bar file by file (page by page in PDF). A single Word or
Markdown document is also read as a document; if you want the tables in it instead, choose the format *Tables in
documents*. A text file is read as CSV until you choose *Documents*. The column step is skipped because the columns
are given. Documents can also be fetched from a web address (Import > Web address) in the same way.

## The document view in Process

A document collection opens in Process as a reading view, and from Manage with the button *Read*; the overview tab
there lists the documents, and a click on one opens that document. Choose a document and a view: *Page by page*,
*Whole document* (continuous text with page markers, drawn in chunks so that even a long report opens at once) or,
for PDF, *Page as image*. Headings are shown as headings and table rows in a fixed-width font. Click a paragraph and
the inspector shows page, number, type and character count with a button to copy the text; at the top of the
inspector are the document's title, author, pages, paragraphs and words, with the button *Download the original*.

The search field searches the whole collection and lists the hits with context (keywords in context); click a hit to
jump to its page. *Show as table* gives the ordinary table with every action in Process, and *Show as document*
takes you back. The dataset itself is always the table: what you do in the table (filter, correct, remove rows) shows
in the reading view too.

## The Text tool in Analyse

When a document collection is selected, Analyse gets the tab **Text** (after Regex, before the Notebook) with four
tools. Every result can be saved as a new dataset with *Create dataset*, and one document can be chosen instead of
the whole collection.

| Tool | What it does | Settings |
|---|---|---|
| Overview | Pages, paragraphs, headings, table rows, words, characters, distinct words and lexical variety (type/token ratio) per document | |
| Word frequency | The most common words with count, share and number of documents | Stopword language (Swedish, Danish, Norwegian, Finnish, Icelandic, English), own stopwords, minimum word length, count numbers, how many to show |
| Keywords in context | Every occurrence of a word or expression with the text before and after, document and page | Whole words, match case, regular expression |
| Co-occurrences | Word pairs that occur together in the same paragraph or within a few words of each other | Window, stopwords, minimum word length |

Words are runs of letters and digits, with hyphens and apostrophes inside (`e-mail`, `don't`), and are counted in
lower case. The stopword lists are short lists of function words; switch them off to count every word. The same
texts can be analysed further in R and Python: `dm_read("name")` gives the paragraph table as a data.frame or a
DataFrame.

## Image collections

Pictures (JPEG, PNG, WebP, GIF, BMP and AVIF where the browser can read them) become an image collection
with one row per picture: `fil`, `typ`, `storlek` (bytes), `bredd`, `hojd`, `datum`, `kamera`, `lon`, `lat`,
`altitud` and `beskrivning`. Date, camera, position and description are read from EXIF in JPEG files; other formats
only get dimensions and size. A preview (long side at most 1600 px) and a thumbnail (320 px) are stored in the
dataset; the originals are not, so that a collection of hundreds of pictures stays manageable in the browser. Drop
all the pictures at once in Import and they become one collection.

The positions can be drawn on the map chart in Visualise (lon and lat as coordinates), and the dates work like any
other dates in filters, Query and charts.

## The gallery in Process

An image collection opens in Process as a gallery with thumbnails, a filter and a sort order (file name, date, size),
and from Manage with the button *Show pictures*; the overview tab there shows the first thumbnails, and a click on one
opens it in the gallery. Click a picture and the inspector shows a larger preview, type, size, dimensions, date,
camera, position and altitude, and the description, which can be edited and saved: the change is logged as a recipe
step like every other cell edit and can be undone. Double-click to see the picture large, or download the preview to
your computer. *Show as table* gives the table with every action.

## The Images tool in Analyse

When an image collection is selected, Analyse gets the tab **Images** with two tools:

- **Overview**: count, size, pixels, how many pictures have a date, a camera and a position, the period, and a
  breakdown by type, camera, year or month that can be saved as a dataset.
- **Duplicates**: every thumbnail is reduced to a greyscale image of 8 × 8 cells; cells brighter than the mean become
  ones and give a hash of 64 bits. Pictures whose hashes differ in at most the chosen number of bits are grouped:
  0 bits gives only exact copies, 5 bits ordinary duplicates (another size, another compression), 12 bits also cropped
  or colour-adjusted variants with more false hits. The groups are shown with thumbnails and can be saved as a dataset
  with file, group, distance and hash.

## Pictures in document templates

In document templates (Export > Documents) the tag `{{bild "file.jpg" | bredd: 400}}` inserts a picture from an
image collection. The picture is looked for first in the template's dataset and then in every image collection; the
preview is used and scaled to the given width (`bredd`, default at most 720 px; `hojd` can be given too). The tag
works in Word, PDF, HTML, Markdown and LaTeX like `{{diagram}}`, also in batch runs.

## Sharing and exporting

Document and image collections are ordinary datasets: they are part of bundles, can be put on GitHub and sent to
another device with the files intact. The review before sharing applies to the table (the text in `text`,
descriptions) as for other datasets. Export to CSV, Excel and the other table formats gives the paragraph or picture
table without the files; Dataspatium's SQLite file and the bundles carry the files.

## Limitations

- Scanned PDF files without a text layer give no paragraphs.
- Page numbers in Word and OpenDocument follow the page breaks in the file and can differ from what a word processor
  shows.
- EXIF is read only from JPEG. HEIC pictures from phones must be converted first, since the browser cannot decode
  them.
- Very large collections (thousands of pictures or tens of thousands of pages) take time to read and room in the
  browser's storage; split them into several datasets.
