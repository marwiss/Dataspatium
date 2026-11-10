# CAD och BIM: byggnadsmodeller och ritningar

Dataspatium öppnar byggnadsmodeller i IFC och ritningar i DXF som ett eget slag av datamängd. Modellen ritas i 3D,
byggdelarna blir en tabell, och egenskaper och mängder går att söka i, räkna på och exportera. Allt sker i webbläsaren:
filen lämnar aldrig datorn. Originalfilen sparas i datamängden och följer med i paket och säkerhetskopior.

## Öppna en modell

Släpp en `.ifc`-, `.ifczip`- eller `.dxf`-fil i Inhämta. Filens uppgifter visas (schema, projekt, program, våningar och
antal per typ), och *Importera* skapar datamängden. Stödet gäller IFC2X3, IFC4 och IFC4X3 i STEP-format. En modell på
cirka 50 MB tar ungefär en kvart minut att importera och öppnas sedan på några sekunder.

## Modellen i Bearbeta

Modellen öppnas som 3D-vy med en tabell över byggdelarna under. Dra för att vrida, rulla för att zooma och högerdra för
att flytta. Knappen med ramen visar hela modellen; enstaka objekt långt från byggnaden räknas inte med.

- **Markera**: klicka på en byggdel i modellen eller på en rad i tabellen. Markeringen följer åt, och inspektören visar
  typ, våning, material, klassificering, egenskaper och mängder, samt yta och volym mätta på geometrin.
- **Filtrera**: välj typ eller våning, eller sök på namn, material eller egenskap. Tabellen och modellen visar samma urval.
- **Visa som tabell**: alla kolumner som en vanlig tabell med Bearbetas alla verktyg.
- **Spara som diagram**: vyn med sitt filter och sin kameravinkel blir ett diagram i Visualisera.

Geometrin räknas fram ur originalfilen första gången modellen öppnas i en session, och den används bara för att rita och
mäta. Tabellerna finns kvar även om datorn saknar WebGL, och då visas ett meddelande i stället för 3D-vyn.

## Ärenden från ett CDE

En modell som hämtats från en OpenCDE-server, eller vilken modell som helst när en sådan server finns som källa, kan visa
sina ärenden: knappen *Ärenden* i modellvyn öppnar en panel i inspektören med projektets BCF-ärenden. De som pekar på
byggdelar i den här modellen står först, med status och antal byggdelar. Klicka på ett ärende, så markeras byggdelarna i
3D-vyn och panelen visar beskrivning, ögonblicksbild och kommentarer. Ärendena hämtas när du ber om det och lagras inte i
datamängden; för att räkna på dem sparar du dem som en tabell i Inhämta. Det går att läsa; att skapa och ändra ärenden
kommer i nästa utgåva.

Med rättigheterna för det går det också att skriva. *Nytt ärende* skapar ett ärende på servern med titel, typ, status och
etiketter ur projektets listor, och vyn följer med som viewpoint: kameran, en ögonblicksbild och de markerade byggdelarna som
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

