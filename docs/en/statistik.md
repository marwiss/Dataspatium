# Statistics, time series and models

The **Statistics** tab in Analyse does common analyses with forms. The form writes the code while you fill it in, so you see
what runs and can take the code along. The **time series operations** in Process prepare series from SDMX and PxWeb. A **model**
from a regression can be saved and used as the recipe step *Prediction* on new data.

## The Statistics tab

Choose a dataset and a tool, fill in the form and press *Run*. R is the default; choose Python in the form if you prefer. The
code shows below the form and can be opened in the console with *Open in the console*.

| Tool | What it gives |
|---|---|
| Descriptive | Count, missing values, mean, standard deviation, quartiles, minimum and maximum per column, by group if you like; with one column a histogram too |
| Crosstab | Counts per two categories, with percentages if you like, and a chi² test |
| Correlation | Pearson or Spearman between number columns, with a coloured table |
| Hypothesis test | t-test (two groups, against a value, paired), Mann-Whitney, analysis of variance and Kruskal-Wallis |
| Regression | Linear or logistic, with coefficients, standard errors and p-values; text columns become indicators |
| Clustering | k-means with any number of clusters, and a new dataset with the cluster as a column if you want |

Above the table a sentence says what the result shows. It says whether a difference is statistically significant, not what it
means. Statistical methods assume things the form cannot see, such as how the data was collected and whether the rows are
independent. The judgement is yours. Every result can be saved as a dataset, and the code goes along in the description.

Python starts only when you press *Run*, and scipy, statsmodels and scikit-learn are fetched the first time they are needed.

## Time series in Process

The group **Time series** among the operations is for tables with a period column and possibly columns that tell the series
apart, such as municipality or sex. Each operation is a recipe step that can be undone and replayed at the next fetch.

| Operation | What it does |
|---|---|
| Read periods | Makes uniform periods (`2024-03`, `2024-Q1`, `2024`) from `2024M03`, `2024K1`, `2024-Q1`, `Q1 2024`, `202403`, `2024` and dates, and a date column for charts |
| Roll up periods | One row per quarter or year, with sum, mean, last value, minimum or maximum; the table is replaced |
| Change over time | Difference or percentage against the previous period or the same period last year |
| Index | Every value against a base period that is 100; a year as base takes the mean of its months or quarters |
| Moving average | The mean of the latest periods, or centred; only full windows give a value |
| Seasonally adjust | Trend, season and adjusted value with R (`stl`); the series must be complete and at least two years long, others stay empty |

The rows need not be in order, and the series are not mixed up. Periods in a format that is not recognised stay empty, so check
the count in the preview.

In Visualise the chart types **Time series** (one line per series) and **Small multiples** (one small chart per series) are available.

## Models and Prediction

When a regression is done you can press *Save the model*. The coefficients are saved in the dataset and go along in bundles and
backups. The tool *Models* in the Statistics tab lists them with their formula.

The operation **Prediction from a model** under Calculations in Process calculates a new column with the model, on the same dataset
or another with the same columns. The calculation is ordinary SQL, so neither R nor Python is needed. The model is copied into the
recipe step, so the recipe can be replayed even if the original dataset is gone. The new column's description in the codebook holds
the model's formula and fit.

- If a column the model needs is missing, a message says which.
- A row with an empty value in an explaining column gets no prediction.
- A text value the model has not seen counts as the reference level, that is, with nothing added.
- A logistic model gives the probability of the last outcome in alphabetical order.

Only linear and logistic models can be saved, since they can be expressed as a formula. Models that need their original library
cannot run as a recipe step.
