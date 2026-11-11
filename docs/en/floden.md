# Flows and watches

A **flow** is a saved chain of steps that runs with one click or when the app starts: fetch new data, process, draw charts,
write documents and export. It is the monthly report on one button. A **watch** keeps track of whether the source of a
dataset has changed and says so in the status bar. Both are under *Flows and watches* in the object panel in Manage.

## Creating a flow

Press *New flow*, give it a name and add steps. The steps run from the top down, and you move them with the arrows.

| Step | What it does |
|---|---|
| Fetch new data | Reads the source again and replays the dataset's recipe, for one dataset or all fetched ones |
| Replay a recipe | Applies the same processing to another dataset |
| Run an R or Python script | Runs a saved script from Analyse; what it writes with `dm_write` becomes datasets |
| Save a list as a dataset | Runs a saved list or query from Search; the next run updates the same dataset, so charts on it keep working |
| Export a chart | Draws a saved chart as PNG, SVG or PDF; with a grouping column, one chart per value |
| Export a dashboard | Writes the dashboard as a standalone HTML file |
| Create a document | Fills a document template; with a grouping column, one document per value |
| Export a dataset | Writes the dataset as a file |
| Run a command | Runs one of the app's commands with arguments as JSON; the answer is the command's data |

A chart or document that builds on a dataset is drawn with the data there when the step runs, so put them after the steps
that fetch and process.

## Conditions, loops and questions

A flow can choose its way by what earlier steps gave. Give a step a *Name of the answer*, and later steps reach the answer as
`{{name.field}}` in arguments, questions and messages, and as `name.field` in conditions. *Run a command* runs one of the
commands the AI in the app uses too, with the arguments as JSON. If the step is called `count` and runs `run_sql` with
`{"dataset": "Population", "sql": "select count(*) from data"}`, the number is `count.rows[0][0]`.

The commands that only read are `list_datasets`, `describe_dataset`, `read_rows`, `column_stats`, `run_sql`, `list_operations`, `describe_operation`, `list_items`, `list_files`. The ones that change something or make files are `apply_operation`, `undo`, `refresh_dataset`, `replay_recipe`, `run_script`, `list_to_dataset`, `render_chart`, `dashboard_html`, `generate_document`, `export_dataset`, `run_flow`, `run_r`, `run_python`. `run_sql` runs only
one statement that reads.

| Step | How it works |
|---|---|
| If a condition holds | Runs the steps under *Then* if the condition holds, otherwise the steps under *Otherwise* |
| For each value in a list | Runs the steps once for every value of an earlier answer, for example `municipalities.rows`; the value is reached as `{{item}}`, and a number n gives the rounds 1 to n |
| Repeat until a condition holds | Runs the steps and tries the condition after every round, with a pause between rounds; the round is reached as `{{round}}` |
| Ask me | Shows a question with answers to choose from, one per line, and waits for the answer, which is reached as `{{name.answer}}` |
| End the flow | Ends the flow with a message in the log; it does not count as an error |

A condition is written with the comparisons `=`, `!=`, `<`, `<=`, `>`, `>=` and `contains`, the words `and`, `or` and `not`,
parentheses, numbers, text in quotes and references to answers, for example `count.rows[0][0] > 0 and name = 'Ale'`. The app
reads the condition itself and never runs it as code. A missing answer counts as empty, and a condition that cannot be read
shows at once in the editor.

Both loops have a limit, *At most this many rounds* (default 100, at most 1,000) and *At most this many seconds*, and the limit
reached first holds. The loop's answer says how many rounds it went (`rounds`) and why it ended (`reason`: `done`, `until`,
`rounds` or `time`), so that a later condition can choose by it.

*Stop*, in the flow view and in the status bar, stops the flow before its next step and after every round, and a pause ends at
once. A step that has already begun runs to its end. The log says where the flow stopped, for example *Stopped by you in round
37 of 250*, and what was done can be undone as usual.

## Running a flow

*Run* starts the flow. The status bar shows which step is running, and the log gets one line per step. *Stop* stops the
flow before the next step. A flow stops at the first error unless you have turned on *Go on with the next step after an
error*. The run still counts as failed then. The inspector shows the latest run step by step, with the error where it happened.

The files from a run stay until you fetch them with *Download the result* or close the app. One file comes as it is, and
several become a ZIP file.

A flow never sends anything out of the app. What you want to share with others goes through the mode Share, where personal
data is reviewed first.

## Running at start

With *Run when the app starts* the flow runs shortly after the app opens. It only runs if it need not ask anything:

- Steps that fetch from the net need the consent already given.
- Steps that read through the database bridge do not run at start, since the bridge is connected by hand.
- Python scripts need Python already fetched.
- A flow that asks you (*Ask me*) never runs at start.

Otherwise the flow is skipped and the log says why. Nothing runs while the app is closed.

## Watching a source

Watching applies to datasets fetched from an API or a database, and to linked files. Turn it on with *Watch the source* on
the dataset's page in Manage, or on the tab *Watches*.

*Check now* reads all watched sources. The app compares the rows with how they looked when the dataset was last updated. The
same rows in another order are no news. If something has changed, the status bar shows *New data*, and the tab tells how
many rows the source has now, how many are new or changed, and which columns have come or gone.

A changed row counts both as new and as gone, since the app does not know which columns identify a row.

The dataset does not change until you press *Update*. The new data is then fetched and the recipe replayed, and the watch
then compares with the new version. That also applies when you update in another way, for example in a flow.

With *Check when the app starts* the check happens at start, but only for sources you have already consented to. Linked
files are then checked only if the browser still holds your permission; otherwise it says *Not checked*.

## Backups

Flows follow backups and the portable folder, but not bundles to others, since they point at datasets in your workspace. A
flow from a backup never starts by itself until you have turned that on again.

## Limitations

- The check fetches the whole answer from the source. Large sources take as long as an ordinary fetch.
- Only one flow runs at a time.
- Only steps with a name give answers that later steps can read: a command gives its data, a loop `rounds` and `reason`, a
  question `answer`, and other steps their message and files.
- Updating several datasets in one step is not cancelled in the middle of a fetch.
