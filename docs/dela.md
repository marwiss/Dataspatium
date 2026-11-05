# Dela

Läget Dela samlar det som handlar om att ge data till andra människor och enheter. Exportera handlar om filer till
den egna datorn; Dela om paket, GitHub, enheter, delningsmenyn, publicering och mottagning. Innan datamängder lämnar
appen går de genom en granskning av personuppgifter (se nedan).

## Paket

Ett paket är en ZIP-fil med valda datamängder och det som hör till dem: diagram, dashboards, mallar,
anteckningsböcker och skript, tillsammans med ett meddelande, avsändarens namn och en ändringslogg över det som
gjorts med varje datamängd sedan den senast delades. *Skapa paket* öppnar dialogen med alla datamängder förvalda;
med en datamängd vald finns också *Paketera bara den*. Mottagaren öppnar paketet under *Ta emot* och ser meddelande
och ändringar innan något tas in. Inspektören visar hur mycket som finns att dela. Se också
[format.md](format.md) om paketets uppbyggnad.

**Filerna.** En datamängd med filer visar hur stora de är, och du kan låta dem stanna hemma för att göra paketet mindre. Raderna följer med. Utan sina filer visar en bildsamling bara uppgifterna om bilderna, och ett dokument sin text.

## GitHub

Arbetsytan som en mapp i ett GitHub-repo, helst privat. Ange repo (`ägare/namn`), gren och mapp, och en finkornig
åtkomstnyckel som bara får läsa och skriva innehållet i det repot. Nyckeln används under sessionen eller sparas
krypterad; ingenting skickas förrän du trycker *Skicka till GitHub* eller *Hämta från GitHub*. Bara ändrade filer
skickas, i en commit med ditt meddelande. Vid hämtning väljer du, som för paket, om datamängder som redan finns ska
ersättas (den egna versionen sparas under *Versioner*). Första gången frågar appen om tillåtelse att kontakta
GitHub (se *Internetåtkomst* i [anvandarguide.md](anvandarguide.md)).

## Samarbeta via GitHub

När du hämtar från GitHub jämförs det som redan finns här med det hämtade, efter deras historik. Dialogen säger för varje
datamängd vem som har ändrat vad, och kommentarer och anteckningar från båda sidor behålls alltid.

- Har bara den andra sidan ändrat data tas den versionen in, och din sparas som en version att gå tillbaka till.
- Har bara du ändrat data behålls din version.
- Har båda ändrat väljer du: behåll båda, med den hämtade som en egen datamängd, behåll din eller ta den hämtade. Att behålla
  båda är förvalt, så inget försvinner.

Kommentarer från andra som du inte har läst syns i statusraden. Ett klick öppnar dem, och namnet på den som skrivit står vid
varje kommentar. Namnet är det som personen själv har angett.

## Enheter

Direkt överföring till telefoner, surfplattor och andra datorer över det lokala nätverket, utan server. Datorn
visar en QR-kod; telefonen skannar den med kameran och öppnar Dataspatium Mobil, som tar emot paket och filer,
visar tabellerna och kan skicka dem vidare eller lämna dem till en annan dator. Första gången visar telefonen en
kod som skrivs in på datorn och enheterna paras; sedan räcker en skanning. Båda enheterna visar samma kontrollkod,
och mottagaren godkänner innan något tas emot. Två datorer ansluter med koder som klistras in. Hela flödet, krav
och felsökning finns i [mobil.md](mobil.md). Knappen *QR-kod till mobilsidan* visar adressen att skanna för att
öppna mobilsidan första gången.

## Granskning före delning

Allt som lämnar appen via paket, enheter eller delningsmenyn granskas först, och granskningen gäller hela filen. Appen letar efter identitetsnummer, e-postadresser och
telefonnummer, både i hela kolumner och inne i löptext, och listar det som annars följer med utan att synas i tabellen. För varje del väljer du vad som ska hända i kopian.

| Del | Val |
|---|---|
| Kolumn med identitetsnummer, e-post eller telefon | Behåll, pseudonymisera eller ta bort. Pseudonymisera betyder att samma värde ger samma kod, men att värdet inte kan läsas ut |
| Löptext, till exempel dokumentens stycken | Behåll, maskera träffarna eller ta bort kolumnen |
| Grafens kanter och modellens egenskaper | Behåll, maskera träffarna eller ta bort i kopian |
| Originalfiler | Behåll eller ta bort. De kan inte pseudonymiseras, så de föreslås bort när något annat ändras |
| Bilder | Behåll eller ta bort. Positionen tas bort för sig, både ur tabellen och ur bildfilen |
| Kommentarer och författare i dokumentens metadata | Behåll eller ta bort |
| Insamlade rader | Vem som samlade in kan pseudonymiseras, och positionen kan tas bort |

