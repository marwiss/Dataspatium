# Dataspatium R helpers, sourced into every R session. User documentation (Swedish): docs/sv/r-guide.md.
#
# Datasets are exchanged with the app as SQLite files in /data (see docs/sv/format.md for the schema):
#   dm_list()            datasets available in this session
#   dm_read("Namn")      read a dataset as a data.frame with restored types
#   dm_write(df, "Namn") hand a data.frame back to the app as a new dataset
#   theme_dataspatium()     ggplot2 theme and palette shared with the rest of the app
# Code comments are in English; messages shown to the user follow the app's language (dm_setup(lang)).

.dataspatium <- new.env(parent = emptyenv())
.dataspatium$data_dir <- "/data"
.dataspatium$out_dir <- "/data/out"
.dataspatium$plots <- list()
.dataspatium$palette <- c("#0072B2", "#E69F00", "#009E73", "#D55E00", "#56B4E9", "#CC79A7", "#F0E442", "#7F7F7F")
.dataspatium$lang <- "sv"

# ---- user-facing messages in the six UI languages (sv is the fallback) -------------------------

.dataspatium$messages <- list(
  sv = c(
    list.empty = "Inga datamängder är tillgängliga i R-sessionen ännu. Importera i läget Inhämta.",
    find.none = "Inga datamängder finns i R-sessionen. Kör dm_list() för att se vad som finns.",
    find.many = "Flera datamängder matchar \"%s\": %s",
    find.missing = "Hittar ingen datamängd som heter \"%s\". Kör dm_list() för att se vad som finns.",
    read.notmirrored = "Datamängden \"%s\" är inte speglad till R ännu. Prova igen om en stund.",
    write.df = "dm_write() behöver en data.frame.",
    write.nocols = "Datamängden saknar kolumner.",
    write.sent = "Datamängden \"%s\" skickas till appen (%d rader, %d kolumner).",
    write.log = "Skapad med dm_write() i R",
    plot.gone = "Diagrammet finns inte längre i R-sessionen.",
    labels.named = "Värdeetiketterna ska vara en namngiven vektor, till exempel c(\"Man\" = 1, \"Kvinna\" = 2).",
    step.nofunction = "Koden måste vara en funktion: function(df) { ... }.",
    step.notframe = "Funktionen måste returnera en data.frame."
  ),
  da = c(
    list.empty = "Ingen datasæt er tilgængelige i R-sessionen endnu. Importér under Hent.",
    find.none = "Der findes ingen datasæt i R-sessionen. Kør dm_list() for at se, hvad der findes.",
    find.many = "Flere datasæt matcher \"%s\": %s",
    find.missing = "Kan ikke finde et datasæt med navnet \"%s\". Kør dm_list() for at se, hvad der findes.",
    read.notmirrored = "Datasættet \"%s\" er ikke spejlet til R endnu. Prøv igen om et øjeblik.",
    write.df = "dm_write() kræver en data.frame.",
    write.nocols = "Datasættet har ingen kolonner.",
    write.sent = "Datasættet \"%s\" sendes til appen (%d rækker, %d kolonner).",
    write.log = "Oprettet med dm_write() i R",
    plot.gone = "Diagrammet findes ikke længere i R-sessionen.",
    labels.named = "Værdietiketterne skal være en navngivet vektor, for eksempel c(\"Mand\" = 1, \"Kvinde\" = 2).",
    step.nofunction = "Koden skal være en funktion: function(df) { ... }.",
    step.notframe = "Funktionen skal returnere en data.frame."
  ),
  nb = c(
    list.empty = "Ingen datasett er tilgjengelige i R-sesjonen ennå. Importer under Hent.",
    find.none = "Det finnes ingen datasett i R-sesjonen. Kjør dm_list() for å se hva som finnes.",
    find.many = "Flere datasett matcher \"%s\": %s",
    find.missing = "Finner ikke noe datasett som heter \"%s\". Kjør dm_list() for å se hva som finnes.",
    read.notmirrored = "Datasettet \"%s\" er ikke speilet til R ennå. Prøv igjen om et øyeblikk.",
    write.df = "dm_write() krever en data.frame.",
    write.nocols = "Datasettet har ingen kolonner.",
    write.sent = "Datasettet \"%s\" sendes til appen (%d rader, %d kolonner).",
    write.log = "Opprettet med dm_write() i R",
    plot.gone = "Diagrammet finnes ikke lenger i R-sesjonen.",
    labels.named = "Verdietikettene må være en navngitt vektor, for eksempel c(\"Mann\" = 1, \"Kvinne\" = 2).",
    step.nofunction = "Koden må være en funksjon: function(df) { ... }.",
    step.notframe = "Funksjonen må returnere en data.frame."
  ),
  nn = c(
    list.empty = "Ingen datasett er tilgjengelege i R-sesjonen enno. Importer under Hent.",
    find.none = "Det finst ingen datasett i R-sesjonen. Køyr dm_list() for å sjå kva som finst.",
    find.many = "Fleire datasett samsvarar med \"%s\": %s",
    find.missing = "Finn ikkje noko datasett som heiter \"%s\". Køyr dm_list() for å sjå kva som finst.",
    read.notmirrored = "Datasettet \"%s\" er ikkje spegla til R enno. Prøv igjen om ei stund.",
    write.df = "dm_write() krev ein data.frame.",
    write.nocols = "Datasettet har ingen kolonnar.",
    write.sent = "Datasettet \"%s\" blir sendt til appen (%d rader, %d kolonnar).",
    write.log = "Oppretta med dm_write() i R",
    plot.gone = "Diagrammet finst ikkje lenger i R-sesjonen.",
    labels.named = "Verdietikettane må vere ein namngjeven vektor, til dømes c(\"Mann\" = 1, \"Kvinne\" = 2).",
    step.nofunction = "Koden må vere ein funksjon: function(df) { ... }.",
    step.notframe = "Funksjonen må returnere ein data.frame."
  ),
  fi = c(
    list.empty = "R-istunnossa ei ole vielä aineistoja. Tuo aineisto Nouda-tilassa.",
    find.none = "R-istunnossa ei ole aineistoja. Aja dm_list() nähdäksesi, mitä on saatavilla.",
    find.many = "Useat aineistot vastaavat hakua \"%s\": %s",
    find.missing = "Aineistoa nimeltä \"%s\" ei löydy. Aja dm_list() nähdäksesi, mitä on saatavilla.",
    read.notmirrored = "Aineistoa \"%s\" ei ole vielä peilattu R:ään. Yritä hetken kuluttua uudelleen.",
    write.df = "dm_write() tarvitsee data.frame-olion.",
    write.nocols = "Aineistossa ei ole sarakkeita.",
    write.sent = "Aineisto \"%s\" lähetetään sovellukseen (%d riviä, %d saraketta).",
    write.log = "Luotu dm_write()-funktiolla R:ssä",
    plot.gone = "Kaaviota ei enää ole R-istunnossa.",
    labels.named = "Arvoselitteiden on oltava nimetty vektori, esimerkiksi c(\"Mies\" = 1, \"Nainen\" = 2).",
    step.nofunction = "Koodin on oltava funktio: function(df) { ... }.",
    step.notframe = "Funktion on palautettava data.frame."
  ),
  is = c(
    list.empty = "Engin gagnasöfn eru tiltæk í R-setunni enn. Flyttu inn undir Sækja.",
    find.none = "Engin gagnasöfn eru í R-setunni. Keyrðu dm_list() til að sjá hvað er til.",
    find.many = "Fleiri gagnasöfn passa við \"%s\": %s",
    find.missing = "Finn ekkert gagnasafn sem heitir \"%s\". Keyrðu dm_list() til að sjá hvað er til.",
    read.notmirrored = "Gagnasafnið \"%s\" hefur ekki verið speglað til R enn. Reyndu aftur eftir augnablik.",
    write.df = "dm_write() þarf data.frame.",
    write.nocols = "Gagnasafnið hefur enga dálka.",
    write.sent = "Gagnasafnið \"%s\" er sent til forritsins (%d raðir, %d dálkar).",
    write.log = "Búið til með dm_write() í R",
    plot.gone = "Myndritið er ekki lengur til í R-setunni.",
    labels.named = "Gildismerkimiðar verða að vera nefndur vigur, til dæmis c(\"Karl\" = 1, \"Kona\" = 2).",
    step.nofunction = "Kóðinn verður að vera fall: function(df) { ... }.",
    step.notframe = "Fallið verður að skila data.frame."
  ),
  en = c(
    list.empty = "No datasets are available in the R session yet. Import one in Import.",
    find.none = "There are no datasets in the R session. Run dm_list() to see what exists.",
    find.many = "Several datasets match \"%s\": %s",
    find.missing = "No dataset called \"%s\" was found. Run dm_list() to see what exists.",
    read.notmirrored = "The dataset \"%s\" has not been mirrored to R yet. Try again in a moment.",
    write.df = "dm_write() needs a data.frame.",
    write.nocols = "The dataset has no columns.",
    write.sent = "The dataset \"%s\" is being sent to the app (%d rows, %d columns).",
    write.log = "Created with dm_write() in R",
    plot.gone = "The plot no longer exists in the R session.",
    labels.named = "Value labels must be a named vector, for example c(\"Man\" = 1, \"Woman\" = 2).",
    step.nofunction = "The code must be a function: function(df) { ... }.",
    step.notframe = "The function must return a data.frame."
  )
)

