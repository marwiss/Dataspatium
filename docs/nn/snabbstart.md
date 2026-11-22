# Snøggstart: Dataregium og Dataspatium saman

Frå ei tom datamaskin til innlogga i Dataregium frå Dataspatium, med ei sak oppretta i
ei 3D-vising og synleg i loggane til serveren. Det tek omtrent tjue minutt, mest det
første bygget. Følg stega i rekkjefølgje, og bruk adresser og portar nøyaktig slik dei
står: nesten alle problem kjem av ei overhoppa innstilling eller ei anna adresse.
[Feilsøking](#feilsøking) seier kva du gjer om noko går gale. Den same sida finst i
repoet til Dataregium; dei to blir haldne identiske.

## What you need

- Docker: Docker Desktop on Windows and macOS, Docker Engine with the compose
  plugin on Linux. It must be running: `docker version` answers for both client
  and server.
- Git, or the source code ZIP from Dataregium's
  [latest release](https://github.com/marwiss/Dataregium/releases/latest) in place
  of `git clone` below.
- Python 3, as a small local web server.
- Microsoft Edge, Google Chrome or Firefox.
- The ports 8000, 5442, 7484, 7697 and 8080 free on your machine.

If you have tried Dataregium on this machine before, begin with
[Start over](#start-over).

## 1. Start Dataregium

```sh
git clone https://github.com/marwiss/Dataregium.git
cd Dataregium
cp .env.example .env
```

In the Windows Command Prompt, `copy` takes the place of `cp`.

Open `.env` in a text editor. The seven lines below are already in the file, two
of them with a `#` in front: change them to read like this, without the `#`, and
save. Choose two passwords of your own, at least 16 characters, letters and
digits only.

```ini
COMPOSE_PROFILES=graph
OPENCDE_TIER=experimental
OPENCDE_STORE_PASSWORD=YourOwnPassword5678
OPENCDE_GRAPH_PASSWORD=YourOwnPassword1234
OPENCDE_DYNAMIC_CLIENT_REGISTRATION=true
OPENCDE_REQUEST_LOG_ENABLED=true
OPENCDE_IFC_DB_ENABLED=true
```

| Line | What it does | Without it |
|---|---|---|
| `COMPOSE_PROFILES` | Starts the graph database beside PostgreSQL | No graph database, and the server does not start |
| `OPENCDE_TIER` | Chooses tier 3, Experimental, which IFC-DB's graph belongs to | Left at `bim-gis`: the server refuses to start, and `docker compose logs api` says why |
| `OPENCDE_STORE_PASSWORD` | The password of PostgreSQL, which holds the server's own data | Missing or empty: Compose starts nothing |
| `OPENCDE_GRAPH_PASSWORD` | The password of the graph database | Shorter than 16 characters: the database does not start |
| `OPENCDE_DYNAMIC_CLIENT_REGISTRATION` | Lets Dataspatium register itself with the server | Step 3 stops, and the app asks for a client id |
| `OPENCDE_REQUEST_LOG_ENABLED` | Records the app's calls | The request log in step 5 stays empty |
| `OPENCDE_IFC_DB_ENABLED` | Turns uploaded models into a graph | No graph in step 5 |

These settings are for trying Dataregium on your own machine, not for a server that
others use.

Start the server and load the demonstration data:

```sh
docker compose up -d --build --wait
docker compose exec api opencde seed
```

The first command takes a few minutes the first time and returns when the server
is running. The second creates demonstration users and projects and prints their
passwords **once**: save the passwords of `admin` and `inspection_manager` now.
Leave the lines that begin with `client` alone; Dataspatium registers a client of
its own.

Check that it works: <http://127.0.0.1:8000/readyz> answers
`"status":"ready","graph":"ok","store":"ok"`: the graph and PostgreSQL answer.
Sign in at <http://127.0.0.1:8000/signin> as `admin` and open
<http://127.0.0.1:8000/admin/projects>, which lists *Building permit* and
*Demolition permit*.

When you change `.env` later, run the `up` command again. `docker compose restart`
does not read the file.

## 2. Start Dataspatium

1. Last ned `dataspatium-<version>.zip` frå den
   [siste utgåva](https://github.com/marwiss/Dataspatium/releases/latest),
   og samanlikn SHA-256-summen med den i utgåveteksten (`Get-FileHash` i PowerShell,
   `shasum -a 256` på macOS og Linux).
2. Pakk ut ZIP-fila i di eiga mappe. Windows kan opprette ei mappe i mappa; det som
   tel, er mappa der `index.html` ligg direkte.
3. Opne ein terminal i den mappa, og start ein webserver på port 8080:

   ```sh
   python -m http.server 8080 --bind 127.0.0.1
   ```

   Kommandoen kan heite `python3` på macOS og Linux og `py` på Windows. La terminalen
   vere open medan du bruker appen. Oppgje alltid porten: utan han tek Python 8000, som er porten til Dataregium.
4. Opne <http://127.0.0.1:8080/>, skrive akkurat slik: serveren sender nettlesaren tilbake etter innlogginga til `127.0.0.1`, ikkje til `localhost`. Ikkje dobbeltklikk på `index.html`: opna frå mappa
   kan ikkje appen registrere seg sjølv. Appen lastar seg sjølv på nytt éin gong ved
   første start.
5. Første start spør om språk: vel eitt, og trykk *Hald fram på …*. Denne sida bruker
   dei nynorske namna. Panelet *Velkomen til Dataspatium* tilbyr eit kurs: trykk
   *Ikkje no*.

## 3. Logg inn i Dataregium frå Dataspatium

1. Vel modusen *Hent*. I venstre kolonne, under *Legg til kjelder*, vel du *OpenCDE*.
2. Under *Adresse* skriv du `http://127.0.0.1:8000`. **La *Klient-id* og hemmelegheita
   stå tomme**: appen registrerer seg sjølv, sjølv om teksten i dialogen snakkar om ein
   klient-id frå administratoren. Trykk *Legg til kjelde*.
3. Appen spør *Tillate internettilgang?* opptil tre gonger, éin gong per føremål. Her
   gjeld det berre din eigen server: trykk *Tillat* kvar gong.
4. Kjelda blir opna og vist under *Tillagde kjelder*. Linja "Tenaren: Dataregium OpenCDE
   server <version>. Tillegg: …" kjem frå kapabilitetsdokumentet til serveren og seier
   kva tillegg som er slått på. Merket *Krev nøkkel* kan du sjå bort frå: det som
   trengst, er innlogginga.
5. Trykk *Logg inn*. Eit popup-vindauge blir opna med innloggingssida til serveren. Om
   nettlesaren blokkerer det, tillat popup-vindauge for `http://127.0.0.1:8080`, og
   trykk igjen.
6. Logg inn som `inspection_manager` med passordet frå steg 1, og trykk *Tillat og logg
   inn*. Ikkje bruk `admin`, som ikkje er med i noko prosjekt. Vindauget lukkar seg
   sjølv, og kjelda seier *Innlogga som Certified inspection manager*.
7. *Building permit* er allereie vald i lista *Prosjekt*.

Du er innlogga til sida blir lasta på nytt; trykk då *Logg inn* igjen. Kjelda blir
verande.

## 4. Opprett ei sak frå 3D-visinga

1. I visinga av kjelda finn du *Filer i prosjektet* og trykkjer *Vis filer*.
   `opencde seed` la `three_walls_gtin.ifc` der (tre veggar med GTIN 3, 2 og 1). Trykk
   *Hent*: fila blir eit modelldatasett.
2. Vel modusen *Bearbeid*; modellen blir opna i 3D. Klikk på ein vegg for å merke han.
3. Trykk *Saker* over 3D-visinga og deretter *Ny sak* i høgre kolonne. Skriv noko under
   *Tittel*, og trykk *Opprett sak*. Saka blir oppretta gjennom BCF-API-et, og visinga
   og den merkte veggen følgjer med som viewpoint.
4. Under saka skriv du noko i *Skriv ein kommentar* og trykkjer *Send*.

## 5. See it on the server

Signed in as `admin`, open <http://127.0.0.1:8000/admin>:

- *Projects* shows *Building permit* with two topics (the one from `opencde seed` and
  yours) and one document.
- *Audit log* lists the sign-in and the registration of the app.
- *Request log* shows every call the app made, with the same `X-Request-ID` values
  as the card *Log* at the bottom of the source's view in *Import*, so a failing
  call can be found on both sides.

The sample model is a graph already, since `OPENCDE_IFC_DB_ENABLED=true` was in
`.env` when you ran `opencde seed`. Neo4j Browser at <http://127.0.0.1:7484> (connect
to `bolt://127.0.0.1:7697` as `neo4j` with the password of `OPENCDE_GRAPH_PASSWORD`)
answers this query with the model's three walls and their GTINs:

```cypher
MATCH (w:IfcWall)-[:IS_DEFINED_BY]->(:IfcRelDefinesByProperties)-[:RELATING_PROPERTY_DEFINITION]
      ->(:IfcPropertySet {Name: 'Reuse'})-[:HAS_PROPERTIES]->(p:IfcPropertySingleValue {Name: 'GTIN'})
RETURN w.GlobalId, w.Name, p.NominalValue
```

A model you send from Dataspatium becomes a graph the same way. To try it, press
*Sign out* at the top of the server's page, since the upload is done as another user:

1. In Dataspatium, choose the mode *Share* and the tab *To the CDE*. Under *What*,
   choose *The original file*, and press *Send*.
2. *Review before sharing* lists what goes along: press *Continue*.
3. The server's upload page opens in a pop-up. Sign in as `inspection_manager` and
   press *Save and continue*. The pop-up closes by itself.

Within seconds the same query finds the walls of the new model too.

## Troubleshooting

Each row quotes the screen as it reads with the English names.

| What you see | Why | What to do |
|---|---|---|
| `Cannot connect to the Docker daemon`, `error during connect` or `docker: command not found` | Docker is not running | Start Docker Desktop, wait until it says it is running, and run the command again |
| `dependency failed to start: container dataregium-graph-1 is unhealthy` | A password of fewer than 16 characters, which Neo4j refuses (`docker compose logs graph` says `A password must be at least 16 characters`), or a database volume left by an earlier installation with another password | Correct the password and run the `up` command again. For the old volume, see [Start over](#start-over) |
| `required variable OPENCDE_STORE_PASSWORD is missing a value` | `.env` has no password for PostgreSQL, perhaps an `.env` from an earlier try | Add the lines `COMPOSE_PROFILES=graph` and `OPENCDE_STORE_PASSWORD` as in step 1 (an `.env` from an earlier try has neither) and run the command again |
| `port is already allocated`, `Ports are not available` or `address already in use` | Another program holds 8000, 5442, 7484 or 7697, perhaps an earlier Dataregium (`docker ps` shows it) | Stop it, or set other ports with `OPENCDE_DEV_PORT`, `OPENCDE_DEV_POSTGRES_PORT`, `OPENCDE_DEV_NEO4J_HTTP_PORT` and `OPENCDE_DEV_NEO4J_BOLT_PORT` in `.env` and use your port instead of 8000 from then on |
| The containers of another folder are replaced | Two checkouts on one machine share the Compose project name `dataregium` | Give the second one `COMPOSE_PROJECT_NAME=dataregium-2` and other `OPENCDE_DEV_*` ports in its `.env` |
| `the IFC graph is not empty` or `the database is not empty` | `opencde seed` has already run and printed the passwords then | Get a new password with `docker compose exec api opencde user set-password inspection_manager`, or [start over](#start-over) |
| `python` is not found, or the Microsoft Store opens | The command has another name on this machine | Use `py` or `python3` |
| A list of files instead of the app | The web server runs in the outer folder | Stop it with Ctrl+C and start it in the folder that holds `index.html` |
| An old version of the app, or something else entirely | Something else answers on port 8080; on Windows a second web server can start on the same port without an error | Use another port, `python -m http.server 8090 --bind 127.0.0.1`, and open `http://127.0.0.1:8090/` |
| *The app can register itself with the server only when it runs from a web server …* | The app was opened from the folder | Open `http://127.0.0.1:8080/` |
| *Could not reach 127.0.0.1:8000 …* | Dataregium is not running, or the address is mistyped | <http://127.0.0.1:8000/readyz> must answer. The address is `http://127.0.0.1:8000` with nothing after it |
| *The server does not let the app register itself …* | `OPENCDE_DYNAMIC_CLIENT_REGISTRATION` is not `true` | Change `.env`, run the `up` command again, and press *Add source* again |
| *The registration failed:* … `Redirect URIs to http://localhost are not allowed here` | The app was opened on `localhost`, which the server does not accept as the way back | Open `http://127.0.0.1:8080/` and add the source there |
| *The registration failed:* … `rate_limited` | More than 60 registrations within an hour; every *Add source* with an empty *Client id* is one | `docker compose restart api` empties the counter |
| *Internet access for … is not allowed.* | *Deny* was pressed | Allow it under *Manage*, *Workspace*, *Internet access*, and try again |
| *The browser blocked the sign-in window …* | The browser's pop-up blocker | Allow pop-ups for `http://127.0.0.1:8080` and press *Sign in* again |
| In the pop-up: *Cannot continue* and *Unknown client.* | The server has forgotten the app's registration, usually after `down -v` | Close the pop-up and reload the app, since *Sign in* otherwise keeps spinning for five minutes. Delete the source with the cross beside it under *Added sources* and add it again |
| In the pop-up: *Cannot continue* and *The redirect URI is not registered for this client.* | *Client id* was filled in, for instance from the output of `opencde seed` | Close the pop-up and reload the app. Delete the source with the cross beside it under *Added sources* and add it again with *Client id* empty |
| In the pop-up: *The user name or password is not correct.* | Every user has their own password from `opencde seed` | Use the right one, or get a new one as above |
| *Too many failed attempts for this user name …* | Five wrong passwords in a row make the server wait, at most 15 minutes | Wait for as long as it says, and use the password from `opencde seed` |
| *The form has expired. Please try again.* on `/signin`, or in the pop-up *Cannot continue* and *The sign-in form has expired or was tampered with. Start again.*, although you just opened the page. `docker compose logs api` shows `foreign_service_worker_removed` | A service worker in your browser from another web app that once ran on `http://127.0.0.1:8000`, for instance one started with `python -m http.server` without a port. It answers with old copies of Dataregium's pages | Wait a few seconds, until the page has reloaded by itself, and try again, since Dataregium removes such a worker. If the message stays, remove it by hand: `about:debugging#/runtime/this-firefox` in Firefox, `edge://serviceworker-internals` in Edge, `chrome://serviceworker-internals` in Chrome; find `127.0.0.1:8000` and choose *Unregister*. Every browser has its own, also one built into an editor. A private window has none, which shows quickly whether this is the cause. Keep other apps off port 8000 |
| *You are not a member of any project on the server.* | You signed in as `admin`, who is in no project | Press *Sign out* and then *Sign in* as `inspection_manager` |
| *Sign in* keeps spinning | The pop-up was closed before the sign-in was finished | Reload the page |
| The pop-up says *Kopiera adressen … / Copy the address …* | It could not reach the app's window, which was perhaps closed or reloaded meanwhile | Close the pop-up and press *Sign in* again |
| *Another account* on the upload page | The browser is signed in to the server as `admin`, who did not start the upload | Press *Sign out* on that page and sign in as `inspection_manager`; the upload then continues in the same window |

## Start over

In the folder you started from (or anywhere, with `-p dataregium`):

```sh
docker compose down -v
```

This deletes the databases and the files of the demonstration. Then run the `up` and
`seed` commands of step 1 again, which gives new passwords. In Dataspatium, delete
the source with the cross beside it under *Added sources* and add it again, since
the server has forgotten the app's registration.

To stop without deleting anything, leave out `-v`, and stop the web server with
Ctrl+C.

## Neste steg

- [docs/nn/client-guide.md](https://github.com/marwiss/Dataregium/blob/main/docs/nn/client-guide.md) om API-ane,
  kapabilitetsdokumentet og feilkodane.
- [docs/nn/deploy/](https://github.com/marwiss/Dataregium/tree/main/docs/nn/deploy) når serveren skal køyre for andre.
