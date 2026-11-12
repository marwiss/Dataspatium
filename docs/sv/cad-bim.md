# CAD och BIM: byggnadsmodeller och ritningar

Dataspatium öppnar byggnadsmodeller i IFC och ritningar i DXF som ett eget slag av datamängd. Modellen ritas i 3D,
byggdelarna blir en tabell, och egenskaper och mängder går att söka i, räkna på och exportera. Allt sker i webbläsaren:
filen lämnar aldrig datorn. Originalfilen sparas i datamängden och följer med i paket och säkerhetskopior.

## Öppna en modell

Släpp en `.ifc`-, `.ifczip`- eller `.dxf`-fil i Inhämta. Filens uppgifter visas (schema, projekt, program, våningar och
antal per typ), och *Importera* skapar datamängden. Stödet gäller IFC2X3, IFC4 och IFC4X3 i STEP-format. En modell på
cirka 50 MB tar ungefär en kvart minut att importera och öppnas sedan på några sekunder.

## Stora modeller från servern

En modell som är för stor att läsa i webbläsaren kan hämtas från Dataregium utan IFC-filen. I källans fillista under *Inhämta →
OpenCDE* har en modell knappen **Stor modell** när servern har geometri-API:t (`ifc_geometry`). Välj detaljnivå: *Hela geometrin* ger
byggdelarnas nät, *Lådor per byggdel* bara en låda var för en snabb överblick. Appen hämtar geometrin som binär glTF, läser den i en
bakgrundstråd och gör en modelldatamängd med en rad per byggdel (id, GlobalId, klass, namn och våning ur serverns namngivna frågor).
Geometrin sparas med datamängden, så 3D-vyn, markering, urval och ärenden fungerar som för en modell ur en fil. Egenskaper och mängder
följer inte med, och det som behöver IFC-filen, som kollisionskontrollen i appen och export av originalet, saknas; serverns krocktest
och frågor går som vanligt. Kortet i Hantera visar *Geometri: Från servern*.

## Modellen i Bearbeta

