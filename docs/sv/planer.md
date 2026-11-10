# Planer: digitala detaljplaner och översiktsplaner

Dataspatium öppnar digitala planer som planer: en detaljplan ritas som plankarta med Boverkets färger och
beteckningar, bestämmelserna listas och slås upp i Boverkets Planbestämmelsekatalog, och en översiktsplan visas
tema för tema. Planen är en datamängd av slaget *plan*: ett planobjekt per rad (planområdet och varje bestämmelse
eller innehållsobjekt) med geometri i WGS 84, planens uppgifter i metadata och originalfilen sparad i datamängden.
Tabellen är alltid en knapp bort.

## Format som läses

| Format | Känns igen på | Innehåll |
|---|---|---|
| Nationell specifikation Detaljplan (Lantmäteriet, version 4.1) | GeoJSON med `feature:mediatyp application/vnd.lm.detaljplan.v4+json` eller `feature:typ` (detaljplan, användningsbestämmelse, egenskapsbestämmelse, administrativ bestämmelse; även skrivna utan å, ä och ö) | Planområde, bestämmelser med katalogreferens, formulering, värden och motiv, geometrier som ytor, linjer, punkter och kroppar (med höjd i RH 2000), beslutsinformation (påbörjad, antagen, laga kraft, genomförandetid, diarienummer) och planbeskrivningens namn |
| Referensobjekt från Nationella geodataplattformen | STAC-objekt med `properties.detaljplan` och `properties.planbestammelse` (svaret från Lantmäteriets detaljplans-API) | Planens uppgifter, bestämmelsernas formulering, katalogreferens, kategori och värde |
| Nationell specifikation Översiktsplan (Lantmäteriet, version 2.0, testversion 4) | GeoJSON med `feature:mediatyp application/vnd.lm.oversiktsplan.v2+json` eller `feature:typ` oversiktsplan, innehallOP, beslutOP | Planens uppgifter och beslut (fattat, laga kraft), innehållsobjekt med innehållstyp, tema efter ÖP-katalogens kategori, namn, precisering, planhändelse, sambandsnivå och kopplingar, även innehåll som bara beskrivs i text |
| Boverkets ÖP-modell (GeoPackage, databasmodell 0.4) | Tabeller `innehall_op_<tema>_<geometrityp>` och `oversiktsplan` | Alla innehållslager som en plan med tema per lager, planens beslut (`beslut_op`), kopplingar mellan innehåll och planhandlingens avsnitt (bokmärken) |
| Detaljplan i GeoPackage | Tabellerna `detaljplan`, `bestammelse` och `anvandning_yta`, `egenskap_yta`, `egenskap_linje`, `egenskap_punkt` med den nationella specifikationens fältnamn | Planen som den sparas i planeringsverktyget: planområde, ytor, linjer och punkter med sina bestämmelser, beteckningar, färger, motiv och höjder, beslutsinformation och handlingar; ytor som ännu saknar bestämmelse visas som de är ritade |

Koordinater i SWEREF 99 TM och de lokala SWEREF 99-zonerna (EPSG:3006–3018, lästa ur `koordinatsystemPlan`) samt
Web Mercator räknas om till WGS 84. En GeoJSON-fil känns igen på innehållet, inte på filändelsen: släpp den i
Inhämta så visas planens uppgifter och knappen *Importera*. En GeoPackage-fil i ÖP-modellen får valet *Hela
översiktsplanen som plan*, och en detaljplan i GeoPackage valet *Hela planen som plan*; avslaget importeras
en tabell i taget som förut. Koordinatsystemet i en GeoPackage-fil läses ur filen, även när det bara står med namn
(till exempel *SWEREF99 15 00*).

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

