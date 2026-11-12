# Share

The Share mode gathers everything about giving data to other people and devices. Export is about files to your own
computer; Share about bundles, GitHub, devices, the share menu, publishing and receiving. Before datasets leave
the app they go through a review of personal data (see below).

## Bundle

A bundle is a ZIP file with chosen datasets and what belongs to them: charts, dashboards, templates, notebooks and
scripts, together with a message, the sender's name and a change log of what has been done with each dataset since
it was last shared. *Create bundle* opens the dialog with all datasets preselected; with a dataset selected there is
also *Bundle only this one*. The recipient opens the bundle under *Receive* and sees the message and the changes
before anything is taken in. The inspector shows how much there is to share. See also [format.md](format.md) on how
the bundle is built.

**The files.** A dataset with files shows how large they are, and you can leave them behind to make the bundle smaller. The rows follow. Without its files a picture collection shows only the facts about the pictures, and a document its text.

## GitHub

The workspace as a folder in a GitHub repository, preferably private. Enter the repository (`owner/name`), branch
and folder, and a fine-grained access token that may only read and write the contents of that repository. The token
is used for the session or stored encrypted; nothing is sent until you press *Push to GitHub* or *Fetch from
GitHub*. Only changed files are sent, in one commit with your message. When fetching you choose, as for bundles,
whether datasets that already exist are replaced (your own version is kept under *Versions*). The first time, the
app asks for permission to contact GitHub (see *Internet access* in [anvandarguide.md](anvandarguide.md)).

## Working together through GitHub

When you fetch from GitHub, what is here is compared with what was fetched, by their histories. The dialog says for each
dataset who has changed what, and comments and notes from both sides are always kept.

- If only the other side has changed the data, that version comes in and yours is kept as a version to go back to.
- If only you have changed the data, your version stays.
- If both have, you choose: keep both, with the fetched one as a dataset of its own, keep yours or take the fetched one. Keeping
  both is the default, so nothing is lost.

Comments from others that you have not read show in the status bar. A click opens them, and the name of the writer stands by
each comment. The name is what that person has given.

## Devices

Direct transfer to phones, tablets and other computers over the local network, without a server. The computer
shows a QR code; the phone scans it with the camera and opens Dataspatium Mobile, which receives bundles and files,
shows the tables and can forward them or hand them to another computer. The first time, the phone shows a code
that is typed into the computer and the devices are paired; after that one scan is enough. Both devices show the
same verification code, and the receiver approves before anything is received. Two computers connect with pasted
codes. The whole flow, requirements and troubleshooting are in [mobil.md](mobil.md). The button *QR code for the
mobile page* shows the address to scan for opening the mobile page the first time.

## Review before sharing

Everything that leaves the app through bundles, devices or the share menu is reviewed first, and the review covers the whole file. The app looks for identity numbers, e-mail addresses and
phone numbers, both in whole columns and inside running text, and lists what otherwise comes along without showing in the table. For each part you choose what happens in the copy.

| Part | Choice |
|---|---|
| Column with identity numbers, e-mail or phone | Keep, pseudonymise or drop. Pseudonymise means that the same value gives the same code, but the value cannot be read back |
| Running text, such as the paragraphs of documents | Keep, mask the matches or drop the column |
| The graph's edges and the model's properties | Keep, mask the matches or remove in the copy |
| Original files | Keep or remove. They cannot be pseudonymised, so removal is suggested when anything else changes |
| Pictures | Keep or remove. The position is removed separately, both from the table and from the picture file |
| Comments and authors in the documents' metadata | Keep or remove |
| Collected rows | Who collected can be pseudonymised, and the position can be removed |

Only the copy that is shared changes, and the dataset in the app stays as it is. If you change anything, neither the change log nor the recipe comes along, since they can hold the original values.
Bundles are also cleaned of traces of removed values in the file itself.

The review does not see everything. Names, addresses and the contents of original files and pictures you have to judge yourself. A bundle carries charts, dashboards and notebooks only for the chosen
datasets. Personal data in them, in templates and scripts, in the notebooks' saved outputs and in the datasets' names and file names is listed
under *What else the package carries* and masked in the copy, unless you choose to keep it, remove the outputs or leave the file out.

A sync to **GitHub** must be able to come back as it was, so nothing can be pseudonymised there. Instead the app shows what may be personal data before you send. **Publish** creates an HTML page with
the values the charts show, so check them before you put the page out.

### Personal data in an IFC model

A model handed to an authority becomes a public record, and the IFC file carries more than the 3D view shows. For an IFC model the review therefore looks inside the
file itself. The tables of elements and properties are built from the file and are not listed apart.