# Message in the session language, formatted with sprintf when arguments are given.
.dm_msg <- function(key, ...) {
  table <- .dataspatium$messages[[.dataspatium$lang]]
  if (is.null(table)) table <- .dataspatium$messages$sv
  text <- table[[key]]
  if (is.null(text)) text <- .dataspatium$messages$sv[[key]]
  if (is.null(text)) text <- key
  if (...length()) sprintf(text, ...) else text
}

# ---- index of datasets mirrored by the app ---------------------------------------------------

dm_index <- function() {
  # Tab-separated so that base R can read it without loading any package.
  path <- file.path(.dataspatium$data_dir, "index.tsv")
  empty <- data.frame(id = character(), name = character(), shortName = character(), folder = character(), file = character(),
                      rowCount = integer(), columnCount = integer(), updatedAt = character(), stringsAsFactors = FALSE)
  if (!file.exists(path)) return(empty)
  idx <- utils::read.delim(path, sep = "\t", quote = "", stringsAsFactors = FALSE, encoding = "UTF-8",
                           colClasses = "character", na.strings = character())
  if (NROW(idx) == 0) return(empty)
  if (is.null(idx$shortName)) idx$shortName <- ""
  if (is.null(idx$folder)) idx$folder <- ""
  idx$rowCount <- as.integer(idx$rowCount)
  idx$columnCount <- as.integer(idx$columnCount)
  idx
}

