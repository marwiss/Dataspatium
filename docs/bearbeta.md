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
| | Etikett, beskrivning och enhet | Etiketten är visningsnamnet i tabellrubriker och diagram; beskrivning och enhet visas i inspektören och kodboken, följer med i SQLite-filen och når R som attributen `description` och `unit` |
| | Ta bort kolumner | Tar bort valda kolumner |
| | Ändra kolumnordning | Flytta kolumner upp och ned |
| | Ändra typ | Text till heltal, decimaltal, datum, datum och tid eller ja/nej. Decimaltecken och datumformat kan anges; värden som inte går att tolka blir tomma och antalet rapporteras |
| | Kopiera kolumn | En kopia med nytt namn, till exempel innan originalet ändras |
| | Städa kolumnnamn | Alla namn blir små bokstäver, siffror och understreck (`Folkmängd 2024` blir `folkmangd_2024`) som är lätta att skriva i SQL och R; etiketterna behåller de ursprungliga namnen |
| Värden | Sök och ersätt | Text eller reguljärt uttryck i valda textkolumner, med förhandsgranskning |
| | Trimma blanksteg | Inledande, avslutande och (valfritt) dubbla blanksteg |
| | Ändra skiftläge | VERSALER, gemener eller Inledande Versal med svenska regler |
| | Reparera teckenkodning | Rättar mojibake (Ã¶ blir ö) som uppstått vid import med fel teckenkodning |
| | Ersätt värde | Ett exakt värde mot ett annat; tomt värde kan väljas som från eller till |
| | Koda om värden | Flera värden på en gång enligt en lista med en rad per värde, `gammalt = nytt` (till exempel `01 = Stockholms län`); övriga värden behålls eller töms |
| | Fyll saknade värden | Konstant värde, föregående eller nästa rads värde, medelvärde, median eller vanligaste värde |
| | Avrunda tal | Till valt antal decimaler: till närmaste (en halv avrundas bort från noll), nedåt, uppåt eller genom att stryka decimalerna; ett negativt antal avrundar till tiotal (−1), hundratal (−2) och så vidare |
| | Fyll ut med inledande nollor | Till en viss längd, till exempel kommunkoden 114 till 0114; tal blir text så att nollorna behålls |
| | Ta bort tecken | Behåll bara siffror (telefon- och organisationsnummer), behåll bara bokstäver och blanksteg, ta bort skiljetecken och symboler, eller ta bort alla blanksteg |
| Rader | Ta bort rader | SQL-villkor, till exempel `befolkning < 1000`; välj Behåll för att i stället behålla bara matchande rader |
| | Ta bort dubbletter | På valda kolumner eller hela raden; första förekomsten behålls |
| | Ta bort tomma rader och kolumner | Rader där alla värden saknas och, om du vill, kolumner som helt saknar värden |
| | Sortera rader | Ändrar radernas ordning permanent, stigande eller fallande på en kolumn, så att exporter och dokument får samma ordning; tomma värden hamnar sist |
| | Behåll de översta raderna | De rader som har störst eller minst värde, totalt eller per grupp (till exempel de tre största kommunerna i varje län) |
| | Slumpmässigt urval | Ett antal rader eller en andel i procent; samma frö ger alltid samma urval så att receptet kan spelas upp igen |
| Struktur | Ny beräknad kolumn | SQL-uttryck, till exempel `round(befolkning / 1000.0, 1)` eller `case when andel > 5 then 'stor' else 'liten' end` |
| | Kombinera kolumner | Flera kolumner till en textkolumn med avgränsare |
| | Dela kolumn | En textkolumn till flera vid en avgränsare |
| | Ta ut del av text | En ny kolumn med ett antal tecken räknat från början eller slutet av texten, från en vald position (länskoden är de två första tecknen i kommunkoden) |
| | Pivotera till långt format | Valda kolumner blir rader med namn och värde |
| | Pivotera till brett format | Värdena i en namnkolumn blir nya kolumner |
| | SQL-sats | Valfri UPDATE, DELETE eller ALTER TABLE mot tabellen `data` |
| Beräkningar | Andel av summan | Varje värdes andel av summan i procent eller som kvot, totalt eller per grupp (kommunens andel av länets befolkning) |
| | Rangordna | Plats i ordningen, störst eller minst först, totalt eller per grupp; lika värden får samma plats (med eller utan lucka efteråt) eller löpande plats |
| | Löpande summa | Den ackumulerade summan i den ordning som en annan kolumn anger, totalt eller per grupp |
| | Förändring mot föregående | Skillnaden eller den procentuella förändringen mot föregående rad i den ordning som en annan kolumn anger, till exempel mot föregående år per kommun |
| | Klassindela | Tal i klasser med egna nedre gränser (`0, 18, 65` ger `0–17`, `18–64` och `65–`), ett antal lika breda klasser eller grupper med lika många rader (kvantiler) |
| | Standardisera | z-värden (avståndet från medelvärdet i standardavvikelser, stickprovets standardavvikelse) eller värdena skalade till 0–1 |
| | Ta ut datumdel | År, kvartal, månad, ISO-vecka, veckodag (1 = måndag), dag, dag på året, år och månad (`2024-03`) eller timme ur ett datum |
| | Tid mellan datum | Antal hela dagar, veckor, månader eller år mellan två datum, till exempel ålder; utan slutdatum räknas till dagens datum när steget körs |
| Nya datamängder | Gruppera och aggregera | Summa, medelvärde, minsta, största, antal, antal unika eller median per grupp, till en ny datamängd |
| | Koppla datamängder | Vänster- eller inre koppling med en annan datamängd på en nyckel |
| | Lägg ihop datamängder | Staplar rader från flera datamängder; kolumner matchas på namn |
| | Rensa kategorier | Hittar stavningsvarianter av samma värde (skiftläge, blanksteg, accenter) och slår ihop dem |