| Part of the model | What is found |
|---|---|
| People (IfcPerson) | Names, identification and the person's addresses with e-mail and phone |
| The organisations' addresses | Postal addresses, e-mail and phone (IfcPostalAddress, IfcTelecomAddress) |
| The owner history (IfcOwnerHistory) | The user who owns or last changed the objects, and the application |
| The file header (FILE_NAME) | Author, organisation and the person who authorised the file |
| Actors and occupants (IfcActor, IfcOccupant) | The roles and the people they point to |
| Free text | E-mail addresses, identity numbers and phone numbers in names, descriptions and properties, with the same checks as in tables |

Each part can be kept, pseudonymised or removed in the copy. The default is to pseudonymise people, owner history and actors, and to remove addresses, the
header and the matches in free text.

- *Pseudonymise* replaces names, identities and addresses with codes. The same value gives the same code in the file and in the tables. The application in the
  owner history stays.
- *Remove in the copy* empties the header and removes the addresses, the actors and the owner history. In IFC2X3, where every object must have an owner history,
  the objects get the app's neutral one instead. People who remain become the app's neutral user, and the matches in free text become [***].
- A person who only stood in the owner history or with an actor goes with it.
- GlobalIds, storeys, elements, types and geometry are kept, and the copy's tables are rebuilt from the cleaned file.

This is done by IfcOpenShell in the app's Python. If Python is not running you can only keep the parts or cancel, and the dialog says why. *Start Python* starts it
(the first time it is fetched after your consent), and then the parts get every choice. Names written as plain text in properties are not recognised, so judge
those yourself.

The review of the model applies to every way out: bundles, devices, the share menu, publishing and OpenCDE, also when the model's own IFC file is sent. A sync to
GitHub cannot change anything, so there the review only shows what comes along.

## Share menu

The computer's or phone's own share menu: send a file to e-mail, Teams, messaging apps or other apps. Choose whether
the selected dataset is shared as a file (CSV, Excel, ODS or JSON) or whether all datasets are shared as a bundle,
and press *Share*. The share menu for files exists in Edge and Chrome on Windows and on mobile; in other browsers
(Firefox) the file is saved instead, and the button is then called *Save file*. On a phone with Dataspatium Mobile
installed, files can also be shared *to* Dataspatium from other apps; they end up under *Received* on the mobile
page.

## Publish

A standalone HTML file that works without Dataspatium and can be put on an intranet or sent: dashboards (with the
charts embedded) and documents from templates, filled with the selected dataset. Published files contain data and
charts in clear text; share them only with those who may see the information.

**A dataset as a page of its own.** Under Datasets, a dataset becomes a page in its own form: a text to read, pictures to look through, a map, a network or a table to filter. The page fetches nothing from the network and can be sent as one file. It goes through the review first and shows at most 2,000 rows or 100 pictures.

## Publishing a workspace

*Publish the workspace* makes a site of the whole workspace or a selection, to put on an intranet or send. It becomes a ZIP
with a start page and a page for each dataset, dashboard and document, with search in tables and a code book under each dataset.
The pages can only be read, hang together with relative links and fetch nothing from the network.

The datasets go through the review and are shown from copies. Dashboards and documents are drawn from the datasets as they are,
so there you are told what they hold and choose yourself whether they come along.

## To the CDE

The tab *To the CDE* sends a dataset to a project on an OpenCDE server such as Dataregium. Choose the server, sign in and choose
the project; then choose whether the dataset is written in a file format or the original file is sent, and whether it goes
through the Documents API, where the server's own page asks for title, version and project and the file then goes up in parts,
or as a BCF document, which takes the file only. The dataset is written from a copy that has been through the review, and
original files get the same warning as in bundles. A dataset fetched from the server can be sent as a new version of its
document, and the card *From the CDE* in Manage then knows about it. Every send is noted in the dataset's history.

*Workspace bundle* sends a bundle instead of a dataset: the bundle dialog chooses datasets and contents as usual, the review is done,
and the file goes up as a document. The recipient sees the bundle in the source's file list in Import and receives it with a click.

## Receive

Open a bundle from a file (drop it on the surface) or from a web address. Sender, message and changes are shown
first; datasets that already exist can be replaced with the bundle's version, otherwise they are skipped. A backup
(ZIP from *Back up the workspace*) can also be opened here, but belongs under Manage, Workspace.

## What is not possible

A browser cannot be a server, so others cannot fetch data from your computer when it is off or when they are not on
the same network; then a file or a bundle passes through the share menu, a cloud folder (the portable folder under
Manage can live in OneDrive or Dropbox) or GitHub. On the same network the transfer goes directly between the
devices (the Devices tab). `mailto:` links cannot carry attachments; use the share menu or save the file and attach
it.
