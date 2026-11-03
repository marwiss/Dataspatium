# Minnisbók

Minnisbók blandar saman texta, R-kóða og SQL í reitum sem keyra í röð, og úttak hvers reits er vistað undir honum. Hún er
þriðji flipinn í hamnum Greina og leiðin frá greiningu að fullbúinni skýrslu án þess að fara út úr forritinu.

## Búa til og vinna

Smelltu á plúsinn við *Minnisbækur* í hlutaspjaldinu (eða veldu *Ný minnisbók* í skipanaspjaldinu), gefðu minnisbókinni heiti
og byrjaðu í fyrsta reitnum. Ný minnisbók fær fyrirsagnarreit, R-reit sem les valda gagnasafnið með stuttheiti þess og
SQL-reit. Gagnasafnið sem SQL-reitirnir keyra á er valið í eiginleikaspjaldinu til hægri.

Hver reitur hefur gerð (Texti, R eða SQL) sem má breyta, hnappa til að keyra, færa upp eða niður og eyða, og niðurstöðusvæði.
Ctrl+Enter keyrir reitinn sem þú ert í; *Keyra allt* keyrir minnisbókina ofan frá og niður. Reitum er bætt við neðst með
hnöppunum *Texti*, *R* og *SQL*. Allt er vistað sjálfkrafa, líka úttak.

- **Textareitir** eru skrifaðir í Markdown (fyrirsagnir með `#`, listar með `-`, `**feitletrað**`, `*skáletrað*`, tenglar og
  töflur) og birtast sniðnir undir breytingareitnum.
- **R-reitir** keyra í sömu R-setu og R-stjórnborðið, svo breytur lifa milli reita og keyrslna þar til R er endurræst.
  Útprentanir, villur, myndrit og gagnasöfn sem búin eru til með `dm_write()` safnast undir reitnum. Myndrit eru vistuð sem PNG.
- **SQL-reitir** keyra á töfluna `data` í gagnasafni minnisbókarinnar. SELECT-fyrirspurnir sýna allt að 1 000 raðir (fyrstu 50
  í yfirlitinu); UPDATE, DELETE og aðrar breytandi setningar eru framkvæmdar sem skref í uppskrift gagnasafnsins og skráðar þar.

## Flytja út og deila

*Flytja út* býr til skjal úr allri minnisbókinni: HTML (sjálfstæð síða), Word, PDF, Markdown (með myndum í ZIP þegar myndrit
eru með) eða LaTeX (ZIP með `main.tex` og myndum). Textareitir verða meginmál, kóði verður kóðablokkir (má sleppa), töflur
verða töflur og myndrit verða myndir. Sömu smiðir eru notaðir og fyrir skjalasniðin (sjá [dokumentmallar.md](dokumentmallar.md)).

*Deila (skrá)* hleður niður minnisbókinni sem `*.nb.json` með reitum og vistuðu úttaki; annar notandi hleður skránni inn með
*Flytja inn minnisbók (skrá)*, og gagnasafnið er tengt eftir stuttheiti eða heiti. Minnisbækurnar fylgja líka afritinu,
pökkum og færanlegu möppunni.

## Takmarkanir

- Ekki er hægt að rjúfa R-kóða undir file://; notaðu *Endurræsa R* í R-flipanum ef reitur frýs.
- Úttak er geymt í vafranum ásamt minnisbókinni. Mörg stór myndrit stækka minnisbókina.
- Breytingareitur textans hefur enga málskipunarlitun fyrir Markdown.