Modellen öppnas som 3D-vy med en tabell över byggdelarna under. Dra för att vrida, rulla för att zooma mot muspekaren och
högerdra eller Skift-dra för att flytta; på en pekskärm vrider ett finger, och två nyper och flyttar. Dubbelklicka på en byggdel
för att vrida runt just den punkten. Knappen med ramen visar allt som visas; enstaka objekt långt från byggnaden räknas inte med.
Fler sätt att se modellen står under [Vyer och tangentbordet](#vyer-och-tangentbordet).

- **Markera**: klicka på en byggdel i modellen eller på en rad i tabellen. Markeringen följer åt, och inspektören visar
  typ, våning, material, klassificering, egenskaper och mängder, samt yta och volym mätta på geometrin.
- **Filtrera**: välj typ eller våning, eller sök på namn, material eller egenskap. Tabellen och modellen visar samma urval.
- **Visa som tabell**: alla kolumner som en vanlig tabell med Bearbetas alla verktyg.
- **Spara som diagram**: vyn med sitt filter och sin kameravinkel blir ett diagram i Visualisera.

Geometrin räknas fram ur originalfilen första gången modellen öppnas i en session, och den används bara för att rita och
mäta. Tabellerna finns kvar även om datorn saknar WebGL, och då visas ett meddelande i stället för 3D-vyn.

### Vyer och tangentbordet

- **Vy-kuben** i hörnet vrider sig med modellen. Klicka på en sida för att se modellen ovanifrån, framifrån, från höger, bakifrån,
  från vänster eller underifrån, och på knappen under kuben för att se den snett ovanifrån. Framifrån tittar längs modellens
  Y-axel, det vill säga mot norr när modellen är ritad med norr uppåt. Vyerna visar det som filtret visar.
- **Ortografisk vy**: knappen med kvadraten växlar mellan perspektiv och ortografisk vy, där byggdelarna inte krymper med
  avståndet. Ovanifrån blir då en planritning och framifrån en fasad. Ett diagram och en viewpoint minns vilken vy det var.
- **Snitt**: knappen med lagren öppnar snittet i inspektören. Dra reglagen för öst–väst, syd–nord och höjd för att skära bort det
  som ligger utanför en låda, eller välj en våning under *Snitt vid våning* för att se den från golvet upp till 1,2 m som en
  planritning. *Ta bort snittet* visar allt igen. Snittet följer med ett diagram och en viewpoint, och en viewpoint från ett annat
  program visar sitt snitt.
- **Zooma till markerade** visar de markerade byggdelarna, och **Visa bara markerade** döljer allt annat så att du kan vrida runt
  dem; klicka igen för att visa allt.
- **Tangentbordet** fungerar när 3D-vyn har fokus: klicka i den eller gå dit med Tabb.

| Tangent | Gör |
|---|---|
| Pilarna | flyttar vyn |
| Ctrl eller Skift och pilarna | vrider |
| + och − | zoomar |
| F | zoomar till de markerade |
| Home | visar allt |
| 1–7 | ovanifrån, framifrån, från höger, bakifrån, från vänster, underifrån, snett ovanifrån |
| O | växlar ortografisk vy |

## Ärenden från ett CDE

En modell som hämtats från en OpenCDE-server, eller vilken modell som helst när en sådan server finns som källa, kan visa
sina ärenden: knappen *Ärenden* i modellvyn öppnar en panel i inspektören med projektets BCF-ärenden. De som pekar på
byggdelar i den här modellen står först, med status och antal byggdelar. Klicka på ett ärende, så markeras byggdelarna i
3D-vyn och panelen visar beskrivning, ögonblicksbild och kommentarer. Ärendena hämtas när du ber om det och lagras inte i
datamängden; för att räkna på dem sparar du dem som en tabell i Inhämta. Har ärendet en viewpoint med kamera går vyn dit, i perspektiv eller ortografiskt och med sitt snitt.

Med rättigheterna för det går det också att skriva. *Nytt ärende* skapar ett ärende på servern med titel, typ, status och
etiketter ur projektets listor, och vyn följer med som viewpoint: kameran (perspektiv eller ortografisk) med snittet, en ögonblicksbild och de markerade byggdelarna som
komponenter. I ett valt ärende kan du skriva en kommentar, byta status och lägga till den aktuella vyn som en ny viewpoint.
*Spara som BCF* ger alla projektets ärenden med kommentarer, viewpoints och ögonblicksbilder som en BCF-fil, som verktyg utan
API kan öppna. En BCF-fil går också att läsa in i Inhämta: ärendena blir en tabell, kommentarer och komponenter tabeller bredvid.

*Färga efter status* ger byggdelarna färgen hos sitt mest öppna ärende: rött för öppna, gult för pågående, grönt för avslutade,
med en teckenförklaring under listan. *Spara som tabell* ger projektets ärenden som en tabell med en rad per ärende och byggdel
(typ, namn och våning följer med), som Hantera känner igen som ärenden: kortet *Ärenden* visar läget och skapar dashboarden
*Ärendeläge* med status, typ, ansvarig, prioritet och månad bakom gemensamma filter, och knappen *Visa i modellen* går tillbaka
till panelen. Verktyget *Ärenden* i Analyseras flik Mängder räknar ärenden, öppna ärenden och byggdelar per status, typ,
prioritet, ansvarig, byggdelstyp eller våning ur en sådan tabell, och SQL-startkoden får frågor för kopplingen. *Spara som
diagram* sparar vyn med färgerna som ett modelldiagram, som dashboards, dokument och Publicera visar med teckenförklaring.

Modellens graf på servern ritas och frågas från *Inhämta*, och knappen *IFC–DB* (tidigare IFC-LPG) tar dig dit, se [grafer.md](grafer.md#ifcdb-på-en-dataregium-server).

Grafens modell, relationerna och frågorna från Dataspatiums sida finns i Dataregiums [ifc-lpg.md](https://github.com/marwiss/Dataregium/blob/main/docs/sv/ifc-lpg.md).

### Ärendets fält och modellfilen

*Nytt ärende* tar de fält som svensk granskningspraxis frågar efter, alla ur projektets egna listor: typ och status (alltid satta),
prioritet, etikett, ansvarig part, tilldelad, skede och förfallodatum. BCF har inget eget fält för ansvarig part, så den läggs till
som en etikett. Ögonblicksbilden är högst 1 500 bildpunkter på längsta sidan, som BCF anger. När servern låter dig knyter appen
ärendet till modellfilen (BCF API:s `PUT /topics/{guid}/files`): med projektets egen post för den version som modellen hämtades
från, och annars med filens namn, tidsstämpel och IfcProject ur IFC-filens rubrik.

### BCF-filer

Appen skriver BCF-filer enligt BCF-XML 3.0, buildingSMART:s format för ärenden:

- Varje ärende har typ och status, rubrik, datum och författare. Utan typ eller status blir de Issue och Open. Författaren är ditt
  konto på servern när du är inloggad, annars namnet du har angett för kommentarer (*Ditt namn*), annars Dataspatium; appen hittar
  aldrig på ett namn.
- Kommentarer och viewpoints ligger i ärendet, och etiketter, länkar, dokumentreferenser och relaterade ärenden i sina listor. Filen
  har `extensions.xml` med de typer, statusar, prioriteter, etiketter, tilldelade och skeden som den använder.
- Varje ärendes rubrik nämner modellfilen: namnet ur IFC-filens rubrik, filens tidsstämpel och IfcProjects GlobalId, och adressen för
  en modell från en server.
- Ögonblicksbilder är högst 1 500 bildpunkter på längsta sidan; en större bild ritas om i den storleken.
- Dokument, som AI-kontrollens foton, ligger i mappen Documents och står i `documents.xml`.

Appen läser BCF 3.0 och 2.1 från andra program och sina egna tidigare filer. Kommentarer, viewpoints med kamera och snitt,
ögonblicksbilder, markerade, dolda och färgade komponenter och dokument följer med. Läs in en BCF-fil i Inhämta: ärendena blir en
tabell med kommentarer och komponenter i tabeller bredvid, och filen sparas med ärendena så att bilderna och vyerna finns kvar.

### Granskning enligt svensk praxis

I svensk praxis för granskning av modeller med BCF har ett ärende en av sex statusar. Appen känner igen dem i projektets egen
statuslista och ger dem samma färger som andra statusar:

- *Ny kommentar* räknas som öppen, som Open.
- *Ska åtgärdas* och *Ny granskning* räknas som pågående, som In progress: ärendet ska åtgärdas, eller tas upp i nästa granskning.
- *Har åtgärdats*, *Avvisad* och *Godkänd* räknas som klara: Har åtgärdats som Resolved, de andra två som Closed.

Statusarna används bara när projektet på servern har dem i sin lista; appen föreslår dem inte själv. Ett projekt i Dataregium har som
förval Open, In progress, Resolved och Closed, som motsvarar dem som ovan. I Dataregium ställer en administratör in projektets
statuslista (`topic_status`) på projektets sida under `/admin`. Där ger knappen *Använd Praxis statusar* listan de sex statusarna
ovan och lämnar projektets övriga listor som de är. Fälten för ett granskningsärende finns i *Nytt ärende* och under *Fler
alternativ* i AI-kontrollen: rubrik, beskrivning, status, tilldelad, ansvarig part (som etikett), skede och förfallodatum, och
granskaren är den som är inloggad.

## Tabellerna

| Tabell | Innehåll |
|---|---|
| `data` | En rad per byggdel, rum och våning: id, guid, typ, kategori (byggdel, rum, struktur), namn, beskrivning, objekttyp, tagg, vaning, typnamn, material, klassificering, egenskaper och mängder som JSON |
| `_properties` | En rad per egenskap: id, uppsattning, namn, varde, tal, enhet, kalla (objekt eller typ) |
| `_quantities` | En rad per mängd i SI-enheter: id, uppsattning, namn, varde, slag (langd, area, volym, vikt, tid, antal), enhet |
| `_entities` | Filens icke-geometriska entiteter med råa attribut: id, typ, attribut |

Egenskaper som bara finns på byggdelens typ räknas med och är märkta med `typ`. Mängder räknas om till meter,
kvadratmeter, kubikmeter och kilogram med hjälp av projektets enheter. Öppningar och anslutningsportar är inte byggdelar
och finns bara i `_entities`.

Tabellerna går att fråga med SQL i Analysera:

```sql
SELECT d.vaning, d.typ, count(*) AS antal, sum(q.varde) AS volym
FROM data d JOIN _quantities q ON q.id = d.id
WHERE q.namn = 'NetVolume'
GROUP BY 1, 2 ORDER BY 1, 2
```

I R och Python ger `dm_read()` byggdelarna, `dm_read_properties()` egenskaperna och `dm_read_quantities()` mängderna.

## Fliken Mängder i Analysera

- **Sammanfattning**: filens uppgifter och innehåll.
- **Mängder**: antal, längd, area, volym och vikt grupperat på typ, våning, material, typnamn eller klassificering.
  Källan *Filens mängder* tar ett värde per byggdel och slag: nettomått före andra och bruttomått sist, så att en vägg
  inte räknas två gånger. Källan *Mätt på geometrin* räknar på trianglarna och fungerar även när filen saknar mängder.
  Då är ytan hela ytan runt byggdelen, inte till exempel en väggs sidoarea.
- **Mängdlista**: varje mängdnamn i filen per typ, med summa. Här ser du exakt vad filen anger.
- **Egenskaper**: vilka värden en egenskap har, och hos hur många byggdelar av varje typ.
- **Entiteter**: hur många entiteter av varje slag filen består av.
- **Klimatdeklaration**: en preliminär klimatdeklaration ur modellen per kategori och skikt, se *Preliminär klimatdeklaration* nedan.
- **Materialinventering**: underlag för avfallshanteringsplanen ur modellen, med byggprodukter som kan återanvändas, avfallet per
  fraktion och skikt och de farliga ämnen modellen anger, se *Materialinventering för avfallshanteringsplanen* nedan.

Varje resultat kan sparas som datamängd.

## IfcOpenShell i appen

Appen kan läsa, kontrollera och ändra IFC-modeller med IfcOpenShell, samma bibliotek som Dataregium bygger på. Det
körs i Python i webbläsaren, hämtas första gången det används (cirka 13 MB, efter ditt samtycke för komponenter) och sparas
sedan i webbläsaren. Inget skickas någonstans; modellen lämnar inte datorn.

**I Analysera, fliken Mängder**, har en IFC-modell fem verktyg till:

- **Validering** kontrollerar modellen mot sitt IFC-schema: attribut, typer och referenser, valfritt även schemats regler.
  Fynden kan sparas som datamängd.
- **Rumslig struktur** visar projekt, tomt, byggnad, våningar och rum som ett träd med antal element per del.
- **Egenskapsmängder** ger alla egenskapsmängder för en elementtyp som en bred tabell: en rad per element, en kolumn per
  egenskap (`Uppsättning.Egenskap`), valfritt även mängdsatserna.
- **IFC-urval** hämtar element med IfcOpenShells urvalsspråk, till exempel `IfcWall, Pset_WallCommon.FireRating=EI60` eller
  `IfcElement, material=Betong`.
- **Geometrimått** mäter volym, yta och omslutande låda per element på geometrin (OpenCASCADE). Långsamt för stora modeller.
- **IDS-kontroll** kontrollerar modellen mot en IDS-fil (buildingSMART Information Delivery Specification) med
  ifctester, IfcOpenShells egen kontrollant: välj .ids-filen, så får du en rad per krav och element med godkänd, underkänd eller
  ej tillämpligt och orsaken, samt en sammanräkning. Filen stannar i webbläsaren. ifctester följer med appen utan sin webbapp,
  så inget hämtas utöver Python självt.
  Under *IDS i appen* väljer du i stället en av appens egna IDS-filer, till exempel *Avfallshantering* (se *Materialinventering för
  avfallshanteringsplanen*), som prövas på samma sätt; *Spara IDS-filen* sparar den valda på datorn.

**I Bearbeta** har modellen två åtgärder under *Åtgärder* (knappen finns i modellvyn och i tabellvyn), i gruppen *Modell*:

- **Skriv tabell till modellen** skriver en tabells värden in i modellen. Raderna matchas på GUID; kolumnerna `Name`,
  `Description`, `ObjectType` och `Tag` (eller `namn`, `beskrivning`, `objekttyp`, `tagg`) blir attribut, och kolumner som
  `Pset_WallCommon.FireRating` blir egenskaper (uppsättningen skapas om den saknas). Arbetssättet: spara *Egenskapsmängder*
  som datamängd, redigera den i Bearbeta och skriv tillbaka.
- **Python på modellen** kör en funktion `step(model)` med IfcOpenShells API på hela modellen.

Båda är steg i receptet: den ändrade modellen blir datamängdens nya innehåll (originalfilen byts och tabellerna byggs om),
steget loggas och kan ångras, och originalfilen är alltid den aktuella versionen när du exporterar modellen eller skickar den
till ett CDE.

**I Python** (fliken Python i Analysera och kodceller i anteckningsboken) öppnar `dm_ifc("namn")` modellen som en
`ifcopenshell.file`. Hjälparna `dm_ifc_elements`, `dm_ifc_psets`, `dm_ifc_tree`, `dm_ifc_validate`, `dm_ifc_select` och
`dm_ifc_geometry` ger tabeller, `dm_ifc_set(model, df)` skriver en tabell in i modellen och `dm_ifc_write(model, "namn")`
skickar modellen till appen som en ny datamängd; se [Python i Dataspatium](python.md). Verktygen i Analysera och Python ändrar
aldrig datamängden; bara åtgärderna i Bearbeta ger en ny version.

IfcOpenShell är LGPL-3.0 och hämtas oförändrat som pinnade hjul från IfcOpenShells egen förteckning, se [Licenser](licenser.md).

## Validera modellen

Kortet **Validera modellen** i Hantera samlar kontrollerna av en IFC-modell, med det senaste resultatet av varje.

- **Serverns kontroll** finns för en modell som hämtats som dokumentversion från ett CDE. Dataregium (från 3.0.0) kontrollerar
  varje uppladdad IFC-fil mot IFC-schemat och, när servern har dem installerade, mot buildingSMART:s regler (ifc-gherkin-rules), och
  lägger resultatet i versionens metadata. *Hämta serverns kontroll* läser det: inga fynd, fynd som bara är varningar, fynd med fel,
  väntar på kontroll eller kunde inte kontrolleras, och när och med vilka regler. Appen frågar servern först när du trycker på
  knappen. Finns det fynd visar *Visa fynden* serverns rapport: antal fynd och fel, vilka kontroller som gjordes och vilka regler som
  inte kunde köras, och varje fynd med sin regel, sin instans (`#123`) och elementets GlobalId. *Markera i modellen* markerar sedan
  elementen i modellvyn i Bearbeta, och *Spara som tabell* sparar fynden som en tabell med kolumnerna `kind`, `rule`, `severity`, `message`, `step_id`, `global_id` och `attribute`.
  Rapporten hämtas med samma inloggning från en adress som appen själv bygger på samma server; en adress ur metadata följs aldrig.
- **Projektets IDS-filer**: kontrollerar servern också filen mot projektets IDS-dokument (den senaste versionen av varje dokument vars
  namn slutar på `.ids`), visar rapporten hur många specifikationer som godkändes, inte godkändes eller inte gällde filen, och vilka som
  inte godkändes, med dokumentets namn och antal fynd. Ett IDS-dokument som inte kunde läsas står bland reglerna som inte kunde köras.
- **Det som inget GlobalId når**: hittar serverns kontroll graph instanser som inget med ett GlobalId når, visar rapporten knappen
  *Ta bort det som inget GlobalId når*. Servern föreslår då, efter din bekräftelse, ett ändringsset som tar bort dem; förslaget
  blir ett ärende som prövas och godkänns som andra, och versionen behåller allt.
- **Kontroller här** visar den senaste *Validering*, *IDS-kontroll* och kollisionskontroll som körts i appen, och knapparna öppnar
  dem i Analysera. Resultaten sparas i appens inställningar, inte i datamängden.

Fynden gäller filen som den laddades upp, och servern stoppar aldrig en fil för dem. En fil vars fynd bara är varningar räknas som
giltig av buildingSMART:s valideringstjänst. Har servern ingen sådan kontroll säger kortet att servern inte har kontrollerat
versionen.

## Projektprofil

Kortet **Projektprofil** i källans vy under *Inhämta → OpenCDE* visar det valda projektets profil: projektets IDS-dokument (filer med
ändelsen `.ids` bland projektets filer) och de bSDD-ordböcker du valt för projektet, sparade i den här webbläsaren per server och projekt.

- **Skriv IDS med AI** skriver en Information Delivery Specification ur en beskrivning i ord. Välj leverantör, den modell kraven ska
  prövas mot och beskriv kraven. AI:n lämnar filen till appen, som kontrollerar den (först formen, sedan med ifctester mot modellen,
  i Python i webbläsaren) och svarar med felet att rätta eller med utfallet per specifikation. Det går varv för varv tills filen går
  att köra, högst fyra varv, och kraven mjukas aldrig upp för att gå igenom. Resultatet kan sparas som `.ids`-fil eller laddas upp
  till projektet som ett dokument.
- **Sök i bSDD** slår upp klasser i buildingSMART Data Dictionary efter samtycke för värden `api.bsdd.buildingsmart.org`, i de valda
  ordböckerna eller alla; *Ordböcker* listar ordböckerna så att du kan lägga till dem i profilen. I *Ändra med AI* kan AI:n söka med
  verktyget `search_bsdd` och klassificera byggdelar med `set_classification`, som skrivs som `IfcClassificationReference` i
  ändringssetet du godkänner.
  `search_bsdd` söker bara i fria ordböcker vars licens har lästs (IFC 4.3, Uniclass 2015 och ETIM 10.1) och svarar med ordbok och
  licens för varje klass, och `set_classification` skriver systemets utgåva, utgivare och adress på dess `IfcClassification`.

Serverns buildingSMART-regler visas på kortet *Validera modellen* i Hantera; välj en regel i listan bredvid *Markera i modellen* för att
markera bara de byggdelar som den regeln träffar.

## Kollisionskontroll

Verktyget **Kollisioner** i Analysera (fliken Mängder) hittar byggdelar som går in i varandra eller kommer för nära varandra. Det
arbetar på samma trianglar som 3D-vyn visar, i en egen tråd, och behöver varken Python eller nät.

- **Mängd A och mängd B** är alla byggdelar eller en typ, till exempel kanaler mot balkar. B kan ligga i samma modell eller i en annan
  modell i samma projekt, och modellerna måste då dela koordinatsystem. Öppningar räknas inte.
- **På servern**: för en modell från Dataregium (från 3.0.0, när servern har kollisionskontrollen påslagen) väljer *Var* om appen
  räknar själv eller om servern gör samma kontroll av versionerna. Servern arbetar i en kö; appen väntar och visar rapporten som
  sin egen, med samma tabell, markering och BCF-fil, och *Skicka som ärenden* låter servern göra ärendena med en viewpoint var.
  Den andra modellen ska då vara en version i samma projekt.
- **Skärning** räknar par där det ena elementet når in i det andra djupare än toleransen (2 mm om inget annat anges). Djupet mäts som
  hur långt in i det andra elementet hörn och kanter når, så ytor som bara möts räknas inte. *Inneslutning* är ett element som ligger
  helt inne i ett annat.
- **Fritt avstånd** räknar par som är närmare varandra än avståndet (50 mm om inget annat anges), skärningar inräknade.

Resultatet är en tabell med båda elementens id, GlobalId, typ och namn, slaget, djupet eller avståndet i millimeter och en punkt i
modellens egna koordinater. Därifrån:

- *Markera i modellen* markerar elementen i modellvyn i Bearbeta.
- *Spara som BCF* sparar ett ärende per kollision i en BCF-fil, med en vy som tittar på punkten och båda elementen markerade och
  färgade. Kamera och punkt står i modellens koordinater med Z uppåt, så andra BCF-verktyg visar samma plats.
- *Skicka som ärenden* skapar ärendena direkt i projektet på servern genom BCF API, för en modell som hämtats från ett CDE. Där ser
  alla klienter dem, till exempel Bonsai.
- *Skapa datamängd* sparar tabellen.

Det senaste resultatet står på kortet Validera modellen i Hantera, med om det gjordes i appen eller på servern. Mätningen förutsätter slutna ytor: ett element med öppna eller
trasiga ytor kan ge osäkra djup. Böjda ytor är uppdelade i trianglar, så en tolerans under någon millimeter blir osäker. Element som 3D-vyn inte kan rita är inte med, och resultatet säger hur många de är; i en provmodell från Tekla gällde det alla armeringsjärn.

## Preliminär klimatdeklaration

Verktyget **Klimatdeklaration** i Analysera (fliken Mängder) räknar fram en preliminär klimatdeklaration ur modellen: klimatpåverkan för
A1–A3, A4 och A5 i kg CO₂e per kategori och per skikt i byggnaden. Det är ett underlag i projekteringen, inte en deklaration att
registrera hos Boverket.

**Kategori och skikt.** Varje byggdel får en av Boverkets fyra kategorier (bärande konstruktionsdelar – grundläggning, bärande
konstruktionsdelar – övriga, klimatskärm, innerväggar) eller *Ingår inte*, och ett av byggnadens sex skikt enligt Boverkets rapport
2024:26: 1 plats och grundläggning, 2 stomme och övriga bärande konstruktioner, 3 klimatskärm, yttertak och fasad, 4 tekniska
installationer, 5 innertak, innerväggar och ytskikt inomhus, 6 fast inredning. Reglerna läser bara IFC-klassen, PredefinedType
(byggdelens eller typens) och LoadBearing och IsExternal i Pset_*Common; ingen klassifikation läses. De följer Boverkets lista över
byggdelar som ingår: pålar, markarbeten, installationer, fast inredning, flyttbara innerväggar, invändiga ytskikt och solavskärmning
ingår inte; trappor, ramper och räcken är bärande; innertak, undertak och innerdörrar hör till innerväggarna. Kolumnen *Regel* visar
vad som avgjorde.

- **Osäker**: byggdelen ingår men kategorin är osäker, till exempel en innervägg utan LoadBearing eller en dörr utan IsExternal. Den
  räknas i den kategori som står och listas under *Att avgöra*. En yttervägg är klimatskärm oavsett LoadBearing.
- **Kan inte avgöras**: reglerna kan inte säga om byggdelen ingår, till exempel ett proxyelement eller solceller (som ingår bara när
  de är integrerade i tak eller fasad). Den räknas inte förrän du har avgjort den.
- **Härledd IsExternal**: när filen inte anger IsExternal får en dörr eller ett fönster värdet från väggen den sitter i. *Härled
  IsExternal* läser byggnadens topologi med appens Python, som startar då (första gången hämtas dess komponenter efter ditt samtycke):
  väggarna längs en vånings yttre gräns är yttre, och på en sluten våning är rummens övriga väggar inre. Regeln säger när ett värde är
  härlett.
- En sammansatt byggdel, till exempel ett tak av takplattor, räknas i sina delar, och en del som reglerna inte kan avgöra tar
  helhetens kategori.

Under **Att avgöra** väljer du kategori för en hel grupp byggdelar med samma klass, typ och regel. Valet sparas per byggdel (GlobalId)
i webbläsaren tills du låter reglerna avgöra igen.

**Mängder.** Volym, area och vikt tas ur filens mängder, nettomått före bruttomått och väggens sidoarea. Har filen inga mängder räknas
volymen ur geometrin när byggdelen är en enkel extrudering: profilens area gånger djupet (rektangel, cirkel, I-profil, polylinje med
flera), också genom typens representation och före en klippning. Öppningar dras då inte av, och kolumnen *Mängdens källa* säger det.
Dörrar och fönster räknas per kvadratmeter ur sina mått. En byggdel med materialskikt delas per material efter skiktens tjocklek.
Annars har raden ingen mängd och räknas inte.

**Klimatdata.** *Hämta klimatdatabasen* hämtar Boverkets klimatdatabas (cirka 0,9 MB) från api.boverket.se efter ditt samtycke för
API-hämtning och sparar den i webbläsaren; inget om modellen skickas. Under *Material och resurser* väljer du en resurs för varje
material. Förslagen bygger först på materialets kategori i IFC (IfcMaterial.Category, till exempel concrete, steel, wood, glass eller
gypsum) och sedan på namnet; dörrar och fönster föreslås efter typens namn. *Godta förslagen* sparar förslagen som dina val, som
gäller alla modeller. Klimatpåverkan är massan (volymen gånger densiteten eller arean gånger vikten per kvadratmeter) gånger
databasens värden för A1–A3, A4 och A5 (spill). Boverket anger att klimatdata för byggprodukter är konservativt satta, cirka 25
procent över genomsnittet; verktyget räknar med det konservativa värdet och visar det typiska på begäran.

Varje vy kan sparas som datamängd. Källa: Boverket, klimatdatabasen (öppna data, se [licenser.md](licenser.md)).

## Materialinventering för avfallshanteringsplanen

Verktyget **Materialinventering** i Analysera (fliken Mängder) sammanställer det modellen vet som underlag för
avfallshanteringsplanen. Enligt PBL 10 kap. 8 a §, som gäller sedan den 1 juli 2026, ska byggherren se till att det finns en
avfallshanteringsplan med uppgifter om

1. vilka byggprodukter som kan återanvändas och hur de tas om hand, och
2. vilket avfall åtgärden kan ge upphov till och hur det tas om hand, särskilt hur byggherren avser att möjliggöra a)
   materialåtervinning av hög kvalitet och b) säker hantering och avlägsnande av farliga ämnen.

Planen behövs inte när det är uppenbart att den inte behövs, och kontrollansvarig har samma uppgift för den som för kontrollplanen.
Boverket föreslog planen i rapport 2024:26 under namnet resurshushållningsplan. Verktyget ger underlaget; planen och bedömningarna
är byggherrens. Vyerna följer bestämmelsens två punkter.

**1. Byggprodukter som kan återanvändas.** Byggdelarna med en typ, de med produktdata först: tillverkare (Manufacturer), modell
(ModelLabel) och GTIN (GlobalTradeItemNumber) ur Pset_ManufacturerTypeInformation, helst på typen, och serienummer (SerialNumber)
och streckkod (BarCode) ur Pset_ManufacturerOccurrence på byggdelen. GTIN:ets kontrollsiffra prövas enligt GS1; ett fel visas men
rättas aldrig. Varje rad har skiktet i byggnaden, materialen, fraktionerna och de farliga ämnen modellen anger. IFC2X3 har inget
GTIN.

**2 a. Avfall per fraktion och per skikt och fraktion.** Varje material i varje byggdel får en avfallsfraktion enligt
avfallsförordningen 3 kap. 10 §, som utöver farligt avfall kräver att trä, mineral (betong, tegel, klinker, keramik och sten),
metall, glas, plast och gips sorteras ut. Fraktionen tas först ur materialets kategori i IFC (IfcMaterial.Category, till exempel
concrete, steel, wood, glass, gypsum eller plastic) och annars ur materialets namn (betong, limträ, gipsskiva, isolerglas och
liknande, på de nordiska språken och engelska). Mineralull, glasull och stenull hör varken till mineral eller glas, och kompositer
som glasfiberarmerad plast, namn som anger flera fraktioner (trä/aluminium) eller ingen och byggdelar utan material blir *Övrigt /
avgörs*. Kolumnen *Regel* visar vad som avgjorde. Summorna ger byggdelar, rader, volym, area och massa per fraktion, och per skikt i
byggnaden (klimatdeklarationens sex skikt) och fraktion. Ingen klassifikation läses.

**2 b. Farliga ämnen.** Bara det en egenskap i modellen säger: en egenskap vars namn eller uppsättning gäller farliga ämnen eller
farligt avfall (till exempel Pset_EnvironmentalImpactValues.HazardousWaste, eller en egen uppsättning med asbest eller PCB) och vars
värde säger ja, på byggdelen, typen eller materialet. Appen gissar aldrig. Anger modellen inga farliga ämnen säger verktyget det,
och en inventering av farliga ämnen behövs ändå.

**Alla byggdelar och material** är raderna bakom summorna: mängden, materialets kategori, tjockleken, fraktionen med regeln,
skiktet, densiteten och massan.

**Mängder och massa.** Mängderna är klimatdeklarationens: filens mängder, annars geometrin för enkla extruderingar, och en byggdel
med materialskikt delas efter skiktens tjocklek; dörrar och fönster räknas här per material. Massan är filens vikt, annars volymen
gånger materialets densitet (Pset_MaterialCommon.MassDensity i kg/m³). Saknas densiteten har raden ingen massa, och anteckningen
säger hur många rader det gäller.

**IDS för avfallshantering.** *IDS Avfallshantering* öppnar IDS-kontroll med appens IDS-fil `SE-Dataspatium_Avfallshantering.ids`
och prövar modellen mot den i appens Python: material med en av IFC:s rekommenderade kategorier på varje byggdel; basmängd för volym
på väggar, bjälklag, balkar, pelare, stänger och skivor (IfcMember och IfcPlate), fundament och trapplopp, och för area på dörrar,
fönster, beklädnader, tak och glasfasader; tillverkare och modell på dörrar, fönster och installationer, och GTIN i rätt form när
det finns. Filen gäller IFC4 och IFC4.3, eftersom IFC2X3 saknar materialkategori, mallar för basmängder och GTIN. ifctester
godkänner materialkravet när minst ett av byggdelens material har en kategori, och sammansatta byggdelar (tak, trappor, ramper och
glasfasader) prövas i sina delar.

Varje vy kan sparas som datamängd. Inget hämtas från nätet.

## DXF-ritningar

En DXF-fil blir en tabell med ett ritobjekt per rad (typ, lager, färg, längd, area, text och läge) och en SVG-ritning.
Ritningen öppnas i Bearbeta, där du zoomar med hjulet eller genom att nypa och panorerar genom att dra; när ritningen har fokus flyttar pilarna, + och − zoomar, Home visar allt och F zoomar till det markerade objektet. En rad i tabellen zoomar till sitt objekt. Lagren tänds och släcks i inspektören,
och en klickning markerar objektet och dess rad. Fliken Mängder ger antal, längd och area per lager och typ.

Linjer, polylinjer med bågar, cirklar, bågar, ellipser, splines, punkter, texter, solider, 3D-ytor, block och
måttsättningars block ritas. Skraffering (HATCH) ritas inte.

## Export

Exportera ger originalfilen, egenskaperna och mängderna som CSV (en rad per värde) och ritningen som SVG, utöver de
vanliga tabellformaten för `data`. Diagram av modeller exporteras som PNG, SVG och PDF; en 3D-modell blir då en bild.

## Begränsningar

- Tabellerna går inte att redigera direkt. Modellen ändras med receptstegen för IfcOpenShell och med *Ändra med AI*, som skriver en
  ny version av IFC-filen.
- En modell ritas om ur originalfilen i varje ny session. Modellen på 57 MB som appen provats med tar 4–6 sekunder.
- Den första ritningen av en mycket stor modell kan låsa sidan en stund medan grafikkortet tar emot trianglarna.
- Mängderna är inte mängdavtagning enligt något regelverk. Kontrollera mot källan innan de används skarpt.
- DXF läses i två dimensioner. DWG måste först sparas som DXF.

## Ny modell

En ny, tom modell skapas i Inhämta med *Ny byggnadsmodell*. Välj schema (IFC4X3_ADD2 är förval; IFC4 och IFC2X3 finns för program
som inte läser det senaste) och namn på projekt, plats, byggnad och första våning. Appen skriver modellen med IfcOpenShell i appens
Python, i meter och med modellens sammanhang, och modellen klarar schemakontrollen. Första gången hämtas Python och IfcOpenShell
efter samtycke.

Modellen blir en vanlig modelldatamängd. Öppna den i Bearbeta och bygg i den med *Ändra med AI*, till exempel "två våningar och ett
rutnät 6×4 m med ytterväggar längs rutnätet". Den kan exporteras som IFC och publiceras på en Dataregium som andra modeller.

### Beteckningar, nummer och läge

Under *Beteckningar och id* i formuläret fyller du i det du vet; bara det skrivs i filen:
- *Fastighetsbeteckning* blir platsens namn (IfcSite.Name) och dess fastighets-id (Pset_LandRegistration.LandID); det du skrev
  under *Plats* blir då platsens långa namn.
- *Byggnadsnummer* blir byggnadens namn (IfcBuilding.Name) och *Byggnadens namn* dess långa namn (LongName).
- *Nationellt byggnads-id* skrivs i Pset_BuildingCommon.BuildingID med IsPermanentID, så att modellen och registren talar om
  samma byggnad.
- *Första våningens beskrivning* blir våningens Description, till exempel att den är entréplan.
- *Upphovsperson* och *Organisation* skrivs i IFC-filens huvud bara om du fyller i dem; ett namn är en personuppgift.

Modellen får också sammanhanget Axis för väggarnas axlar från början, och rapporten påminner om att modellen saknar
koordinatsystem (buildingSMART-regeln GRF003) tills `set_site` har gett den ett.

AI:n numrerar våningarna i höjdordning för hela projektet (Plan 1, Plan 2 …) och skriver entréplanet i våningens beskrivning;
`create_storeys_and_grid` tar `description` och `long_name` per våning. `create_spaces` tar ett `number` per rum, unikt i
byggnaden: numret blir rummets Name, rumsnamnet dess LongName och `long_name` dess beskrivning, och en rumstyp (`room_type`)
skrivs som ObjectType med PredefinedType USERDEFINED. Utan nummer gäller namnen som förut.

`set_site` känner de sammansatta EPSG-koderna för SWEREF 99 med höjder i RH 2000: 5845 för SWEREF 99 TM och 5846–5857 för de
tolv lokala zonerna i samma ordning som 3007–3018 (till exempel 5850 för SWEREF 99 18 00 + RH 2000). För en byggnad i Sverige
föredrar AI:n den lokala zonen när koordinaterna finns i den; den räknar aldrig om koordinater själv. Koordinatsystemet
(IfcProjectedCRS) får en beskrivning i klartext och, när koden inte anger höjdsystemet, RH 2000 som VerticalDatum (ett annat med
`vertical_datum`). Kartenheten är alltid meter och konverteringens Scale filens längdenhet i meter (GRF005), så en modell i
millimeter får Scale 0,001. Varje överordnat sammanhang (Model, Plan) får en egen IfcMapConversion med samma värden (GRF001).
Byggnadens höjd över havet står i konverteringens OrthogonalHeight; i IFC4 och IFC2X3 också i IfcBuilding.ElevationOfRefHeight,
som IFC4X3 har avvecklat.

Filhuvudet: varje IFC-fil som appen skriver eller sparar får FILE_DESCRIPTION med vydefinition och nivån 2;1, och FILE_NAME med
filens namn, tiden enligt ISO 8601, förprocessorn (Dataspatium och IfcOpenShell med versioner) och ursprungsprogrammet i formen
*Dataspatium - Dataspatium - version*. Vydefinitionen är CoordinationView_V2.0 för IFC2X3 och ReferenceView_V1.2 för IFC4. IFC4X3
har ingen officiell vy för en modell i hela schemat (Reference View utesluter bland annat extruderade kroppar), så huvudet säger
`notYetAssigned` i stället för en vy som filen inte följer; buildingSMARTs valideringstjänst flaggar det, och en mottagare som
kräver en vy anger den. En fil som appen ändrar behåller sin egen upphovsperson, organisation och sitt ursprungsprogram, och sin vy
när valideringstjänsten godtar den.

## Ny byggnad från en uppdragsbeskrivning

Skriv en uppdragsbeskrivning i formuläret *Ny byggnadsmodell* ("ett tvåvåningshus 12 × 8 m med sadeltak, tegelfasad, entré mot söder …") och välj
*Bygg från uppdragsbeskrivningen med AI* när modellen är skapad: modellen öppnas i Bearbeta med AI-panelen i läget **Bygg från beskrivning**. Där kan du
bifoga foton och skannade ritningar (JPEG, PNG eller PDF; en planritning ger de riktiga måtten, ett foto utseende, material och hur
delarna hör ihop) eller lägga till bilderna ur en bildsamling, till exempel de du tagit med Dataspatium Mobil. AI:n läser den tomma
modellen, säger sin plan, frågar i panelen när beskrivningen lämnar något väsentligt öppet (fotavtryck, antal våningar, våningshöjd,
väggtjocklekar, material) och bygger sedan i grupper med samma verktyg som *Ändra*: våningar och rutnät, väggar per våning, bjälklag,
öppningar, egenskaper och material, med förhandsvisning och rättning efter varje grupp. Ingenting skrivs i modellen förrän du
förhandsgranskar och godkänner ändringssetet som vanligt, och du kan komplettera med en ny beskrivning i samma läge. Bilderna skickas till
leverantören tillsammans med beskrivningen, efter samtycket för leverantörens värd; en lokal modell som ser bilder behåller allt på datorn.
Med *Uppgifter ur en datamängd* läggs rader ur en tabell i beskrivningen som text: en byggnadsyta hämtad ur kartan (Öppna geodata) blir
hörn i meter från sydvästra hörnet, så att väggarna får riktiga mått, och mått och anteckningar ur ett fältformulär från Dataspatium
Mobil blir rader; en runda med telefonen kan sedan ge fler bilder och mått, och beskrivningen kompletteras i samma läge.
Uppdragsbeskrivningen och bilderna kan också läggas på servern som modellens underlag när modellen hämtats från ett CDE: ärendet *Underlag* i
modellens projekt får beskrivningen som textdokument och varje bild som dokument, så att andra som arbetar med modellen i egna klienter
ser vad den byggdes av. Knappen heter *Lägg underlaget på servern*.
Överst i panelen står *Byggnadens uppgifter* (vilken byggnad, våningar, längd, bredd, höjd, grundläggning, tak) och *Noggrannhet*
(skiss, huvuddrag eller detaljerad): fyll i det du vet, så inleder det beskrivningen och AI:n frågar om resten. Orden är vanliga, men bakom
dem ligger ISO 19650:s informationskrav och level of information need, och modellen är tänkt som byggnadens förvaltningsmodell. Varje
bild bifogas som foto, fasad mot norr, öster, söder eller väster, insida eller ritning, och ett foto med position och tidpunkt i filen
(EXIF) får dem i sin bildtext, så att AI:n vet vad den ser. Uppgifterna ur en datamängd ger också byggnadsytans sydvästra hörn på
kartan, så att AI:n placerar modellen med `set_site` (läge, höjd och SWEREF 99 TM), och med *Med markhöjd i hörnen*, som visas när
Lantmäteriets källa är tillagd, markhöjden i varje hörn ur höjdmodellen: ett nätanrop med din nyckel efter samtycke.
När en datamängd är vald visar *Platsen på kartan* byggnadsytan nära, och i valet av bakgrundskarta finns ortofotot som täcker platsen:
byggnaden syns då uppifrån medan du placerar den. Kartan ritas när du öppnar den, och bilderna hämtas först när du väljer bakgrund och
ger samtycke. Danmark, Finland och Island har öppna ortofoton som rutor; i Sverige läser appen Lantmäteriets ortofoto för platsen och
250 m runt den ur Lantmäteriets filer med din nyckel från Geotorget (samma som för markhöjden); Norge saknar öppet ortofoto (se
[kartor.md](kartor.md#ortofoton)).
Efter väggarna på varje våning läser förhandsvisningen byggnadens topologi: väggarnas mittlinjer blir rum, och våningen är sluten när
väggarna sluter minst ett rum och ingen väggände står lös; AI:n lagar lösa ändar genom att flytta eller lägga till väggar innan den
lägger bjälklagen. Ytterväggarna med sina väderstreck låter AI:n para ett foto av fasaden mot söder med rätt väggar (läsverktyget
`get_topology`), och samma topologi visas på kortet *Topologi* i Kontrollera.

### Syfte, skede och krav

Under *Byggnadens uppgifter* finns också *Syfte*, *Skede* och *Krav (IDS)*. Syftet är vad modellen ska användas till, och det väljer
noggrannhet och krav, som du kan ändra efteråt:

| Syfte | Noggrannhet | Krav |
|---|---|---|
| Volymstudie | Skiss | SE-Dataspatium_Grund |
| Bygglov | Huvuddrag | SE-Dataspatium_Grund |
| Klimatdeklaration | Huvuddrag | SE-Dataspatium_Klimatdeklaration |
| Förvaltning | Detaljerad | SE-Dataspatium_Grund |
| Avfallshantering | Detaljerad | SE-Dataspatium_Avfallshantering |
| Annat (med egen text) | Huvuddrag | inga |

Skedet säger var i byggnadens liv modellen hör hemma: förstudie, förslag, bygghandlingar, under byggnad eller befintlig byggnad.
Syfte, skede och krav inleder uppdragsbeskrivningen. Med ett krav prövar varje förhandsvisning, AI:ns egen och din, kandidaten mot IDS-filen, och
AI:n får de specifikationer som inte uppfylls så att den kan rätta dem. Kraven hindrar inte godkännandet; panelen visar hur många
specifikationer som uppfylls och vilka som inte gör det.

Noggrannheten följer informationsbehovet i ISO 7817-1 (avsnitt 6), som delar det i geometri, alfanumerisk information och
dokumentation. Med appens egna ord betyder de tre nivåerna detta per aspekt:

| Aspekt | Skiss | Huvuddrag | Detaljerad |
|---|---|---|---|
| Detalj | våningar, ytterväggar och bjälklag som enkla kroppar, inga öppningar | alla väggar med typernas tjocklek, bjälklag, takets form och öppningar med rimliga mått | skikt per typ, dörrar och fönster med karm och båge, väggar som möts i hörnen |
| Dimensioner | kroppar i 3D och väggens axel | som skissen | som skissen; symboler i plan kan komma senare |
| Läge | våningarnas höjder, rutnätet och platsen när den är känd | mått ur ritning eller uppdragsbeskrivning, georefererad när uppgifterna finns | inmätta eller måttsatta lägen, öppningar på exakt plats |
| Utseende | standardfärger | färg efter materialets kategori | en ytstil per material, skild från materialet |
| Parametriskt beteende | extruderingar vars mått kan ändras | typer (byt typen så ändras alla) och skikt | anslutningar som räknar om hörnen, dörrar och fönster med parametrar |
| Identifiering | namn, IFC-klass med PredefinedType och GlobalId | typer med namn, rum med nummer och namn | delar och rumsklasser, Tag på dörrar och fönster |
| Informationsinnehåll | våningar och höjder | IsExternal, LoadBearing och material på typerna, basmängder | brand, U-värde och klimatdata per typ eller material, skicket i en befintlig byggnad |
| Dokumentation | uppdragsbeskrivningen | uppdragsbeskrivningen och bilderna som modellens underlag | EPD-referenser och produktblad |

## Kontrollera med AI

Läget **Kontrollera** i AI-panelen prövar en befintlig byggnads modell mot foton av skador och slitage, tagna med Dataspatium Mobil,
en kamera eller en drönare, och mot mått ur ett fältformulär. Bifoga fotona i panelen, märkta med fasad eller insida, eller lägg till
bilderna ur en bildsamling som du har importerat i Inhämta; ett foto med position och tidpunkt i filen (EXIF) får dem i sin bildtext,
och *Uppgifter ur en datamängd* lägger mått och anteckningar ur ett fältformulär i frågan. AI:n läser modellen med samma verktyg som i
*Fråga*, letar upp elementet som varje foto visar och skriver ett fynd per skada med titel, beskrivning, skick (bra, godtagbart,
dåligt eller kritiskt), prioritet (låg, medel, hög eller akut) och föreslagen åtgärd; ett foto utan synlig skada ger inget fynd.
Elementets skick hamnar i egenskapsmängden Pset_Condition (bedömningsdatum, skick och en kort beskrivning) i ett ändringsset som du
förhandsvisar och godkänner som i *Ändra*, och inga element skapas, flyttas eller tas bort. Fynden listas under svaret, och *Spara
fynden som tabell* gör en ny datamängd med ett fynd per rad: foto, element, titel, beskrivning, skick, prioritet, åtgärd, datum och
fotots position. *Exportera som BCF* laddar ned en BCF-fil med ett ärende per fynd, där vyn tittar på elementet, markerat och färgat, med en bild av modellen som ögonblicksbild och fotot som dokument, och för en modell hämtad från en server du är inloggad på skapar *Skapa ärenden på servern* samma ärenden i modellens
projekt efter en bekräftelse; där blir fotot ett dokument i projektet, eller en egen viewpoint med bara fotot när du inte får lägga till dokument, och ärendena knyts till modellfilen när servern tillåter det. Under *Fler alternativ* ger du ärendena status, tilldelad, ansvarig part, skede och förfallodatum, på en server ur projektets listor. Fotona skickas till leverantören tillsammans med frågan efter samtycket för leverantörens värd, och de
lämnar datorn igen bara när du själv skapar ärenden på servern.

## Fråga AI om modellen

Knappen *Fråga AI* i modellvyn öppnar en panel i inspektören där du ställer en fråga om den öppna IFC-modellen, till exempel "vilka dörrar
saknar brandklass på plan 2?". AI-modellen läser med verktyg (modellens översikt, våningarna, element per klass, våning, namn och
egenskap, ett element med alla egenskaper, det du markerat i 3D-vyn och, för en modell hämtad från Dataregium, serverns namngivna
frågor) och svarar med de element den stöder sig på. *Markera n element*
lägger svarets element i urvalet, som 3D-vyn, tabellen och de andra lägena följer. Panelen visar varje verktygsanrop och hur många token
som gick åt. AI:n kan bara läsa: ingenting ändras, sparas eller publiceras, och nästa fråga fortsätter samtalet.

*Leverantörer* lägger till en molntjänst eller en lokal modell: Anthropic Messages eller ett OpenAI-kompatibelt API (OpenAI, Gemini,
Ollama, vLLM, llama.cpp med flera), med adress, modell och API-nyckel. Nyckeln hålls i sessionen eller krypterad med din lösenfras, aldrig
i klartext och aldrig i frågan. *Policy* avgör vad som får anropas: *Fråga* ber om samtycke per leverantör första gången, *Moln* tillåter
molntjänster, och *Endast lokal* tillåter bara modeller på den egna datorn. Det som skickas är din fråga och de verktygssvar modellen
begär; verktygssvaren är data ur modellen, aldrig instruktioner, och kapas när de är stora.

## Ändra med AI

Läget *Ändra* i samma panel låter AI:n föreslå ändringar i modellen, till exempel "skapa två våningar och ett rutnät 6×4 m,
ytterväggar längs rutnätet, ett bjälklag per våning och en dörr i varje vägg på plan 1". AI:n läser modellen med samma verktyg som i
Fråga och skriver med verktyg för våningar och rutnät, väggar, bjälklag, öppningar med dörr eller fönster, egenskaper, material, flytt
och radering. Verktyget `set_site` anger modellens plats på jorden: tomtens latitud, longitud och höjd, och med ett EPSG-nummer som
3006 för SWEREF 99 TM även kartkonverteringen, det vill säga modellens origo i öst- och nordkoordinater och dess vridning (inte i
IFC2X3, som saknar den). Verktyget `create_roof` lägger ett sadeltak, valmat tak, pulpettak eller platt tak med lutning, takfot och
tjocklek på en vånings väggar (utan angiven våning den översta): ett IfcRoof av takskivor (IfcSlab av typen ROOF), en per takfall, över
väggarnas omskrivande rektangel eller en angiven rektangel (en annan kontur ersätts än så länge av sin omskrivande rektangel).
Verktyget `create_spaces` gör rummen som väggarna sluter till utrymmen (IfcSpace) med namn ur rumsprogrammet, valda med en punkt inuti
eller sitt nummer i topologin, med höjden upp till nästa våning, rumsytor (Qto_SpaceBaseQuantities) och gränser mot väggarna och deras
dörrar och fönster. Verktygen ändrar ingenting: de fyller ett ändringsset som panelen listar steg för steg (mått i meter; nya element
får referenserna new-1, new-2 … tills filen har gett dem id).

Verktyget `define_type` gör en väggtyp, bjälklagstyp eller taktyp (IfcWallType, IfcSlabType eller IfcSlabType av typen ROOF för
takskivorna) med materialskikt i meter, för en vägg från höger sida till vänster sett från start mot slut och för bjälklag och tak
uppifrån och ned. Varje skikt kan få materialets kategori (IFC:s rekommenderade: concrete, steel, aluminium, block, brick, stone, wood,
glass, gypsum, plastic och earth) och skiktets roll (bärande, isolering, inre eller yttre ytskikt), men bara när de är kända.
`create_wall`, `create_slab` och `create_roof` tar typen: elementet får typen (IfcRelDefinesByType), sin tjocklek ur skikten och
skikten lagda på sig (IfcMaterialLayerSetUsage: väggens centrerade på linjen, bjälklagets nedåt från ovansidan i våningens höjd och
takskivornas uppåt från undersidan), och dess PredefinedType står på typen. Material och gemensamma egenskaper hör till typen, och AI:n
definierar typerna först. När ändringssetet körs knyts de väggar det skapar ihop med väggarna de möter (IfcRelConnectsPathElements): i
ett hörn går den tjockare väggen (vid samma tjocklek den längre) förbi hörnet och den andra slutar mot den, och en vägg som slutar mot
en annans linje slutar mot dess sida, så att hörnen varken får glipor eller överlapp och ingen volym räknas två gånger. Väggarnas
mittlinjer ändras inte, och hörn i andra vinklar än räta knyts ihop som de är ritade. Till sist får de väggar, bjälklag, tak, dörrar
och fönster som ändringssetet skapat eller ändrat basmängder (Qto_WallBaseQuantities, Qto_SlabBaseQuantities, Qto_RoofBaseQuantities,
Qto_DoorBaseQuantities och Qto_WindowBaseQuantities) räknade ur måtten, med öppningarna avdragna och med namnen ur schemats mallar.

Verktyget `create_element` gör de byggdelar som inte har ett eget verktyg, av den mest specifika IFC-klassen och aldrig som
IfcBuildingElementProxy: pelare (IfcColumn), balkar (IfcBeam), stänger som reglar och takstolar (IfcMember), grundsulor och plintar
(IfcFooting), pålar (IfcPile), beklädnader som golv, undertak, fasadbeklädnad, taktäckning och isolering (IfcCovering), räcken
(IfcRailing), skorstenar (IfcChimney), solskydd (IfcShadingDevice), sanitetsdon (IfcSanitaryTerminal), möbler (IfcFurniture, i IFC2X3
IfcFurnishingElement) och raka trappor (IfcStair). Klassen och dess PredefinedType kontrolleras mot modellens schema som i de andra
verktygen. Kroppen är en extruderad profil: en rektangel, en cirkel eller en kontur i våningens plan, stående uppåt från en höjd över
våningen (pelare, grundläggning, beklädnader, möbler) eller liggande i en riktning (balkar, stänger och räcken). Elementet ligger i
våningen eller är en del av en helhet (`part_of`), till exempel ett räcke i en trappa, och ligger då i helheten och på dess våning men
inte direkt i våningen. En beklädnad kan ange vad den täcker (`host`): en byggdel eller ett rum. I IFC4 och senare blir den en del av
byggdelen (IfcRelAggregates) eller ligger i rummet; bara i IFC2X3 får den IfcRelCoversBldgElements eller IfcRelCoversSpaces. En rak
trappa (STRAIGHT_RUN_STAIR) består av ett lutande trapplopp (IfcStairFlight, STRAIGHT) med antal steg, steghöjd, stegdjup och bredd
som attribut och i Pset_StairFlightCommon, och på begäran ett vilplan (IfcSlab, LANDING) överst; den sista steghöjden är vilplanets
eller bjälklagets framkant.

`define_type` gör också typer för beklädnader (med skikt, som en bjälklagstyp), pelare, balkar, grundläggning, räcken, dörrar och
fönster (IfcCoveringType, IfcColumnType, IfcBeamType, IfcFootingType, IfcRailingType, IfcDoorType och IfcWindowType; i IFC2X3
IfcDoorStyle och IfcWindowStyle) med material. En dörrtyp har sitt öppningssätt (OperationType, till exempel SINGLE_SWING_LEFT, med
gångjärnen till vänster sett i den riktning dörren öppnas), en fönstertyp sin indelning (PartitioningType, till exempel SINGLE_PANEL
eller DOUBLE_PANEL_VERTICAL), och båda bredd, höjd och karmdjup. Geometrin med karm, dörrblad eller bågar och glas ritas av
IfcOpenShell en gång på typen och återanvänds av varje dörr och fönster av typen (mappad geometri), och typen får karmens och
dörrbladens egenskaper (IfcDoorLiningProperties, IfcDoorPanelProperties, IfcWindowLiningProperties). `create_opening` tar typen: dörren
eller fönstret får typens storlek och geometri och står i liv med väggens vänstra sida, sett från väggens start mot dess slut (insidan
av en yttervägg som ritas moturs), och en dörr öppnas åt det hållet, en vänsterhängd med gångjärnen på den sida av öppningen som är
närmast väggens start. Med `side: right` vänds den: i liv med högra sidan och öppnad åt det hållet. En karm lika djup som väggen är
tjock fyller hela smygen.
Verktyget `edit_element` ändrar ett befintligt element på plats, så att det behåller sitt GlobalId hela sin livstid: en väggs start,
slut, tjocklek, höjd och typ, ett bjälklags kontur, tjocklek och typ, en öppnings läge, bredd, höjd och underkant tillsammans med dess
dörr eller fönster, ett taks lutning, takfot och takfotens höjd, och vilket elements namn som helst. Måtten läses ur elementets egen
geometri (väggens start och slut ur dess axel), och kroppen, axeln, skikten, basmängderna och väggskarvarna görs om. Läsverktyget
`get_parameters` visar AI:n de mått som `edit_element` ändrar, lästa på samma sätt, så att den kan ändra ett element som den inte själv
har skapat. Väggens öppningar behåller sin plats längs väggen så länge den behåller sin riktning (annars sitt avstånd från starten) och
måste rymmas i den, och taket behåller sin rektangel. En vägg eller ett bjälklag med typ får sin tjocklek ur typen, så en tjockare vägg
får en annan typ. Ett element som inte är ritat som skrivverktygen ritar kan bara få nytt namn, och svaret säger vad AI:n kan göra i
stället. AI:n ändrar därför element i stället för att radera och skapa dem på nytt, och raderar bara när du ber om det. Flytt med
`transform_elements` sker i våningens plan: en dörr eller ett fönster flyttas med sin öppning, en flyttad vägg knyts ihop med väggarna
den möter, ingen punkt blir kvar utan användning, och tomten, byggnaden och våningarna flyttas aldrig, eftersom deras läge och höjder
gäller hela projektet och bara ändras efter överenskommelse.
Produktidentiteter skriver AI:n bara när du anger dem, och den hittar aldrig på dem: GTIN (GlobalTradeItemNumber), tillverkare
(Manufacturer) och modell (ModelLabel) i Pset_ManufacturerTypeInformation på typen, och serienummer (SerialNumber) och streckkod
(BarCode) i Pset_ManufacturerOccurrence på byggdelen. IFC2X3 har inget GTIN.
**Bärande, status och egenskaper.** `create_wall` och `create_slab` tar `load_bearing` (bärande eller inte), och de och `create_roof`
tar `status` (NEW ny, EXISTING befintlig, DEMOLISH rivs, TEMPORARY tillfällig), men bara när uppdragsbeskrivningen eller du säger det: AI:n gissar
aldrig, och en digital tvilling av en befintlig byggnad får EXISTING. Värdena skrivs som LoadBearing och Status i Pset_WallCommon,
Pset_SlabCommon och Pset_RoofCommon, på typen när alla element av typen säger samma sak och annars på elementet; IFC2X3 saknar Status,
och rapporten säger det. När ändringssetet körs sätter appen själv IsExternal ur topologin på de väggar det skapat eller ändrat: sant
längs våningens yttre gräns och falskt inne i byggnaden, och dörrarna och fönstren i väggarna får sin väggs värde. Tak och takskivor
är yttre. En våning vars väggar inte sluter sig får inget IsExternal, och rapporten och AI:ns förhandsvisning säger varför; ett värde
som redan fanns i modellen behålls. Det är med LoadBearing och IsExternal som klimatdeklarationen skiljer kategorierna åt.
`set_properties` prövar en egenskapsmängd som heter Pset_… eller Qto_… mot IfcOpenShells mallar för modellens schema: en mängd eller
egenskap som mallen saknar avvisas med de närmaste namnen, sant och falskt, mått och uppräkningar måste ha rätt typ, och ett tal med
enheten skriven i värdet (”40 dB”) avvisas. Ange bara talet, längder i meter, areor i m², volymer i m³ och vinklar i grader, så
skriver appen dem i filens enheter. En mängd som heter Qto_… blir en mängdsats (IfcElementQuantity). En egen egenskapsmängd får inte
börja med Pset_ eller Qto_, och AI:n får rådet att kalla den land-ursprung-projekt_Namn, till exempel SE-ACME-42_Akustik, med
egenskapsnamn i PascalCase utan å, ä och ö. Egenskaperna skrivs i elementets egen mängd, aldrig i typens. `assign` tar materialets
kategori (IfcMaterial.Category, samma elva som i `define_type`).

*Förhandsvisa* kör ändringssetet på en kopia av modellen med IfcOpenShell i appens Python (komponenterna hämtas efter samtycke första
gången), ritar resultatet i 3D med nytt grönt och ändrat gult, och visar vad som skapas, ändras och raderas samt schemakontrollens fynd.
*Godkänn* gör ändringarna till receptsteget *AI-ändring*: modellen får en ny version i arbetsytan, tabellerna byggs om, och steget kan
ångras exakt. Steget bär proveniensen (leverantör, modell och frågorna). Ett ändringsset med schemafel kan inte godkännas, raderingar
bekräftas en gång till, och *Avvisa* kastar ändringssetet utan att röra modellen. AI:n kan aldrig spara eller publicera: det gör du med
knapparna.

Förhandsvisningen kontrollerar också modellens samband: en öppning utan vägg, en dörr eller ett fönster utan öppning, en byggdel
utanför våningarna och ett samband utan innehåll räknas som fel, men bara när ändringssetet har orsakat dem; det som redan fanns i
modellen spärrar ingenting. Raderas en vägg följer dess dörrar och fönster med. När appens Python redan är igång förhandsvisar AI:n
själv sitt ändringsset innan du ser det och rättar det som hjulet hittar, högst två gånger; godkännandet är fortfarande ditt.

En modell hämtad från Dataregium publiceras som ny version i Dela med dokumentets basversion, den version du hämtade. Har dokumentet
fått en nyare version under tiden avvisar servern publiceringen (412 version_conflict); hämta då den nyaste versionen, gör om
ändringarna och publicera igen. För en modell hämtad från Dataregium frågar *Förhandsvisa* också serverns förhandskontroll av
kandidaten (schema, buildingSMART-regler och projektets IDS) när källan är inloggad, och ett projekt som inte tar emot filer med
valideringsfel avvisar publiceringen (422) med serverns fynd i meddelandet och på kortet Validera modellen.

*Föreslå på servern* skickar ett förhandsvisat ändringsset till Dataregium som ett ändringsförslag i stället för att publicera: ett
BCF-ärende i projektet med ändringarna som bilaga i serverns form (snippet-typen DataregiumIfcChangeSet, som servern håller mot sitt
schema). Formen anger ändringar av befintliga instanser, en per attribut: egenskapsvärden, placeringar, tillhörighet till våning och
liknande, med dokumentets basversion, ditt namn på servern och AI-modellen som proveniens. Nya element, raderingar och nya samband
kan inte anges i formen än; panelen räknar dem och de står i ärendets beskrivning. Knappen finns för en modell hämtad från Dataregium
när servern anger kapabiliteten `ifc_changes`, och modellen ändras inte av förslaget. Prövar servern förslag (Dataregium med
IFC–DB-modulen på) visar panelen prövningens utfall under ärendet: hur många ändringar som gick att tillämpa på basversionen, nya
fynd mot basen, och varje ändring som inte gick att tillämpa med orsaken (ett fynd av slaget proposal), till exempel att ett värde
inte längre är det förslaget utgick från. Är prövningen ren kan en *manager* i projektet trycka *Godkänn på servern*: servern gör
förslaget till dokumentets nästa version (med basversion, förslagsställare och godkännare i versionens metadata) och stänger ärendet.
Modellen i appen ändras inte av det; hämta den nya versionen från Dataregium för att arbeta vidare på den. Har dokumentet fått
nyare versioner sedan basen prövar servern förslaget om mot den senaste i samma steg och godkänner mot den när prövningen är ren;
krockar ändringarna med det som kommit emellan vägrar servern (412) och panelen listar de krockande nycklarna (instans och attribut),
eller säger att allt kan ha ändrats när en hel fil laddats upp emellan. Hämta då den nyaste versionen, gör om ändringarna och föreslå
igen.
Kortet *Ändringsförslag på servern* i modellvyn visar, för en modell hämtad från Dataregium, alla förslag mot dokumentet när servern
anger kapabiliteten `ifc_proposals_url`: titel, tillstånd, vem som föreslog, hur många ändringar och mot vilken version; *Godkänn* gör
ett prövat förslag till nästa version för den som får godkänna, så att flera personer med varsin klient kan arbeta mot samma modell. En
server som anger formen `ops_form` (`dataspatium-tools/1`) får dessutom skrivverktygens operationer, så att nya element, raderingar och
samband kommer med i förslaget: servern bygger dem på basversionen med samma kod som appen, och en krockande nyckel som du ger upp
skickas med som `keep_theirs`.

Har projektet team (kortet *Projektets medlemmar* i Hantera) visar panelen vilka team ändringen rör. Rör den bara ett teams del
godkänner teamets ansvarige, även med rollen redaktör, och servern nekar (403) en projektansvarig; rör den flera teams delar, eller
ingen, godkänner en projektansvarig som förut. När ett IDS-dokument får en ny version kontrollerar servern om projektets senaste
IFC-versioner, och deras rapporter står som väntande under tiden.

Anger servern värdena per krock visar panelen för varje krock värdet i basen, det som kom emellan och ditt förslag, och du väljer
per krock att behålla ditt förslag eller ta det som kom emellan. *Föreslå igen med mina val* skickar förslaget mot den senaste
versionen, med de behållna ändringarna och utan de strukna, och servern prövar det på nytt innan det kan godkännas. Sammanfogningen
sker på servern; webbläsaren hanterar bara själva krockarna.

## Rätt IFC-klass

I IFC är klassen den första klassificeringen: den mest specifika klassen med sin PredefinedType, ObjectType bara när PredefinedType är
USERDEFINED, och ett typobjekt; andra klassificeringssystem läggs ovanpå. AI:n söker klassen för en sak med läsverktyget
`search_ifc_class`, med engelska IFC-ord som *sink* eller *handrail*, i dokumentationen av modellens schema som följer med
IfcOpenShell, och ändringssetet godtar bara klasser som finns och inte är abstrakta i modellens schema och PredefinedType ur klassens
lista. Kortet *IFC-klasser* i Kontrollera (och läsverktyget `get_class_report`) räknar proxyelement (IfcBuildingElementProxy),
USERDEFINED utan namn, element utan typ, PredefinedType på både typ och element (regeln OJT001) och element utanför den rumsliga
strukturen (SPS007), med exempel.

## buildingSMART:s regler i förhandsvisningen

Förhandsvisningen prövar också det som ändringssetet skapar eller ändrar mot ett urval av buildingSMART:s normativa regler, samma regler
som buildingSMART:s valideringstjänst använder (ifc-gherkin-rules), överförda till appens egen Python:

- **IFC102**: inga avvecklade entiteter, attribut eller värden i filens schema, till exempel IfcWallStandardCase, väggen STANDARD eller
  IfcBuildingStorey.Elevation i IFC 4.3;
- **GEM111**: inga upprepade punkter i polylinjer och polyloopar, och en sluten polylinje slutar på sin egen första punkt;
- **SWE001**: profiler som inte skär sig själva (prövat med shapely);
- **PSE001** och **PSE002**: en standarduppsättning (Pset_) har schemamallens namn, egenskaper, typer och klasser, och en egen uppsättning
  börjar inte som Pset;
- **QTY001**: en mängduppsättning (Qto_) följer mallen och har MethodOfMeasurement BaseQuantities;
- **GRF001**, **GRF003** och **GRF005**: alla sammanhang har samma koordinatoperation, en modell med byggnad har ett koordinatsystem,
  och kartkonverteringens skala stämmer med enheterna;
- **SPS007**: byggdelar ligger i den rumsliga strukturen, och en del av en byggdel ligger inte samtidigt i en våning;
- **OJT001**: PredefinedType står på typen eller på elementet, inte på båda, och USERDEFINED har ett namn;
- **PJS003**: varje GlobalId har 22 tillåtna tecken och börjar med 0–3, och inget GlobalId används två gånger.

Varje fynd bär sin regels kod. Det buildingSMART räknar som överenskommelser ger fel, som hindrar godkännandet precis som schemafel;
branschpraxis (PSE002, GRF003 och GRF005) ger varningar, som står för sig. Bara det som ändringssetet orsakar räknas: det som redan
fanns i modellen spärrar ingenting. AI:n får de regler som inte håller efter varje förhandsvisning och rättar dem, som den gör med
topologin. Appen har inte hela regelsviten: GRF005 känner koordinatsystemets enhet för de nordiska koder som appen skriver eller ur
dess MapUnit, och SWE001 följer polylinjer, indexerade kurvor och sammansatta kurvor av dem. Hela sviten hör hemma på servern.

Därför skriver appen inte heller själv det som IFC102 avvecklar. I IFC4 och senare blir en beklädnad med `host` en del av
byggdelen den täcker (IfcRelAggregates) eller ligger i rummet, i stället för IfcRelCoversBldgElements och IfcRelCoversSpaces, och
trappans antal steg och mått står bara i Pset_StairFlightCommon. I IFC 4.3 står karmens och dörrbladens egenskaper i
Pset_DoorLiningProperties, Pset_DoorPanelProperties och Pset_WindowLiningProperties, som ersätter IfcDoorLiningProperties och de andra.
En standarduppsättning som kom först med IFC4, till exempel Pset_Condition i en IFC2X3-fil, ger bara en varning av PSE001.

*Godkänn* kör dessutom schemats EXPRESS-regler (WHERE-regler och funktioner) med IfcOpenShell; pytest hämtas för dem som komponent
första gången. Ett ändringsset som bryter mot en regel som modellen klarade förut godkänns inte, och meddelandet namnger regeln; be
AI:n rätta ändringssetet och godkänn igen. I en modell med fler än 300 000 instanser hoppas EXPRESS-reglerna över, och loggen säger det.

## Grunduppgifter

Kortet **Grunduppgifter** i Kontrollera prövar en modell mot grundreglerna i Praxi, BIM Alliances anvisningar för IFC, här med appens
egna ord; inga texter, värdelistor eller mallar ur Praxi följer med appen. Kortet läser modellen när du trycker på knappen:

- filhuvudet anger vy (MVD), programmet som skrev filen, förprocessorn och tidpunkten (författare och organisation visas inte);
- modellen har ett projicerat koordinatsystem med en enda EPSG-kod, en kartkonvertering och ett höjdsystem;
- projektet, platsen, byggnaden och våningarna har namn, byggnaden även ett längre namn och våningarna en beskrivning;
- varje rum har ett nummer i Name, och inget nummer används två gånger i samma byggnad;
- en egen egenskapsuppsättning börjar inte som IFC:s (Pset_, Qto_), börjar med en landskod (SE-…), har bara A–Z, siffror, - och _, och
  egenskaper i PascalCase utan å, ä och ö;
- inget värde bär sin enhet: 40, inte "40 dB".

Varje kontroll visas som uppfylld, att se över eller fel, med de första exemplen. IDS kan inte pröva filhuvudet eller att något är
unikt, och därför är det ett eget kort.

## Appens IDS-filer

Appen har egna IDS-filer i `presets/ids/`, skrivna efter öppna regler:

- **SE-Dataspatium_Grund.ids**: namn på plats, byggnad, våningar och rum, inga proxyelement, och en PredefinedType på bjälklag, tak,
  dörrar, fönster och beklädnader (USERDEFINED godtas med ett namn).
- **SE-Dataspatium_Klimatdeklaration.ids**: LoadBearing på väggar, bjälklag, tak, pelare och balkar, IsExternal på väggar, dörrar och
  fönster, material på byggdelarna, en kategori på varje material och basmängder: det som den preliminära klimatdeklarationen läser.

IDS nämner en klass utan dess underklasser, så IFC4:s klasser …StandardCase har egna specifikationer, och en specifikation gäller bara
de IFC-versioner den anger. Uppdragsbeskrivningen väljer en fil efter syftet, och IDS-kontroll i Analysera kan köra dem.

## Jämför versioner

Knappen *Jämför* i modellvyn jämför den öppna modellen med en sparad version av samma datamängd (Versioner i Bearbeta) eller med en
annan IFC-modell i arbetsytan, till exempel en nyare version hämtad från ett CDE. Elementen matchas på GlobalId; panelen listar vad som
bara finns här, bara i den andra och vad som ändrats, attribut för attribut och egenskap för egenskap. I 3D färgas det som bara finns
här grönt och det ändrade gult; *Visa den andra versionen* ritar i stället den andra filen med det som bara finns där rött. *Markera*
lägger skillnaderna i urvalet. Ingenting ändras; samma jämförelse får senare Dataregiums diff-API som källa.

För en modell hämtad från Dataregium visar panelen också *Serverns ändringsset*: ändringarna som gav den hämtade versionen på
servern, när den godkändes från ett ändringsförslag, med ärendet, vem som föreslog och godkände, basversionen (den version förslaget
prövades mot) och varje ändring med instans, attribut, gammalt och nytt värde. *Markera* markerar instanserna i modellen. En version
som laddats upp som hel fil har inget ändringsset. Det är en tredje källa bredvid ögonblicksbilderna och de andra modellerna.

Med *Serverns versioner* hämtas dokumentets övriga versioner på Dataregium som val i listan *Jämför med*. Väljer du en av dem räknas
jämförelsen av servern (dess diff mellan versioner, efter GlobalId och attribut, med placering, form, behållare och typ som egna
fält) och visas som samma listor och färger här, men utan den andra versionen i 3D; hämta den versionen om du vill se den.