Bara kopian som delas ändras, och datamängden i appen är kvar som den är. Ändrar du något följer varken ändringsloggen eller receptet med, eftersom de kan innehålla de ursprungliga
värdena. Paket rensas också från rester av borttagna värden i själva filen.

Granskningen ser inte allt. Namn, adresser och innehållet i originalfiler och bilder måste du bedöma själv. Diagram, anteckningsböcker och dokument i ett paket kan visa de ursprungliga
värdena, så välj bort dem om det behövs. Filnamn följer med.

En synkning till **GitHub** måste kunna hämtas tillbaka som den var, så där kan inget pseudonymiseras. Appen visar i stället vad som kan vara personuppgifter innan du skickar. **Publicera** skapar
en HTML-sida med de värden som diagrammen visar, så kontrollera dem innan du lägger ut sidan.

## Delningsmeny

Datorns eller telefonens egen delningsmeny: skicka en fil till e-post, Teams, meddelandeappar eller andra appar.
Välj om den valda datamängden ska delas som fil (CSV, Excel, ODS eller JSON) eller om alla datamängder ska delas
som ett paket, och tryck på *Dela*. Delningsmenyn för filer finns i Edge och Chrome på Windows och på mobil; i
andra webbläsare (Firefox) sparas filen i stället, och knappen heter då *Spara fil*. På en telefon med Dataspatium
Mobil installerad kan filer också delas *till* Dataspatium från andra appar; de hamnar under *Mottaget* på
mobilsidan.

## Publicera

En fristående HTML-fil som fungerar utan Dataspatium och kan läggas på ett intranät eller skickas: dashboards
(med diagrammen inbäddade) och dokument ur mallar, fyllda med den valda datamängden. Publicerade filer innehåller
data och diagram i klartext; dela dem bara med dem som får se uppgifterna.

**En datamängd som egen sida.** Under Datamängder blir en datamängd en sida i sin egen form: en text att läsa, bilder att bläddra i, en karta, ett nätverk eller en tabell att filtrera. Sidan hämtar inget från nätet och kan skickas som en enda fil. Den går igenom granskningen först och visar högst 2 000 rader eller 100 bilder.

## Publicera en arbetsyta

*Publicera arbetsytan* gör en webbplats av hela arbetsytan eller ett urval, att lägga på ett intranät eller skicka. Den blir en
ZIP med en startsida och en sida för varje datamängd, dashboard och dokument, med sök i tabeller och en kodbok under varje
datamängd. Sidorna går bara att läsa, hänger ihop med relativa länkar och hämtar inget från nätet.

Datamängderna går genom granskningen och visas ur kopior. Dashboards och dokument ritas ur datamängderna som de är, så där får
du veta vad de innehåller och väljer själv om de ska med.

## Till CDE

Fliken *Till CDE* skickar en datamängd till ett projekt på en OpenCDE-server som Kontroll. Välj server, logga in och välj
projekt; välj sedan om datamängden ska skrivas i ett filformat eller om originalfilen ska skickas, och om den ska gå genom
Documents API, där serverns egen sida frågar efter titel, version och projekt och filen sedan laddas upp i delar, eller som
BCF-dokument, som bara tar filen. Datamängden skrivs ur en kopia som gått genom granskningen, och originalfiler får samma
varning som i paketen. En datamängd som hämtats från servern kan skickas som en ny version av sitt dokument, och kortet
*Från CDE* i Hantera vet sedan om den. Varje skickning noteras i datamängdens historik.

*Arbetsytepaket* skickar ett paket i stället för en datamängd: paketdialogen väljer datamängder och innehåll som vanligt, granskningen
görs, och filen går upp som dokument. Den som tar emot ser paketet i källans fillista i Inhämta och tar emot det med ett klick.

## Ta emot

Öppna ett paket från en fil (släpp den på ytan) eller från en webbadress. Avsändare, meddelande och ändringar visas
först; datamängder som redan finns kan ersättas med paketets version, annars hoppas de över. En säkerhetskopia
(ZIP från *Säkerhetskopiera arbetsytan*) kan också öppnas här, men hör hemma under Hantera, Arbetsyta.

## Vad som inte går

En webbläsare kan inte vara server, så andra kan inte hämta data från din dator när den är avstängd eller när de
inte är på samma nätverk; då passerar en fil eller ett paket via delningsmenyn, en molnmapp (den portabla mappen
under Hantera kan ligga i OneDrive eller Dropbox) eller GitHub. På samma nätverk går överföringen direkt mellan
enheterna (fliken Enheter). `mailto:`-länkar kan inte bära bilagor; använd delningsmenyn eller spara filen och
bifoga den.
