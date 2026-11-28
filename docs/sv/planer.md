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
| Nationell specifikation Översiktsplan (Lantmäteriet, version 2.0, testversion 5 av 2026-10-23) | GeoJSON med `feature:mediatyp application/vnd.lm.oversiktsplan.v2+json` eller `feature:typ` oversiktsplan, innehallOP, beslutOP | Planens uppgifter och beslut (fattat, laga kraft), innehållsobjekt med innehållstyp, tema efter ÖP-katalogens kategori, namn, precisering, planhändelse, sambandsnivå och kopplingar, även innehåll som bara beskrivs i text |
| Boverkets ÖP-modell (GeoPackage, databasmodell 0.4) | Tabeller `innehall_op_<tema>_<geometrityp>` och `oversiktsplan` | Alla innehållslager som en plan med tema per lager, planens beslut (`beslut_op`), underlag och dokument, kopplingar mellan innehåll och textdokumentets avsnitt (bokmärken), även till hela planen; med textdokumentet, se [Digital översiktsplan i flera filer](#digital-översiktsplan-i-flera-filer) |
| Detaljplan i GeoPackage | Tabellerna `detaljplan`, `bestammelse` och `anvandning_yta`, `egenskap_yta`, `egenskap_linje`, `egenskap_punkt` med den nationella specifikationens fältnamn | Planen som den sparas i planeringsverktyget: planområde, ytor, linjer och punkter med sina bestämmelser, beteckningar, färger, motiv och höjder, beslutsinformation och handlingar; ytor som ännu saknar bestämmelse visas som de är ritade |

Koordinater i SWEREF 99 TM och de lokala SWEREF 99-zonerna (EPSG:3006–3018, lästa ur `koordinatsystemPlan`) samt
Web Mercator räknas om till WGS 84. En GeoJSON-fil känns igen på innehållet, inte på filändelsen: släpp den i
Inhämta så visas planens uppgifter och knappen *Importera*. En GeoPackage-fil i ÖP-modellen får valet *Hela
översiktsplanen som plan*, och en detaljplan i GeoPackage valet *Hela planen som plan*; avslaget importeras
en tabell i taget som förut. Koordinatsystemet i en GeoPackage-fil läses ur filen, även när det bara står med namn
(till exempel *SWEREF99 15 00*).

När ett svar från ett API eller en geodatakälla är en enda plan som appen kan läsa är *Spara som detaljplan* eller *Spara
som översiktsplan* förvald, och *Spara som tabell* sparar svaret som en vanlig datamängd i stället; tipset på planknappen
säger vilket format svaret känns igen som. Som detaljplan sparas referensobjekt från Lantmäteriets geodataplattform (källan
*Lantmäteriet geodataplattformen: detaljplaner*, med en nyckel som alla kan få, se [Hela detaljplaner från en geodatakälla](#hela-detaljplaner-från-en-geodatakälla)), ett lokalplanslager från
Plandata.dk och ett deiliskipulag från Skipulagsstofnun; som översiktsplan Plandata.dk:s kommuneplanrammer och ett
aðalskipulag.

Ett svar med delar av flera planer, till exempel en kommuns lager *NGP_Detaljplan_yta* med alla detaljplanernas ytor, är
ingen plan utan en karta över planerna. Det sparas med *Spara som datamängd* och öppnas som karta, och en rad ovanför
knapparna säger hur många planer svaret har; en hel plan ur lagren hämtas med *Detaljplaner (hela planer)*, se nedan. Svenska översiktsplaner hämtas ännu inte från något API; de läses från filer
(GeoPackage enligt Boverkets ÖP-modell eller GeoJSON).

## Hela detaljplaner från en geodatakälla

En detaljplan i Lantmäteriets NGP-form ligger i flera lager: ett med planernas ytor (en rad per plan) och ett per slag av
bestämmelse. En geodatakälla med de lagren, och källan *Lantmäteriet geodataplattformen: detaljplaner*, har därför posten
**Detaljplaner (hela planer)** överst i lagerlistan, så att du inte behöver välja lagren själv:

1. Välj **Detaljplaner (hela planer)** och skriv en del av planens namn eller beteckning, till exempel *Prästbordet* eller
   *22-HAV-1125*. Utan text listas de första planerna.
2. **Sök** ger en kort lista med beteckning, namn, status och datum (laga kraft, annars påbörjad).
3. Välj en plan. Planområdet och alla bestämmelser hämtas och sparas som en detaljplan med Boverkets färger och
   beteckningar, och *Öppna i Bearbeta* visar plankartan. Förloppet visas lager för lager, och **Avbryt** stoppar
   hämtningen utan att något sparas.

**En kommuns WFS.** Posten finns när tjänsten har lagret `NGP_Detaljplan_yta` och ett eller flera `NGP_…bestammelse…`-lager
(användnings-, egenskaps- och administrativa bestämmelser), i vilken arbetsyta som helst (`RIGES:NGP_Detaljplan_yta`).
Planen hämtas ur planlagret och varje bestämmelselager med ett filter på planens identitet (`detaljplan.objektidentitet`):
med `CQL_FILTER` på GeoServer och annars med ett FES 2.0-filter. Tar tjänsten inte emot det ena prövas det andra, och tar
den inget av dem säger appen det. Ett lager som saknar fältet hoppas över och nämns i kortet. I sökningen matchar å, ä och ö
vilket tecken som helst, eftersom GeoServer annars kan missa planer med de bokstäverna. Den färdiga källan *Sundsvall med
grannkommuner: detaljplaner i NGP-form (WFS)* (Sundsvalls GeoServer, arbetsytan RIGES) har cirka 2 100 planer för Sundsvall,
Örnsköldsvik, Härnösand, Timrå, Ånge, Kramfors och Sollefteå och kräver ingen nyckel.

**Lantmäteriets geodataplattform.** Källan *Lantmäteriet geodataplattformen: detaljplaner* söker med `POST /search` bland
alla kommuners planer eller i den kommun du väljer, med svaret i WGS 84. Har planen sin fil enligt den nationella
specifikationen (Detaljplan 4.1) hämtas den och sparas som planens original; annars, eller om filen inte går att läsa,
hämtas planens referensobjekt sida för sida. Nyckeln skickas bara till Lantmäteriets egen server, aldrig till en fil på en
annan värd.

**Nyckel till geodataplattformen.** Alla kan bli konsument utan kostnad: privatperson, företag, förening, kommun eller
myndighet. Skapa ett konto i Geotorget, ansök under *Nationella geodataplattformen* om att bli konsument och godkänn
villkoren (för en organisation tar kontot cirka två arbetsdagar), och skapa sedan nycklar för OAuth 2.0 i API-portalen
(apimanager.lantmateriet.se). Ange konsumentnyckeln och konsumenthemligheten i källans nyckelfält; de lagras som andra
nycklar, i sessionen eller krypterade med en lösenfras. Appen hämtar en token från `api.lantmateriet.se/token` med nyckeln i
formulärets kropp, eftersom tokenadressen inte tillåter rubriken Authorization från webbläsaren. Lantmäteriet rekommenderar
OAuth 2.0; en privatperson kan också använda Basic med inloggningen till Geotorget, men källan använder OAuth 2.0. Data är
CC0. Se [Bli konsument som privatperson](https://www.lantmateriet.se/sv/nationella-geodataplattformen/konsument/bli-konsument-som-privatperson/) och [Bli konsument som organisation](https://www.lantmateriet.se/sv/nationella-geodataplattformen/konsument/bli-konsument-som-organisation/).

**En fil med flera planer.** Lantmäteriets referensobjekt för flera planer i en fil, till exempel en kommuns planytor, är
ingen plan utan en karta över planerna. Filen läses in som karta, och förhandsgranskningen säger hur många planer den har;
en fil med en plan läses in som detaljplan.

## Plankartan i Bearbeta

En plan öppnas som plankarta: användningsbestämmelserna fyllda med Boverkets färger (bostäder gul, centrum brun,
industri blågrå, gata ljusgrå, park ljusgrön, vatten blå och så vidare enligt de allmänna råden till BFS 2020:5;
nyanserna är appens), egenskapsbestämmelser som blå streckade konturer, administrativa bestämmelser som lila
punktade, planområdesgränsen i svart och beteckningarna som etiketter. Klicka på ett objekt så visar inspektören
dess uppgifter och vad Planbestämmelsekatalogen säger om bestämmelsen: kod, typ, giltighet och katalogens
formulering. Lagren slås av och på per typ, bakgrundskarta visas efter samtycke, och knapparna ger *Spara som
kartvy* (för Visualisera, dashboards och Publicera), *Planbestämmelser* (bestämmelselistan som Markdown) och
*Visa som tabell*.

En översiktsplan ritas lager för lager: mark- och vattenanvändningen fylld per innehållstyp med Boverkets färger, övriga
lager i Boverkets färger där planen anger dem och annars med var sin färg (se [Lagren](#lagren)). Teckenförklaringen i
inspektören visar arean per mark- och vattenanvändning.

Linjer (utfartsförbud, stängsel, utvecklingsinriktningar) och punkter (till exempel markens höjd) ritas som de är. En
bestämmelse som är begränsad i höjd ritas med sitt fotavtryck, och inspektören visar höjden i planens höjdsystem (RH 2000 i planer till NGP): underkant,
överkant eller båda. Inspektören visar också planens identitet (objektidentiteten, utan klamrar), en översiktsplans
planhändelse med datum, planens beslut (antagen, laga kraft, överklagad, genomförandetid,
diarienummer, beslutstyp), planbeskrivningens namn och handlingarna, och för det valda objektet övriga uppgifter som
giltighetstid, sekundär egenskapsgräns, vilka användningsbestämmelser en egenskap reglerar, sambandsnivå, vad
innehållet berör och var i planhandlingen det beskrivs. Innehåll som bara beskrivs i text, utan läge i kartan, listas
under *objekt utan läge i kartan* och kan väljas där.

## En digital översiktsplan: lager, ställningstaganden och filer

En digital översiktsplan levereras som en eller flera GeoPackage-filer i Boverkets ÖP-modell, planbeskrivningen (översiktsplanens
textdokument) som DOCX och ibland filerna `manifest.xml` och `metadata.xml`. Hela leveransen är en datamängd av slaget plan, och
planvyn i Bearbeta visar den samlat: kartan med lagren, planbeskrivningens ställningstaganden och leveransens filer. En enskild
DOCX-fil är fortfarande en dokumentsamling och ett enskilt lager en tabell, som förut.

### Lagren

Under *Lager* i inspektören listas lagren per GeoPackage-fil och därunder lager för lager, ett för varje tabell i filen (till
exempel mark- och vattenanvändning, utvecklingsinriktning som ytor och som linjer, riksintressen). En äldre plan utan uppgift om
källagret har ett lager per tema. Varje lager har en växel, sitt antal objekt och sin symbol.

- Alla lager visas från början, och flera kan visas samtidigt.
- *Visa alla* och *Dölj alla* överst gäller alla lager som filtret visar. Varje fil har egna knappar för att visa och dölja sina
  lager, och ögat vid ett lager (*Visa bara detta*) visar bara det lagret.
- Har planen fler än tolv lager finns ett filter som smalnar av listan på lagrets eller filens namn.
- Vilka lager som är dolda sparas per datamängd och gäller igen när du kommer tillbaka till planen, också efter en omladdning.

Symbolerna skiljer lagren åt. Boverkets färger går alltid först, i nya och äldre planer och för alla teman och objekttyper:
mark- och vattenanvändningen behåller Boverkets färger per användning, så att markanvändningskartan ser ut som Boverkets,
och ett objekt vars rad anger en färg (kolumnen `farg`, med Planbestämmelsekatalogens färgnamn) ritas i den. Har alla objekt
i ett lager en färg ritas lagret objekt för objekt och teckenförklaringen visar en rad per kategori och färg; har bara några
en färg ritas de i sin färg och resten i lagrets egen. Ytor fylls med färgen, linjer och konturer ritas i den. En detaljplan
ritas som förut: användningarna i Boverkets färger och övriga bestämmelser som plankartans konturer. Planens gräns är en
mörk kontur och områdena en streckad. Övriga lager får var sin färg ur appens färgblindsäkra palett: ytor fylls och har
kontur, linjer ritas som linjer (streckade när två linjelager annars skulle få samma färg) och punkter med en egen
markörform (cirkel, kvadrat, triangel eller romb). Teckenförklaringen i inspektören visar bara de lager som visas,
grupperade som listan och med samma symboler, och mark- och vattenanvändningen med sina användningar och deras area i
hektar.

### Planbeskrivningen bredvid kartan

När planen har planbeskrivningens avsnitt eller leveransens filer delar kartan och planbeskrivningen på arbetsytan: kartan till
vänster och texten till höger, med en avdelare emellan. Dra i avdelaren, eller använd piltangenterna när den har fokus, för att
ändra bredden. Bredden sparas och gäller för alla planer, och ett dubbelklick återställer den. Under 1 100 px ligger texten under
kartan. Planbeskrivningen och *Filer* är flikar ovanför texten. Panelerna runt arbetsytan är desamma som förut.

Planbeskrivningen visar avsnitten med rubrik och text:

- *Gäller hela planen* överst: avsnitt som är kopplade till planen som helhet.
- Därefter ställningstagandena (avsnittstypen Ställningstagande) och sist övriga avsnitt, som beskrivningar och konsekvenser.
- Texten visas alltid som text, aldrig som HTML.
- *Visa 3 områden i kartan* (med avsnittets antal) markerar alla områden som avsnittet gäller, i accentfärgen och även om
  deras lager är dolda, och zoomar kartan till dem. Avsnittet markeras i texten, och inspektören visar det med sina områden,
  *Visa i planbeskrivningen* och *Avmarkera*.

### Områden och deras ställningstaganden

Klicka på ett område i kartan så listar inspektören överst under *I planbeskrivningen* de ställningstaganden och andra avsnitt
som gäller området, ställningstagandena först. Flera områden väljs på två sätt:

- **Skift-klick** lägger till ett område eller tar bort det igen.
- **Markera område** i verktygsraden: dra sedan en rektangel i kartan, så väljs alla områden som visas och som rektangeln rör.
  Planens gräns räknas inte. Skift och dra gör detsamma utan knappen och lägger till områdena till dem som redan är valda.
  Esc avbryter.

Med flera områden valda listar inspektören dem under *Valda områden* och därunder alla ställningstaganden och avsnitt som gäller
något av dem, ett avsnitt i taget med de valda områden det gäller (*Gäller Trossö, Lyckeby*). *Visa i planbeskrivningen*
bläddrar fram avsnittet i texten bredvid kartan och markerar det. *Avmarkera områdena* tömmer valet.

En koppling som bara finns i texten, för att texten nämner områdets namn men filerna inte kopplar dem, visas som *Nämnd i
texten* (se [Hur kopplingarna läses](#hur-kopplingarna-läses)). Kan inspektören inte lista något säger den varför: området
saknar objektidentitet, inget avsnitt gäller området, eller planen har inga kopplingar alls mellan kartan och texten.

### Filer

Fliken *Filer* visar först hur planens kopplingar mellan karta och text lästes: hur många och varifrån, hur många områden och
ställningstaganden som saknar koppling och, när det inte finns någon, varför. *Läs kopplingarna igen* läser dem på nytt ur
planens filer, på alla sätt appen känner till nu, till exempel för en plan som importerades med en äldre version. Därefter listas
leveransens filer med roll (plankarta, underlag, textdokument, bilaga, manifest, metadata eller övrigt) och storlek, och de
varningar som leveransen lästes med. Filer som leveransen nämner men som inte sparades står för sig.

- Bara en PDF eller en bild (PNG eller JPEG) vars innehåll stämmer med filändelsen öppnas i en ny flik. Alla andra filer laddas
  ned, så att en fil som utger sig för att vara något annat aldrig visas i appen.
- *Lägg till fil i planen* sparar filer från datorn med planen, till exempel ett granskningsyttrande.

En GeoPackage med många lager som inte är en plan kan på samma sätt bli en enda datamängd, se
[Kartlager](kartor.md#kartlager-en-geopackage-med-många-lager).

## En ny översiktsplan

*Ny översiktsplan* bland källorna i Inhämta skapar en tom digital översiktsplan att bygga med AI eller för hand, på samma sätt som
*Ny byggnadsmodell* gör för byggnader. Formuläret har:

- planens namn (annars *Översiktsplan* och kommunens namn);
- kommunen, ur kommungränserna som följer med appen. Med *Hela kommunen som planområde* blir kommungränsen planens plangeometri,
  så att kartan visar planområdet från början;
- koordinatsystemet: SWEREF 99 TM om inget annat väljs, eller en av de lokala SWEREF 99-zonerna. Det är systemet som AI:n läser
  och skriver koordinater i; leveransen skrivs alltid i SWEREF 99 TM;
- en beskrivning för AI:n, som sparas med planen.

*Skapa planen* gör en plan i Boverkets ÖP-modell med en ny objektidentitet, tomma tabeller för planbeskrivningen och kopplingarna
och, med en kommun vald, plangeometrin. Inget hämtas från nätet. Planen öppnas i planvyn som en levererad plan: den kan redigeras,
byggas med AI och exporteras som leverans. *Bygg planen med AI* öppnar den med AI-panelen i läget *Bygg från beskrivning* och
beskrivningen ifylld.

## En ny detaljplan

*Ny detaljplan* bland källorna i Inhämta skapar en tom digital detaljplan enligt den nationella specifikationen, i samma form som
de detaljplaner appen läser in. Formuläret har:

- planens namn (annars *Ny detaljplan*) och beteckning hos kommunen, till exempel DP 2026:4;
- kommunen, ur kommungränserna som följer med appen. Kommunkoden följer med planen och exporten;
- koordinatsystemet: SWEREF 99 TM om inget annat väljs, eller en av de lokala SWEREF 99-zonerna. Planen exporteras i det;
- planens syfte.

*Skapa planen* gör en plan med en ny objektidentitet och dagens datum som påbörjad, utan objekt. Inget hämtas från nätet. *Rita
planen* öppnar den i planvyn med *Redigera planen* påslaget.

I redigeringsläget väljer raden ovanför kartan vad som ritas: *Plangräns*, *Användningsområde* eller *Egenskapsområde*.

- Plangränsen och användningsområdena är ytor; ett egenskapsområde kan också vara en linje (till exempel utfartsförbud) eller en
  punkt. Planen har en plangräns: ritas den igen får den befintliga den nya formen.
- För ett användnings- eller egenskapsområde väljs bestämmelsen ur Boverkets planbestämmelsekatalog (BFS 2020:5). Listan har de
  vanligaste bestämmelserna först: användningarna för kvartersmark, allmän plats och vatten (B, C, D, E, H, J, K, P, S, T, Z, W,
  GATA, TORG, PARK, NATUR) och egenskaperna prickmark, korsmark, största byggnadsarea, högsta nockhöjd och totalhöjd, största
  takvinkel, minsta fastighetsstorlek, utfartsförbud och upphävt strandskydd. *Sök i katalogen* söker bland alla gällande
  bestämmelser.
- Katalogen följer med appen (release 2025-12-01), så allt detta fungerar utan nät. En nyare release kan läsas från Boverket med
  källan *Boverket Planbestämmelsekatalogen* under Inhämta, efter samtycke.

Ett nytt område får en ny objektidentitet och bestämmelsens katalogreferens, kod, kategori, användningsform, beteckning och färg.
Klicka på ett område för att ändra det i inspektören:

- byta bestämmelse;
- fylla i bestämmelsens värden, till exempel höjden i *Högsta nockhöjd är [höjd] meter*. Formuleringen fylls i med värdet, och
  mallen sparas med området;
- ändra beteckningen på plankartan (till exempel e1) och skriva motivet;
- *Redigera formen*, *Flytta* och *Ta bort området*, som för en översiktsplan.

Varje ändring är ett steg i datamängdens logg och ångras med *Ångra* i redigeringsraden.

*Exportera som detaljplan* i verktygsraden, och formatet *Detaljplan: nationell specifikation (GeoJSON)* i Exportera, sparar
planen som utbytesmodellen i GeoJSON (`application/vnd.lm.detaljplan.v4+json`):

- ett objekt `detaljplan` med planens uppgifter, plangränsen och beslutsinformationen;
- ett objekt per bestämmelse med katalogreferensen, formuleringen och värdena, motivet och geometrin.

Geometrin skrivs i planens koordinatsystem med millimeterupplösning. Filen läses in igen som samma plan, med samma objekt,
bestämmelser och värden. Kommunens namn kommer då ur kommungränserna, eftersom specifikationen bara anger koden. En plan utan
plangräns exporteras inte. Detaljplaner som lästs in från fil kan redigeras och exporteras på samma sätt, utom planer från de
andra nordiska länderna.

## Redigera planen

En digital översiktsplan kan redigeras i planvyn: planbeskrivningens avsnitt, områdena i plankartan och kopplingarna mellan
dem. Välj *Redigera planen* i verktygsraden; *Klar* lämnar redigeringen. Varje ändring sparas direkt som ett steg i
datamängdens logg och kan ångras med *Ångra* i redigeringsraden, en ändring i taget. Versioner fungerar som för andra
datamängder.

### Avsnitt och ställningstaganden

I redigeringsläget har varje avsnitt i planbeskrivningen knapparna *Ändra*, *Koppla markerade områden*, *Ta bort kopplingen
till markerade* och *Ta bort*.

- *Ändra* gör rubriken, texten och avsnittstypen redigerbara där avsnittet står. Texten är vanlig text: varje rad blir ett
  stycke, tomma rader och dubbla blanksteg tas bort, och ingen formatering eller HTML sparas.
- *Nytt ställningstagande* och *Nytt avsnitt* överst lägger till ett avsnitt sist i textdokumentet. Det får ett bokmärke som
  byggs av rubriken, till exempel `op_verksamheter_vid_hamnen`, och som följer utbytesmodellens regel: en bokstav och sedan
  högst 39 bokstäver (a–z), siffror eller understreck. Bokmärket kan ändras under *Fler alternativ* och måste vara unikt i
  planen. Är områden valda kan det nya avsnittet kopplas till dem direkt.
- *Ta bort* tar bort avsnittet och alla dess kopplingar, efter en fråga.

### Områden

Redigeringsraden ovanför kartan väljer var nya objekt hamnar: ett lager i planen eller ett tema ur ÖP-modellen. *Rita yta*,
*Rita linje* och *Rita punkt* ritar i kartan med Leaflet-Geoman: klicka ut hörnen och avsluta på det första hörnet, eller med
*Avsluta formen*. Ett lager tar bara sin sorts geometri, och temana Område och Plangeometri bara ytor. Det nya området får en
ny objektidentitet (UUID) och hamnar i temats tabell i plankartans GeoPackage-fil, till exempel `innehall_op_lis_point`, när
planen inte redan har ett sådant lager.

Klicka på ett område så kan inspektören ändra det:

- innehållstypen ur listan (ÖP-katalogens värden ur planens GeoPackage-fil, Boverkets markanvändningar och de typer planen
  redan har) eller en annan under *Fler alternativ*, namnet och preciseringen; *Spara* sparar dem;
- *Redigera formen* visar hörnen, som kan dras, läggas till och tas bort, och *Flytta* drar hela formen; *Spara formen* sparar
  och *Avbryt* släpper ändringen;
- *Ta bort området* tar bort området och dess kopplingar, efter en fråga.

Planens antal objekt per tema och per lager hålls aktuella.

### Kopplingar

Områden väljs som annars i planvyn: klick, Skift-klick, *Markera område* eller Skift och dra. Med områden valda i
redigeringsläget finns *Koppla till ställningstagande* i inspektören, som kopplar dem till det ställningstagande eller avsnitt
som väljs i listan. Från avsnittets sida gör *Koppla markerade områden* detsamma, och *Ta bort kopplingen till markerade* tar
bort de valda områdenas kopplingar till avsnittet. I inspektörens lista över avsnitten som gäller de valda områdena tar *Ta
bort koppling* bort kopplingen.

En koppling som görs här sparas i `_section_links` med avsnittets typ och källan `redigerad`. *Läs kopplingarna igen* och
*Lägg till fil i planen* behåller de kopplingar och avsnitt som har gjorts här, men text som har ändrats i ett avsnitt som finns
i en Word-fil läses om ur filen. Exportera planen som leverans först om ändringarna ska finnas i filerna.

### Med AI

*Fråga AI* i planvyns verktygsrad öppnar AI-panelen i inspektören, med samma leverantörer och policy som för byggnadsmodeller (se
[Fråga AI om modellen](cad-bim.md#fråga-ai-om-modellen)). Modellen väljs, nyckeln prövas och statusraden visar vad AI:n gör som där (se
[Nyckeln och modellen](cad-bim.md#nyckeln-och-modellen) och [Medan AI:n arbetar](cad-bim.md#medan-ain-arbetar)). Panelen har tre lägen:

- *Fråga*: AI:n läser planen med verktyg och svarar. Den läser planens uppgifter, planbeskrivningens avsnitt i ordning, områdena
  med tema, innehållstyp, namn och läge, kopplingarna, det du har valt i kartan och objekten i andra datamängder som visas i
  kartan. *Välj n områden i kartan* väljer de områden som svaret bygger på. AI:n kan inte ändra något.
- *Ändra*: AI:n föreslår ändringar i avsnitten, områdena och kopplingarna.
- *Bygg från beskrivning*: AI:n planerar och bygger planen ur beskrivningen, med avsnitt som planens syfte och
  ställningstaganden, områden i plankartan och kopplingarna mellan dem. Saknas något väsentligt frågar den i panelen.

AI:n ändrar aldrig planen själv. I lägena *Ändra* och *Bygg från beskrivning* fyller den ett ändringsset med planens egna
redigeringar, samma som ovan. Panelen listar stegen, med texten i de nya och ändrade avsnitten under *Visa texten*.

- *Förhandsvisa* prövar ändringarna på en kopia av planen och ritar områdena i kartan: nytt grönt, ändrat gult och borttaget rött
  och streckat. Ett steg som inte går att göra visas med sitt fel, och då kan ändringssetet inte godkännas.
- *Godkänn* gör ändringarna till ett enda steg i datamängdens logg, med leverantör, modell och frågor. *Ångra* i redigeringsraden,
  eller i meddelandet som visas, tar bort dem på en gång.
- *Avvisa* släpper ändringssetet utan att röra planen.

Ett ändringsset som tar bort områden eller avsnitt bekräftas en gång till, och AI:n får bara ta bort något när du har bett om
det. Områdenas former anges i planens koordinatsystem. AI:n kan också kopiera formen från ett objekt i en annan datamängd som
visas i kartan (ögat i listan över datamängder), till exempel en detaljplan eller ett kartlager, eller från ett annat område i
planen. Formerna som AI:n ritar själv är utkast: justera dem med *Redigera formen* och *Flytta*.

Till AI-leverantören skickas planens uppgifter, texter, namn och lägen och de objekt i andra datamängder som visas i kartan och som
AI:n läser, efter samtycke för leverantörens värd. AI-panelen hör till nivån BIM och GIS.

### Exportera som leverans

*Exportera som leverans* i verktygsraden, och formatet *Leverans: GeoPackage och planbeskrivning (ZIP)* i Exportera, laddar ned
en ZIP-fil med:

- plankartan som GeoPackage-fil i Boverkets ÖP-modell 0.4: en innehållstabell per tema och geometri
  (`innehall_op_<tema>_polygon`, `_line` eller `_point`, området och plangeometrin i egna tabeller) med Boverkets kolumnnamn i
  SWEREF 99 TM, och tabellerna `oversiktsplan` (med beslutet när det är känt), `dokumentavsnitt` (en rad per bokmärke och
  objekt; en koppling till hela planen pekar på planens objektidentitet), `avsnittsbokmärke`, `dokumentreferens_op` och
  `innehall_op_beror_annat_innehall`. Alla kopplingar skrivs, vilken källa de än har;
- planbeskrivningen som Word-fil, en per dokument som avsnitten finns i: varje avsnitt är en rubrik och dess stycken inom ett
  Word-bokmärke med avsnittets namn;
- planens övriga filer som de kom, till exempel bilagor, underlag och metadata. GeoPackage-filen som planen lästes från ersätts,
  och manifestet följer inte med, eftersom dess kontrollsummor inte längre stämmer.

Leveransen kan importeras igen i Inhämta och ger samma områden, avsnitt och kopplingar.

## Koordinatsystem och höjder

Detaljplaner till NGP görs i SWEREF 99 TM eller i kommunens lokala SWEREF 99-zon med höjder i RH 2000, och filen anger
båda (`koordinatsystemPlan` och `hojdsystem`). Översiktsplaner är oftast i SWEREF 99 TM. Inspektören visar planens
koordinatsystem och, för en plan med höjder, höjdsystemet; en GeoPackage-fil anger inget höjdsystem, och då står det så.

Plankartan ritas som webbkarta (Web Mercator med norr uppåt, där OpenStreetMap eller kartrutor från OGC API – Tiles kan vara bakgrund) eller i planens eget
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

Släpp filen i Inhämta, eller hämta den med *Webbadress* när den finns på webben (till exempel en plan som kommunen publicerar); en fil utan filändelse känns igen på sin innehållstyp. Ett arkivpaket släpps som mapp eller som ZIP-fil: appen läser planen ur mappen `content`
(GeoPackage-filen i första hand, annars leveransfilen), sparar paketets filer med planen och jämför varje fil med
kontrollsumman (SHA-256) i `PREMIS.xml`. Inspektören visar under *Arkivpaket* om filerna stämmer, vilka som har ändrats
eller saknas, och öppnar handlingarna (plankarta och planbeskrivning) i en ny flik. Bara PDF-filer och bilder (PNG, JPEG) vars filändelse
och innehåll stämmer öppnas i en flik; andra filer i paketet, till exempel XML, HTML och SVG, laddas ned i stället. En plats som pekar utanför paketet
kontrolleras inte och läses aldrig. En vanlig mapp med planens GeoPackage-fil och textdokument kan bli en plan (se nedan); avslaget öppnas handlingarna för sig, som dokument.

## Digital översiktsplan i flera filer

En digital översiktsplan levereras ofta som en mapp, en ZIP-fil eller några filer: en eller flera GeoPackage-filer
(plankartan i Boverkets ÖP-modell och kanske underlag), en eller flera Word-filer (textdokumentet och bilagor) och ibland
en `manifest.xml` och en `metadata.xml`. Släpp mappen, ZIP-filen eller filerna i Inhämta. Steget som sorterar filerna har då
valet **Digital översiktsplan (alla filer som en plan)**. Det är påslaget när en GeoPackage-fil följer ÖP-modellen eller på
annat sätt kopplar sina objekt till texten (se [Hur kopplingarna läses](#hur-kopplingarna-läses)); avslaget importeras varje fil
för sig som förut.

Påslaget blir alla filer en datamängd av slaget plan:

- **Filerna känns igen på innehållet**, inte på namnet: en GeoPackage-fil på sitt SQLite-huvud och sina tabeller, en
  Word-fil på sina delar i ZIP-filen och en manifest- eller metadatafil på sitt rotelement. Varje fil sparas i planen med
  sin roll: *plankarta* (GeoPackage-filen i ÖP-modellen, annars den som kopplar sina objekt till texten), *underlag* (andra
  GeoPackage-filer), *textdokument* (Word-filen som GeoPackage-filen hänvisar till med namn eller länk, annars den enda eller
  den med flest av planens bokmärken), *bilaga* (andra Word-filer
  och PDF-filer), *manifest*, *metadata* och *övrigt*.
- **Alla lager med objekt** blir rader i planen. Kolumnen `lager` säger vilken tabell i GeoPackage-filen raden kommer från
  och `fil` vilken fil. Lagren känns igen på `gpkg_contents` (värdelistor och kopplingstabeller är inga lager), med sina
  namn därifrån. Tomma lager tas inte med. Lager med ändelserna `_point`, `_line` och `_polygon` läses liksom `_punkt` och
  `_linje`.
- **Textdokumentets avsnitt**: varje bokmärke i Word-filerna blir ett avsnitt med sin text, även när bokmärket går över
  flera stycken, och den närmaste rubriken före det. GeoPackage-filen kopplar bokmärkena till objekten i kartan, se
  [Hur kopplingarna läses](#hur-kopplingarna-läses). Ett ställningstagande kan gälla flera områden, och ett område kan ha
  flera avsnitt. Ett avsnitt kan också gälla hela planen. Avsnittstypen (till exempel *Ställningstagande*) läses ur
  GeoPackage-filen, på ÖP-katalogens id eller på namnet.
- **Manifest och metadata** har ingen formell roll i en ÖP-leverans. De läses när de finns och krävs aldrig. Planens
  uppgifter läses alltid ur GeoPackage-filen. Kontrollsummor i filerna (SHA-1, SHA-256, SHA-384 och SHA-512) jämförs med
  filerna; andra algoritmer, till exempel MD5, sägs inte kontrollerade.
- **Varningar** sparas med planen och visas i Inhämta före importen. Det gäller till exempel ett bokmärke som GeoPackage-filen
  nämner men textdokumentet saknar, ett textdokument som GeoPackage-filen hänvisar till men som inte levererades, en
  kontrollsumma som inte stämmer och bokmärken vars namn inte följer utbytesmodellens regel. Ett sådant bokmärke läses ändå.
  Varningarna säger också hur många kopplingar som lästes, se nedan.

### Hur kopplingarna läses

Boverkets modell kopplar ett objekt till ett bokmärke i tabellen `dokumentavsnitt`. Filer från andra verktyg, eller skrivna
för hand eller av en AI, gör det på andra sätt. Appen läser kopplingarna i den här ordningen, och en svagare källa lägger bara
till kopplingar för objekt som ingen starkare källa har kopplat:

1. **ÖP-modellens `dokumentavsnitt`**, även när kolumnerna heter något annat, till exempel `objekt_id`, `omrade_id` eller
   `objektidentitet_omrade` för objektet och `bokmarke` för bokmärket.
2. **En annan tabell med kopplingar**: en tabell med en kolumn för objektets id och en för bokmärket eller avsnittet, till
   exempel `objektreferens` med `objekt_id` och `identitet_i_dokument`.
3. **Kolumner på områdena** som namnger deras bokmärken eller ställningstaganden, till exempel `bokmarke`, `stallning_id`,
   `stallningstaganden` eller `avsnitt`, med ett eller flera värden åtskilda med komma eller semikolon.
4. **Texten**: områden som ett avsnitt nämner vid namn, som "Kopplade områden: Trossö, Lyckeby" eller "gäller områdena A2 och
   A3". Bara avsnitt som ingen annan källa kopplar läses så. Kopplingarna är tolkade och visas som *Nämnd i texten*, aldrig som
   kopplingar ur filerna.

Id:n jämförs utan klamrar, citattecken och blanksteg och oberoende av versaler. Ett objekt hittas på sitt id, sina andra
id-kolumner, `<lager>:<fid>` eller en tabell som anger lager och objekt för varje id (som `kartobjekt`). Ett objekt utan
objektidentitet får `<lager>:<fid>` som id. Ett bokmärke hittas på sitt namn, oberoende av versaler, utan ett prefix som `op_`
eller på sin rubrik. En tabell med ställningstagandenas text (som `stallningstagande` med bokmärke och text) gör avsnitten till
ställningstaganden och ger texten när Word-filen saknas, och en tabell med nycklar och värden (som `planmetadata`) ger planens
id, kommun och status.

Planens varningar och fliken *Filer* säger hur många kopplingar som lästes och varifrån, hur många områden och
ställningstaganden som saknar koppling och, när planen inte har någon koppling, varför: inget textdokument, ingen tabell med
kopplingar, inga kolumner på områdena, inga namn i texten eller id:n som inget område har.

### Tabellerna och filer som läggs till

Avsnitten ligger i tabellen `_sections` (avsnitt, dokument, rubrik, text, typ, ordning) och kopplingarna i `_section_links`
(avsnitt, objektid, dokument, typ, kalla). Ett tomt objektid är hela planen, och kalla säger varifrån kopplingen lästes: modell,
tabell, attribut eller text. Båda kan läsas med SQL i Analysera.
En GeoPackage-fil i ÖP-modellen som importeras ensam med *Hela översiktsplanen som plan* får samma tabeller, med rubrikerna
ur GeoPackage-filen, och en varning om att textdokumentet saknas. Ett textdokument som läggs till i planen i efterhand läses
på samma sätt, och avsnitten och kopplingarna görs om; ett med samma namn som ett i planen ersätter det.

Ingenting i filerna körs och ingenting hämtas. Makron i en Word-fil körs aldrig, länkar till andra platser följs inte, och
texten visas bara som text. En XML-fil med en dokumenttypsdeklaration (DOCTYPE) läses inte. En del av en Word-fil som packas
upp till mer än 64 MB läses inte heller.

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
- Lantmäteriets detaljplans-API kräver nyckel; sökningen och hämtningen därifrån är provade mot specifikationens exempel
  (version 2.2) med egna testdata, inte mot den riktiga tjänsten. Hela planer ur Sundsvalls WFS är provade mot tjänsten.
- Ett avsnitt utan koppling får ingen avsnittstyp i en exporterad GeoPackage-fil, eftersom ÖP-modellen har typen på kopplingen;
  rubriken och texten följer med i Word-filen.
- Exporten skriver avsnitten efter varandra; avsnitt vars bokmärken överlappade i det ursprungliga dokumentet upprepar då text.
- Beslutshandlingar, underlag och externa referenser i den ursprungliga GeoPackage-filen följer inte med i exporten, bara
  beslutets diarienummer och datum.
