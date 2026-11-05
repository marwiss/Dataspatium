# Dokument och bilder

Dataspatium läser in dokument som **dokumentsamlingar** och bilder som **bildsamlingar**. En dokumentsamling öppnas som
en läsvy och en bildsamling som ett galleri. Under ytan är båda datamängder av egna slag, med ett stycke respektive en
bild per rad och filerna själva med i datamängden, så att allt som gäller för tabeller också gäller här: filter, Söka,
regler, recept, SQL, R och Python, export, paket och delning. Därtill kommer verktygen **Text** och **Bilder** i
Analysera, som fungerar utan kod.

## Dokumentsamlingar

| Format | Känns igen på | Stycken | Rubriker | Sidor |
|---|---|---|---|---|
| PDF | .pdf | Textrader samlas till stycken efter radavstånd | Rader med klart större teckenstorlek än sidans text | Riktiga sidor |
| Word | .docx | Stycken och tabellrader | Styckeformat med namn som Heading, Rubrik, Title | Sidbrytningar och Words sparade sidbrytningar |
| OpenDocument | .odt | Stycken, listor och tabellrader | `text:h`-element | Mjuka sidbrytningar |
| Markdown | .md, .markdown | Block åtskilda av tomrad; punktlistor på en rad | Rader som börjar med `#` | Allt är sida 1 |
| Text | .txt (välj formatet *Dokument*) | Block åtskilda av tomrad | Inga | Allt är sida 1 |

Varje dokumentsamling har kolumnerna `dokument` (filnamn), `sida`, `stycke` (löpnummer i dokumentet),
`typ` (`rubrik`, `stycke` eller `tabell`), `text` och `tecken`. Rader från tabeller får cellerna åtskilda med ` | `.
Originalfilerna sparas i datamängden, så att PDF-sidor kan visas och filerna hämtas igen; de räknas in i
datamängdens storlek under Hantera.

PDF-filer läses med pdf.js i en bakgrundstråd, så appen svarar medan en lång rapport läses in; 200 sidor tar ungefär
en sekund. Skannade PDF-filer utan textlager ger inga stycken förrän du läser dem, se *Läsa text i bilder* nedan.

### Importera

Släpp en eller flera filer i Inhämta. Flera dokument på en gång blir **en** datamängd med alla stycken, och
inställningssteget visar fillistan, namnet och en förloppsindikator fil för fil (sida för sida i PDF). Ett ensamt
Word- eller Markdown-dokument tolkas också som dokument; vill du i stället ha tabellerna i det väljer du formatet
*Tabeller i dokument*. En textfil tolkas som CSV tills du väljer *Dokument*. Kolumnsteget hoppas över eftersom
kolumnerna är givna. Dokument kan också hämtas från en webbadress (Inhämta > Webbadress) på samma sätt.

## Dokumentvyn i Bearbeta

En dokumentsamling öppnas i Bearbeta som läsvy, och från Hantera med knappen *Läs*; översiktsfliken där listar
dokumenten, och ett klick på ett av dem öppnar just det. Välj dokument och visning: *Sida för sida*, *Hela dokumentet*
(löpande text med sidmarkeringar, ritad i omgångar så att även en lång rapport öppnas direkt) eller, för PDF, *Sidan
som bild*. Rubriker visas som rubriker och tabellrader med fast bredd. Klicka på ett stycke så visar inspektören
sida, nummer, typ och antal tecken med en knapp för att kopiera texten; längst upp i inspektören står dokumentets
titel, författare, sidor, stycken och ord, med knappen *Hämta originalet*.

Sökfältet söker i hela samlingen och listar träffarna med sammanhang (nyckelord i kontext); klicka på en träff för
att hoppa till sidan. *Visa som tabell* ger den vanliga tabellen med alla åtgärder i Bearbeta, och *Visa som
dokument* tar dig tillbaka. Datamängden i sig är alltid tabellen: det du gör i tabellen (filtrera, rätta, ta bort
rader) syns också i läsvyn.

## Verktyget Text i Analysera

När en dokumentsamling är vald får Analysera fliken **Text** (efter Regex, före Anteckningsboken) med fyra verktyg.
Alla resultat kan sparas som en ny datamängd med knappen *Skapa datamängd*, och ett dokument kan väljas i stället för
hela samlingen.

| Verktyg | Vad det gör | Inställningar |
|---|---|---|
| Översikt | Sidor, stycken, rubriker, tabellrader, ord, tecken, olika ord och ordvariation (type/token-kvot) per dokument | |
| Ordfrekvens | De vanligaste orden med antal, andel och antal dokument | Språk för stoppord (svenska, danska, norska, finska, isländska, engelska), egna stoppord, minsta ordlängd, räkna tal, antal att visa |
| Nyckelord i kontext | Alla förekomster av ett ord eller uttryck med texten före och efter, dokument och sida | Hela ord, skilj på stora och små bokstäver, reguljärt uttryck |
| Samförekomster | Ordpar som förekommer tillsammans i samma stycke eller inom några ords avstånd | Fönster, stoppord, minsta ordlängd |

Ord är följder av bokstäver och siffror, med bindestreck och apostrofer inuti (`e-post`, `don't`), och räknas i
gemener. Stoppordslistorna är korta listor med formord; stäng av växeln för att räkna alla ord. Samma texter kan
analyseras vidare i R och Python: `dm_read("namn")` ger stycketabellen som data.frame respektive DataFrame.

## Bildsamlingar