# Minimal JSON string escaping for the metadata we write (avoids depending on jsonlite at startup).
.dm_json_string <- function(x) {
  x <- as.character(x)[1]
  if (is.na(x)) return("null")
  x <- gsub("\\\\", "\\\\\\\\", x)
  x <- gsub("\"", "\\\\\"", x)
  x <- gsub("\n", "\\\\n", x)
  x <- gsub("\r", "\\\\r", x)
  x <- gsub("\t", "\\\\t", x)
  paste0("\"", x, "\"")
}

# Value labels (SPSS and Stata codes with names) travel as JSON in _columns.value_labels:
# {"values":"codes" or "labels","labels":[[code,"label"],...]}. "labels" means that the column already holds
# the labels (an SPSS import with labels as text) and the codes are kept for export.
.dm_labels_json <- function(labs, values = "codes") {
  if (is.null(labs) || !length(labs)) return(NA_character_)
  codes <- unname(labs)
  codes <- if (is.numeric(codes)) as.character(codes) else vapply(as.character(codes), .dm_json_string, character(1))
  pairs <- paste0("[", codes, ",", vapply(names(labs), .dm_json_string, character(1)), "]", collapse = ",")
  paste0("{\"values\":\"", values, "\",\"labels\":[", pairs, "]}")
}

# A bundled package, installed on first use (pkg:: alone does not go through webR's install shim).
.dm_need <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) suppressWarnings(webr::install(pkg, quiet = TRUE))
  requireNamespace(pkg, quietly = TRUE)
}

# A column holding codes with value labels becomes haven::labelled; a column that already holds the labels
# keeps them as text, with the JSON as the attribute "value_labels" so that dm_write() keeps it.
.dm_apply_labels <- function(x, json) {
  if (is.null(json) || is.na(json) || !nzchar(json)) return(x)
  if (!.dm_need("jsonlite")) { attr(x, "value_labels") <- json; return(x) }
  vl <- jsonlite::fromJSON(json, simplifyVector = FALSE)
  if (identical(vl$values, "labels") || !length(vl$labels) || !.dm_need("haven")) { attr(x, "value_labels") <- json; return(x) }
  codes <- unlist(lapply(vl$labels, `[[`, 1))
  labs <- if (is.numeric(x)) as.numeric(codes) else as.character(codes)
  if (is.integer(x) && is.numeric(labs) && all(labs == round(labs))) labs <- as.integer(labs)
  names(labs) <- vapply(vl$labels, function(p) as.character(p[[2]]), character(1))
  keep <- attributes(x)[intersect(names(attributes(x)), c("label", "description", "unit"))]
  y <- haven::labelled(as.vector(x), labels = labs)
  for (a in names(keep)) attr(y, a) <- keep[[a]]
  y
}

# Value labels for one column, as a named vector c("Man" = 1, "Kvinna" = 2). to = "labels" replaces the
# codes with their labels, to = "codes" turns labels back into codes, NULL only sets the labels and NULL
# labels remove them. Values without a code or label stay as they are.
dm_value_labels <- function(x, labels, to = NULL) {
  keep <- attributes(x)[intersect(names(attributes(x)), c("label", "description", "unit"))]
  old <- attr(x, "value_labels", exact = TRUE)
  v <- if (is.factor(x)) as.character(x) else as.vector(unclass(x))
  restore <- function(y) { for (a in names(keep)) attr(y, a) <- keep[[a]]; y }
  if (!length(labels)) return(restore(v))
  if (is.null(names(labels))) stop(.dm_msg("labels.named"), call. = FALSE)
  if (identical(to, "codes")) {
    i <- match(as.character(v), names(labels))
    v <- ifelse(is.na(i), as.character(v), as.character(unname(labels)[i]))
    if (is.numeric(labels) && !anyNA(suppressWarnings(as.numeric(v[!is.na(v)])))) v <- as.numeric(v)
  } else if (identical(to, "labels")) {
    i <- match(as.character(v), as.character(unname(labels)))
    v <- ifelse(is.na(i), as.character(v), names(labels)[i])
  }
  as_text <- identical(to, "labels") || (is.null(to) && !is.null(old) && grepl('"values":"labels"', old, fixed = TRUE))
  if (!as_text && is.numeric(v) == is.numeric(labels) && .dm_need("haven")) {
    return(restore(haven::labelled(v, labels = if (is.numeric(v)) labels else stats::setNames(as.character(labels), names(labels)))))
  }
  restore(structure(v, value_labels = .dm_labels_json(labels, if (as_text) "labels" else "codes")))
}