Linjer (utfartsförbud, stängsel, utvecklingsinriktningar) och punkter (till exempel markens höjd) ritas som de är. En
bestämmelse som är begränsad i höjd ritas med sitt fotavtryck, och inspektören visar höjden i planens höjdsystem (RH 2000 i planer till NGP): underkant,
överkant eller båda. Inspektören visar också planens beslut (antagen, laga kraft, överklagad, genomförandetid,
diarienummer, beslutstyp), planbeskrivningens namn och handlingarna, och för det valda objektet övriga uppgifter som
giltighetstid, sekundär egenskapsgräns, vilka användningsbestämmelser en egenskap reglerar, sambandsnivå, vad
innehållet berör och var i planhandlingen det beskrivs. Innehåll som bara beskrivs i text, utan läge i kartan, listas
under *objekt utan läge i kartan* och kan väljas där.

## Koordinatsystem och höjder

Detaljplaner till NGP görs i SWEREF 99 TM eller i kommunens lokala SWEREF 99-zon med höjder i RH 2000, och filen anger
båda (`koordinatsystemPlan` och `hojdsystem`). Översiktsplaner är oftast i SWEREF 99 TM. Inspektören visar planens
koordinatsystem och, för en plan med höjder, höjdsystemet; en GeoPackage-fil anger inget höjdsystem, och då står det så.

Plankartan ritas som webbkarta (Web Mercator med norr uppåt, där OpenStreetMap kan vara bakgrund) eller i planens eget
system: välj det i verktygsraden, till exempel *SWEREF 99 16 30*. Då är rutnätets norr uppåt som på plankartan, och
varje objekt ligger på sina koordinater. Bakgrunden kan då komma från en WMS-tjänst som erbjuder samma system: välj
*WMS-tjänst* som bakgrundskarta och ange adress och lager (*Läs lager* hämtar tjänstens lagerlista och säger till om
lagret saknar systemet). OpenStreetMap finns bara som webbkarta. Bakgrunden hämtas efter samtycke, som andra
bakgrundskartor, och *Spara som kartvy* sparar en webbkarta.

