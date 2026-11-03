# Bearbeta och SQL-konsolen

Läget Bearbeta är allt man gör med tabellen via knappar och dialoger: rätta celler, rensa text, ändra typer,
beräkna nya kolumner, pivotera, koppla ihop datamängder. Varje åtgärd loggas som ett steg i datamängdens
recept, kan ångras och kan spelas upp igen på en annan datamängd. SQL-konsolen i läget Analysera arbetar mot
samma datamängd och loggar ändringar på samma sätt.

## Tabellen

- Dubbelklicka på en cell, eller markera en rad och tryck Enter eller F2, för att redigera. Enter sparar,
  Esc avbryter, Tab går vidare till nästa cell. Värdet tolkas enligt kolumnens typ: skriver du text i en
  talkolumn får du ett felmeddelande och cellen behåller sitt värde. Tom text blir ett saknat värde.
- Piltangenterna flyttar markeringen, Page Up/Page Down bläddrar, Home/End hoppar till första eller sista raden.
- Klicka på en kolumnrubrik för att sortera (stigande, fallande, osorterat). Egenskapspanelen till höger visar
  då kolumnstatistik (antal, saknade, unika, minsta, största, medel, summa, vanligaste värden) och de åtgärder
  som passar kolumnens typ. Skift-klick visar statistiken utan att ändra sorteringen.
- Filterfältet söker i alla kolumner. Redigering fungerar även i ett filtrerat urval.
- Tabellen är virtualiserad: bara de synliga raderna finns i webbläsarens DOM, resten ligger i SQLite. En
  miljon rader bläddras lika snabbt som hundra.

## Åtgärder

Knappen **Åtgärder** öppnar paletten. Varje åtgärd har en dialog med fält som genereras ur åtgärdens
parametrar, och där det går visas en förhandsgranskning av hur många rader som påverkas och exempel på före
och efter.

| Grupp | Åtgärd | Vad den gör |
|---|---|---|
| Kolumner | Byt namn på kolumn | Nytt kolumnnamn; etiketten följer med om den var lika med namnet |
| | Sätt etikett | Visningsnamn för tabellrubriker och diagram |
| | Ta bort kolumner | Tar bort valda kolumner |
| | Ändra kolumnordning | Flytta kolumner upp och ned |
| | Ändra typ | Text till heltal, decimaltal, datum, datum och tid eller ja/nej. Decimaltecken och datumformat kan anges; värden som inte går att tolka blir tomma och antalet rapporteras |
| Värden | Sök och ersätt | Text eller reguljärt uttryck i valda textkolumner, med förhandsgranskning |
| | Trimma blanksteg | Inledande, avslutande och (valfritt) dubbla blanksteg |
| | Ändra skiftläge | VERSALER, gemener eller Inledande Versal med svenska regler |
| | Reparera teckenkodning | Rättar mojibake (Ã¶ blir ö) som uppstått vid import med fel teckenkodning |
| | Ersätt värde | Ett exakt värde mot ett annat; tomt värde kan väljas som från eller till |
| | Fyll saknade värden | Konstant värde eller föregående rads värde |
| Rader | Ta bort rader | SQL-villkor, till exempel `befolkning < 1000`; välj Behåll för att i stället behålla bara matchande rader |
| | Ta bort dubbletter | På valda kolumner eller hela raden; första förekomsten behålls |
| Struktur | Ny beräknad kolumn | SQL-uttryck, till exempel `round(befolkning / 1000.0, 1)` eller `case when andel > 5 then 'stor' else 'liten' end` |
| | Kombinera kolumner | Flera kolumner till en textkolumn med avgränsare |
| | Dela kolumn | En textkolumn till flera vid en avgränsare |
| | Pivotera till långt format | Valda kolumner blir rader med namn och värde |
| | Pivotera till brett format | Värdena i en namnkolumn blir nya kolumner |
| | SQL-sats | Valfri UPDATE, DELETE eller ALTER TABLE mot tabellen `data` |
| Nya datamängder | Gruppera och aggregera | Summa, medelvärde, minsta, största, antal, antal unika eller median per grupp, till en ny datamängd |
| | Koppla datamängder | Vänster- eller inre koppling med en annan datamängd på en nyckel |
| | Lägg ihop datamängder | Staplar rader från flera datamängder; kolumner matchas på namn |
| | Rensa kategorier | Hittar stavningsvarianter av samma värde (skiftläge, blanksteg, accenter) och slår ihop dem |

