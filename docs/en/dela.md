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

## GitHub

The workspace as a folder in a GitHub repository, preferably private. Enter the repository (`owner/name`), branch
and folder, and a fine-grained access token that may only read and write the contents of that repository. The token
is used for the session or stored encrypted; nothing is sent until you press *Push to GitHub* or *Fetch from
GitHub*. Only changed files are sent, in one commit with your message. When fetching you choose, as for bundles,
whether datasets that already exist are replaced (your own version is kept under *Versions*). The first time, the
app asks for permission to contact GitHub (see *Internet access* in [anvandarguide.md](anvandarguide.md)).

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

The review does not see everything. Names, addresses and the contents of original files and pictures you have to judge yourself. Charts, notebooks and documents in a bundle can show the original
values, so leave them out if needed. File names come along.

A sync to **GitHub** must be able to come back as it was, so nothing can be pseudonymised there. Instead the app shows what may be personal data before you send. **Publish** creates an HTML page with
the values the charts show, so check them before you put the page out.

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
