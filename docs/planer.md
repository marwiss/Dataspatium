# Planer: digitala detaljplaner och översiktsplaner

Dataspatium öppnar digitala planer som planer: en detaljplan ritas som plankarta med Boverkets färger och
beteckningar, bestämmelserna listas och slås upp i Boverkets Planbestämmelsekatalog, och en översiktsplan visas
tema för tema. Planen är en datamängd av slaget *plan*: ett planobjekt per rad (planområdet och varje bestämmelse
eller innehållsobjekt) med geometri i WGS 84, planens uppgifter i metadata och originalfilen sparad i datamängden.
Tabellen är alltid en knapp bort.

## Format som läses

| Format | Känns igen på | Innehåll |
|---|---|---|
| Nationell specifikation Detaljplan (Lantmäteriet, version 4) | GeoJSON med `feature:typ` (detaljplan, anvandningsbestammelse, egenskapsbestammelse, administrativBestammelse, beslutsinformation, planbestammelsebeskrivning) eller `feature:mediatyp application/vnd.lm.detaljplan.v4+json` | Planområde, bestämmelser med katalogreferens, formulering och värde, beslutsinformation (påbörjad, antagen, laga kraft, genomförandetid), motiv |
| Referensobjekt från Nationella geodataplattformen | STAC-objekt med `properties.detaljplan` och `properties.planbestammelse` (svaret från Lantmäteriets detaljplans-API) | Planens uppgifter, bestämmelsernas formulering, katalogreferens, kategori och värde |
| Nationell specifikation Översiktsplan (testversion 1.0) | GeoJSON med `feature:typ` oversiktsplan, innehallOP, beslutOP | Planens uppgifter och innehållsobjekt med innehållstyp, namn, precisering och planhändelse |
| Boverkets ÖP-modell (GeoPackage) | Tabeller `innehall_op_<tema>_<geometrityp>` och `oversiktsplan` | Alla innehållslager som en plan med tema per lager |

Koordinater i SWEREF 99 TM och de lokala SWEREF 99-zonerna (EPSG:3006–3018, lästa ur `koordinatsystemPlan`) samt
Web Mercator räknas om till WGS 84. En GeoJSON-fil känns igen på innehållet, inte på filändelsen: släpp den i
Inhämta så visas planens uppgifter och knappen *Importera*. En GeoPackage-fil i ÖP-modellen får valet *Hela
översiktsplanen som plan*; avslaget importeras en tabell i taget som förut.

Från Lantmäteriets detaljplans-API (källan *Lantmäteriet geodataplattformen: detaljplaner*, kräver nyckel från en
ansluten organisation) sparas ett svar som plan med knappen *Spara som plan* i stället för som tabell.

## Plankartan i Bearbeta

En plan öppnas som plankarta: användningsbestämmelserna fyllda med Boverkets färger (bostäder gul, centrum brun,
industri blågrå, gata ljusgrå, park ljusgrön, vatten blå och så vidare enligt de allmänna råden till BFS 2020:5;
nyanserna är appens), egenskapsbestämmelser som blå streckade konturer, administrativa bestämmelser som lila
punktade, planområdesgränsen i svart och beteckningarna som etiketter. Klicka på ett objekt så visar inspektören
dess uppgifter och vad Planbestämmelsekatalogen säger om bestämmelsen: kod, typ, giltighet och katalogens
formulering. Lagren slås av och på per typ, bakgrundskarta visas efter samtycke, och knapparna ger *Spara som
kartvy* (för Visualisera, dashboards och Publicera), *Planbestämmelser* (bestämmelselistan som Markdown) och
*Visa som tabell*.

En översiktsplan ritas per tema: mark- och vattenanvändningen fylld per innehållstyp, övriga teman med en färg per
tema och valbar synlighet. Inspektören visar arean per mark- och vattenanvändning.

## Fliken Plan i Analysera

För en plan finns fliken **Plan** efter Regex:

- **Sammanfattning**: planens uppgifter, antal objekt per typ, katalogreferensernas status och planens användningsyta.
- **Bestämmelser**: alla bestämmelser som tabell med beteckning, formulering, kategori, värde, kod och
  katalogstatus; kan sparas som datamängd eller laddas ned som Markdown. För en översiktsplan: innehållet per tema.
- **Areor**: area per användning (summa av ytorna, räknad i SWEREF 99 TM) och andel av planens användningsyta.
- **Katalogkontroll**: varje katalogreferens slås upp i Planbestämmelsekatalogen: gällande, ersatt (och av vad),
  upphörd, okänd eller saknad referens, och om formuleringen följer katalogens mall.
- **Sök i katalogen**: fritextsökning bland katalogens 3 700 bestämmelser med filter på typ, användningsform och
  gällande; resultatet kan sparas som datamängd.

## Planbestämmelsekatalogen

Appen har en inbäddad kopia av Boverkets Planbestämmelsekatalog (öppna data; release 20251201) så att uppslag,
färger och katalogkontroll fungerar utan nät. Källa ska anges: Boverket och Planbestämmelsekatalogen. Katalogen
finns också som källa i Inhämta (*Boverket Planbestämmelsekatalogen*): slå upp en bestämmelse på dess UUID, lista
releaser, färger, användningsformer, kategorier och symboler via Boverkets öppna API. Kopian uppdateras med
`python tools/plan_catalog.py` inför en ny utgåva.

## Begränsningar

- Boverkets färger anges i föreskrifterna som namn; nyanserna i appen är egna. Symbolbeteckningar (prickmark,
  korsmark med flera) ritas som konturer med beteckning, inte med Boverkets symboler.
- Planbestämmelsebeskrivning, planeringsunderlag och beslutshandlingar följer bara med som text (motiv) respektive
  som uppgifter i planens metadata; dokumenten hämtas inte.
- Areor är planära beräkningar i SWEREF 99 TM; för planer i lokala zoner är felet försumbart.
- Lantmäteriets detaljplans-API kräver nyckel; appen är testad mot den dokumenterade modellen med egna testdata.