Åtgärder som skapar en ny datamängd lämnar originalet orört och väljer den nya datamängden när den är klar.

## Ångra

Knappen **Ångra** tar tillbaka det senaste steget, upp till tio steg bakåt under samma session. Cellredigeringar
ångras genom att det gamla värdet skrivs tillbaka; övriga åtgärder genom att en ögonblicksbild av
datamängden återställs. För mycket stora datamängder tar ögonblicksbilden en stund och högst 80 MB
ögonblicksbilder hålls i minnet. Ångra efter omladdning av sidan gör du med versioner.

## Datakvalitet

Knappen **Datakvalitet** profilerar datamängden: antal rader och dubbletter, och per kolumn saknade värden,
unika värden, intervall och iakttagelser. Iakttagelserna pekar på en åtgärd som rättar dem med ett klick:

- blanksteg i början eller slutet, dubbla blanksteg: Trimma blanksteg
- tomma texter som inte är saknade värden: Ersätt värde (tomt till saknat)
- tal eller datum lagrade som text: Ändra typ
- trolig teckenkodningsskada: Reparera teckenkodning
- värden som bara skiljer sig i skiftläge: Ändra skiftläge
- värden som ser ut som personnummer: Pseudonymisera
- kolumn med samma värde på alla rader (upplysning)

## Regler

Knappen **Regler** öppnar datamängdens kvalitetsregler: vad som ska gälla för att datan ska vara rätt. Sju
regeltyper finns: får inte saknas, unik (en eller flera kolumner tillsammans), inom intervall (tal, datum eller
text), finns i lista, matchar mönster (reguljärt uttryck), textlängd och fritt SQL-villkor som ska vara sant för
varje rad. **Föreslå regler** lägger till regler ur datakvalitetsprofilen: kolumner utan saknade värden, unika
kolumner och koder med fast längd.

**Kör regler** räknar raderna som bryter mot varje regel, visar andelen och några exempel, och loggar körningen i
datamängdens historik. För en bruten regel kan de felande raderna sparas som en egen datamängd, och hela
resultatet kan laddas ned som en HTML-rapport. Reglerna lagras i datamängdens metadata och följer därför med i
säkerhetskopior, delningspaket och den portabla mappen.

## Pseudonymisera

Åtgärden **Pseudonymisera** (gruppen Värden, även i kolumnmenyn och kommandopaletten) ersätter identifierare som
personnummer eller kundnummer inför delning. Tre metoder:

- **Hashvärde**: SHA-256 av ett salt och värdet, förkortat till valfri längd (standard 16 tecken). Samma värde ger
  samma hashvärde, så kopplingar mellan tabeller överlever om samma salt används. Saltet är en hemlig text som du
  väljer; den sparas aldrig i loggen eller receptet (där står `***`), och ett recept med ett sådant steg kan inte
  spelas upp utan att saltet anges på nytt.
- **Maskera tecken**: behåller valfritt antal tecken i början och slutet samt skiljetecken, och ersätter resten
  med `*` (`19800101-1234` blir `198001**-****` med sex tecken i början).
- **Löpnummer**: varje unikt värde får ett löpnummer med prefix i sorterad ordning (`P0001`, `P0002`).

Hashning med salt är pseudonymisering, inte anonymisering: den som känner saltet kan testa kandidater, och
kombinationer av andra kolumner kan fortfarande peka ut personer. Ta bort eller grovklassa övriga känsliga
kolumner, och dela aldrig saltet tillsammans med datan. Receptexporten till SQL använder Dataspatiums funktioner
`dm_hash` och `dm_mask`; exporten till R använder paketet digest för hashvärden.

## Geodata

Åtgärdsgruppen *Geodata* arbetar med geometrikolumner (GeoJSON eller WKT som text, i longitud/latitud eller
SWEREF 99 TM) och koordinatkolumner:

- **Mittpunkt ur geometri** lägger till longitud och latitud (WGS 84) för varje ytas eller linjes mittpunkt,
  till exempel för att rita kommuner som bubblor i en punktkarta.
