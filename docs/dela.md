# Dela

Läget Dela samlar det som handlar om att ge data till andra människor och enheter. Exportera handlar om filer till
den egna datorn; Dela om paket, GitHub, delningsmenyn, publicering och mottagning. Fliken Enheter, direkt
överföring mellan datorer och telefoner, kommer i 2.1.

## Paket

Ett paket är en ZIP-fil med valda datamängder och det som hör till dem: diagram, dashboards, mallar,
anteckningsböcker och skript, tillsammans med ett meddelande, avsändarens namn och en ändringslogg över det som
gjorts med varje datamängd sedan den senast delades. *Skapa paket* öppnar dialogen med alla datamängder förvalda;
med en datamängd vald finns också *Paketera bara den*. Mottagaren öppnar paketet under *Ta emot* och ser meddelande
och ändringar innan något tas in. Inspektören visar hur mycket som finns att dela. Se också
[format.md](format.md) om paketets uppbyggnad.

## GitHub

Arbetsytan som en mapp i ett GitHub-repo, helst privat. Ange repo (`ägare/namn`), gren och mapp, och en finkornig
åtkomstnyckel som bara får läsa och skriva innehållet i det repot. Nyckeln används under sessionen eller sparas
krypterad; ingenting skickas förrän du trycker *Skicka till GitHub* eller *Hämta från GitHub*. Bara ändrade filer
skickas, i en commit med ditt meddelande. Vid hämtning väljer du, som för paket, om datamängder som redan finns ska
ersättas (den egna versionen sparas under *Versioner*). Första gången frågar appen om tillåtelse att kontakta
GitHub (se *Internetåtkomst* i [anvandarguide.md](anvandarguide.md)).

## Delningsmeny

Datorns eller telefonens egen delningsmeny: skicka en fil till e-post, Teams, meddelandeappar eller andra appar.
Välj om den valda datamängden ska delas som fil (CSV, Excel, ODS eller JSON) eller om alla datamängder ska delas
som ett paket, och tryck på *Dela*. Delningsmenyn för filer finns i Edge och Chrome på Windows och på mobil; i
andra webbläsare (Firefox) sparas filen i stället, och knappen heter då *Spara fil*.

## Publicera

En fristående HTML-fil som fungerar utan Dataspatium och kan läggas på ett intranät eller skickas: dashboards
(med diagrammen inbäddade) och dokument ur mallar, fyllda med den valda datamängden. Publicerade filer innehåller
data och diagram i klartext; dela dem bara med dem som får se uppgifterna.

## Ta emot

Öppna ett paket från en fil (släpp den på ytan) eller från en webbadress. Avsändare, meddelande och ändringar visas
först; datamängder som redan finns kan ersättas med paketets version, annars hoppas de över. En säkerhetskopia
(ZIP från *Säkerhetskopiera arbetsytan*) kan också öppnas här, men hör hemma under Hantera, Arbetsyta.

## Vad som inte går

En webbläsare kan inte vara server, så andra kan inte hämta data direkt från din dator utan att en fil eller ett
paket passerar: via delningsmenyn, en molnmapp (den portabla mappen under Hantera kan ligga i OneDrive eller
Dropbox), GitHub eller, från 2.1, direkt mellan enheter med WebRTC. `mailto:`-länkar kan inte bära bilagor; använd
delningsmenyn eller spara filen och bifoga den.