En plan i ett koordinatsystem som appen inte kan räkna om läses med alla sina objekt, men objekten ritas inte, eftersom
de skulle hamna fel: Inhämta och inspektören säger vilket system filen anger, och objekten listas under *objekt utan läge
i kartan*. Vilka system appen räknar om står i [kartor.md](kartor.md#koordinatsystem).

## Planer från planeringsverktyg

Planer som ritas i ett planeringsverktyg läses som alla planer av samma slag, vilket verktyg som än har gjort dem. Ett exempel är [Rita Detaljplan och Rita Översiktsplan](https://github.com/ritaplan), insticksprogram till QGIS. Det de sparar och levererar öppnas så här:

| Fil | Öppnas som |
|---|---|
| Detaljplanens leveransfil till NGP (JSON, Detaljplan 4.1) | Plankarta med beteckningar och färger ur Planbestämmelsekatalogen |
| Detaljplan i GeoPackage med den nationella specifikationens fältnamn | Plankarta med planens egna beteckningar och färger, motiven och höjderna |
| Översiktsplanens leveransfil till NGP (JSON, Översiktsplan 2.0) | Översiktsplan per tema med beslut |
| Översiktsplan i GeoPackage (Boverkets databasmodell 0.4) | Översiktsplan per tema med beslut, kopplingar och planhandlingens avsnitt |
| Arkivpaket (mapp eller ZIP-fil med `metadata/PREMIS.xml`) | Planen ur mappen `content` med handlingarna, och kontrollen av filerna |

Släpp filen i Inhämta, eller hämta den med *Från webbadress* när den finns på webben (till exempel en plan som kommunen publicerar); en fil utan filändelse känns igen på sin innehållstyp. Ett arkivpaket släpps som mapp eller som ZIP-fil: appen läser planen ur mappen `content`
(GeoPackage-filen i första hand, annars leveransfilen), sparar paketets filer med planen och jämför varje fil med
kontrollsumman (SHA-256) i `PREMIS.xml`. Inspektören visar under *Arkivpaket* om filerna stämmer, vilka som har ändrats
eller saknas, och öppnar handlingarna (plankarta och planbeskrivning) i en ny flik. En plats som pekar utanför paketet
kontrolleras inte och läses aldrig. Planens egna handlingar i en vanlig mapp öppnas för sig, som dokument.

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

## Planer från andra nordiska länder

Appen läser även grannländernas digitala planer och ritar dem som planer med respektive lands färgpraxis (nyanserna är
appens; kolumnen `farg` bär färgnamnet). Boverkets katalog gäller bara svenska planer, så fliken Plan visar
sammanfattning, bestämmelser och areor för dessa.

| Land | Detaljplan / översiktsplan | Så får du in dem |
|---|---|---|
| Danmark | lokalplan (delområder, byggefelter) / kommuneplanrammer | Källan *Plandata.dk (WFS)*: **Hämta plan** med planid eller plannummer hämtar lokalplanen med delområden och byggefelter; ett lager (t.ex. kommuneplanrammer) hämtas som karta och sparas med *Spara som plan*. GeoJSON-filer från Plandata känns igen på innehållet. Färg per generel anvendelse: bolig gul, erhverv lila, center brun, rekreativt grön, offentlige formål blå, tekniske anlæg grå, sommerhus orange, landområde ljusgrön. |
| Finland | asemakaava / yleiskaava | En plan i kaavatietomallen (Ryhti-JSON med `planObjects` och `planRegulationGroups`) importeras som fil: kaavakohteenas användningsbestämmelser får kartbeteckningen (AK, VP …) ur kodlistan RY_Kaavamaarayslaji (inbäddad kopia) och den finska plankartans färger; övriga bestämmelser blir egenskapsbestämmelser. Källan *Ryhti kaavatiedot* ger planindexet (gällande och pågående planer med länkar till handlingarna) som tabell och karta; Helsingfors avoindata-WFS har stadens planindex och kaavayksiköt. |
| Island | deiliskipulag / aðalskipulag | Källan *Skipulagsstofnun skipulagsgögn (ArcGIS)*: **Hämta plan** med skipulagsnúmer hämtar plangräns, tomter, byggrätter, restriktioner och trafik (fem lager); `ask:` före numret hämtar ett aðalskipulag med landnotkun-klasser (ÍB, M, VÞ …). En GeoPackage enligt Skipulagsstofnuns mall importeras hel med valet *Hela planen som plan*. |
| Norge | reguleringsplan / kommuneplan | Vektordata kräver Norge digitalt-avtal: ladda ned planen som GeoPackage från Geonorge och importera den hel (tabellerna RpOmråde, RpArealformålOmråde, RpBestemmelseOmråde, hensynssoner med flera); arealformål-koderna får namn ur den inbäddade kodlistan och färg per huvudformål (bebyggelse gul, sentrum brun, næring lila, samferdsel ljusgrå, grønnstruktur grön, LNFR ljusgrön, sjø blå). DiBK:s WMS `https://nap.ft.dibk.no/services/wms/reguleringsplaner/` kan läggas som bakgrund i kartvyn. |

Koordinater i ETRS89 UTM 32–35, ETRS-TM35FIN, de finska GK-zonerna och ISN93 räknas om till WGS 84. Begränsningar:
Ryhti innehåller planer godkända från 2024 (rikstäckande 2029); isländska planer före 2025 har bara plangräns;
Plandata lagrar bestämmelser som koder och tal, inte som löptext.

## Begränsningar

- Boverkets färger anges i föreskrifterna som namn; nyanserna i appen är egna. Symbolbeteckningar (prickmark,
  korsmark med flera) ritas som konturer med beteckning, inte med Boverkets symboler.
- Planbestämmelsebeskrivning, planeringsunderlag och beslutshandlingar följer bara med som text (motiv) respektive
  som uppgifter i planens metadata; dokumenten hämtas inte.
- Areor är planära beräkningar i SWEREF 99 TM; för planer i lokala zoner är felet försumbart.
- Lantmäteriets detaljplans-API kräver nyckel; appen är testad mot den dokumenterade modellen med egna testdata.