# For SPSS and Stata: columns that hold the labels as text get their codes back as haven::labelled, when
# every value has a code or is a number among numeric codes; other columns are left as they are.
.dm_labels_for_export <- function(df) {
  df[] <- lapply(df, function(x) {
    j <- attr(x, "value_labels", exact = TRUE)
    if (is.null(j) || !.dm_need("jsonlite") || !.dm_need("haven")) return(x)
    vl <- jsonlite::fromJSON(j, simplifyVector = FALSE)
    if (!identical(vl$values, "labels") || !length(vl$labels)) return(x)
    codes <- unlist(lapply(vl$labels, `[[`, 1))
    labs <- vapply(vl$labels, function(p) as.character(p[[2]]), character(1))
    y <- codes[match(as.character(x), labs)]
    # A value without a label may itself be a code (3 when only 1 and 2 have labels).
    rest <- is.na(y) & !is.na(x)
    if (is.numeric(codes) && any(rest)) y[rest] <- suppressWarnings(as.numeric(as.character(x[rest])))
    if (any(is.na(y) & !is.na(x))) return(x)
    a <- attr(x, "label", exact = TRUE)
    y <- haven::labelled(y, labels = stats::setNames(codes, labs))
    if (!is.null(a)) attr(y, "label") <- a
    y
  })
  df
}

#' List the datasets available to R.
dm_list <- function() {
  idx <- dm_index()
  if (nrow(idx) == 0) {
    message(.dm_msg("list.empty"))
    return(invisible(idx))
  }
  out <- idx[, c("name", "shortName", "folder", "rowCount", "columnCount", "updatedAt", "id")]
  names(out) <- c("namn", "kortnamn", "mapp", "rader", "kolumner", "ändrad", "id")
  out
}

#' Resolve a dataset reference (id, short name, exact name, case-insensitive name or unique prefix) to an id.
dm_find <- function(x) {
  idx <- dm_index()
  if (nrow(idx) == 0) stop(.dm_msg("find.none"), call. = FALSE)
  x <- as.character(x)[1]
  hit <- which(idx$id == x)
  if (!length(hit)) hit <- which(idx$name == x)
  if (!length(hit)) hit <- which(idx$shortName == tolower(x))
  if (!length(hit)) hit <- which(tolower(idx$name) == tolower(x))
  # "Mapp/Namn" or "mapp/kortnamn" addresses a dataset through its folder.
  qualified <- ifelse(nzchar(idx$folder), paste0(idx$folder, "/", idx$name), idx$name)
  qshort <- ifelse(nzchar(idx$folder), paste0(idx$folder, "/", idx$shortName), idx$shortName)
  if (!length(hit)) hit <- which(tolower(qualified) == tolower(x))
  if (!length(hit)) hit <- which(tolower(qshort) == tolower(x))
  if (!length(hit)) hit <- which(startsWith(tolower(idx$name), tolower(x)))
  if (length(hit) == 1) return(idx$id[hit])
  if (length(hit) > 1) stop(.dm_msg("find.many", x, paste(idx$name[hit], collapse = ", ")), call. = FALSE)
  stop(.dm_msg("find.missing", x), call. = FALSE)
}

.dm_connect <- function(file) {
  con <- DBI::dbConnect(RSQLite::SQLite(), file)
  con
}

#' Read a dataset into a data.frame, restoring Dataspatium's column types.
#' @param x name or id
#' @param columns optional character vector of columns to read
#' @param where optional SQL condition, e.g. "lan = 'Skåne län'"
#' @param n maximum number of rows
dm_read <- function(x, columns = NULL, where = NULL, n = Inf) {
  id <- dm_find(x)
  file <- file.path(.dataspatium$data_dir, paste0(id, ".sqlite"))
  if (!file.exists(file)) stop(.dm_msg("read.notmirrored", x), call. = FALSE)
  .dm_read_file(file, columns = columns, where = where, n = n, id = id)
}