Modellens graf på servern ritas och frågas från *Inhämta*, och knappen *IFC-LPG* tar dig dit, se [grafer.md](grafer.md#ifc-lpg-på-en-dataregium-server).

Grafens modell, relationerna och frågorna från Dataspatiums sida finns i Dataregiums [ifc-lpg.md](https://github.com/marwiss/Dataregium/blob/main/docs/sv/ifc-lpg.md).

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
- **Kontroller här** visar den senaste *Validering*, *IDS-kontroll* och kollisionskontroll som körts i appen, och knapparna öppnar
  dem i Analysera. Resultaten sparas i appens inställningar, inte i datamängden.

Fynden gäller filen som den laddades upp, och servern stoppar aldrig en fil för dem. En fil vars fynd bara är varningar räknas som
giltig av buildingSMART:s valideringstjänst. Har servern ingen sådan kontroll säger kortet att servern inte har kontrollerat
versionen.

## Kollisionskontroll

Verktyget **Kollisioner** i Analysera (fliken Mängder) hittar byggdelar som går in i varandra eller kommer för nära varandra. Det
arbetar på samma trianglar som 3D-vyn visar, i en egen tråd, och behöver varken Python eller nät.

- **Mängd A och mängd B** är alla byggdelar eller en typ, till exempel kanaler mot balkar. B kan ligga i samma modell eller i en annan
  modell i samma projekt, och modellerna måste då dela koordinatsystem. Öppningar räknas inte.
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

Det senaste resultatet står på kortet Validera modellen i Hantera. Mätningen förutsätter slutna ytor: ett element med öppna eller
trasiga ytor kan ge osäkra djup. Böjda ytor är uppdelade i trianglar, så en tolerans under någon millimeter blir osäker. Element som 3D-vyn inte kan rita är inte med, och resultatet säger hur många de är; i en provmodell från Tekla gällde det alla armeringsjärn.

## DXF-ritningar

En DXF-fil blir en tabell med ett ritobjekt per rad (typ, lager, färg, längd, area, text och läge) och en SVG-ritning.
Ritningen öppnas i Bearbeta, där du zoomar med hjulet och panorerar genom att dra. Lagren tänds och släcks i inspektören,
och en klickning markerar objektet och dess rad. Fliken Mängder ger antal, längd och area per lager och typ.

Linjer, polylinjer med bågar, cirklar, bågar, ellipser, splines, punkter, texter, solider, 3D-ytor, block och
måttsättningars block ritas. Skraffering (HATCH) ritas inte.

## Export

Exportera ger originalfilen, egenskaperna och mängderna som CSV (en rad per värde) och ritningen som SVG, utöver de
vanliga tabellformaten för `data`. Diagram av modeller exporteras som PNG, SVG och PDF; en 3D-modell blir då en bild.

## Begränsningar

- Modellen går inte att redigera, och ingen ny IFC-fil skrivs. Ändringar i tabellerna påverkar inte originalfilen.
- En modell ritas om ur originalfilen i varje ny session. Modellen på 57 MB som appen provats med tar 4–6 sekunder.
- Den första ritningen av en mycket stor modell kan låsa sidan en stund medan grafikkortet tar emot trianglarna.
- Mängderna är inte mängdavtagning enligt något regelverk. Kontrollera mot källan innan de används skarpt.
- DXF läses i två dimensioner. DWG måste först sparas som DXF.

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
och radering. Verktygen ändrar ingenting: de fyller ett ändringsset som panelen listar steg för steg (mått i meter; nya element får
referenserna new-1, new-2 … tills filen har gett dem id).

*Förhandsvisa* kör ändringssetet på en kopia av modellen med IfcOpenShell i appens Python (komponenterna hämtas efter samtycke första
gången), ritar resultatet i 3D med nytt grönt och ändrat gult, och visar vad som skapas, ändras och raderas samt schemakontrollens fynd.
*Godkänn* gör ändringarna till receptsteget *AI-ändring*: modellen får en ny version i arbetsytan, tabellerna byggs om, och steget kan
ångras exakt. Steget bär proveniensen (leverantör, modell och frågorna). Ett ändringsset med schemafel kan inte godkännas, raderingar
bekräftas en gång till, och *Avvisa* kastar ändringssetet utan att röra modellen. AI:n kan aldrig spara eller publicera: det gör du med
knapparna.

En modell hämtad från Dataregium publiceras som ny version i Dela med dokumentets basversion, den version du hämtade. Har dokumentet
fått en nyare version under tiden avvisar servern publiceringen (412 version_conflict); hämta då den nyaste versionen, gör om
ändringarna och publicera igen. För en modell hämtad från Dataregium frågar *Förhandsvisa* också serverns förhandskontroll av
kandidaten (schema, buildingSMART-regler och projektets IDS) när källan är inloggad, och ett projekt som inte tar emot filer med
valideringsfel avvisar publiceringen (422) med serverns fynd i meddelandet och på kortet Validera modellen.

## Jämför versioner

Knappen *Jämför* i modellvyn jämför den öppna modellen med en sparad version av samma datamängd (Versioner i Bearbeta) eller med en
annan IFC-modell i arbetsytan, till exempel en nyare version hämtad från ett CDE. Elementen matchas på GlobalId; panelen listar vad som
bara finns här, bara i den andra och vad som ändrats, attribut för attribut och egenskap för egenskap. I 3D färgas det som bara finns
här grönt och det ändrade gult; *Visa den andra versionen* ritar i stället den andra filen med det som bara finns där rött. *Markera*
lägger skillnaderna i urvalet. Ingenting ändras; samma jämförelse får senare Dataregiums diff-API som källa.
