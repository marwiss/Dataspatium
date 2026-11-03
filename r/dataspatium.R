# Dataspatium R helpers, sourced into every R session. User documentation (Swedish): docs/r-guide.md.
#
# Datasets are exchanged with the app as SQLite files in /data (see docs/format.md for the schema):
#   dm_list()            datasets available in this session
#   dm_read("Namn")      read a dataset as a data.frame with restored types
#   dm_write(df, "Namn") hand a data.frame back to the app as a new dataset
#   theme_dataspatium()     ggplot2 theme and palette shared with the rest of the app
# Code comments are in English; messages shown to the user are in Swedish.

.dataspatium <- new.env(parent = emptyenv())
.dataspatium$data_dir <- "/data"
.dataspatium$out_dir <- "/data/out"
.dataspatium$plots <- list()
.dataspatium$palette <- c("#0072B2", "#E69F00", "#009E73", "#D55E00", "#56B4E9", "#CC79A7", "#F0E442", "#7F7F7F")

# ---- index of datasets mirrored by the app ---------------------------------------------------

dm_index <- function() {
  # Tab-separated so that base R can read it without loading any package.
  path <- file.path(.dataspatium$data_dir, "index.tsv")
  empty <- data.frame(id = character(), name = character(), shortName = character(), file = character(), rowCount = integer(),
                      columnCount = integer(), updatedAt = character(), stringsAsFactors = FALSE)
  if (!file.exists(path)) return(empty)
  idx <- utils::read.delim(path, sep = "\t", quote = "", stringsAsFactors = FALSE, encoding = "UTF-8",
                           colClasses = "character", na.strings = character())
  if (NROW(idx) == 0) return(empty)
  if (is.null(idx$shortName)) idx$shortName <- ""
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

#' List the datasets available to R.
dm_list <- function() {
  idx <- dm_index()
  if (nrow(idx) == 0) {
    message("Inga datamängder är tillgängliga i R-sessionen ännu. Importera i läget Inhämta.")
    return(invisible(idx))
  }
  out <- idx[, c("name", "shortName", "rowCount", "columnCount", "updatedAt", "id")]
  names(out) <- c("namn", "kortnamn", "rader", "kolumner", "ändrad", "id")
  out
}

#' Resolve a dataset reference (id, short name, exact name, case-insensitive name or unique prefix) to an id.
dm_find <- function(x) {
  idx <- dm_index()
  if (nrow(idx) == 0) stop("Inga datamängder finns i R-sessionen. Kör dm_list() för att se vad som finns.", call. = FALSE)
  x <- as.character(x)[1]
  hit <- which(idx$id == x)
  if (!length(hit)) hit <- which(idx$name == x)
  if (!length(hit)) hit <- which(idx$shortName == tolower(x))
  if (!length(hit)) hit <- which(tolower(idx$name) == tolower(x))
  if (!length(hit)) hit <- which(startsWith(tolower(idx$name), tolower(x)))
  if (length(hit) == 1) return(idx$id[hit])
  if (length(hit) > 1) stop("Flera datamängder matchar \"", x, "\": ", paste(idx$name[hit], collapse = ", "), call. = FALSE)
  stop("Hittar ingen datamängd som heter \"", x, "\". Kör dm_list() för att se vad som finns.", call. = FALSE)
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
  if (!file.exists(file)) stop("Datamängden \"", x, "\" är inte speglad till R ännu. Prova igen om en stund.", call. = FALSE)
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
  }
  meta <- DBI::dbReadTable(con, "_meta")
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
  if (!is.data.frame(df)) stop("dm_write() behöver en data.frame.", call. = FALSE)
  if (is.null(name)) name <- deparse(substitute(df))[1]
  # Variable labels (SPSS, Stata, SAS) become column labels unless given explicitly; "description" and
  # "unit" attributes (as set by dm_read) become column descriptions and units.
  attr_of <- function(a) vapply(df, function(x) { l <- attr(x, a, exact = TRUE); if (is.null(l)) NA_character_ else as.character(l)[1] }, character(1))
  if (is.null(labels)) labels <- attr_of("label")
  if (is.null(descriptions)) descriptions <- attr_of("description")
  if (is.null(units)) units <- attr_of("unit")
  df <- as.data.frame(df, stringsAsFactors = FALSE)
  if (!ncol(df)) stop("Datamängden saknar kolumner.", call. = FALSE)
  labels <- as.character(labels); length(labels) <- ncol(df)
  labels <- ifelse(is.na(labels) | labels == "", names(df), labels)
  descriptions <- as.character(descriptions); length(descriptions) <- ncol(df)
  units <- as.character(units); length(units) <- ncol(df)
  dir.create(.dataspatium$out_dir, showWarnings = FALSE, recursive = TRUE)
  id <- paste0("ds_r", format(Sys.time(), "%Y%m%d%H%M%S"), sample(1000:9999, 1))
  file <- file.path(.dataspatium$out_dir, paste0(id, ".sqlite"))
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
  DBI::dbExecute(con, "create table _columns (position integer, name text, type text, label text, format text, source_name text, description text, unit text)")
  DBI::dbAppendTable(con, "_columns", data.frame(position = seq_along(out) - 1L, name = names(out), type = unname(types),
                                                 label = unname(labels), format = NA_character_, source_name = names(out),
                                                 description = unname(descriptions), unit = unname(units), stringsAsFactors = FALSE))
  now <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  source_json <- paste0("{\"kind\":\"r\",\"expression\":", .dm_json_string(deparse(substitute(df))[1]), "}")
  DBI::dbExecute(con, "create table _meta (key text primary key, value text)")
  DBI::dbAppendTable(con, "_meta", data.frame(
    key = c("id", "name", "description", "createdAt", "updatedAt", "rowCount", "columnCount", "source"),
    value = c(id, name, description, now, now, as.character(nrow(out)), as.character(ncol(out)), source_json),
    stringsAsFactors = FALSE))
  DBI::dbExecute(con, "create table _log (ts text, action text, details text)")
  DBI::dbAppendTable(con, "_log", data.frame(ts = now, action = "r",
    details = "{\"message\":\"Skapad med dm_write() i R\"}", stringsAsFactors = FALSE))
  cat(sprintf("[dataspatium:write] %s\n", file))
  message("Datamängden \"", name, "\" skickas till appen (", nrow(out), " rader, ", ncol(out), " kolumner).")
  invisible(id)
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
      axis.title = ggplot2::element_text(colour = "#6b7583"),
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
  if (is.null(rec)) stop("Diagrammet finns inte längre i R-sessionen.", call. = FALSE)
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
dm_setup <- function() {
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