Bilder (JPEG, PNG, WebP, GIF, BMP och AVIF där webbläsaren kan läsa dem) blir en bildsamling med en
rad per bild: `fil`, `typ`, `storlek` (byte), `bredd`, `hojd`, `datum`, `kamera`, `lon`, `lat`, `altitud` och
`beskrivning`. Datum, kamera, position och beskrivning läses ur EXIF i JPEG-filer; andra format får bara mått och
storlek. En förhandsvisning (långsidan högst 1600 px) och en miniatyr (320 px) sparas i datamängden; originalen
sparas inte, så att en samling med hundratals bilder förblir hanterlig i webbläsaren. Släpp alla bilder på en gång i
Inhämta så blir de en samling.

Positionerna kan ritas på kartdiagrammet i Visualisera (lon och lat som koordinater), och datumen fungerar som
alla andra datum i filter, Fråga och diagram.

## Galleriet i Bearbeta

En bildsamling öppnas i Bearbeta som galleri med miniatyrer, filter och sortering (filnamn, datum, storlek), och från
Hantera med knappen *Visa bilder*; översiktsfliken där visar de första miniatyrerna, och ett klick på en av dem öppnar
den i galleriet. Klicka på en bild så visar inspektören en större förhandsvisning, typ, storlek, mått, datum, kamera,
position och höjd samt beskrivningen, som kan ändras och sparas: ändringen loggas som receptsteg som alla andra
celländringar och kan ångras. Dubbelklicka för att se bilden stor, eller hämta förhandsvisningen till datorn. *Visa som
tabell* ger tabellen med alla åtgärder.

## Verktyget Bilder i Analysera

När en bildsamling är vald får Analysera fliken **Bilder** med två verktyg:

- **Översikt**: antal, storlek, bildpunkter, hur många bilder som har datum, kamera och position, period, och en
  fördelning på typ, kamera, år eller månad som kan sparas som datamängd.
- **Dubbletter**: varje miniatyr görs om till en gråskalebild om 8 × 8 rutor; rutor ljusare än medelvärdet blir ettor
  och ger en hash om 64 bitar. Bilder vars hashar skiljer sig i högst det valda antalet bitar grupperas: 0 bitar ger
  bara exakta kopior, 5 bitar vanliga dubbletter (andra storlek, annan komprimering), 12 bitar även beskurna eller
  färgjusterade varianter med fler falska träffar. Grupperna visas med miniatyrer och kan sparas som en datamängd med
  fil, grupp, avstånd och hash.

## Läsa text i bilder

En skannad PDF saknar text, så den ger inga stycken. Dokumentvyn säger hur många sidor det gäller, och knappen *Läs text
i bilderna* läser dem med textigenkänning. Välj språket i bilderna; engelska läses alltid med, eftersom namn och fackord
ofta är på engelska. Texten blir vanliga stycken i dokumentets tabell, så den går att söka i, räkna på och exportera, och
åtgärden kan ångras. Avbryter du behålls sidorna som redan lästs.

Maskinläst text kan innehålla fel. Därför står det *Maskinläst text* och läsningens säkerhet på sidan, med en knapp som
visar sidan som bild.

I galleriet gör *Läs text i bilderna* en ny dokumentsamling av bilderna som visas, ett dokument per bild. Bildsamlingen
ändras inte. *Läs text i bilden* i inspektören lägger texten i bildens beskrivning, där du kan rätta den innan du sparar.

En bild av en tabell går också att importera. Välj *Klistra in* i Inhämta och sedan *Läs tabell ur bild*, eller klistra
in bilden direkt i rutan. Texten hamnar i rutan med semikolon mellan kolumnerna. Rätta den där, så går den sedan genom
den vanliga importen.

Läsningen sker helt i webbläsaren, och inget skickas iväg. Läsmotorn Tesseract och språkdata följer inte med appen: de
hämtas första gången, efter att du samtyckt, från fasta adresser och kontrolleras mot kontrollsummor. Sedan ligger de i
webbläsaren och syns under Komponenter i Hantera.

## Bilder i dokumentmallar

I dokumentmallar (Exportera > Dokument) lägger taggen `{{bild "fil.jpg" | bredd: 400}}` in en bild ur en bildsamling.
Bilden söks först i mallens datamängd och sedan i alla bildsamlingar; förhandsvisningen används och skalas till
angiven bredd (standard högst 720 px, `hojd` kan också anges). Taggen fungerar i Word, PDF, HTML, Markdown och LaTeX
på samma sätt som `{{diagram}}`, också i batchkörningar.

## Dela och exportera

Dokument- och bildsamlingar är vanliga datamängder: de ingår i paket, kan läggas på GitHub och skickas till en annan
enhet med filerna intakta. Granskningen före delning gäller tabellen (texten i `text`, beskrivningar) som för andra
datamängder. Export till CSV, Excel och de andra tabellformaten ger stycke- respektive bildtabellen utan filerna;
Dataspatiums SQLite-fil och paketen tar filerna med.

## Begränsningar

- Maskinläst text kan innehålla fel, särskilt i tabeller, handskrift och dåliga skanningar.
- Sidnumren i Word och OpenDocument följer sidbrytningarna i filen och kan avvika från vad ett ordbehandlingsprogram
  visar.
- EXIF läses bara ur JPEG. HEIC-bilder från telefoner måste konverteras först, eftersom webbläsaren inte kan avkoda
  dem.
- Mycket stora samlingar (tusentals bilder eller tiotusentals sidor) tar tid att läsa in och plats i webbläsarens
  lagring; dela upp dem i flera datamängder.