# A Dataspatium SQLite file as a data.frame (dm_read() and the code steps in recipes).
.dm_read_file <- function(file, columns = NULL, where = NULL, n = Inf, id = NULL) {
  con <- .dm_connect(file)
  on.exit(DBI::dbDisconnect(con), add = TRUE)
  cols <- DBI::dbReadTable(con, "_columns")
  cols <- cols[order(cols$position), , drop = FALSE]
  select <- if (is.null(columns)) "*" else paste(vapply(columns, function(c) as.character(DBI::dbQuoteIdentifier(con, c)), character(1)), collapse = ", ")
  sql <- paste0("select ", select, " from data")
  if (!is.null(where) && nzchar(where)) sql <- paste0(sql, " where ", where)
  if (is.finite(n)) sql <- paste0(sql, " limit ", as.integer(n))
  df <- DBI::dbGetQuery(con, sql)
  for (i in seq_len(nrow(cols))) {
    nm <- cols$name[i]
    if (!nm %in% names(df)) next
    type <- cols$type[i]
    v <- df[[nm]]
    if (type == "date") df[[nm]] <- as.Date(v)
    else if (type == "datetime") df[[nm]] <- as.POSIXct(v, tz = "UTC", format = "%Y-%m-%d %H:%M:%S")
    else if (type == "boolean") df[[nm]] <- as.logical(v)
    else if (type == "integer" && is.numeric(v) && all(is.na(v) | abs(v) < 2^31)) df[[nm]] <- as.integer(v)
    # Column metadata as attributes (haven-style "label", plus "description" and "unit" when set).
    for (a in c("label", "description", "unit")) {
      if (!a %in% names(cols)) next
      val <- cols[[a]][i]
      if (!is.na(val) && nzchar(val) && !(a == "label" && identical(val, nm))) attr(df[[nm]], a) <- val
    }
    if ("value_labels" %in% names(cols)) df[[nm]] <- .dm_apply_labels(df[[nm]], cols$value_labels[i])
  }
  meta <- DBI::dbReadTable(con, "_meta")
  if (is.null(id)) id <- meta$value[meta$key == "id"]
  attr(df, "dataspatium") <- list(id = id, name = meta$value[meta$key == "name"], columns = cols)
  df
}

.dm_type_of <- function(col) {
  if (inherits(col, "Date")) "date"
  else if (inherits(col, "POSIXt")) "datetime"
  else if (is.logical(col)) "boolean"
  else if (is.integer(col)) "integer"
  else if (is.numeric(col)) "number"
  else "text"
}

#' Hand a data.frame to the app as a new dataset. The app picks up the file after the command ends.
#' @return the new dataset id (invisibly)
dm_write <- function(df, name = NULL, description = "", labels = NULL, descriptions = NULL, units = NULL) {
  if (!is.data.frame(df)) stop(.dm_msg("write.df"), call. = FALSE)
  expression <- deparse(substitute(df))[1]
  if (is.null(name)) name <- expression
  dir.create(.dataspatium$out_dir, showWarnings = FALSE, recursive = TRUE)
  id <- paste0("ds_r", format(Sys.time(), "%Y%m%d%H%M%S"), sample(1000:9999, 1))
  file <- file.path(.dataspatium$out_dir, paste0(id, ".sqlite"))
  dims <- .dm_write_file(df, file, id, name, description = description, labels = labels, descriptions = descriptions, units = units,
                         source_json = paste0("{\"kind\":\"r\",\"expression\":", .dm_json_string(expression), "}"))
  cat(sprintf("[dataspatium:write] %s\n", file))
  message(.dm_msg("write.sent", name, dims[1], dims[2]))
  invisible(id)
}