Åtgärder som skapar en ny datamängd lämnar originalet orört och väljer den nya datamängden när den är klar.
Beräkningarna lägger till en ny kolumn och lämnar de befintliga orörda; de bygger på SQL:s fönsterfunktioner och
exporteras till R som dplyr-kod med `group_by()` och `mutate()`.

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

Knappen **Regler** öppnar datamängdens kvalitetsregler: vad som ska gälla för att datan ska vara rätt. Regeltyperna
är:

| Regeltyp | Bryts av |
|---|---|
| Får inte saknas | Saknade värden |
| Unik | Värden (eller kombinationer av flera kolumner) som förekommer mer än en gång |
| Inom intervall | Tal, datum eller text utanför gränserna |
| Finns i lista | Värden som inte står i listan |
| Har inte förbjudna värden | Värden som står i listan, till exempel `okänd` eller `-99` |
| Matchar mönster | Text som inte matchar det reguljära uttrycket |
| Har ett visst format | Text som inte är en e-postadress, webbadress, ett ISO-datum, ett postnummer (svenskt, danskt, norskt, finskt eller isländskt) eller en svensk kommun- eller länskod |
| Textlängd | Text som är kortare eller längre än gränserna |
| Inga överflödiga blanksteg | Text med blanksteg i början eller slutet, eller dubbla blanksteg |
| Går att tolka som typ | Text som inte går att tolka som heltal, decimaltal, datum, datum och tid eller ja/nej |
| Giltigt identitetsnummer | Nummer med fel form, ogiltigt datum eller fel kontrollsiffra, se nedan |
| Jämför två kolumner | Rader där villkoret mellan två kolumner inte gäller, till exempel att startdatum är mindre än eller lika med slutdatum |
| Finns i annan datamängd | Värden som saknas i en kolumn i en annan datamängd (referensintegritet, som en främmande nyckel) |
| Andel ifyllda värden | Kolumnen som helhet, när andelen ifyllda värden är lägre än tröskeln (till exempel 95 %) |
| Inga avvikande värden | Tal längre från kvartilerna än ett valt antal kvartilavstånd (standard 1,5), eller längre från medelvärdet än ett valt antal standardavvikelser (standard 3) |
| SQL-villkor | Rader där det fria SQL-villkoret inte är sant |

Identitetsnumren kontrolleras så här: svenskt personnummer och samordningsnummer (10 eller 12 siffror, giltigt
datum, dag plus 60 för samordningsnummer, kontrollsiffra enligt Luhn), svenskt organisationsnummer (tredje siffran
minst 2, Luhn), norskt fødselsnummer och D-nummer (båda kontrollsiffrorna enligt modulus 11), danskt CPR-nummer
(giltigt datum; modulus 11 kontrolleras inte eftersom den inte gäller alla nummer sedan 2007), finsk
personbeteckning (sekelmarkör och kontrolltecken) och isländsk kennitala (kontrollsiffra enligt modulus 11, giltigt
datum, sekelsiffra). Kontrollen säger bara att numret kan finnas, inte att det tillhör någon.