- **Area ur geometri** lägger till arean i kvadratkilometer (planärt för SWEREF 99 TM, på jordklotet för
  longitud/latitud; hål dras av).
- **Omprojicera koordinater** räknar om två kolumner mellan SWEREF 99 TM (öst, norr) och WGS 84 (longitud,
  latitud) till nya kolumner, med Lantmäteriets formler.
- **Kommun och län ur koordinater** slår upp vilken kommun och vilket län varje punkt ligger i med SCB:s
  medföljande gränser och lägger till `kommunkod`, `kommun`, `lanskod` och `lan` (eller bara län). Koordinater
  i SWEREF 99 TM känns igen. Gränserna är SCB:s förenklade landgränser för tematiska kartor: punkter i sjöar,
  hav eller utanför Sverige blir tomma, och punkter mycket nära en gräns kan hamna i grannkommunen.

Alla fyra är receptsteg som kan ångras och spelas upp igen. I SQL-exporten syns de som anrop till Dataspatiums
funktioner (`dm_geo_lon`, `dm_geo_area`, `dm_to_lon`, `dm_region` med flera); R-exporten ger motsvarande kod
med paketet sf.

## Versioner

Knappen **Versioner** (finns också i Hantera) sparar en ögonblicksbild av datamängden med en beskrivning. En
version kan jämföras med nuläget (antal rader, tillagda, borttagna och omtypade kolumner), återställas eller tas
bort. Versioner lagras i webbläsarens databas och följer med i säkerhetskopian av arbetsytan. Spara en version
före större ändringar.

## Recept

Knappen **Recept** visar alla steg som gjorts med datamängden, i ordning. Härifrån kan du:

- kopiera receptet som R-kod (`dm_read()`, dplyr/tidyr/stringr-anrop, `dm_write()`) eller som SQL mot tabellen `data`,
- ladda ned receptet som JSON för att dela med andra,
- köra samma steg på en annan datamängd i arbetsytan,
- köra ett recept från en JSON-fil på den valda datamängden.

Uppspelningen stannar vid första steget som misslyckas (till exempel en kolumn som inte finns) och berättar
hur många steg som utfördes. Receptfilen har formen

```json
{ "app": "Dataspatium", "kind": "recipe", "version": "0.3.0", "name": "Rensning kommuner",
  "steps": [ { "op": "trim", "params": { "columns": ["kommun"], "squish": true }, "description": "Trimma kommun" } ] }
```

## SQL-konsolen

SQL-konsolen ligger i läget Analysera under fliken SQL och arbetar mot den valda datamängden, vars tabell heter
`data`. Ctrl+Enter kör hela skriptet, markerad text körs ensam.

- `SELECT`, `WITH`, `VALUES`, `PRAGMA` och `EXPLAIN` visar resultatet i en tabell (de första 5 000 raderna).
  **Spara resultatet som datamängd** skapar en ny datamängd av hela resultatet, utan radgräns.
- `UPDATE`, `DELETE`, `ALTER TABLE` och andra satser ändrar datamängden, loggas som receptsteget SQL-sats
  och kan ångras i Bearbeta.
- Egenskapspanelen listar datamängdens kolumner (klick infogar namnet) och de extra SQL-funktioner som
  Dataspatium lägger till: `regexp`, `regexp_replace`, `dm_parse_number`, `dm_parse_date`, `dm_fix_encoding`,
  `dm_upper`, `dm_lower`, `dm_title`, `dm_squish`.
- SQL-skript sparas i objektpanelen på samma sätt som R-skript.

SQLite-dialekten gäller: `||` för textkonkatenering, `cast(x as integer)`, `strftime()` för datum,
`group_concat()`, fönsterfunktioner som `row_number() over (partition by …)`.

## Begränsningar

- Ångra gäller inom sessionen; använd versioner för att gå tillbaka efter omladdning.
- Åtgärder som bygger om en kolumn (Ändra typ, Dela kolumn, pivotering) exporterar datamängden för ångra
  först. På datamängder över några hundra MB tar det märkbar tid.
- Receptens R-export täcker de inbyggda åtgärderna; fritt SQL exporteras som kommentar eftersom det inte kan
  översättas till R automatiskt.