# Write a data.frame as a Dataspatium SQLite file (dm_write() and the code steps). Returns c(rows, columns).
.dm_write_file <- function(df, file, id, name, description = "", labels = NULL, descriptions = NULL, units = NULL, source_json = "{\"kind\":\"r\"}") {
  # Variable labels (SPSS, Stata, SAS) become column labels unless given explicitly; "description" and
  # "unit" attributes (as set by dm_read) become column descriptions and units.
  attr_of <- function(a) vapply(df, function(x) { l <- attr(x, a, exact = TRUE); if (is.null(l)) NA_character_ else as.character(l)[1] }, character(1))
  if (is.null(labels)) labels <- attr_of("label")
  if (is.null(descriptions)) descriptions <- attr_of("description")
  if (is.null(units)) units <- attr_of("unit")
  # Value labels: from haven::labelled columns (codes) or the "value_labels" attribute that dm_read() set.
  value_labels <- vapply(df, function(x) {
    if (inherits(x, "haven_labelled")) return(.dm_labels_json(attr(x, "labels", exact = TRUE)))
    j <- attr(x, "value_labels", exact = TRUE)
    if (is.null(j)) NA_character_ else as.character(j)[1]
  }, character(1))
  df[] <- lapply(df, function(x) if (inherits(x, "haven_labelled")) as.vector(unclass(x)) else x)
  df <- as.data.frame(df, stringsAsFactors = FALSE)
  if (!ncol(df)) stop(.dm_msg("write.nocols"), call. = FALSE)
  labels <- as.character(labels); length(labels) <- ncol(df)
  labels <- ifelse(is.na(labels) | labels == "", names(df), labels)
  descriptions <- as.character(descriptions); length(descriptions) <- ncol(df)
  units <- as.character(units); length(units) <- ncol(df)
  if (file.exists(file)) invisible(file.remove(file))
  types <- vapply(df, .dm_type_of, character(1))
  out <- df
  for (nm in names(out)) {
    col <- out[[nm]]
    type <- types[[nm]]
    if (type == "date") out[[nm]] <- format(col, "%Y-%m-%d")
    else if (type == "datetime") out[[nm]] <- format(col, "%Y-%m-%d %H:%M:%S", tz = "UTC")
    else if (type == "boolean") out[[nm]] <- as.integer(col)
    else if (type == "text") out[[nm]] <- as.character(col)
  }
  sql_types <- c(text = "TEXT", integer = "INTEGER", number = "REAL", date = "TEXT", datetime = "TEXT", boolean = "INTEGER")
  con <- .dm_connect(file)
  on.exit(DBI::dbDisconnect(con), add = TRUE)
  qi <- function(x) vapply(x, function(v) as.character(DBI::dbQuoteIdentifier(con, v)), character(1))
  DBI::dbExecute(con, paste0("create table data (", paste(paste(qi(names(out)), sql_types[types]), collapse = ", "), ")"))
  DBI::dbAppendTable(con, "data", out)
  DBI::dbExecute(con, "create table _columns (position integer, name text, type text, label text, format text, source_name text, description text, unit text, value_labels text)")
  DBI::dbAppendTable(con, "_columns", data.frame(position = seq_along(out) - 1L, name = names(out), type = unname(types),
                                                 label = unname(labels), format = NA_character_, source_name = names(out),
                                                 description = unname(descriptions), unit = unname(units),
                                                 value_labels = unname(value_labels), stringsAsFactors = FALSE))
  now <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  DBI::dbExecute(con, "create table _meta (key text primary key, value text)")
  DBI::dbAppendTable(con, "_meta", data.frame(
    key = c("id", "name", "description", "createdAt", "updatedAt", "rowCount", "columnCount", "source"),
    value = c(id, name, description, now, now, as.character(nrow(out)), as.character(ncol(out)), source_json),
    stringsAsFactors = FALSE))
  DBI::dbExecute(con, "create table _log (ts text, action text, details text)")
  DBI::dbAppendTable(con, "_log", data.frame(ts = now, action = "r",
    details = paste0("{\"message\":", .dm_json_string(.dm_msg("write.log")), "}"), stringsAsFactors = FALSE))
  c(nrow(out), ncol(out))
}

# A code step in a recipe: `code` is an R expression giving a function(df); its result replaces the dataset's
# table. Called by the app with the dataset as a SQLite file; `limit` keeps only the first rows (preview).
.dm_run_step <- function(code, in_file, out_file, limit = NULL, name = "") {
  df <- .dm_read_file(in_file)
  if (!is.null(limit)) df <- utils::head(df, limit)
  step <- eval(parse(text = code), envir = new.env(parent = globalenv()))
  if (!is.function(step)) stop(.dm_msg("step.nofunction"), call. = FALSE)
  out <- step(df)
  if (is.null(out)) out <- df
  if (!is.data.frame(out)) stop(.dm_msg("step.notframe"), call. = FALSE)
  meta <- attr(df, "dataspatium")
  if (!nzchar(name) && !is.null(meta$name)) name <- meta$name
  dims <- .dm_write_file(out, out_file, "step", name, source_json = "{\"kind\":\"r_step\"}")
  cat(sprintf("[dataspatium:step] %d %d\n", dims[1], dims[2]))
  invisible(dims)
}

# ---- plots -------------------------------------------------------------------------------------

#' Colour palette shared with the app (Okabe-Ito).
dm_palette <- function(n = NULL) {
  if (is.null(n)) .dataspatium$palette else rep_len(.dataspatium$palette, n)
}

#' ggplot2 theme matching the app's look.
theme_dataspatium <- function(base_size = 12, base_family = "") {
  ggplot2::theme_minimal(base_size = base_size, base_family = base_family) +
    ggplot2::theme(
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major = ggplot2::element_line(colour = "#e1e4e9"),
      plot.title = ggplot2::element_text(face = "bold"),
      plot.title.position = "plot",
      plot.background = ggplot2::element_rect(fill = "white", colour = NA),
      axis.title = ggplot2::element_text(colour = "#545c69"),
      legend.position = "bottom"
    )
}
scale_colour_dataspatium <- function(...) ggplot2::scale_colour_manual(values = dm_palette(), ...)
scale_color_dataspatium <- scale_colour_dataspatium
scale_fill_dataspatium <- function(...) ggplot2::scale_fill_manual(values = dm_palette(), ...)