**Föreslå regler** lägger till regler ur datakvalitetsprofilen: kolumner utan saknade värden, unika kolumner och
koder med fast längd. Kolumner som heter något med personnummer, organisationsnummer, CPR, fødselsnummer,
henkilötunnus eller kennitala får en regel för det slag av identitetsnummer som minst hälften av värdena klarar,
kolumner med postnummer i namnet en regel för det postnummerformat som flest värden följer, och kolumner med
e-post i namnet en regel för e-postadresser.

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

Varje datamängd har ett **kortnamn** (visas under namnet i objektpanelen och under Hantera, där det kan ändras
tillsammans med namnet): små bokstäver a–z, siffror och understreck, högst 20 tecken och helst högst 15, aldrig
ett reserverat ord i SQL eller R. Förslaget bildas av namnet utan småord och med årtal som suffix:
*Befolkning per kommun 2024* blir `befolkning_2024` och *Kommungränser (SCB)* blir `kommungranser`. Den
medföljande exempeldatans kortnamn (`befolkning_2024`, `kommungranser`, `lansgranser`) är desamma på alla språk, så
att delade diagram och recept hittar dem.
I SQL-konsolen heter den valda datamängden `data` men nås också med sitt kortnamn, och andra datamängder nås
med sina kortnamn, så att en fråga kan koppla ihop flera datamängder:

```sql
select k.kommun, k.lan, b.folkmangd
from befolkning_2024 b
join kommungranser k on k.kommunkod = b.kommunkod
order by b.folkmangd desc
```

Andra datamängder är skrivskyddade i frågan; UPDATE, DELETE och ALTER gäller den valda datamängden men får
läsa de andra (till exempel `update data set lan = (select lan from kommungranser k where k.kommunkod =
data.kommunkod)`). Högst nio andra datamängder kan ingå i samma fråga. Resultatet kan sparas som en ny
datamängd. Kortnamnen fungerar också i R (`dm_read("kortnamn")`; knappen *Infoga dm_read()*, R-exemplen,
nya anteckningsböcker och receptens R-export använder kortnamnet) och används när diagram och
anteckningsböcker kopplas till datamängder vid import.

SQL-konsolen ligger i läget Analysera under fliken SQL och arbetar mot den valda datamängden, vars tabell heter
`data`. Ctrl+Enter kör hela skriptet, markerad text körs ensam.

- `SELECT`, `WITH`, `VALUES`, `PRAGMA` och `EXPLAIN` visar resultatet i en tabell (de första 5 000 raderna).
  **Spara resultatet som datamängd** skapar en ny datamängd av hela resultatet, utan radgräns.
- `UPDATE`, `DELETE`, `ALTER TABLE` och andra satser ändrar datamängden, loggas som receptsteget SQL-sats
  och kan ångras i Bearbeta.
- Egenskapspanelen listar datamängdens kolumner (klick infogar namnet) och de extra SQL-funktioner som
  Dataspatium lägger till: `regexp`, `regexp_replace`, `dm_parse_number`, `dm_parse_date`, `dm_fix_encoding`,
  `dm_upper`, `dm_lower`, `dm_title`, `dm_squish`, `dm_round`, `dm_pad`, `dm_date_part`, `dm_date_diff` och
  `dm_valid_id` (till exempel `select * from data where dm_valid_id(personnummer, 'se_pnr') = 0`).
- SQL-skript sparas i objektpanelen på samma sätt som R-skript.

SQLite-dialekten gäller: `||` för textkonkatenering, `cast(x as integer)`, `strftime()` för datum,
`group_concat()`, fönsterfunktioner som `row_number() over (partition by …)`.

## Begränsningar

- Ångra gäller inom sessionen; använd versioner för att gå tillbaka efter omladdning.
- Åtgärder som bygger om en kolumn (Ändra typ, Dela kolumn, pivotering) exporterar datamängden för ångra
  först. På datamängder över några hundra MB tar det märkbar tid.
- Receptens R-export täcker de inbyggda åtgärderna; fritt SQL exporteras som kommentar eftersom det inte kan
  översättas till R automatiskt.
