**Svenska** · [Dansk](docs/da/README.md) · [Norsk bokmål](docs/nb/README.md) · [Norsk nynorsk](docs/nn/README.md) · [Suomi](docs/fi/README.md) · [Íslenska](docs/is/README.md) · [English](docs/en/README.md)

<img src="src/ui/design/icon-192.png" alt="" width="64" height="64" align="left">

# Dataspatium OpenCDE-klient

*Det här är README för Dataspatium 2.0.0. Den senaste utgåvan, 3.0.0, beskrivs i [README på main](https://github.com/marwiss/Dataspatium#readme).*

Dataspatium är ett program för att arbeta med data, som du öppnar i din vanliga webbläsare. Du hämtar in en tabell, en karta, en
plan, en byggnadsmodell eller statistik från en myndighet, rättar och räknar på den, gör diagram och rapporter och skickar resultatet
vidare. Allt händer på din egen dator: ingen installation, inget konto och ingen server. Ingenting lämnar datorn om du inte själv
exporterar eller delar det, och appen frågar alltid innan den använder internet.

Dataspatium kan också arbeta mot [Dataregium](https://github.com/marwiss/Dataregium), en server där ett byggprojekt delar modeller,
dokument och ärenden. Då kan du hämta projektets byggnadsmodeller, peka ut problem i 3D som ärenden och ställa frågor till serverns
graf över modellerna. Utan Dataregium fungerar allt annat precis likadant.

**För den tekniskt kunnige:** en statisk webbapp utan byggsteg som körs från `file://` i Edge, Chrome och Firefox eller från vilken
statisk webbserver som helst. Varje datamängd är en SQLite-fil (sql.js) i IndexedDB; R körs i WebR 0.5.9 och Python i Pyodide 0.29.5,
båda i workers; IFC läses med web-ifc och IfcOpenShell (wasm). Mot en server är appen en OpenCDE-klient: Foundation API 1.0 med OAuth2
authorization code och PKCE, BCF API 3.0 och 2.1 och Documents API 1.0. Inga nätverksanrop sker utan samtycke per ändamål, och
hemligheter lagras bara krypterade (AES-GCM).

![Dataspatium i läget Bearbeta med en tabell över Sveriges kommuner](docs/images/bearbeta.png)

**Innehåll**

- [Ladda ned och kom igång](#ladda-ned-och-kom-igång)
- [Vad som krävs](#vad-som-krävs)
- [Ord att känna till](#ord-att-känna-till)
- [Vad du kan göra](#vad-du-kan-göra)
- [OpenCDE-API:erna och deras klienter](#opencde-apierna-och-deras-klienter)
- [Dataspatium och Dataregium](#dataspatium-och-dataregium)
- [Lär dig mer](#lär-dig-mer)
- [Begränsningar i korthet](#begränsningar-i-korthet)
- [Personuppgifter](#personuppgifter)
- [Nyare utgåvor](#nyare-utgåvor)
- [Fel och förslag](#fel-och-förslag)
- [Utveckling](#utveckling)
- [Licens](#licens)

## Ladda ned och kom igång

1. **Ladda ned.** Gå till [utgåvan 2.0.0](https://github.com/marwiss/Dataspatium/releases/tag/v2.0.0) och hämta
   ZIP-filen under *Assets* (`dataspatium-<version>.zip`, ungefär 100 MB; R och de vanligaste R-paketen ingår).
2. **Packa upp.** Högerklicka på ZIP-filen och välj *Extrahera alla* (Windows) eller dubbelklicka på den (macOS).
   Lägg mappen där du vill ha den, till exempel i Dokument. Appen fungerar inte direkt inifrån ZIP-filen.
3. **Öppna.** Dubbelklicka på `index.html` i mappen, eller dra filen till ett webbläsarfönster. Om Windows frågar
   vilken app som ska användas väljer du Edge, Chrome eller Firefox. Första gången väljer du språk, och sedan erbjuds
   **Grundkursen**: en genomgång av alla lägen med exempeldata som tar ungefär tio minuter och kan öppnas igen från hjälpen (?).
4. **Hämta in data.** I läget *Inhämta* släpper du en fil på ytan, eller klickar på *Prova med exempeldata*. Appen visar vad filen
   innehåller; klicka på *Importera*. Datamängden sparas i webbläsaren på din dator.
5. **Arbeta vidare.** Lägena högst upp är stegen i arbetet: *Hantera* håller ordning på dina datamängder, *Söka* hittar rader utan
   kod, *Bearbeta* visar tabellen, kartan eller modellen med knappar för att rätta och räkna, *Analysera* har statistik och kod (R,
   Python och SQL), *Visualisera* gör diagram och kartor, *Exportera* sparar filer på datorn och *Dela* skickar till andra.

Det du sparar ligger i webbläsarens egen databas på datorn. Rensar du webbläsarens webbplatsdata försvinner det, så ta regelbundet
en säkerhetskopia under *Hantera > Arbetsyta*. Säkerhetskopian är en ZIP-fil som kan återställas på samma eller en annan dator. Steg
för steg med fler detaljer: [docs/sv/kom-igang.md](docs/sv/kom-igang.md).

Webbversionen på <https://marwiss.github.io/Dataspatium/> är alltid den senaste utgåvan, nu 3.0.0.

### För den tekniskt kunnige

- **Kör:** packa upp ZIP-filen och öppna `index.html` (file://), eller serva mappen: `python -m http.server 8080 --bind 127.0.0.1`
  och öppna <http://127.0.0.1:8080/>. Från en webbserver finns service worker, installerbar app och avbrytbar R och Python.
- **Kontrollera ZIP-filen:** jämför dess SHA-256 med den i utgåvans text (`Get-FileHash` i PowerShell, `shasum -a 256` på macOS och
  Linux).
- **Med en server:** starta Dataregium med Docker eller Podman (`docker compose up -d --build --wait` och
  `docker compose exec api opencde seed` i Dataregiums repo), servera Dataspatium på port 8080 och lägg till servern under *Inhämta >
  Lägg till källor > OpenCDE*. Klient-id kan lämnas tomt när servern tillåter självregistrering. Hela vägen på tjugo minuter:
  [snabbstart.md](docs/sv/snabbstart.md).
- **Grafen:** serverns IFC-graf (Neo4j eller Memgraph) frågas med Cypher från *Inhämta*, genom serverns graffråga eller direkt över
  Bolt.
- **Prov:** `powershell -File tools/run-tests.ps1` eller `tools/run-tests.sh` kör hela sviten i headless Edge och Firefox.

## Vad som krävs

- Windows, macOS eller Linux.
- Microsoft Edge eller Google Chrome (version 120 eller senare), eller Firefox (version 128 eller senare).
  Safari stöds inte för hela appen.
- Ungefär 300 MB ledigt utrymme för appmappen och minst 4 GB arbetsminne (8 GB rekommenderas för stora
  datamängder och modeller). Inga administratörsrättigheter behövs.
- Internet behövs bara när du själv väljer något som kräver det, och appen frågar om lov först för varje ändamål: hämta data från
  öppna API:er och kartor, ansluta till en Dataregium-server eller GitHub, söka efter uppdatering eller
  hämta en del som inte följer med i mappen (Python, IfcOpenShell och R-paket utöver de vanligaste).
- För Dataregium behövs en server. Att köra en egen kräver Docker eller Podman; det beskriver Dataregiums README.

## Ord att känna till

Du behöver inte kunna orden nedan för att använda appen, men de förekommer i texten.

- **API**: ett sätt för program att hämta data från varandra över nätet. Appen hämtar statistik från myndigheters API:er och pratar
  med Dataregium genom dess API:er.
- **Datamängd**: det appen sparar när du hämtar in något: en tabell, en karta, en plan, en graf, en modell eller en samling dokument
  eller bilder.
- **Recept**: listan över allt du har gjort med en datamängd, steg för steg, så att det kan ångras eller göras om på nya data.
- **R, Python och SQL**: språk för att analysera data. Appen har dem inbyggda, men det mesta görs med knappar och formulär som skriver
  koden åt dig.
- **BIM**: att beskriva en byggnad som en digital modell där varje vägg, dörr och rum har uppgifter, inte bara som linjer på en
  ritning.
- **IFC**: det öppna filformatet för byggnadsmodeller, som alla stora program för byggprojektering kan läsa och skriva.
- **CAD**: ritningar gjorda i ett ritprogram; appen läser dem i det öppna formatet DXF.
- **IDS**: en öppen fil som säger vilka uppgifter en modell måste ha, så att modellen kan kontrolleras automatiskt.
- **BCF**: ett öppet format för ärenden om en modell, till exempel "ventilationen går genom balken", med en bild och den vy som visar
  platsen.
- **OpenCDE**: buildingSMART:s öppna regler för hur program delar modeller, dokument och ärenden i ett byggprojekt, så att program från
  olika tillverkare fungerar ihop.
- **Server**: ett program som andra ansluter till över nätet. Dataregium är en server; Dataspatium behöver ingen.
- **Graf och grafdatabas**: data som saker och förbindelser mellan dem, till exempel att en dörr sitter i en vägg på en våning.
  Dataregium kan lagra varje modell som en graf i Neo4j eller Memgraph, med hjälp av modulen IFC-LPG.
- **Container**: ett färdigpaketerat program som startas med Docker eller Podman utan att delarna installeras var för sig. Dataregium
  körs så; Dataspatium behöver inga containrar.
- **OAuth2-inloggning**: det vanliga sättet att logga in i en tjänst från en annan app utan att appen ser ditt lösenord.
- **file:// och CORS**: file:// betyder att appen öppnas direkt från en mapp. CORS är webbläsarens regel för vilka webbtjänster en
  webbapp får hämta data från; en tjänst utan CORS kan inte nås direkt.

## Vad du kan göra

Det som går i en version går också i nästa. Varje version hör ihop med samma version av Dataregium.

### Version 1 (med Dataregium 1)

- **Hämta in data**: filer i ett fyrtiotal format, från Excel och CSV till statistikfiler, geodata och tabeller i Word och
  webbsidor, och statistik från myndigheter i Sverige, Norden och Europa med ett klick (se [Öppna API:er](docs/sv/api-konfiguration.md)).
  *Tekniskt:* teckenkodning och kolumntyper känns av; SPSS, Stata, SAS, PX, Parquet och RDS via R; egna källor som `*.api.json`.
- **Rätta och räkna**: ett femtiotal åtgärder med knappar, som rensa, byta typ, koda om, räkna andelar, pivotera och koppla tabeller,
  med kvalitetsregler, pseudonymisering av personnummer, ångra och versioner (se [Bearbeta](docs/sv/bearbeta.md)). *Tekniskt:* varje
  steg sparas i ett recept som kan exporteras som R- eller SQL-kod.
- **Analysera**: R med ggplot2 och tidyverse, SQL över flera datamängder, reguljära uttryck och anteckningsböcker som blir rapporter,
  helt i webbläsaren (se [R](docs/sv/r-guide.md) och [Reguljära uttryck](docs/sv/regex.md)).
- **Planer**: svenska detaljplaner och översiktsplaner som plankartor med Boverkets färger och beteckningar, i planens eget
  koordinatsystem (se [Planer](docs/sv/planer.md)).
- **Diagram, kartor och dokument**: diagram och kartor med Vega-Lite, D3 eller R, dashboards och rapporter ur mallar som HTML, Word,
  PDF, PowerPoint, Markdown eller LaTeX (se [Visualisera](docs/sv/visualisera.md)).
- **Spara och dela**: data i ett tiotal format, delningspaket, kommentarer, säkerhetskopia, synk med GitHub och en portabel mapp.
- **Dataregium som dokumentarkiv**: hämta dokument från servern som datamängder och skicka tillbaka datamängder och filer som nya
  versioner. *Tekniskt:* Foundation API och Documents API.
- **Sex språk och en grundkurs**: svenska, danska, norska (bokmål), finska, isländska och engelska, och kommandopaletten (Ctrl+K) som
  hittar allt.

### Också i version 2 (med Dataregium 2)

- **Söka och Dela**: två nya lägen. *Söka* hittar och listar rader utan kod; *Dela* skickar paket, publicerar dashboards och dokument
  som webbsidor och överför till telefoner med en QR-kod, efter en granskning av personuppgifter (se [Söka](docs/sv/soka.md) och
  [Dela](docs/sv/dela.md)).
- **Fler källor**: Access-filer, databaser, öppna geodata, bakgrundskartor, dokument och bilder som samlingar och text ur skannade
  sidor (se [Källor](docs/sv/kallor.md)). *Tekniskt:* en lokal brygga till SQL Server och ODBC, PostgREST, OData, GraphQL, SPARQL med
  flera över HTTP, WFS, OGC API Features, ArcGIS och Neo4j över Bolt.
- **Kartor, planer och grafer**: kartor med lager och geoverktyg, planer från hela Norden och grafer som ritas, frågas och redigeras
  (se [Kartor](docs/sv/kartor.md) och [Grafer](docs/sv/grafer.md)).
- **Byggnadsmodeller**: IFC-modeller i 3D med tabeller, egenskaper och mängder, kontroll mot schemat och mot IDS, och DXF-ritningar
  (se [CAD och BIM](docs/sv/cad-bim.md)). *Tekniskt:* web-ifc och three.js för visningen, IfcOpenShell och ifctester i appens Python.
- **Python och statistik utan kod**: en Python-konsol och formulär för statistik och tidsserier som skriver och visar koden (se
  [Statistik](docs/sv/statistik.md) och [Python](docs/sv/python.md)).
- **Ordning och flöden**: mappar, taggar och åtgärder på många datamängder, sparade flöden som körs med ett klick och källor som säger
  till när de har nya data (se [Lägen](docs/sv/lagen.md)).
- **Dataspatium Mobil**: telefonen tar emot och visar data och samlar in rader i fält, också utan nät (se [Mobil](docs/sv/mobil.md)).
- **Dataregium med ärenden**: projektets modeller och ärenden, nya ärenden som pekar ut platsen i 3D, BCF-filer, serverns IFC-graf,
  kortet *Administration* för administratören och kortet *Projektets medlemmar* för den projektansvarige (se
  [Dataspatium och Dataregium](#dataspatium-och-dataregium)). *Tekniskt:* BCF API 3.0 och 2.1 med viewpoints.
- **Sju språk**: också nynorska, med handboken i appen och grundkursen genom alla åtta lägen.

## OpenCDE-API:erna och deras klienter

OpenCDE är buildingSMART Internationals öppna regler för hur program delar ett byggprojekts modeller, dokument och ärenden. Ett
program som följer reglerna kan arbeta med varje server som också gör det, vem som än har byggt dem. Dataspatium är ett sådant
program, en klient, och använder alla tre API:erna:

| API | Vad appen gör med det | Specifikation |
|---|---|---|
| Foundation API 1.0 | Läser vilka API:er servern erbjuder, var man loggar in och vem användaren är; registrerar appen som klient när servern tillåter det | [foundation-API](https://github.com/buildingSMART/foundation-API) |
| BCF API 3.0 och 2.1 | Läser och skriver ärenden om en modell, med kommentarer och viewpoints (kamera, komponenter och bilder) ur 3D-vyn; väljer den nyaste version servern erbjuder | [BCF-API](https://github.com/buildingSMART/BCF-API) |
| Documents API 1.0 | Väljer och hämtar dokument och versioner via serverns egna sidor, så att en IFC-modell blir en datamängd, och laddar upp nya versioner, datamängder och paket | [documents-API](https://github.com/buildingSMART/documents-API) |

**Dataregium är en server, inte den enda.** Inget i appen beror på Dataregium. Dataregiums tillägg utanför specifikationerna
(kapabilitetsdokumentet, graffrågorna och projektadministrationen) visas bara när servern själv anger dem.

**För den tekniskt kunnige:** av en server behöver appen tre saker:

- CORS från appens ursprung: `null` från file://, `http://127.0.0.1:8080` från en lokal webbserver och `https://marwiss.github.io`
  från webben, med rubrikerna Authorization, Content-Type och X-Request-ID;
- en klientregistrering, gjord av serverns administratör (en publik klient med omdirigeringsadressen
  `http://127.0.0.1:8080/oauth-callback.html`, eller motsvarande för appens adress) eller av appen själv (RFC 7591) när servern
  tillåter det, och OAuth2 authorization code med PKCE `S256`; från file:// klistrar du in adressen du hamnar på efter inloggningen;
- BCF API 3.0 eller 2.1; Documents API är valfritt, men utan det kan appen inte hämta eller publicera dokument.

Så långt är det visat mot Dataregium: livesviten körs mot servern i båda versionerna av BCF API, och en server med bara 2.1 fungerar.
Andra servrar är inte provade; berätta hur det gick under [Fel och förslag](#fel-och-förslag). När appen och en specifikation inte
stämmer överens avgör specifikationen. Appens sida beskrivs i [kallor.md](docs/sv/kallor.md), serverns i Dataregiums README.

## Dataspatium och Dataregium

*Dataregium hette Kontroll fram till den 8 november 2026.*

Dataspatium är appen du arbetar i, och [Dataregium](https://github.com/marwiss/Dataregium) är servern där ett projekt samlar sina
modeller, dokument och ärenden. De är byggda för varandra men följer öppna regler, så andra program fungerar också. Du lägger till
servern som källa i *Inhämta* och loggar in; sedan hämtar du projektets modeller och dokument, pekar ut problem i 3D som ärenden,
skickar tillbaka datamängder och filer och ställer frågor till serverns graf över modellerna. Utan server fungerar resten av appen som vanligt.

**För den tekniskt kunnige:** allt utom graffrågorna och administrationen går genom de tre OpenCDE-API:erna. Varje anrop bär ett
`X-Request-Id` som servern skriver i sin begärandelogg, så att loggen i appen och serverns logg kan paras ihop. Samarbetet beskrivs
från appens sida i [kallor.md](docs/sv/kallor.md) och [cad-bim.md](docs/sv/cad-bim.md), och från serverns sida i Dataregiums README
och `docs/client-guide.md`.

Så här hänger de ihop:

```mermaid
flowchart LR
    subgraph app ["Dataspatium, i webbläsaren"]
        source["Källa och inloggning"]
        issues["Ärenden i 3D-vyn"]
        files["Modeller och dokument"]
        queries["Frågor mot IFC-grafen"]
        log["Loggen i appen"]
        admin["Administration och medlemmar"]
    end
    subgraph server ["Dataregium, servern"]
        foundation["Foundation API, OAuth2"]
        bcf["BCF API"]
        documents["Documents API"]
        ifcgraph[("IFC-graf")]
        requests["Begärandelogg"]
        adminapi["Administrations-API"]
    end
    source <--> foundation
    issues <--> bcf
    files <--> documents
    queries --> ifcgraph
    log <-- "X-Request-ID" --> requests
    admin --> adminapi
```

Dataspatium 2.0.0 fungerar med Dataregium 2.0.0. Samma nummer hör ihop. Snabbstarten [snabbstart.md](docs/sv/snabbstart.md) tar
paret från ingenting till ett ärende på tjugo minuter.

### Utgåvorna 1, 2 och 3

Det finns en utgåva per huvudnummer, och Dataspatium och Dataregium med samma nummer hör ihop:

| Dataspatium | Vad den har | Hör ihop med |
|---|---|---|
| 1.0.0 | Datainhämtning från filer och öppna API:er, bearbetning, R, SQL och reguljära uttryck, svenska planer, diagram och kartor i diagram, dashboards, dokument, export och delning. Mot en server bara Documents API: hämta dokument som datamängder och skicka tillbaka datamängder och filer. Inga ärenden, inga modeller och ingen Python | Dataregium 1.0.0 (bara Documents API) |
| 2.0.0 | Allt i 1.0.0 och dessutom lägena Söka och Dela, Python och statistik utan kod, fler källor, kartvyer, nordiska planer, grafer, IFC-modeller i 3D med kontroll mot IDS, flöden, Dataspatium Mobil, ärenden med viewpoints (BCF API 3.0 och 2.1), serverns IFC-graf, kortet *Administration* och kortet *Projektets medlemmar* | Dataregium 2.0.0 |
| 3.0.0 | Allt i 2.0.0 och dessutom kortet *Validera modellen*, kollisionskontroll, Fråga AI och Ändra med AI, nya tomma modeller i valfritt schema, Jämför versioner, publicering med basversion och förhandskontroll, ändringsförslag som prövas och godkänns på servern med val vid krockar, och grafen i lättare form | Dataregium 3.0.0 |

En ny utgåva i samma huvudnummer ersätter den förra; bara den senaste i varje serie rättas. Appens uppdateringskontroll erbjuder
nästa huvudnummer, och datamängder, listor, diagram, mallar och skript följer med när du öppnar den nya versionens `index.html`.

## Lär dig mer

**Börja här**

- **Grundkursen** i appen: en genomgång av alla lägen med exempeldata; öppna den från hjälpen (?) eller med Ctrl+K.
- **Handboken** i appen: samma dokumentation som här, med sökning; öppna den med ? uppe till höger eller F1.
- [Kom igång](docs/sv/kom-igang.md): steg för steg med vanliga frågor.
- [Användarguide](docs/sv/anvandarguide.md): hela arbetsflödet från fil till rapport.
- [De åtta lägena](docs/sv/lagen.md): vad som finns var och varför.
- [Vanliga frågor](docs/sv/faq.md): lagring, säkerhet, R, API:er och uppdateringar.

**Per område**

- [Format och import](docs/sv/format.md) och [Öppna API:er](docs/sv/api-konfiguration.md): filformat, teckenkodning, de förinställda
  källorna, nycklar och egna konfigurationer.
- [Källor](docs/sv/kallor.md): databaser, bryggan, öppna geodata, länkade filer och OpenCDE-servrar.
- [Bearbeta](docs/sv/bearbeta.md), [Söka](docs/sv/soka.md) och [Reguljära uttryck](docs/sv/regex.md): rätta, räkna och hitta.
- [Statistik](docs/sv/statistik.md), [R i Dataspatium](docs/sv/r-guide.md), [Python i Dataspatium](docs/sv/python.md) och
  [Anteckningsbok](docs/sv/anteckningsbok.md): analys med och utan kod.
- [Visualisera](docs/sv/visualisera.md), [Kartor](docs/sv/kartor.md) och [Dokument och mallar](docs/sv/dokumentmallar.md): diagram,
  kartor, dashboards och rapporter.
- [Planer](docs/sv/planer.md), [Grafer](docs/sv/grafer.md) och [CAD och BIM](docs/sv/cad-bim.md): planer, grafer, byggnadsmodeller och kontroller.
- [Dokument och bilder](docs/sv/dokument.md): PDF, Word, OpenDocument, Markdown och bilder som datamängder.
- [Flöden](docs/sv/floden.md), [Dela](docs/sv/dela.md), [Dataspatium Mobil](docs/sv/mobil.md) och [Insamling](docs/sv/insamling.md):
  automatisera, dela och samla in.
- [Snabbstart med Dataregium](docs/sv/snabbstart.md): tjugo minuter från ingenting till ett ärende skapat i 3D-vyn och synligt på servern.
- [Säkerhet](docs/sv/sakerhet.md) och [Licenser](docs/sv/licenser.md): hotmodell, kontroller och prov, och vad du får göra med appen.
- Hur bidrag tas emot står i [CONTRIBUTING.md](CONTRIBUTING.md).

### Vidare läsning

- [BCF API](https://github.com/buildingSMART/BCF-API), [Foundation API](https://github.com/buildingSMART/foundation-API) och [Documents API](https://github.com/buildingSMART/documents-API): specifikationerna som appen följer mot en server.
- [IFC](https://github.com/buildingSMART/IFC4.x-development): filformatet för byggnadsmodeller, och [IDS](https://github.com/buildingSMART/IDS): kravspecifikationer som modeller kontrolleras mot.
- Externa resurser: [WebR](https://docs.r-wasm.org/webr/latest/), [Pyodide](https://pyodide.org/), [IfcOpenShell](https://ifcopenshell.org/),
  [Vega-Lite](https://vega.github.io/vega-lite/), [SCB:s API](https://www.scb.se/vara-tjanster/oppna-data/api-for-statistikdatabasen/).

## Begränsningar i korthet

- Appen måste öppnas från en uppackad mapp eller en vanlig webbserver; den fungerar inte direkt inifrån ZIP-filen.
- Webbtjänster som inte tillåter anrop från webbläsare (saknar CORS, till exempel Riksbankens) kan inte nås direkt; en egen proxy
  kan anges.
- En datamängd bör hålla sig under ett par miljoner rader, och mycket stora byggnadsmodeller kan vara för tunga för webbläsaren; minnet
  sätter gränsen.
- När appen öppnas från en mapp kan R- och Python-kod inte avbrytas mitt i en beräkning; använd *Starta om R* eller *Starta om
  Python*. Från en webbserver finns knappen *Avbryt*.
- Python och IfcOpenShell ingår inte i ZIP-filen; de hämtas första gången de behövs, efter samtycke, och sparas sedan i webbläsaren.
- Flera flikar fungerar och håller varandra underrättade, men redigera inte samma datamängd i två flikar samtidigt: den som sparar
  sist vinner.
- Den portabla mappen kräver Edge eller Chrome; Firefox saknar mappåtkomst. Säkerhetskopia som ZIP fungerar överallt.
- Hela appen är gjord för datorer. På telefoner och surfplattor används Dataspatium Mobil
  (<https://marwiss.github.io/Dataspatium/m/>), som tar emot, visar, samlar in och skickar vidare. I smala fönster öppnas panelerna
  som flak över arbetsytan.
- Exempeldata och kartgränser som följer med gäller Sverige, Danmark, Norge och Finland, och de förinställda källorna är nordiska och
  europeiska; data från andra länder går lika bra att hämta in själv.

## Personuppgifter

Dataspatium körs i din webbläsare, och du ansvarar själv för de uppgifter du lägger in. Allt som appen sparar (datamängder och deras
versioner, listor, diagram, dokument, anteckningsböcker, kommentarer och inställningar) ligger i webbläsarens lagring på din dator och
lämnar den bara när du exporterar, delar eller publicerar; då granskas allt i sin helhet först, och personuppgifter kan behållas,
pseudonymiseras eller tas bort i kopian. Mot en Dataregium-server skickas din inloggning (token hålls i sessionen eller krypterade med
din lösenfras, aldrig i klartext), de ärenden, kommentarer och filer du skapar under ditt namn på servern, och ett
X-Request-ID per anrop; serverns egen behandling står i Dataregiums README. Kommentarer och paket bär det namn du själv anger. Kontrollerna och proven som visar dem står i
[docs/sv/sakerhet.md](docs/sv/sakerhet.md).

## Nyare utgåvor

Dataspatium 3.0.0, gjord tillsammans med Dataregium 3.0.0, lägger till kontrollen av modeller, kollisionskontroll, Fråga AI och
Ändra med AI, nya tomma modeller, Jämför versioner och ändringsförslag som servern prövar och godkänner. Den hämtas från
[senaste utgåvan](https://github.com/marwiss/Dataspatium/releases/latest) och beskrivs i [README på main](https://github.com/marwiss/Dataspatium#readme). Datamängder, listor, diagram, mallar och skript följer med när du
öppnar den nya versionens `index.html`.

## Fel och förslag

Rapportera fel eller önskemål som *Issues* här på GitHub. Beskriv webbläsare, version av Dataspatium (visas under
hjälpknappen) och vad du gjorde. Se [CONTRIBUTING.md](CONTRIBUTING.md). Bifoga inga personuppgifter och inga hemligheter. För en
säkerhetssårbarhet, följ [SECURITY.md](SECURITY.md) i stället för att öppna ett ärende.

## Utveckling

- Inget byggsteg, inget node.js. Öppna `index.html` direkt, eller serva mappen med `python -m http.server 8080`.
- Arkitektur i korthet: all egen kod är klassiska skript som registreras med `Dataspatium.define` i ordningen i `src/boot.js`;
  `src/platform` bär allt som är file://-specifikt (resurser, shims, workers, lagring, samtycke); motorerna SQLite, R (WebR) och Python
  (Pyodide) kör i workers; `src/ui` har designvariablerna, komponenterna (`dm-*`), skalet och ett läge per fil. Allt som renderas
  escapas, och inget hämtas från nätet utan din åtgärd och ditt samtycke.
- Tredjepartskomponenter: `python tools/fetch_vendor.py` följt av `python tools/wrap_assets.py`.
- Prov: `powershell -File tools/run-tests.ps1` eller `tools/run-tests.sh` (headless Edge och Firefox). Proven går aldrig mot nätet;
  riktiga tjänster provas bara med egna parametrar (`?cde=` mot en Dataregium, `?python=1` med Pyodide).
- Säkerhet: proven för samtycke, hemligheter, granskning före delning, OAuth2 (PKCE, state, återhopp) och loggens maskering ingår i
  sviten; se [docs/sv/sakerhet.md](docs/sv/sakerhet.md).

## Licens

Dataspatiums egen kod, dokumentation och förinställningar (allt utom `vendor/`) är licensierade under
[PolyForm Strict 1.0.0](LICENSE): fri att ladda ned och använda för icke-kommersiella ändamål, inklusive i
myndigheter och andra offentliga institutioner, men inte att ändra, bygga vidare på eller sprida vidare utan
skriftligt tillstånd. Licensgivare är Dataspatiums upphovsperson, som nås via GitHub-kontot
[marwiss](https://github.com/marwiss); öppna ett ärende för andra villkor. Vad licensen betyder i praktiken
förklaras i [docs/sv/licenser.md](docs/sv/licenser.md).

Tredjepartskomponenter i `vendor/` har sina egna licenser (MIT, BSD, Apache-2.0, ISC, OFL, MPL, LGPL och GPL), se
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md). R och de GPL-licensierade R-paketen distribueras oförändrade;
källkoden finns hos [R-projektet](https://cran.r-project.org/sources.html), [webR](https://github.com/r-wasm/webr)
och [CRAN](https://cran.r-project.org/) i de versioner som anges där. Se [SECURITY.md](SECURITY.md) för hur en sårbarhet rapporteras och
vad projektet gör för att förbli säkert.
