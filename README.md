**Svenska** · [Dansk](docs/da/README.md) · [Norsk bokmål](docs/nb/README.md) · [Norsk nynorsk](docs/nn/README.md) · [Suomi](docs/fi/README.md) · [Íslenska](docs/is/README.md) · [English](docs/en/README.md)

<img src="src/ui/design/icon-192.png" alt="" width="64" height="64" align="left">

# Dataspatium OpenCDE-klient

Dataspatium är en webbapp för data från källa till rapport: hämta in data från filer och öppna API:er, lagra och
hantera datamängder, granska och korrigera värden, analysera med R, visualisera och exportera. Allt körs i din
egen webbläsare. Ingen server, ingen installation, inga konton. Din data lämnar aldrig datorn om du inte själv
exporterar den. Säkerheten är det första kravet: inga nätverksanrop utan din åtgärd och ditt samtycke, hemligheter bara krypterade, komponenter pinnade och kontrollerade, och allt som delas granskas först.

![Dataspatium i läget Bearbeta med en tabell över Sveriges kommuner](docs/images/bearbeta.png)

**Innehåll**

- [Ladda ned och kom igång](#ladda-ned-och-kom-igång)
- [Vad som krävs](#vad-som-krävs)
- [Vad du kan göra](#vad-du-kan-göra)
- [OpenCDE-API:erna och deras klienter](#opencde-apierna-och-deras-klienter)
- [Dataspatium och Dataregium](#dataspatium-och-dataregium)
- [Lär dig mer](#lär-dig-mer)
- [Begränsningar i korthet](#begränsningar-i-korthet)
- [Personuppgifter](#personuppgifter)
- [Nästa i 3-serien](#nästa-i-3-serien)
- [Fel och förslag](#fel-och-förslag)
- [Utveckling](#utveckling)
- [Licens](#licens)

## Ladda ned och kom igång

1. **Ladda ned.** Gå till [senaste utgåvan](https://github.com/marwiss/Dataspatium/releases/latest) och hämta
   ZIP-filen under *Assets* (`dataspatium-<version>.zip`, ungefär 100 MB; R och alla R-paket ingår).
2. **Packa upp.** Högerklicka på ZIP-filen och välj *Extrahera alla* (Windows) eller dubbelklicka på den (macOS).
   Lägg mappen där du vill ha den, till exempel i Dokument. Appen fungerar inte direkt inifrån ZIP-filen.
3. **Öppna.** Dubbelklicka på `index.html` i mappen, eller dra filen till ett webbläsarfönster. Om Windows frågar
   vilken app som ska användas väljer du Edge, Chrome eller Firefox. Första gången frågar appen vilket språk du
   vill ha (det kan ändras med språkknappen uppe till höger) och startar sedan **Grundkursen**, en interaktiv
   genomgång av alla lägen med exempeldata som tar ungefär tio minuter. Kursen öppnas igen från hjälpen (?).
4. **Importera.** I läget *Inhämta* släpper du en fil på ytan (eller klickar på *Prova med exempeldata*),
   kontrollerar kolumnernas typer och klickar på *Importera*. Datamängden sparas i webbläsaren på din dator.
5. **Arbeta vidare.** Växla läge högst upp: *Hantera* visar dina datamängder och arbetsytan, *Söka* hittar rader
   i dem, *Bearbeta* visar tabellen med sortering, filter och åtgärder, *Analysera* öppnar R- och SQL-konsolen,
   *Visualisera* bygger diagram, *Exportera* laddar ned data, diagram och dokument och *Dela* ger dem till andra.

Data sparas i webbläsarens egen databas. Rensar du webbplatsdata försvinner den, så ta regelbundet en
säkerhetskopia under *Hantera > Arbetsyta*. Säkerhetskopian är en ZIP-fil som kan återställas på samma eller en
annan dator. Steg för steg med fler detaljer: [docs/sv/kom-igang.md](docs/sv/kom-igang.md).

Appen finns också direkt på webben, utan nedladdning: <https://marwiss.github.io/Dataspatium/>. Från en webbserver
kan den installeras som egen app (Edge och Chrome: *Installera* i adressfältet) och fungerar sedan även utan
nätverk. Webbversionen och mappversionen har skilda arbetsytor; flytta data mellan dem med en säkerhetskopia eller
ett paket.

## Vad som krävs

- Windows, macOS eller Linux.
- Microsoft Edge eller Google Chrome (version 120 eller senare), eller Firefox (version 128 eller senare).
  Safari stöds inte.
- Ungefär 300 MB ledigt utrymme för appmappen och minst 4 GB arbetsminne (8 GB rekommenderas för stora
  datamängder). Inga administratörsrättigheter behövs.
- Internet behövs bara när du hämtar data från öppna API:er, skickar till GitHub, söker efter uppdatering eller
  hämtar en komponent eller ett R-paket som inte följer med i mappen; appen frågar om lov först.

## Vad du kan göra

Det som går i version 1 går också i version 2, och det som går i version 2 går också i version 3. Dataspatium och Dataregium med samma
huvudnummer hör ihop.

### Version 1 (med Dataregium 1)

- **Hämta in**: CSV-, Excel-, ODS-, JSON-, JSON-stat-, SDMX-JSON-, GeoJSON-, XML-, SQLite-, GeoPackage- och shapefile-filer,
  tabeller i HTML-, Markdown-, Word- och LaTeX-dokument, kartfiler i KML, KMZ, GPX och TopoJSON, SQL-skript,
  äldre kalkylformat (dBase, Lotus 1-2-3, Quattro Pro, SYLK, DIF), text med fasta kolumnbredder, statistikfiler
  från SPSS, Stata och SAS (med värdeetiketter) och SCB:s PX-format samt Parquet och RDS
  (via R), inklistrad text, filer från webbadresser, och data direkt från öppna API:er hos SCB,
  Folkhälsomyndigheten, Socialstyrelsen, Kolada, Eurostat, SMHI, Naturvårdsverket, Lantmäteriet och Sveriges
  dataportal samt statistikbyråerna och andra myndigheter i Danmark, Norge, Finland, Island, Grönland, Färöarna
  och Åland, Nordic Statistics, ECB och OECD, med landsfilter och sparade hämtningar som uppdateras med ett klick
  och spelar upp sina recept (se [docs/sv/api-konfiguration.md](docs/sv/api-konfiguration.md)). Exempeldata och
  kommun- och regiongränser för Sverige, Danmark, Norge och Finland följer med.
- **Bearbeta**: bläddra, sortera och filtrera i stora tabeller, redigera celler, rensa, typa, koda om,
  klassindela, rangordna, beräkna andelar, löpande summor och förändringar, pivotera och koppla data,
  kontrollera datakvalitet med profil och regler (bland annat format, nordiska identitetsnummer, referenser till
  andra datamängder och avvikande värden), pseudonymisera personnummer inför delning, slå
  upp kommun och län ur koordinater, med ångra, versioner och recept som kan exporteras som R eller SQL (se
  [docs/sv/bearbeta.md](docs/sv/bearbeta.md)).
- **Analysera**: en inbyggd R-konsol med ggplot2 och tidyverse (se [docs/sv/r-guide.md](docs/sv/r-guide.md)), en
  SQL-konsol där datamängder kopplas ihop med join via sina kortnamn, och anteckningsböcker med text-, R- och
  SQL-celler som blir rapporter i HTML, Word, PDF, Markdown eller LaTeX (se
  [docs/sv/anteckningsbok.md](docs/sv/anteckningsbok.md)), och en Regex-flik där reguljära uttryck prövas på en kolumn
  och används för att filtrera, extrahera, ersätta och dela upp (se [docs/sv/regex.md](docs/sv/regex.md)), helt i
  webbläsaren.
- **Planer**: digitala detaljplaner (nationella specifikationen, Lantmäteriets geodataplattform) öppnas som plankartor
  med Boverkets färger och beteckningar, bestämmelserna slås upp i Boverkets Planbestämmelsekatalog (inbäddad kopia),
  och översiktsplaner (specifikationen eller Boverkets ÖP-modell) visas tema för tema (se [docs/sv/planer.md](docs/sv/planer.md)).
- **Visualisera**: diagram med Vega-Lite (inklusive koropletkartor och punktkartor med medföljande kommun- och
  länsgränser, fasta axelgränser, logaritmisk skala, referenslinjer och trendlinjer), D3-mallar eller R,
  exporterade som SVG, PNG, PDF och PowerPoint, även i batch per grupp, och dashboards med gemensamma filter som
  blir HTML eller PowerPoint (se [docs/sv/visualisera.md](docs/sv/visualisera.md)).
- **Dokumentera**: rapporter och kodböcker ur mallar som HTML, Word, PDF, Markdown eller LaTeX, även ett dokument
  per kommun eller år (se [docs/sv/dokumentmallar.md](docs/sv/dokumentmallar.md)).
- **Exportera och dela**: data till CSV, Excel, ODS, JSON, GeoJSON, XML, SQLite, Parquet, SPSS, Stata och RDS;
  delningspaket med valda datamängder och objekt, ett meddelande och en ändringslogg, kommentarer på datamängder och
  kolumner, säkerhetskopia av arbetsytan som ZIP, synk med ett GitHub-repo och, i Edge och Chrome, en portabel mapp
  med vanliga filer.
- **Hitta snabbt**: kommandopaletten (Ctrl+K) växlar läge, öppnar datamängder, diagram och dashboards och kör
  åtgärder från ett enda sökfält.
- **Dataregium som källa**: en OpenCDE-server som [Dataregium](https://github.com/marwiss/Dataregium) blir en källa i Inhämta med inloggning via
  OAuth2 med PKCE och självregistrering där servern tillåter det; dokument väljs på serverns sida och hämtas som datamängder, och
  datamängder och filer skickas tillbaka som nya dokument eller versioner (Documents API).
- **Sex språk**: gränssnitt, meddelanden och dokumentation på svenska, danska, norska (bokmål), finska,
  isländska och engelska.
- **Grundkurs**: en interaktiv genomgång av alla sex lägen med exempeldata, på alla sex språk. Den visas första
  gången appen öppnas och kan öppnas när som helst från hjälpen eller kommandopaletten.

### Också i version 2 (med Dataregium 2)

- **Python**: en Python-konsol med pandas och matplotlib som hämtas första gången, bredvid R och SQL i Analysera (se
  [docs/sv/python.md](docs/sv/python.md)).
- **Databaser**: Access-filer läses direkt i webbläsaren; databaser på datorn eller i nätverket (SQL Server, ODBC, Excel,
  SQLite) nås genom en lokal brygga, och PostgREST/Supabase, OData, GraphQL, CouchDB, ClickHouse, Elasticsearch,
  SPARQL, InfluxDB, Google Sheets och Airtable blir källor med ett klick. Filer kan länkas och läsas in igen från
  disken (se [docs/sv/kallor.md](docs/sv/kallor.md)).
- **Dokument och bilder**: PDF, Word, OpenDocument, Markdown och text blir dokumentsamlingar som läses i en läsvy, sida för sida
  eller i sin helhet; bilder blir en bildsamling med EXIF-uppgifter och galleri. Verktygen Text (ordfrekvens, nyckelord
  i kontext, samförekomster) och Bilder (översikt, dubbletter) fungerar utan kod (se [docs/sv/dokument.md](docs/sv/dokument.md)).
- **Kartor**: geodatamängder öppnas som kartor att zooma i, kartvyer med flera lager och bakgrundskarta efter samtycke
  blir dashboards och publicerad HTML, geoverktygen räknar area, punkter i områden, närmaste, buffert och överlagring
  utan kod, och QGIS-projekt blir kartvyer (se [docs/sv/kartor.md](docs/sv/kartor.md)).
- **Öppna geodata**: WFS-, OGC API Features- och ArcGIS-tjänster blir källor vars lager hämtas som kartor, med
  förinställningar för SCB, SGU, HaV, RAÄ, Skogsstyrelsen, Kartverket, Statistikcentralen och SYKE, sökning i
  Geodataportalen och WMS-tjänster som bakgrundskarta eller lager (se [docs/sv/kallor.md](docs/sv/kallor.md)).
- **Nordiska planer**: Danmarks lokalplaner och kommuneplanrammer (Plandata.dk), Finlands kaavatietomalli och planindex
  (Ryhti), Islands stafrænt deili- och aðalskipulag (Skipulagsstofnun) och Norges reguleringsplaner (GeoPackage) öppnas
  som planer med respektive lands färger; en hel plan hämtas med sitt nummer från Plandata och Skipulagsstofnun.
- **Grafer**: GraphML, GEXF, JSON med noder och kanter och Cypher-skript öppnas som grafer med översikt per etikett, fokus
  och helgrafsvisning (Cytoscape och sigma), en Cypher-delmängd översatt till SQL, grafmått i bakgrunden och export i
  alla fyra formaten; två tabeller blir en graf (se [docs/sv/grafer.md](docs/sv/grafer.md)).
  Grafen redigeras i Bearbeta och med skrivande Cypher (receptsteg), Neo4j är en källa via Bolt, fliken Graf har PageRank,
  samhällen, centralitet, mönsterfrågor och layout, och grafer blir diagram i Visualisera, dashboards och Publicera.
- **CAD och BIM**: IFC-modeller öppnas i 3D (web-ifc och three.js) ovanför en tabell över byggdelarna, och urvalet följer åt åt båda
  håll. Egenskaper och mängder blir tabeller, fliken Mängder räknar per typ, våning och material, och DXF-ritningar visas som
  SVG med lager (se [docs/sv/cad-bim.md](docs/sv/cad-bim.md)).
- **Flöden och bevakningar**: en sparad kedja (hämta, recept, skript, listor, diagram, dashboards, dokument, export) körs med ett klick
  eller vid start, och bevakade källor säger till i statusraden när de har nya data (se [docs/sv/floden.md](docs/sv/floden.md)).
- **Statistik utan kod**: fliken Statistik gör beskrivande statistik, korstabeller, korrelation, hypotestester, regression och klustring med
  formulär som skriver och visar R- eller Python-koden. Tidsserieåtgärder i Bearbeta (perioder, förändring, index, glidande medelvärde,
  säsongsrensning), och en regression kan sparas och användas som receptsteget Prediktion (se [docs/sv/statistik.md](docs/sv/statistik.md)).
- **Insamling i fält**: ett formulär byggt på en datamängds kolumner och regler skickas till Dataspatium Mobil. Telefonen samlar in rader utan nät, med
  foto och position, och raderna kommer tillbaka som en ny version. Fotona blir en bildsamling och positionerna hamnar på kartan (se [docs/sv/insamling.md](docs/sv/insamling.md)).
- **Lägena följer datamängdens slag**: appen säger vad en fil är och vad en datamängd också kan användas som, frågar om koordinater, koordinatsystem och kopplingar vid inläsning, sorterar blandade mappar och visar en bild per datamängd i Hantera. Sökträffar öppnas där de finns (sida, bild, nod, byggdel, planobjekt eller plats), du kan söka efter plats, hitta noder via sina kanter och byggdelar via sina egenskaper, kommentera en sida, en bild, en nod eller en plats, rätta text, sätta plats på bilder, laga geometrier, hitta dubbletter i grafer och klassificera byggdelar. Analysera öppnar i rätt verktyg med startkod skriven för datamängden, visar trenden i en tidsserie och räknar platser per område, och ett urval följer med mellan lägena (se [docs/sv/lagen.md](docs/sv/lagen.md)).
- **Visualisera, Exportera och Dela följer slaget**: diagramförslag med riktiga bilder för varje slag, korsfilter i dashboards och mallord som lägger in en karta, en graf, en modell eller en plan i ett dokument; KML, GPX och GeoPackage för platser, kontaktkarta för bilder, plankarta och planbestämmelser för planer, mängder i Excel och glTF för modeller och PDF för ritningar; i Dela väljer du om filerna ska följa med i paketet, gör en datamängd till en egen sida att skicka och ser varje slag i sin egen form på telefonen (se [docs/sv/visualisera.md](docs/sv/visualisera.md) och [docs/sv/dela.md](docs/sv/dela.md)).
- **Granskning före delning**: allt som lämnar appen granskas i sin helhet, med kolumner, löptext, sidotabeller, originalfiler, bilders positioner, grafers kanter, kommentarer och författare; personuppgifter kan behållas, pseudonymiseras eller tas bort i kopian, och datamängden ändras aldrig (se [docs/sv/dela.md](docs/sv/dela.md)).
- **Kodlistor, beskrivningar och guider**: etiketter ur SNI, SSYK, NACE och andra listor med ett klick, datapaket, DCAT-AP-SE, kvalitetsdeklaration och fyra guider med riktiga data (se [docs/sv/lagen.md](docs/sv/lagen.md)).
- **Text ur bilder**: skannade PDF-filer, bilder och bilder av tabeller läses med textigenkänning i webbläsaren, på alla sju språken.
- **Härkomst, samarbete och bibliotek**: se var en datamängd kommer ifrån och vad den har blivit, arbeta ihop via GitHub utan att något försvinner, hämta recept och mallar med licens, och publicera arbetsytan som en webbplats.
- **Dataregium och OpenCDE**: en OpenCDE-server som [Dataregium](https://github.com/marwiss/Dataregium) blir en källa i Inhämta med inloggning via OAuth2 och självregistrering där servern tillåter det. Appen hämtar projektets modeller och dokument och säger till när en nyare version finns, visar ärendena som pekar på byggdelarna, skapar ärenden ur markeringen i 3D-vyn med vyn som viewpoint, kommenterar och byter status, färgar modellen efter ärendestatus, sparar ärendena som tabell med verktyget Ärenden och dashboarden Ärendeläge, läser och skriver BCF-filer, skickar datamängder, filer och arbetsytepaket till servern, frågar serverns IFC-graf med Cypher, läser vad servern erbjuder och förklarar dess felkoder, och loggar varje anrop med ett X-Request-Id som paras med serverns begärandelogg, och administrerar servern (användare, projekt, klienter, sessioner, revision, inställningar, hälsa och graffrågor) från kortet Administration när du är administratör (se avsnittet [Dataspatium och Dataregium](#dataspatium-och-dataregium) nedan).
- **Lätt start**: stora delar som R och Python laddas först när de används, och statusraden visar vad som laddas under tiden.
- **Samordning med Dataregium, steg 1**: appen läser serverns kapabilitetsdokument, översätter dess felkoder, bär en gemensam ordlista på sju språk och öppnar en källa från länken Öppna i Dataspatium.
- **Dela**: läget *Dela* med paket, datorns delningsmeny och publicering av dashboards och dokument som fristående HTML (se
  [docs/sv/dela.md](docs/sv/dela.md)); direkt överföring till telefoner och andra datorer på samma nätverk med QR-kod och kontrollkod,
  och *Dataspatium Mobil* som tar emot, visar och skickar vidare på telefonen (se [docs/sv/mobil.md](docs/sv/mobil.md)).
- **Hålla ordning**: mappar och taggar för datamängder, filter och sortering, och batchåtgärder på flera
  datamängder på en gång (ordna, paketera, exportera, hämta igen, köra recept, ta bort).
- **Söka**: läget *Söka* letar i alla kolumner i en eller alla datamängder, med fasetter som avgränsar och
  sparade listor (se [docs/sv/soka.md](docs/sv/soka.md)).
- **Fråga utan kod**: fliken *Fråga* i Söka kopplar datamängder, väljer kolumner och beräkningar, sätter villkor och
  visar den SQL som skapas; sparade listor avgränsar tabellen i Bearbeta och raderna i diagram.
- **Hjälp i appen och presentation**: hela handboken med sökning öppnas med ? eller F1 vid kapitlet för det läge du
  står i, och **Presentera** visar en dashboard i hela fönstret med ett diagram i taget.
- **Sju språk**: gränssnitt, meddelanden och dokumentation på svenska, danska, norska (bokmål och nynorsk), finska,
  isländska och engelska.
- **Grundkurs**: en interaktiv genomgång av alla åtta lägen med exempeldata, på alla sju språk. Den visas första
  gången appen öppnas och kan öppnas när som helst från hjälpen eller kommandopaletten.

### Också i version 3 (med Dataregium 3)

- **Validera modellen och kollisionskontroll**: kortet *Validera modellen* samlar serverns kontroll (IFC-schemat, buildingSMART:s regler och projektets IDS-filer) och kontrollerna i appen, och
  *Kollisionskontroll* hittar byggdelar som går in i varandra eller ligger för tätt och kan skicka dem som BCF-ärenden (se [docs/sv/cad-bim.md](docs/sv/cad-bim.md)).
- **AI-modellering och versioner**: panelen *Fråga AI om modellen* låter en språkmodell (Anthropic eller ett OpenAI-kompatibelt API, med din
  egen nyckel lagrad krypterad) svara på frågor om en IFC-modell genom verktyg som läser modellens tabeller och, för en modell från
  Dataregium, serverns namngivna frågor. I läget *Ändra* föreslår AI:n ett ändringsset (våningar, rutnät, väggar, bjälklag, öppningar,
  egenskaper, flyttar) som förhandsvisas i 3D, kontrolleras lokalt och av serverns förkontroll och tillämpas som ett receptsteg först när
  du godkänner; AI:n kan aldrig spara eller publicera. Ett ändringsset kan skickas till Dataregium som ändringsförslag, prövas där mot
  basversionen och godkännas av en *manager* till dokumentets nästa version, med krockar listade när dokumentet hunnit ändras.
  *Jämför versioner* visar vad som är nytt, borta och ändrat mellan en modell och en ögonblicksbild, en annan modell, serverns
  ändringsset per version eller serverns diff, markerat i 3D. En modell från Dataregium publiceras med sin basversion, så att servern
  vägrar när någon hunnit före.
- **Dataregium 3**: en modell från Dataregium publiceras med sin basversion, och servern vägrar (412) när någon hunnit före och (422)
  när projektet inte tar emot filer med valideringsfel; serverns förhandskontroll prövar en kandidat utan att spara den; serverns IFC-graf
  ritas i skelettform med modellens ursprung och formversion, och en startfråga hittar byggdelar nära en byggdel; en lokal Dataregium på
  den egna datorn fungerar som källa också från file://; BCF-kameror skrivs i modellens koordinater.
- **Öppna geodata**: Sundsvalls kommuns WFS bland de färdiga geodatakällorna, bland annat med detaljplaner.

## OpenCDE-API:erna och deras klienter

OpenCDE är buildingSMART Internationals familj av öppna webb-API:er för en gemensam datamiljö, den plats där ett projekt delar
sina modeller, dokument och ärenden. En klient och en server som följer samma specifikationer kan arbeta tillsammans, vem som än
har byggt dem. Dataspatium använder alla tre:

| API | Vad appen gör med det | Specifikation |
|---|---|---|
| Foundation API 1.0 | Läser vilka API:er servern erbjuder, var man loggar in och vem användaren är; registrerar appen som klient när servern tillåter det | [foundation-API](https://github.com/buildingSMART/foundation-API) |
| BCF API 3.0 och 2.1 | Läser och skriver ärenden om en modell, med kommentarer och viewpoints (kamera, komponenter och bilder) ur 3D-vyn; väljer den nyaste version servern erbjuder | [BCF-API](https://github.com/buildingSMART/BCF-API) |
| Documents API 1.0 | Väljer och hämtar dokument och versioner via serverns egna sidor, så att en IFC-modell blir en datamängd, och laddar upp nya versioner, datamängder och paket | [documents-API](https://github.com/buildingSMART/documents-API) |

**Dataregium är en server, inte den enda.** Appen ska kunna ansluta till varje server som följer specifikationerna: inget i appen
beror på Dataregium, och Dataregiums tillägg utanför specifikationerna (kapabilitetsdokumentet, de namngivna graffrågorna,
förhandskontrollen, basversionen, ändringsförslagen och diffen mellan versioner) visas bara när servern själv anger dem. Av en server
behöver appen tre saker:

- att servern tillåter anrop från webbläsaren (CORS) från appens adress: `null` när appen öppnas från file://, `http://127.0.0.1:8080`
  från en lokal webbserver och `https://marwiss.github.io` från webben, med rubrikerna Authorization, Content-Type och X-Request-ID;
- en klientregistrering, gjord av serverns administratör (en publik klient med omdirigeringsadressen
  `http://127.0.0.1:8080/oauth-callback.html`, eller motsvarande för den adress appen servas från) eller av appen själv när servern
  tillåter det, och inloggning med OAuth2 authorization code med PKCE `S256`; från file:// klistrar du in adressen du hamnar på efter
  inloggningen;
- BCF API 3.0 eller 2.1; Documents API är valfritt, men utan det kan appen inte hämta eller publicera dokument.

Så långt är det visat mot Dataregium: livesviten körs mot servern i båda versionerna av BCF API, och en server med bara 2.1 fungerar.
Andra servrar är inte provade; berätta hur det gick under [Fel och förslag](#fel-och-förslag). När appen och en specifikation inte
stämmer överens avgör specifikationen. Serverns sida beskrivs i Dataregiums README och klientguide; appens i
[kallor.md](docs/sv/kallor.md).

## Dataspatium och Dataregium

*Dataregium hette Kontroll fram till den 8 november 2026.*

Dataspatium (appen i webbläsaren) och [Dataregium](https://github.com/marwiss/Dataregium) (en server för buildingSMARTs OpenCDE-API:er Foundation, BCF och
Documents) är utvecklade för att fungera tillsammans som klient och server. Appen lägger till servern som källa i Inhämta, loggar in
med OAuth2 och registrerar sig själv som klient när servern tillåter det, hämtar projektets modeller och dokument, läser och skriver
ärenden med viewpoints ur 3D-vyn, skickar datamängder, filer och arbetsytepaket tillbaka genom Documents API, frågar serverns
IFC-graf med Cypher och loggar varje anrop med samma X-Request-Id som servern skriver i sin begärandelogg. Frågorna mot grafen och administrationen är tillägg utanför specifikationerna; allt annat går genom de tre OpenCDE-API:erna, så
andra OpenCDE-klienter fungerar också. Servern behövs inte för resten av appen: utan server fungerar allt annat som förut. Dataregiums README och `docs/client-guide.md` beskriver samarbetet från
serverns sida; här beskrivs det i [kallor.md](docs/sv/kallor.md) och [cad-bim.md](docs/sv/cad-bim.md).

Appen talar BCF API 3.0 och 2.1, så den ansluter också till servrar som bara har 2.1, och den ritar och frågar serverns IFC-graf direkt från Inhämta.

Dataspatium 3.0.0 fungerar med Dataregium 3.0.0. Båda får samma utgåvenummer, så samma nummer hör ihop. Snabbstarten
[snabbstart.md](docs/sv/snabbstart.md) tar paret från ingenting till ett ärende på tjugo minuter.

### Utgåvorna 1, 2 och 3

Det finns en utgåva per huvudnummer, och Dataspatium och Dataregium med samma nummer hör ihop:

| Dataspatium | Vad den har | Hör ihop med |
|---|---|---|
| 1.0.0 | Hela 1-serien: datainhämtning, bearbetning, R, Python, kartor, diagram, dokument och delning, samt planer. Mot en server bara Documents API: hämta dokument som datamängder och skicka tillbaka datamängder och filer. Inga ärenden och inga modeller | Dataregium 1.0.0 (bara Documents API) |
| 2.0.0 | Hela 2-serien: IFC-modeller i 3D med tabeller, egenskaper och mängder, ärenden med viewpoints (BCF API 3.0 och 2.1), serverns IFC-graf (IFC-LPG) ritad och frågad, och planer ur planeringsverktyg fullt ut | Dataregium 2.0.0 |
| 3.0.0 | 3-serien: kortet *Validera modellen*, kollisionskontroll i webbläsaren, BCF-kameror i modellens koordinater, grafen i skelettform, Fråga AI och Ändra med AI, Jämför versioner, publicering med basversion och förhandskontroll, ändringsförslag som prövas och godkänns på servern | Dataregium 3.0.0 |

En ny utgåva i samma huvudnummer ersätter den förra; bara den senaste i varje serie rättas. Appens uppdateringskontroll erbjuder
nästa huvudnummer, och datamängder, listor, diagram, mallar och skript följer med när du öppnar den nya versionens `index.html`.

## Lär dig mer

- **Handboken** i appen: samma dokumentation som här, med sökning; öppna den med ? uppe till höger eller F1.
- **Grundkursen** i appen: en interaktiv genomgång av alla lägen med exempeldata; öppna den från hjälpen (?)
  eller med Ctrl+K.
- [Kom igång](docs/sv/kom-igang.md): steg för steg med vanliga frågor.
- [Snabbstart med Dataregium](docs/sv/snabbstart.md): tjugo minuter från ingenting till ett ärende skapat i 3D-vyn och synligt på servern.
- [Användarguide](docs/sv/anvandarguide.md): hela arbetsflödet från fil till rapport.
- [Vanliga frågor](docs/sv/faq.md): lagring, säkerhet, R, API:er och uppdateringar.
- [De åtta lägena](docs/sv/lagen.md): vad som finns var och varför.
- [Söka](docs/sv/soka.md) och [Dela](docs/sv/dela.md): hitta utan kod, och ge data till andra.
- [Dataspatium Mobil](docs/sv/mobil.md): telefonen som kurir, mottagare och visare; överföring mellan enheter.
- [Anteckningsbok](docs/sv/anteckningsbok.md): text, R, Python och SQL i celler som blir en rapport.
- [Dokument och bilder](docs/sv/dokument.md): PDF, Word, OpenDocument, Markdown och bilder som datamängder; dokumentvy, galleri och verktygen Text och Bilder.
- [Kartor](docs/sv/kartor.md): kartan i Bearbeta, kartvyer i Visualisera, geoverktygen och QGIS-projekt.
- [R i Dataspatium](docs/sv/r-guide.md) och [Python i Dataspatium](docs/sv/python.md): konsolerna, `dm_read()`,
  `dm_write()`, paketen och diagrammen.
- [Reguljära uttryck](docs/sv/regex.md): mönster för att analysera, rätta och dela upp text i datamängder.
- [Format och import](docs/sv/format.md): filformat, teckenkodning, decimaltecken, datum och kolumntyper.
- [Öppna API:er](docs/sv/api-konfiguration.md): de förinställda källorna, nycklar och hur du skriver en egen konfiguration.
- [Visualisera](docs/sv/visualisera.md): diagrambyggaren, D3-mallar, R-diagram, kartor och dashboards.
- [Dokument och mallar](docs/sv/dokumentmallar.md): mallspråket och utdataformaten.
- [Säkerhet](docs/sv/sakerhet.md): hotmodell, kontrollerna och proven som visar dem, personuppgifter och lagring, och hur en sårbarhet rapporteras.
- [Licenser](docs/sv/licenser.md): vad du får göra med appen och vilka licenser tredjepartskomponenterna har.
- Hur bidrag tas emot står i [CONTRIBUTING.md](CONTRIBUTING.md).

### Vidare läsning

- [BCF API](https://github.com/buildingSMART/BCF-API), [Foundation API](https://github.com/buildingSMART/foundation-API) och [Documents API](https://github.com/buildingSMART/documents-API): specifikationerna som appen följer mot en server.
- [IFC](https://github.com/buildingSMART/IFC4.x-development): filformatet för byggnadsmodeller, och [IDS](https://github.com/buildingSMART/IDS): kravspecifikationer som modeller kontrolleras mot.
- Externa resurser: [WebR](https://docs.r-wasm.org/webr/latest/), [R för nybörjare](https://www.r-project.org/),
  [Vega-Lite](https://vega.github.io/vega-lite/), [SCB:s API](https://www.scb.se/vara-tjanster/oppna-data/api-for-statistikdatabasen/).

## Begränsningar i korthet

- Appen måste öppnas från en uppackad mapp (file://) eller en vanlig webbserver; den fungerar inte direkt inifrån
  en ZIP-fil.
- API:er som saknar CORS-stöd (till exempel Riksbankens) kan inte anropas direkt från webbläsaren.
- En datamängd bör hålla sig under ett par miljoner rader; minnet i webbläsaren sätter gränsen.
- När appen öppnas från en mapp kan R-kod inte avbrytas mitt i en beräkning; använd *Starta om R*. Från en
  webbserver (localhost eller https) finns knappen *Avbryt*.
- Flera flikar fungerar och håller varandra underrättade, men redigera inte samma datamängd i två flikar
  samtidigt: den som sparar sist vinner.
- Den portabla mappen kräver Edge eller Chrome; Firefox saknar mappåtkomst (File System Access). Säkerhetskopia
  som ZIP fungerar överallt.
- Hela appen är gjord för datorer; på telefoner och surfplattor används Dataspatium Mobil
- Exempeldata, API-förinställningar och kartgränser som följer med är svenska; appen fungerar lika bra med andra länders data, men de får du hämta själv.
  (<https://marwiss.github.io/Dataspatium/m/>), som tar emot, visar och skickar vidare. Safari stöds inte för
  hela appen. I smala fönster öppnas panelerna som flak över arbetsytan.

## Personuppgifter

Dataspatium körs i din webbläsare, och du ansvarar själv för de uppgifter du lägger in. Allt som appen sparar (datamängder och deras
versioner, listor, diagram, dokument, anteckningsböcker, kommentarer och inställningar) ligger i webbläsarens lagring på din dator och
lämnar den bara när du exporterar, delar eller publicerar; då granskas allt i sin helhet först, och personuppgifter kan behållas,
pseudonymiseras eller tas bort i kopian. Mot en Dataregium-server skickas din inloggning (token hålls i sessionen eller krypterade med
din lösenfras, aldrig i klartext), de ärenden, kommentarer, förslag och filer du skapar under ditt namn på servern, och ett
X-Request-ID per anrop; serverns egen behandling står i Dataregiums README. Mot en AI-leverantör skickas bara det du frågar och de
svar verktygen hämtar ur modellen, efter samtycke för ändamålet AI, med din egen nyckel lagrad krypterad; projektets policy kan begränsa
till lokala modeller. Kommentarer och paket bär det namn du själv anger. Kontrollerna och proven som visar dem står i
[docs/sv/sakerhet.md](docs/sv/sakerhet.md).

## Nästa i 3-serien

3.0.0 är 3-seriens första utgåva, gjord tillsammans med Dataregium 3.0.0: kontrollen av modeller, kollisionskontrollen, AI-stegen
och versionsjämförelsen, som [Vad du kan göra](#vad-du-kan-göra) beskriver. Som varje huvudnummer har serien en enda utgåva, som
ges ut igen när den växer. Det som följer gör appen till klienten som redigerar serverns modell och visar dess versioner: AI:n
föreslår, människan granskar och godkänner, servern prövar och sammanfogar. Det här avsnittet säger vad som är beslutat, för den,
människa eller AI-agent, som för en del av det vidare; serverns sida står i Dataregiums README under samma rubrik.

### Beslutat

- **Modelleringen sker i appen, inte på servern.** Modelleringshjulet (skrivverktygen och IfcOpenShell i appens Python) är
  Dataspatiums eget, under Dataspatiums licens, och bär ingen kod ur IFC-LPG; servern når det bara genom API:erna.
- **AI:n föreslår, människan godkänner.** Ett ändringsset förhandsvisas i 3D, kontrolleras lokalt och av serverns förhandskontroll,
  och tillämpas först när du godkänner; radering bekräftas en gång till; publicering och förslag till servern är knappar, aldrig
  verktyg AI:n kan anropa. Byggt i 3.0.0.
- **Versionsmodellen.** Ett ändringsset skickas till servern som ett BCF-ärende med snippet i serverns form (GlobalId och sökväg
  som nyckel), servern prövar det mot basversionen och en *manager* godkänner det till nästa version; en publicering med inaktuell
  bas avvisas (412), och krockarna visas. Byggt i 3.0.0. Härnäst: trevägsmerge i appen vid krock, versionshistoriken per dokument
  och ett BCF-ärende per godkänt ändringsset.
- **Jämför versioner** med tre källor: ögonblicksbilder och andra modeller i appen, serverns ändringsset per version och serverns
  diff mellan versioner. Byggt i 3.0.0.
- **Projektets förvaltare** får en sida i appen när Dataregiums API för medlemmar och roller finns.
- **Steg 4 och 5, efter steg 3:** repoläge per projekt med en lokal Dataregium på den egna datorn och hämta och publicera mellan den
  lokala och den fjärran; stora modeller ritade från serverns geometri-API när webbläsaren inte räcker; projektprofiler med IDS och
  bSDD, IDS som AI:n skriver och buildingSMART-regler kopplade till element.
- **Öppna format** gäller utbytesformat och lagrade data, inte AI-API:er; AI-leverantör väljs av användaren med egen nyckel, lagrad
  krypterad, och projektets policy kan begränsa till lokala modeller.

## Fel och förslag

Rapportera fel eller önskemål som *Issues* här på GitHub. Beskriv webbläsare, version av Dataspatium (visas under
hjälpknappen) och vad du gjorde. Se [CONTRIBUTING.md](CONTRIBUTING.md). Bifoga inga personuppgifter och inga hemligheter. För en
säkerhetssårbarhet, följ [SECURITY.md](SECURITY.md) i stället för att öppna ett ärende.

## Utveckling

- Inget byggsteg, inget node.js. Öppna `index.html` direkt, eller serva mappen med `python -m http.server 8080`.
- Arkitektur i korthet: all egen kod är klassiska skript som registreras med `Dataspatium.define` i ordningen i `src/boot.js`; `src/platform` bär allt som är file://-specifikt (resurser, shims, workers, lagring, samtycke); motorerna SQLite, R (WebR) och Python (Pyodide) kör i workers; `src/ui` har designvariablerna, komponenterna (`dm-*`), skalet och ett läge per fil. Allt som renderas escapas, och inget hämtas från nätet utan din åtgärd och ditt samtycke.
- Tredjepartskomponenter: `python tools/fetch_vendor.py` följt av `python tools/wrap_assets.py`.
- Tester: `powershell -File tools/run-tests.ps1` eller `tools/run-tests.sh` (headless Edge och Firefox).
- Säkerhet: proven för samtycke, hemligheter, granskning före delning, OAuth2 (PKCE, state, återhopp) och loggens maskering ingår i sviten; se [docs/sv/sakerhet.md](docs/sv/sakerhet.md).

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