setHook(packageEvent("ggplot2", "attach"), function(...) {
  ggplot2::theme_set(theme_dataspatium())
  options(ggplot2.discrete.colour = dm_palette(), ggplot2.discrete.fill = dm_palette())
})

#' Record the current plot (called by the app after each command that drew something).
dm_plot_record <- function(key) {
  if (!length(grDevices::dev.list())) return(invisible(FALSE))
  rec <- tryCatch(grDevices::recordPlot(), error = function(e) NULL)
  if (is.null(rec)) return(invisible(FALSE))
  .dataspatium$plots[[as.character(key)]] <- rec
  if (length(.dataspatium$plots) > 30) .dataspatium$plots <- .dataspatium$plots[-1]
  invisible(TRUE)
}

#' Export a recorded plot to SVG, PNG or PDF.
dm_plot_export <- function(key, format = c("svg", "png", "pdf"), file, width = 7, height = 5, dpi = 150) {
  format <- match.arg(format)
  rec <- .dataspatium$plots[[as.character(key)]]
  if (is.null(rec)) stop(.dm_msg("plot.gone"), call. = FALSE)
  if (format == "svg" && !requireNamespace("svglite", quietly = TRUE)) suppressWarnings(webr::install("svglite", quiet = TRUE))
  if (format == "svg") svglite::svglite(file, width = width, height = height)
  else if (format == "png") grDevices::png(file, width = width, height = height, units = "in", res = dpi)
  else grDevices::pdf(file, width = width, height = height)
  on.exit(grDevices::dev.off(), add = TRUE)
  grDevices::replayPlot(rec)
  invisible(file)
}

# ---- session setup -----------------------------------------------------------------------------

#' Called once by the app after R has started.
#' @param lang language code for user-facing messages (sv, da, nb, fi, is or en)
dm_setup <- function(lang = "sv") {
  if (is.character(lang) && length(lang) == 1 && !is.null(.dataspatium$messages[[lang]])) .dataspatium$lang <- lang
  dir.create(.dataspatium$data_dir, showWarnings = FALSE, recursive = TRUE)
  dir.create(.dataspatium$out_dir, showWarnings = FALSE, recursive = TRUE)
  # Packages dm_read()/dm_write() need; svglite is installed on first SVG export.
  suppressWarnings(webr::install(c("DBI", "RSQLite"), quiet = TRUE))
  options(
    device = function(...) { webr::canvas(width = 672, height = 448, ...); grDevices::dev.control(displaylist = "enable") },
    webr.show_menu = FALSE,
    warn = 1,
    width = 110,
    OutDec = "."
  )
  webr::shim_install()
  invisible(TRUE)
}

#' Read the edges of a graph dataset (kind "graph") as a data.frame: id, kalla (source), mal (target), typ,
#' and the edge properties as columns. Nodes are read with dm_read(); igraph::graph_from_data_frame() joins them.
#' @param x name or id of the graph dataset
dm_read_edges <- function(x) {
  id <- dm_find(x)
  file <- file.path(.dataspatium$data_dir, paste0(id, ".sqlite"))
  if (!file.exists(file)) stop(.dm_msg("read.notmirrored", x), call. = FALSE)
  con <- .dm_connect(file)
  on.exit(DBI::dbDisconnect(con), add = TRUE)
  tables <- DBI::dbListTables(con)
  if (!"_edges" %in% tables) stop("not a graph dataset", call. = FALSE)
  df <- DBI::dbGetQuery(con, "select id, kalla, mal, typ, egenskaper from _edges")
  .dm_expand_json(df, "egenskaper")
}

# Expand a column of JSON objects into columns (graph node and edge properties).
.dm_expand_json <- function(df, column) {
  if (!column %in% names(df) || !requireNamespace("jsonlite", quietly = TRUE)) return(df)
  parsed <- lapply(df[[column]], function(s) if (is.na(s) || !nzchar(s)) list() else tryCatch(jsonlite::fromJSON(s, simplifyVector = TRUE), error = function(e) list()))
  keys <- unique(unlist(lapply(parsed, names)))
  for (k in keys) {
    if (k %in% names(df)) next
    df[[k]] <- vapply(parsed, function(p) { v <- p[[k]]; if (is.null(v) || length(v) == 0) NA_character_ else if (length(v) > 1 || is.list(v)) jsonlite::toJSON(v, auto_unbox = TRUE) else as.character(v) }, character(1))
    nums <- suppressWarnings(as.numeric(df[[k]]))
    if (all(is.na(df[[k]]) | !is.na(nums))) df[[k]] <- nums
  }
  df[[column]] <- NULL
  df
}

#' Nodes of a graph dataset with their properties as columns (id, etikett, namn, ...).
dm_read_nodes <- function(x) .dm_expand_json(dm_read(x), "egenskaper")

