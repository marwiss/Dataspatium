// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Statistics without code: each tool turns a form into ordinary R or Python code that the user sees and can take along,
 * runs it in the engine and brings back tables, key figures and plots. The code shown is what runs; only a line that
 * hands the result back to the page is added at run time. Same principle as Fråga: the form teaches the code.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/stats', ['data/r-bridge', 'data/python-bridge'], (rBridge, pyBridge) => {
    const TOOLS = ['describe', 'crosstab', 'correlation', 'test', 'regression', 'cluster'];
    const TESTS = ['t_two', 't_one', 't_paired', 'wilcox', 'anova', 'kruskal'];
    const MARK = '@@DMSTAT@@'; const END = '@@END@@';
    const str = (s) => JSON.stringify(String(s));
    const vec = (list) => `c(${list.map(str).join(', ')})`;
    const pyl = (list) => `[${list.map(str).join(', ')}]`;
    const tick = (s) => '`' + String(s).replace(/`/g, '\\`') + '`';
    const nameOf = (ds) => (ds && (ds.shortName || ds.name)) || '';

    function needs(p, ...keys) { for (const k of keys) { const v = p[k]; if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) throw new Error(D.t('stats.err.field')); } }

    // ---- R ------------------------------------------------------------------------------------------------------
    const R = {
      describe(p, ds) {
        const lines = [`df <- dm_read(${str(nameOf(ds))})`, `kolumner <- ${vec(p.columns)}`];
        const row = 'data.frame(kolumn = k, n = sum(!is.na(x)), saknas = sum(is.na(x)), medel = mean(x, na.rm = TRUE), sd = sd(x, na.rm = TRUE), min = min(x, na.rm = TRUE), q1 = unname(quantile(x, 0.25, na.rm = TRUE)), median = median(x, na.rm = TRUE), q3 = unname(quantile(x, 0.75, na.rm = TRUE)), max = max(x, na.rm = TRUE))';
        if (p.group) {
          lines.push(`grupper <- split(df, df[[${str(p.group)}]])`, 'resultat <- do.call(rbind, lapply(names(grupper), function(g) do.call(rbind, lapply(kolumner, function(k) {', '  x <- grupper[[g]][[k]]', `  cbind(grupp = g, ${row})`, '}))))');
        } else {
          lines.push('resultat <- do.call(rbind, lapply(kolumner, function(k) {', '  x <- df[[k]]', `  ${row}`, '}))');
        }
        lines.push('rownames(resultat) <- NULL', 'print(resultat)');
        if (p.columns.length === 1) {
          lines.push('library(ggplot2)', `p <- ggplot(df, aes(x = .data[[${str(p.columns[0])}]]${p.group ? `, fill = factor(.data[[${str(p.group)}]])` : ''})) + geom_histogram(bins = 30${p.group ? ', position = "identity", alpha = 0.6' : ''}) + labs(x = ${str(p.columns[0])}, y = "Antal"${p.group ? `, fill = ${str(p.group)}` : ''}) + theme_dataspatium()`, 'print(p)');
        }
        return lines.join('\n');
      },
      crosstab(p, ds) {
        const lines = [`df <- dm_read(${str(nameOf(ds))})`, `tabell <- table(df[[${str(p.row)}]], df[[${str(p.column)}]])`, 'print(tabell)'];
        if (p.percent === 'row') lines.push('print(round(prop.table(tabell, 1) * 100, 1))');
        if (p.percent === 'column') lines.push('print(round(prop.table(tabell, 2) * 100, 1))');
        lines.push('test <- chisq.test(tabell)', 'print(test)',
          'resultat <- as.data.frame.matrix(tabell)', `resultat <- cbind(${str(p.row)} = rownames(resultat), resultat)`, 'rownames(resultat) <- NULL',
          'matt <- list(chi2 = unname(test$statistic), frihetsgrader = unname(test$parameter), p = test$p.value)',
          'library(ggplot2)', 'lang <- as.data.frame(tabell)',
          `p <- ggplot(lang, aes(x = Var1, y = Freq, fill = Var2)) + geom_col(position = "stack") + labs(x = ${str(p.row)}, y = "Antal", fill = ${str(p.column)}) + theme_dataspatium()`, 'print(p)');
        return lines.join('\n');
      },
      correlation(p, ds) {
        return [`df <- dm_read(${str(nameOf(ds))})`, `kolumner <- ${vec(p.columns)}`,
          `m <- cor(df[kolumner], use = "pairwise.complete.obs", method = ${str(p.method || 'pearson')})`, 'print(round(m, 3))',
          'resultat <- cbind(kolumn = rownames(m), as.data.frame(m))', 'rownames(resultat) <- NULL',
          'library(ggplot2)', 'lang <- as.data.frame(as.table(m))',
          'p <- ggplot(lang, aes(Var1, Var2, fill = Freq)) + geom_tile() + geom_text(aes(label = round(Freq, 2))) + labs(x = NULL, y = NULL, fill = "r") + theme_dataspatium()', 'print(p)'].join('\n');
      },
      test(p, ds) {
        const v = `df[[${str(p.value)}]]`; const g = `df[[${str(p.group)}]]`;
        const head = [`df <- dm_read(${str(nameOf(ds))})`];
        const htest = (call) => head.concat([`test <- ${call}`, 'print(test)',
          'resultat <- data.frame(statistika = unname(test$statistic), frihetsgrader = if (is.null(test$parameter)) NA else unname(test$parameter)[1], p = test$p.value, skattning = if (is.null(test$estimate)) NA else unname(test$estimate)[1], skattning2 = if (length(test$estimate) > 1) unname(test$estimate)[2] else NA, ci_lag = if (is.null(test$conf.int)) NA else test$conf.int[1], ci_hog = if (is.null(test$conf.int)) NA else test$conf.int[2])',
          'matt <- list(p = test$p.value)']);
        let out;
        switch (p.test) {
          case 't_one': out = htest(`t.test(${v}, mu = ${Number(p.mu) || 0})`); break;
          case 't_paired': out = htest(`t.test(${v}, df[[${str(p.value2)}]], paired = TRUE)`); break;
          case 'wilcox': out = htest(`wilcox.test(${v} ~ ${g}, conf.int = TRUE)`); break;
          case 'kruskal': out = htest(`kruskal.test(${v} ~ factor(${g}))`); break;
          case 'anova':
            out = head.concat([`modell <- aov(${v} ~ factor(${g}))`, 's <- summary(modell)[[1]]', 'print(s)',
              'resultat <- data.frame(kalla = c("Mellan grupper", "Inom grupper"), frihetsgrader = s[["Df"]], kvadratsumma = s[["Sum Sq"]], medelkvadrat = s[["Mean Sq"]], f = s[["F value"]], p = s[["Pr(>F)"]])',
              'matt <- list(p = s[["Pr(>F)"]][1], f = s[["F value"]][1])']);
            break;
          default: out = htest(`t.test(${v} ~ ${g})`);
        }
        if (p.group && p.test !== 't_one' && p.test !== 't_paired') {
          out.push('library(ggplot2)', `p <- ggplot(df, aes(x = factor(.data[[${str(p.group)}]]), y = .data[[${str(p.value)}]])) + geom_boxplot() + labs(x = ${str(p.group)}, y = ${str(p.value)}) + theme_dataspatium()`, 'print(p)');
        }
        return out.join('\n');
      },
      regression(p, ds) {
        const formula = `${tick(p.target)} ~ ${p.predictors.map(tick).join(' + ')}`;
        const logistic = p.kind === 'logistic';
        const lines = [`df <- dm_read(${str(nameOf(ds))})`];
        if (logistic) lines.push(`df[[${str(p.target)}]] <- factor(df[[${str(p.target)}]])`);
        lines.push(logistic ? `modell <- glm(${formula}, data = df, family = binomial)` : `modell <- lm(${formula}, data = df)`, 's <- summary(modell)', 'print(s)',
          'koef <- s$coefficients',
          'resultat <- data.frame(term = rownames(koef), skattning = koef[, 1], medelfel = koef[, 2], statistika = koef[, 3], p = koef[, 4])', 'rownames(resultat) <- NULL',
          logistic ? `matt <- list(n = nobs(modell), aic = AIC(modell), avvikelse = deviance(modell), nivaer = levels(df[[${str(p.target)}]]))` : 'matt <- list(n = nobs(modell), r2 = s$r.squared, r2_justerat = s$adj.r.squared, residualfel = s$sigma)');
        lines.push('library(ggplot2)');
        if (logistic) lines.push('p <- ggplot(data.frame(sannolikhet = fitted(modell)), aes(sannolikhet)) + geom_histogram(bins = 30) + labs(x = "Anpassad sannolikhet", y = "Antal") + theme_dataspatium()');
        else lines.push('p <- ggplot(data.frame(anpassat = fitted(modell), residual = resid(modell)), aes(anpassat, residual)) + geom_point(alpha = 0.6) + geom_hline(yintercept = 0) + labs(x = "Anpassat värde", y = "Residual") + theme_dataspatium()');
        lines.push('print(p)');
        return lines.join('\n');
      },
      cluster(p, ds) {
        const k = Math.max(2, Math.trunc(Number(p.k) || 3));
        const lines = [`df <- dm_read(${str(nameOf(ds))})`, `kolumner <- ${vec(p.columns)}`, 'hela <- complete.cases(df[kolumner])', 'x <- df[hela, kolumner, drop = FALSE]', 'set.seed(1)',
          `km <- kmeans(${p.scale === false ? 'x' : 'scale(x)'}, centers = ${k}, nstart = 10)`,
          `resultat <- data.frame(kluster = seq_len(${k}), antal = km$size, aggregate(x, list(km$cluster), mean)[, -1, drop = FALSE], check.names = FALSE)`, 'print(resultat)',
          'matt <- list(forklarad = km$betweenss / km$totss, n = nrow(x))'];
        if (p.save) lines.push('ut <- df[hela, ]', 'ut$kluster <- km$cluster', `dm_write(ut, ${str(p.saveName || nameOf(ds) + ' med kluster')})`);
        if (p.columns.length >= 2) {
          lines.push('library(ggplot2)', `p <- ggplot(cbind(x, kluster = factor(km$cluster)), aes(x = .data[[${str(p.columns[0])}]], y = .data[[${str(p.columns[1])}]], colour = kluster)) + geom_point() + labs(x = ${str(p.columns[0])}, y = ${str(p.columns[1])}) + theme_dataspatium()`, 'print(p)');
        }
        return lines.join('\n');
      },
    };

    // ---- Python -------------------------------------------------------------------------------------------------
    const Py = {
      describe(p, ds) {
        const lines = ['import pandas as pd', `df = dm_read(${str(nameOf(ds))})`, `kolumner = ${pyl(p.columns)}`,
          'def rad(x, k):', '    return {"kolumn": k, "n": int(x.notna().sum()), "saknas": int(x.isna().sum()), "medel": x.mean(), "sd": x.std(), "min": x.min(), "q1": x.quantile(0.25), "median": x.median(), "q3": x.quantile(0.75), "max": x.max()}'];
        if (p.group) lines.push(`resultat = pd.DataFrame([{"grupp": str(g), **rad(d[k], k)} for g, d in df.groupby(${str(p.group)}) for k in kolumner])`);
        else lines.push('resultat = pd.DataFrame([rad(df[k], k) for k in kolumner])');
        lines.push('print(resultat)');
        if (p.columns.length === 1) lines.push('import matplotlib.pyplot as plt', 'fig, ax = plt.subplots()', `ax.hist(df[${str(p.columns[0])}].dropna(), bins=30)`, `ax.set_xlabel(${str(p.columns[0])})`, 'ax.set_ylabel("Antal")');
        return lines.join('\n');
      },
      crosstab(p, ds) {
        const lines = ['import pandas as pd', 'from scipy import stats', `df = dm_read(${str(nameOf(ds))})`, `tabell = pd.crosstab(df[${str(p.row)}], df[${str(p.column)}])`, 'print(tabell)'];
        if (p.percent === 'row') lines.push(`print(pd.crosstab(df[${str(p.row)}], df[${str(p.column)}], normalize="index").round(3) * 100)`);
        if (p.percent === 'column') lines.push(`print(pd.crosstab(df[${str(p.row)}], df[${str(p.column)}], normalize="columns").round(3) * 100)`);
        lines.push('chi2, pvarde, frihetsgrader, _ = stats.chi2_contingency(tabell)', 'print("chi2", chi2, "p", pvarde)',
          'resultat = tabell.reset_index()', 'resultat.columns = [str(c) for c in resultat.columns]', 'matt = {"chi2": float(chi2), "frihetsgrader": int(frihetsgrader), "p": float(pvarde)}',
          'tabell.plot(kind="bar", stacked=True)');
        return lines.join('\n');
      },
      correlation(p, ds) {
        return ['import pandas as pd', `df = dm_read(${str(nameOf(ds))})`, `kolumner = ${pyl(p.columns)}`, `m = df[kolumner].corr(method=${str(p.method || 'pearson')})`, 'print(m.round(3))',
          'resultat = m.reset_index().rename(columns={"index": "kolumn"})', 'import matplotlib.pyplot as plt', 'fig, ax = plt.subplots()', 'bild = ax.imshow(m, vmin=-1, vmax=1)', 'ax.set_xticks(range(len(kolumner)), kolumner)', 'ax.set_yticks(range(len(kolumner)), kolumner)', 'fig.colorbar(bild)'].join('\n');
      },
      test(p, ds) {
        const head = ['import pandas as pd', 'from scipy import stats', `df = dm_read(${str(nameOf(ds))})`];
        const v = str(p.value); const g = str(p.group);
        const two = [`grupper = [d[${v}].dropna() for _, d in df.groupby(${g})]`];
        const finish = (call, extra = '') => [`test = ${call}`, 'print(test)', `resultat = pd.DataFrame([{"statistika": float(test.statistic), "p": float(test.pvalue)${extra}}])`, 'matt = {"p": float(test.pvalue)}'];
        switch (p.test) {
          case 't_one': return head.concat(finish(`stats.ttest_1samp(df[${v}].dropna(), ${Number(p.mu) || 0})`)).join('\n');
          case 't_paired': return head.concat([`d = df[[${v}, ${str(p.value2)}]].dropna()`], finish(`stats.ttest_rel(d[${v}], d[${str(p.value2)}])`)).join('\n');
          case 'wilcox': return head.concat(two, finish('stats.mannwhitneyu(grupper[0], grupper[1])')).join('\n');
          case 'kruskal': return head.concat(two, finish('stats.kruskal(*grupper)')).join('\n');
          case 'anova': return head.concat(two, finish('stats.f_oneway(*grupper)')).join('\n');
          default: return head.concat(two, finish('stats.ttest_ind(grupper[0], grupper[1], equal_var=False)', ', "skattning": float(grupper[0].mean()), "skattning2": float(grupper[1].mean())')).join('\n');
        }
      },
      regression(p, ds) {
        const all = [p.target].concat(p.predictors);
        const logistic = p.kind === 'logistic';
        const lines = ['import pandas as pd', 'import statsmodels.api as sm', `df = dm_read(${str(nameOf(ds))})`, `data = df[${pyl(all)}].dropna()`,
          `X = sm.add_constant(pd.get_dummies(data[${pyl(p.predictors)}], drop_first=True, prefix_sep="=", dtype=float))`];
        if (logistic) lines.push(`nivaer = sorted(data[${str(p.target)}].unique())`, `y = (data[${str(p.target)}] == nivaer[-1]).astype(float)`, 'modell = sm.Logit(y, X).fit(disp=0)');
        else lines.push(`modell = sm.OLS(data[${str(p.target)}].astype(float), X).fit()`);
        lines.push('print(modell.summary())', 'resultat = pd.DataFrame({"term": modell.params.index, "skattning": modell.params.values, "medelfel": modell.bse.values, "statistika": modell.tvalues.values, "p": modell.pvalues.values})',
          logistic ? 'matt = {"n": int(modell.nobs), "aic": float(modell.aic), "avvikelse": float(-2 * modell.llf), "nivaer": [str(n) for n in nivaer]}' : 'matt = {"n": int(modell.nobs), "r2": float(modell.rsquared), "r2_justerat": float(modell.rsquared_adj), "residualfel": float(modell.mse_resid ** 0.5)}');
        return lines.join('\n');
      },
      cluster(p, ds) {
        const k = Math.max(2, Math.trunc(Number(p.k) || 3));
        const lines = ['import pandas as pd', 'from sklearn.cluster import KMeans', 'from sklearn.preprocessing import StandardScaler', `df = dm_read(${str(nameOf(ds))})`, `kolumner = ${pyl(p.columns)}`, 'x = df[kolumner].dropna()',
          `km = KMeans(n_clusters=${k}, n_init=10, random_state=1).fit(${p.scale === false ? 'x' : 'StandardScaler().fit_transform(x)'})`,
          'etiketter = pd.Series(km.labels_ + 1, index=x.index)', 'resultat = x.groupby(etiketter).mean().reset_index(names="kluster")', 'resultat.insert(1, "antal", etiketter.value_counts().sort_index().values)', 'print(resultat)',
          'matt = {"n": int(len(x))}'];
        if (p.save) lines.push('ut = df.loc[x.index].copy()', 'ut["kluster"] = etiketter', `dm_write(ut, ${str(p.saveName || nameOf(ds) + ' med kluster')})`);
        return lines.join('\n');
      },
    };

    const validate = {
      describe: (p) => needs(p, 'columns'),
      crosstab: (p) => needs(p, 'row', 'column'),
      correlation: (p) => { needs(p, 'columns'); if (p.columns.length < 2) throw new Error(D.t('stats.err.two.columns')); },
      test: (p) => { needs(p, 'value'); if (p.test === 't_paired') needs(p, 'value2'); else if (p.test !== 't_one') needs(p, 'group'); },
      regression: (p) => needs(p, 'target', 'predictors'),
      cluster: (p) => needs(p, 'columns'),
    };

    /**
     * The code for a filled-in form, as it is shown to the user.
     * @param {string} tool @param {any} params @param {any} dataset @param {'r'|'python'} [lang]
     */
    function code(tool, params, dataset, lang = 'r') {
      if (!validate[tool]) throw new Error('unknown tool ' + tool);
      validate[tool](params);
      return (lang === 'python' ? Py : R)[tool](params, dataset);
    }
    const TAILS = {
      r: (src) => `local({
${src}
.dm_stat_emit(resultat, if (exists("matt", inherits = FALSE)) matt else NULL, ${str(MARK)}, ${str(END)})
})`,
      python: (src) => `matt = None\n${src}\nimport json as _json\nprint(${str(MARK)} + _json.dumps({"tabell": resultat.astype(object).where(resultat.notna(), None).to_dict(orient="list"), "matt": matt}, default=str) + ${str(END)})`,
    };
    /** Rows and typed columns from the result's column lists. */
    function tableOf(raw) {
      const names = Object.keys(raw || {});
      const lists = names.map((n) => (Array.isArray(raw[n]) ? raw[n] : [raw[n]]));
      const size = lists.reduce((m, l) => Math.max(m, l.length), 0);
      const columns = names.map((name, i) => {
        const vals = lists[i].filter((v) => v !== null && v !== undefined);
        const numeric = vals.length > 0 && vals.every((v) => typeof v === 'number');
        const whole = numeric && vals.every((v) => Number.isInteger(v));
        return { name, type: numeric ? (whole ? 'integer' : 'number') : 'text' };
      });
      const rows = [];
      for (let r = 0; r < size; r++) rows.push(lists.map((l) => (l[r] === undefined ? null : l[r])));
      return { columns, rows };
    }
    /**
     * Runs a tool in the engine.
     * @param {string} tool @param {any} params @param {any} dataset @param {'r'|'python'} [lang]
     * @returns {Promise<{code: string, table: {columns: any[], rows: any[][]}, values: any, plots: any[], output: string, datasets: any[], lang: string}>}
     */
    async function run(tool, params, dataset, lang = 'r') {
      const src = code(tool, params, dataset, lang);
      const bridge = lang === 'python' ? pyBridge.bridge : rBridge.bridge;
      const res = await bridge.run(TAILS[lang](src));
      const failed = res.entries.find((e) => e.kind === 'error');
      if (failed) throw new Error(/exactly 2 levels|grouping factor/.test(failed.text) ? D.t('stats.err.two.groups') : failed.text);
      const text = res.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('');
      const at = text.lastIndexOf(MARK);
      const stop = text.lastIndexOf(END);
      if (at < 0 || stop < at) throw new Error(D.t('stats.err.noresult'));
      const parsed = JSON.parse(text.slice(at + MARK.length, stop));
      return {
        code: src, lang, table: tableOf(parsed.tabell), values: parsed.matt || {},
        plots: res.entries.filter((e) => e.kind === 'plot'), datasets: res.entries.filter((e) => e.kind === 'dataset').map((e) => e.meta),
        output: (text.slice(0, at) + text.slice(stop + END.length)).trim(),
      };
    }
    return { TOOLS, TESTS, code, run, tableOf, MARK, END };
  });
})();
