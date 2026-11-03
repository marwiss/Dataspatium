# Share

The Share mode gathers everything about giving data to other people and devices. Export is about files to your own
computer; Share about bundles, GitHub, the share menu, publishing and receiving. The Devices tab, direct transfer
between computers and phones, comes in 2.1.

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

## Share menu

The computer's or phone's own share menu: send a file to e-mail, Teams, messaging apps or other apps. Choose whether
the selected dataset is shared as a file (CSV, Excel, ODS or JSON) or whether all datasets are shared as a bundle,
and press *Share*. The share menu for files exists in Edge and Chrome on Windows and on mobile; in other browsers
(Firefox) the file is saved instead, and the button is then called *Save file*.

## Publish

A standalone HTML file that works without Dataspatium and can be put on an intranet or sent: dashboards (with the
charts embedded) and documents from templates, filled with the selected dataset. Published files contain data and
charts in clear text; share them only with those who may see the information.

## Receive

Open a bundle from a file (drop it on the surface) or from a web address. Sender, message and changes are shown
first; datasets that already exist can be replaced with the bundle's version, otherwise they are skipped. A backup
(ZIP from *Back up the workspace*) can also be opened here, but belongs under Manage, Workspace.

## What is not possible

A browser cannot be a server, so others cannot fetch data directly from your computer without a file or a bundle
passing between you: through the share menu, a cloud folder (the portable folder under Manage can live in OneDrive or
Dropbox), GitHub or, from 2.1, directly between devices with WebRTC. `mailto:` links cannot carry attachments; use
the share menu or save the file and attach it.
