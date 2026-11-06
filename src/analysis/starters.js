// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Code to start from, written for the dataset at hand: its side tables, its own columns and what the data can be used as.
 * Every piece here is run by the tests, so a column name that changes breaks a test and not a user's first attempt.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/starters', ['data/kinds'], (kinds) => {
    const str = JSON.stringify;
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const nameOf = (ds) => ds.shortName || ds.name;
    const piece = (key, code) => ({ key, code });

    /** @type {Record<string, Record<string, (s: string, ds: any) => Array<{key: string, code: string}>>>} */
    const BY_KIND = {
      table: {
        r: (s) => [piece('starter.summary', `df <- dm_read(${s})\nsummary(df)`)],
        python: (s) => [piece('starter.summary', `df = dm_read(${s})\ndf.describe(include="all")`)],
        sql: () => [piece('starter.rows', 'select * from data limit 10')],
      },
      document: {
        r: (s) => [piece('starter.document.size', `text <- dm_read(${s})\nsort(tapply(text$tecken, text$dokument, sum), decreasing = TRUE)`)],
        python: (s) => [piece('starter.document.size', `text = dm_read(${s})\ntext.groupby("dokument")["tecken"].sum().sort_values(ascending=False)`)],
        sql: () => [
          piece('starter.document.size', 'select dokument, count(*) as stycken, sum(tecken) as tecken, max(sida) as sidor from data group by dokument order by tecken desc'),
          piece('starter.document.search', "select dokument, sida, text from data where text like '%ord%' limit 50"),
        ],
      },
      images: {
        r: (s) => [piece('starter.images.months', `bilder <- dm_read(${s})\ntable(substr(bilder$datum, 1, 7))`)],
        python: (s) => [piece('starter.images.months', `bilder = dm_read(${s})\nbilder["datum"].astype(str).str[:7].value_counts().sort_index()`)],
        sql: () => [
          piece('starter.images.months', 'select substr(datum, 1, 7) as manad, count(*) as bilder from data where datum is not null group by manad order by manad'),
          piece('starter.images.cameras', 'select kamera, count(*) as bilder from data group by kamera order by bilder desc'),
        ],
      },
      plan: {
        r: (s, ds) => [piece('starter.plan.objects', `plan <- dm_read(${s})\nsort(table(plan$${planColumn(ds)}), decreasing = TRUE)`)],
        python: (s, ds) => [piece('starter.plan.objects', `plan = dm_read(${s})\nplan["${planColumn(ds)}"].value_counts()`)],
        sql: (s, ds) => [piece('starter.plan.objects', `select ${planColumn(ds)}, count(*) as objekt from data group by ${planColumn(ds)} order by objekt desc`)],
      },
      graph: {
        r: (s) => [
          piece('starter.graph.types', `kanter <- dm_read_edges(${s})\nsort(table(kanter$typ), decreasing = TRUE)`),
          piece('starter.graph.degree', `kanter <- dm_read_edges(${s})\nhead(sort(table(c(kanter$kalla, kanter$mal)), decreasing = TRUE), 10)`),
        ],
        python: (s) => [
          piece('starter.graph.types', `kanter = dm_read_edges(${s})\nkanter["typ"].value_counts()`),
          piece('starter.graph.degree', `import pandas as pd\nkanter = dm_read_edges(${s})\npd.concat([kanter["kalla"], kanter["mal"]]).value_counts().head(10)`),
        ],
        sql: () => [
          piece('starter.graph.types', 'select typ, count(*) as kanter from _edges group by typ order by kanter desc'),
          piece('starter.graph.degree', 'select n.id, n.namn, count(*) as grad from data n join _edges e on e.kalla = n.id or e.mal = n.id group by n.id order by grad desc limit 20'),
        ],
      },
      model: {
        r: (s, ds) => (kinds.isDxf(ds) ? [piece('starter.model.layers', `ritning <- dm_read(${s})\ntable(ritning$lager, ritning$typ)`)] : [piece('starter.model.quantities', `mangder <- dm_read_quantities(${s})\naggregate(varde ~ namn + enhet, mangder, sum)`)]),
        python: (s, ds) => (kinds.isDxf(ds) ? [piece('starter.model.layers', `ritning = dm_read(${s})\nritning.groupby(["lager", "typ"]).size()`)] : [
          piece('starter.model.quantities', `mangder = dm_read_quantities(${s})\nmangder.groupby(["namn", "enhet"])["varde"].sum()`),
          piece('starter.model.ifc', `modell = dm_ifc(${s})\nprint(modell.schema, len(modell.by_type("IfcElement")))\ndm_ifc_psets(modell, "IfcWall").head()`)]),
        sql: (s, ds) => (kinds.isDxf(ds) ? [piece('starter.model.layers', 'select lager, typ, count(*) as objekt from data group by lager, typ order by lager, objekt desc')] : [
          piece('starter.model.types', 'select typ, count(*) as element from data group by typ order by element desc'),
          piece('starter.model.quantities', 'select namn, enhet, sum(varde) as summa from _quantities group by namn, enhet order by namn'),
          piece('starter.model.properties', 'select namn, varde, count(*) as element from _properties group by namn, varde order by element desc limit 50'),
        ]),
      },
    };
    /** A comprehensive plan is grouped by its theme, a detailed plan by the type of object. */
    function planColumn(ds) { return ds.plan && ds.plan.slag === 'oversiktsplan' ? 'tema' : 'objekttyp'; }
    const kindOf = (ds) => (BY_KIND[ds && ds.kind] ? ds.kind : 'table');

    /**
     * The pieces that follow from the kind alone.
     * @param {any} ds @param {'r'|'python'|'sql'} lang @returns {Array<{key: string, code: string}>}
     */
    function forKind(ds, lang) {
      return BY_KIND[kindOf(ds)][lang](str(nameOf(ds)), ds);
    }
    /** What a column of periods beside a number can be asked. */
    function seriesPieces(s, period, value, lang) {
      if (lang === 'r') return [piece('starter.series', `df <- dm_read(${s})\nd <- aggregate(df[[${str(value)}]], list(period = dm_period(df[[${str(period)}]])), sum, na.rm = TRUE)\nd[order(d$period), ]`)];
      if (lang === 'python') return [piece('starter.series', `df = dm_read(${s})\ndf.groupby(${str(period)})[${str(value)}].sum().sort_index()`)];
      return [piece('starter.series', `select ${q(period)}, sum(${q(value)}) as summa from data group by ${q(period)} order by ${q(period)}`)];
    }
    /** Issues from a CDE: how many stand open, who has them, and when they came. */
    function bcfPieces(s, lang) {
      if (lang === 'r') return [piece('starter.bcf.status', `arenden <- dm_read(${s})\ntable(arenden$topic_status, useNA = "ifany")`)];
      if (lang === 'python') return [piece('starter.bcf.status', `arenden = dm_read(${s})\narenden["topic_status"].value_counts(dropna=False)`)];
      return [
        piece('starter.bcf.status', 'select topic_status, count(*) as arenden from data group by topic_status order by arenden desc'),
        piece('starter.bcf.assigned', "select assigned_to, count(*) as oppna from data where topic_status not in ('Closed', 'Resolved', 'Stängd', 'Löst') group by assigned_to order by oppna desc"),
        piece('starter.bcf.months', 'select substr(creation_date, 1, 7) as manad, count(*) as arenden from data group by manad order by manad'),
      ];
    }
    /** Issue tables saved from the model view carry the elements: issues per element type, status and storey. */
    function elementPieces(s, lang) {
      if (lang === 'r') return [piece('starter.bcf.elements', `arenden <- dm_read(${s})\nmed <- arenden[!is.na(arenden$element_guid), ]\ntable(med$element_typ, med$topic_status)`)];
      if (lang === 'python') return [piece('starter.bcf.elements', `arenden = dm_read(${s})\narenden.dropna(subset=["element_guid"]).groupby(["element_typ", "topic_status"])["guid"].nunique()`)];
      return [
        piece('starter.bcf.elements', 'select element_typ, topic_status, count(distinct guid) as arenden, count(distinct element_guid) as byggdelar from data where element_guid is not null group by 1, 2 order by arenden desc'),
        piece('starter.bcf.storeys', 'select element_vaning, count(distinct guid) as arenden, count(distinct element_guid) as byggdelar from data where element_guid is not null group by 1 order by arenden desc'),
      ];
    }
    /**
     * The pieces for a table, following what the data can be used as.
     * @param {any} ds @param {'r'|'python'|'sql'} lang @returns {Promise<Array<{key: string, code: string}>>}
     */
    async function forDataset(ds, lang) {
      const out = forKind(ds, lang);
      if (kinds.isCollection(ds)) return out;
      const s = str(nameOf(ds));
      const found = (await D.require('data/facets').detect(ds.id)).filter((f) => f.on);
      const series = found.find((f) => f.id === 'timeseries');
      if (series) {
        const columns = await D.require('data/datasets').columns(ds.id);
        const value = columns.find((c) => (c.type === 'number' || c.type === 'integer') && c.name !== series.columns[0]);
        if (value) out.push(...seriesPieces(s, series.columns[0], value.name, lang));
      }
      const places = found.find((f) => f.id === 'spatial' && f.columns.length === 2);
      if (places) {
        const [lon, lat] = places.columns;
        if (lang === 'r') out.push(piece('starter.map', `library(ggplot2)\ndf <- dm_read(${s})\nggplot(df, aes(.data[[${str(lon)}]], .data[[${str(lat)}]])) + geom_point() + coord_quickmap() + theme_dataspatium()`));
        else if (lang === 'python') out.push(piece('starter.map', `import matplotlib.pyplot as plt\ndf = dm_read(${s})\ndf.plot.scatter(x=${str(lon)}, y=${str(lat)})\nplt.show()`));
      }
      const text = found.find((f) => f.id === 'text');
      if (text && lang === 'sql') out.push(piece('starter.search', `select * from data where ${q(text.columns[0])} like '%ord%' limit 50`));
      if (found.some((f) => f.id === 'bcf')) {
        out.push(...bcfPieces(s, lang));
        const columns = await D.require('data/datasets').columns(ds.id);
        if (columns.some((c) => c.name === 'element_typ')) out.push(...elementPieces(s, lang));
      }
      return out;
    }

    return { forKind, forDataset };
  });
})();