# Properties and quantities of a building model (dataset kind "model"), one row per value.
.dm_read_model_table <- function(x, table) {
  id <- dm_find(x)
  file <- file.path(.dataspatium$data_dir, paste0(id, ".sqlite"))
  if (!file.exists(file)) stop(.dm_msg("read.notmirrored", x), call. = FALSE)
  con <- .dm_connect(file)
  on.exit(DBI::dbDisconnect(con), add = TRUE)
  if (!table %in% DBI::dbListTables(con)) stop("not an IFC model", call. = FALSE)
  DBI::dbGetQuery(con, paste0("select * from ", table))
}
dm_read_properties <- function(x) .dm_read_model_table(x, "_properties")
dm_read_quantities <- function(x) .dm_read_model_table(x, "_quantities")

# Periods as the recipes write them: 2024-03, 2024-Q1 and 2024, from 2024M03, 2024K1, 2024-Q1, Q1 2024, 202403, 2024 or a date.
dm_period <- function(x, frequency = "auto") {
  vapply(as.character(x), function(s) {
    s <- trimws(s)
    y <- m <- q <- NA_integer_
    if (is.na(s)) return(NA_character_)
    if (grepl("^[0-9]{4}$", s)) y <- as.integer(s)
    else if (grepl("^[0-9]{4}[-/ ]?[KkQqT][1-4]$", s)) { y <- as.integer(substr(s, 1, 4)); q <- as.integer(substr(s, nchar(s), nchar(s))) }
    else if (grepl("^[KkQq][1-4][-/ ][0-9]{4}$", s)) { y <- as.integer(substr(s, nchar(s) - 3, nchar(s))); q <- as.integer(substr(s, 2, 2)) }
    else if (grepl("^[0-9]{4}[-/ ]?[Mm]?[0-9]{1,2}(-[0-9]{1,2}.*)?$", s)) {
      y <- as.integer(substr(s, 1, 4))
      m <- as.integer(sub("^[-/ ]?[Mm]?([0-9]{1,2}).*$", "\\1", substr(s, 5, nchar(s))))
      if (m < 1 || m > 12) return(NA_character_)
      q <- ceiling(m / 3)
    } else return(NA_character_)
    if (frequency == "year") return(as.character(y))
    if (frequency == "quarter") return(if (is.na(q)) NA_character_ else paste0(y, "-Q", q))
    if (frequency == "month") return(if (is.na(m)) NA_character_ else sprintf("%d-%02d", y, m))
    if (!is.na(m)) return(sprintf("%d-%02d", y, m))
    if (!is.na(q)) return(paste0(y, "-Q", q))
    as.character(y)
  }, character(1), USE.NAMES = FALSE)
}
# The first day of a period from dm_period().
dm_period_date <- function(x) {
  x <- dm_period(x)
  out <- ifelse(grepl("-Q", x), sprintf("%s-%02d-01", substr(x, 1, 4), (as.integer(substr(x, 7, 7)) - 1) * 3 + 1), ifelse(nchar(x) == 7, paste0(x, "-01"), paste0(x, "-01-01")))
  out[is.na(x)] <- NA
  out
}
# How many periods a year a column holds: 12, 4 or 1.
dm_periods_per_year <- function(x) {
  x <- dm_period(x)[1]
  if (is.na(x) || nchar(x) == 4) 1 else if (grepl("-Q", x)) 4 else 12
}

# Hands the result of a Statistik tool to the page as JSON, without depending on jsonlite.
.dm_json_atom <- function(v) {
  if (is.na(v)) return("null")
  if (is.logical(v)) return(if (v) "true" else "false")
  if (is.numeric(v)) return(if (is.finite(v)) format(v, digits = 15, trim = TRUE) else "null")
  .dm_json_string(enc2utf8(as.character(v)))
}
.dm_json_value <- function(x) {
  if (is.null(x)) return("null")
  if (is.factor(x)) x <- as.character(x)
  if (is.list(x)) return(paste0("{", paste(vapply(names(x), function(n) paste0(.dm_json_atom(n), ":", .dm_json_value(x[[n]])), character(1)), collapse = ","), "}"))
  x <- unname(x)
  if (length(x) == 1) return(.dm_json_atom(x))
  paste0("[", paste(vapply(seq_along(x), function(i) .dm_json_atom(x[[i]]), character(1)), collapse = ","), "]")
}
.dm_stat_emit <- function(tabell, matt, start, slut) {
  kolumner <- lapply(as.list(tabell), function(k) { if (is.factor(k)) k <- as.character(k); if (length(k) == 1) list(k) else k })
  tabelltext <- paste0("{", paste(vapply(names(kolumner), function(n) {
    k <- kolumner[[n]]
    paste0(.dm_json_atom(n), ":[", paste(vapply(seq_along(k), function(i) .dm_json_atom(k[[i]]), character(1)), collapse = ","), "]")
  }, character(1)), collapse = ","), "}")
  cat(start, '{"tabell":', tabelltext, ',"matt":', .dm_json_value(matt), "}", slut, "
", sep = "")
  invisible(NULL)
}
