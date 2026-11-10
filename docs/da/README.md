[Svenska](../../README.md) · **Dansk** · [Norsk bokmål](../nb/README.md) · [Norsk nynorsk](../nn/README.md) · [Suomi](../fi/README.md) · [Íslenska](../is/README.md) · [English](../en/README.md)

<img src="../../src/ui/design/icon-192.png" alt="" width="64" height="64" align="left">

# Dataspatium OpenCDE-klient

Dataspatium er en webapp til data fra kilde til rapport: hent data fra filer og åbne API'er, gem og håndter
datasæt, gennemgå og ret værdier, analysér med R, visualisér og eksportér. Alt kører i din egen browser. Ingen
server, ingen installation, ingen konti. Dine data forlader aldrig computeren, medmindre du selv eksporterer dem. Sikkerheden er det første krav: ingen netværkskald uden din handling og dit samtykke, hemmeligheder kun krypteret, komponenter fastlåst og kontrolleret, og alt, der deles, gennemgås først.

![Dataspatium i tilstanden Bearbejd med en tabel over svenske kommuner](../images/bearbeta.png)

**Indhold**

- [Download og kom i gang](#download-og-kom-i-gang)
- [Hvad der kræves](#hvad-der-kræves)
- [Hvad du kan](#hvad-du-kan)
- [OpenCDE-API'erne og deres klienter](#opencde-apierne-og-deres-klienter)
- [Dataspatium og Dataregium](#dataspatium-og-dataregium)
- [Lær mere](#lær-mere)
- [Begrænsninger i korte træk](#begrænsninger-i-korte-træk)
- [Personoplysninger](#personoplysninger)
- [Næste i 3-serien](#næste-i-3-serien)
- [Fejl og forslag](#fejl-og-forslag)
- [Udvikling](#udvikling)
- [Licens](#licens)

Brugerfladen findes på svensk, dansk, norsk (bokmål og nynorsk), finsk, islandsk og engelsk. Skærmbillederne i dokumentationen viser
appen på svensk.

## Download og kom i gang

1. **Download.** Gå til den [seneste udgivelse](https://github.com/marwiss/Dataspatium/releases/latest), og hent
   ZIP-filen under *Assets* (`dataspatium-<version>.zip`, omkring 100 MB; R og alle R-pakker er med).
2. **Pak ud.** Højreklik på ZIP-filen, og vælg *Udpak alle* (Windows), eller dobbeltklik på den (macOS). Læg mappen,
   hvor du vil have den, for eksempel i Dokumenter. Appen fungerer ikke direkte inde i ZIP-filen.
3. **Åbn.** Dobbeltklik på `index.html` i mappen, eller træk filen til et browservindue. Hvis Windows spørger, hvilken
   app der skal bruges, vælger du Edge, Chrome eller Firefox. Første gang spørger appen, hvilket sprog du vil have
   (det kan ændres med sprogknappen øverst til højre), og starter derefter **grundkurset**, en interaktiv gennemgang
   af alle tilstande med eksempeldata, som tager omkring ti minutter. Åbn det igen fra hjælpen (?).
4. **Importér.** I tilstanden *Hent* slipper du en fil på fladen (eller klikker på *Prøv med eksempeldata*),
   kontrollerer kolonnernes typer og klikker på *Importér*. Datasættet gemmes i browseren på din computer.
5. **Arbejd videre.** Skift tilstand øverst: *Håndter* viser dine datasæt og arbejdsområdet, *Søg* finder rækker i
   dem, *Bearbejd* viser tabellen med sortering, filtre og handlinger, *Analysér* åbner R- og SQL-konsollen,
   *Visualisér* bygger diagrammer, *Eksportér* downloader data, diagrammer og dokumenter, og *Del* giver dem til andre.

Data gemmes i browserens egen database. Rydder du webstedsdata, forsvinder de, så tag backup regelmæssigt under
*Håndter > Arbejdsområde*. Backuppen er en ZIP-fil, der kan gendannes på samme eller en anden computer. Trin for trin
med flere detaljer: [kom-igang.md](kom-igang.md).

Appen findes også direkte på nettet, uden download: <https://marwiss.github.io/Dataspatium/>. Fra en webserver kan
den installeres som en selvstændig app (Edge og Chrome: *Installér* i adresselinjen) og fungerer derefter også uden
netværk. Webversionen og mappeversionen har adskilte arbejdsområder; flyt data mellem dem med en backup eller en pakke.

## Hvad der kræves

- Windows, macOS eller Linux.
- Microsoft Edge eller Google Chrome (version 120 eller nyere) eller Firefox (version 128 eller nyere). Safari
  understøttes ikke.
- Omkring 300 MB ledig plads til appmappen og mindst 4 GB hukommelse (8 GB anbefales til store datasæt). Der kræves
  ingen administratorrettigheder.
- Internet kræves kun, når du henter data fra åbne API'er, sender til GitHub, søger efter opdateringer eller henter
  en komponent eller en R-pakke, der ikke følger med i mappen; appen spørger om lov først.

## Hvad du kan

Det, der virker i version 1, virker også i version 2, og det, der virker i version 2, virker også i version 3. Dataspatium og
Dataregium med samme hovednummer hører sammen.

### Version 1 (med Dataregium 1)

- **Hente**: filer i omkring fyrre formater, fra regneark og statistikfiler til geodata og tabeller i dokumenter, og data fra åbne
  API'er hos nordiske og europæiske myndigheder, med gemte hentninger (se [Åbne API'er](api-konfiguration.md)).
- **Bearbejde**: sortere, filtrere, rense, sætte typer, omkode, pivotere og koble, med regler for datakvalitet, pseudonymisering,
  fortryd, versioner og opskrifter (se [Bearbejd](bearbeta.md)).
- **Analysere**: R med ggplot2 og tidyverse, SQL, notesbøger, der bliver rapporter, og regulære udtryk, helt i browseren (se
  [R](r-guide.md)).
- **Planer**: svenske detaljplaner og översiktsplaner som plankort med Boverkets farver og betegnelser (se [Planer](planer.md)).
- **Visualisere og dokumentere**: diagrammer med Vega-Lite, D3 eller R, dashboards og rapporter fra skabeloner som HTML, Word, PDF,
  PowerPoint eller LaTeX (se [Visualisér](visualisera.md)).
- **Eksportere og dele**: data i omkring ti formater, pakker, kommentarer, backup, synkronisering med GitHub og en portabel mappe.
- **Dataregium som kilde**: dokumenter hentes som datasæt, og datasæt og filer sendes tilbage (Documents API).
- **Seks sprog og grundkursus**: svensk, dansk, norsk (bokmål), finsk, islandsk og engelsk, et interaktivt kursus gennem alle
  tilstande og kommandopaletten (Ctrl+K), der finder alt.

### Også i version 2 (med Dataregium 2)

- **Flere kilder**: databaser, åbne geodata og WMS, dokumenter og billeder som samlinger og tekst fra scannede sider (se
  [Kilder](kallor.md)).
- **Kort, planer og grafer**: kortvisninger med lag og geoværktøjer, planer fra hele Norden og grafer, der tegnes, forespørges med
  Cypher og redigeres (se [Kort](kartor.md) og [Grafer](grafer.md)).
- **CAD og BIM**: IFC-modeller i 3D med tabeller, egenskaber og mængder samt DXF-tegninger (se [CAD og BIM](cad-bim.md)).
- **Python og statistik uden kode**: en Python-konsol og formularer til statistik og tidsserier, der skriver koden for dig (se
  [Statistik](statistik.md)).
- **Søge og holde orden**: tilstanden *Søg* med facetter og gemte lister, forespørgsler uden kode, mapper, tags og batchhandlinger (se
  [Søg](soka.md)).
- **Del og Mobil**: tilstanden *Del* med pakker og udgivelse, gennemgang af personoplysninger før deling, overførsel med QR-kode og
  *Dataspatium Mobil* til at vise og indsamle i felten (se [Del](dela.md)).
- **Flows og arter**: gemte kæder, der køres med ét klik, overvågede kilder og tilstande, der genkender, hvad et datasæt er, og tilbyder
  de rette visninger og værktøjer (se [Tilstande](lagen.md)).
- **Dataregium med sager**: modeller og sager fra serveren, sager fra 3D-visningen, BCF-filer, serverens IFC-graf og administrationen
  (se [Dataspatium og Dataregium](#dataspatium-og-dataregium)).
- **Syv sprog**: også nynorsk, med håndbogen i appen og grundkurset gennem alle otte tilstande.

### Også i version 3 (med Dataregium 3)

- **Kontrol af modeller**: kortet *Valider modellen* med serverens og appens kontroller og kollisionskontrol med resultaterne som
  BCF-sager (se [CAD og BIM](cad-bim.md)).
- **AI-modellering**: *Spørg AI om modellen* og *Ændr med AI*, hvor AI'en foreslår, og du forhåndsviser i 3D og godkender; AI'en kan
  aldrig gemme eller publicere.
- **Versioner mod Dataregium**: publicering med basisversion, forhåndskontrol, ændringsforslag, som serveren afprøver og en manager
  godkender, og *Sammenlign versioner* markeret i 3D.
- **Mere**: serverens IFC-graf i skeletform, en lokal Dataregium på din egen computer og Sundsvalls WFS blandt geodatakilderne.

## OpenCDE-API'erne og deres klienter

OpenCDE er buildingSMART Internationals familie af åbne web-API'er for et fælles datamiljø, det sted, hvor et projekt deler sine
modeller, dokumenter og sager. En klient og en server, der følger de samme specifikationer, kan arbejde sammen, uanset hvem der har
bygget dem. Dataspatium bruger alle tre:

| API | Hvad appen gør med det | Specifikation |
|---|---|---|
| Foundation API 1.0 | Læser, hvilke API'er serveren tilbyder, hvor man logger ind, og hvem brugeren er; registrerer appen som klient, når serveren tillader det | [foundation-API](https://github.com/buildingSMART/foundation-API) |
| BCF API 3.0 og 2.1 | Læser og skriver sager om en model, med kommentarer og viewpoints (kamera, komponenter og billeder) fra 3D-visningen; vælger den nyeste version, serveren tilbyder | [BCF-API](https://github.com/buildingSMART/BCF-API) |
| Documents API 1.0 | Vælger og henter dokumenter og versioner via serverens egne sider, så en IFC-model bliver et datasæt, og uploader nye versioner, datasæt og pakker | [documents-API](https://github.com/buildingSMART/documents-API) |

**Dataregium er én server, ikke den eneste.** Appen skal kunne forbinde til enhver server, der følger specifikationerne: intet i
appen afhænger af Dataregium, og Dataregiums udvidelser uden for specifikationerne (kapabilitetsdokumentet, de navngivne
grafforespørgsler, forhåndskontrollen, basisversionen, ændringsforslagene og diffen mellem versioner) vises kun, når serveren selv
angiver dem. Appen behøver tre ting af en server:

- at serveren tillader kald fra browseren (CORS) fra appens adresse: `null`, når appen åbnes fra file://, `http://127.0.0.1:8080`
  fra en lokal webserver og `https://marwiss.github.io` fra nettet, med headerne Authorization, Content-Type og X-Request-ID;
- en klientregistrering, lavet af serverens administrator (en offentlig klient med omdirigeringsadressen
  `http://127.0.0.1:8080/oauth-callback.html` eller det tilsvarende for den adresse, appen serveres fra) eller af appen selv, når
  serveren tillader det, og login med OAuth2 authorization code med PKCE `S256`; fra file:// indsætter du den adresse, du lander på
  efter login;
- BCF API 3.0 eller 2.1; Documents API er valgfrit, men uden det kan appen ikke hente eller publicere dokumenter.

Indtil videre er det vist mod Dataregium: live-suiten køres mod serveren i begge versioner af BCF API, og en server med kun 2.1
virker. Andre servere er ikke afprøvet; fortæl, hvordan det gik, under [Fejl og forslag](#fejl-og-forslag). Når appen og en
specifikation ikke stemmer overens, afgør specifikationen. Serverens side beskrives i Dataregiums README og klientguide; appens i
[kallor.md](kallor.md).

## Dataspatium og Dataregium

*Dataregium hed Kontroll indtil 8. november 2026.*

Dataspatium (appen i browseren) og [Dataregium](https://github.com/marwiss/Dataregium) (en server til buildingSMARTs OpenCDE-API'er Foundation, BCF og
Documents) er udviklet til at fungere sammen som klient og server. Appen tilføjer serveren som kilde i Hent, logger ind med OAuth2 og
registrerer sig selv som klient, når serveren tillader det, henter projektets modeller og dokumenter, læser og skriver sager med
viewpoints fra 3D-visningen, sender datasæt, filer og arbejdsområdepakker tilbage gennem Documents API, spørger serverens IFC-graf
med Cypher og logger hvert kald med samme X-Request-Id, som serveren skriver i sin forespørgselslog. Forespørgslerne mod grafen og administrationen er tilføjelser uden for specifikationerne; alt andet går gennem de tre
OpenCDE-API'er, så andre OpenCDE-klienter fungerer også. Serveren er ikke nødvendig for resten af appen: uden server fungerer alt
andet som før. Dataregiums README og `docs/client-guide.md` beskriver samarbejdet fra
serverens side; her beskrives det i [kallor.md](kallor.md) og [cad-bim.md](cad-bim.md).

Appen taler BCF API 3.0 og 2.1, så den også forbinder til servere, der kun har 2.1, og den tegner og forespørger serverens IFC-graf direkte fra Hent.

Dataspatium 3.0.0 fungerer med Dataregium 3.0.0. Begge får samme udgavenummer, så samme nummer hører sammen. Den hurtige start
[snabbstart.md](snabbstart.md) tager parret fra ingenting til en sag på tyve minutter.

### Udgivelserne 1, 2 og 3

Der er én udgivelse pr. hovednummer, og Dataspatium og Dataregium med samme nummer hører sammen:

| Dataspatium | Hvad den har | Hører sammen med |
|---|---|---|
| 1.0.0 | Hele 1-serien: dataindhentning, bearbejdning, R, Python, kort, diagrammer, dokumenter og deling samt planer. Mod en server kun Documents API: hent dokumenter som datasæt, og send datasæt og filer tilbage. Ingen sager og ingen modeller | Dataregium 1.0.0 (kun Documents API) |
| 2.0.0 | Hele 2-serien: IFC-modeller i 3D med tabeller, egenskaber og mængder, sager med viewpoints (BCF API 3.0 og 2.1), serverens IFC-graf (IFC-LPG) tegnet og forespurgt, og planer fra planlægningsværktøjer fuldt ud | Dataregium 2.0.0 |
| 3.0.0 | 3-serien: kortet *Validér modellen*, kollisionskontrol i browseren, BCF-kameraer i modellens koordinater, grafen i skeletform, Spørg AI og Ændr med AI, Sammenlign versioner, publicering med basisversion og forhåndskontrol, ændringsforslag, der afprøves og godkendes på serveren | Dataregium 3.0.0 |

En ny udgivelse i samme hovednummer erstatter den forrige; kun den nyeste i hver serie rettes. Appens opdateringskontrol tilbyder
næste hovednummer, og datasæt, lister, diagrammer, skabeloner og scripts følger med, når du åbner den nye versions `index.html`.

## Lær mere

Filnavnene er de samme på alle sprog (de svenske originaler), så links virker ens overalt.

- **Håndbogen** i appen: den samme dokumentation som her, med søgning; åbn den med ? øverst til højre eller F1.
- **Grundkurset** i appen: en interaktiv gennemgang af alle tilstande med eksempeldata; åbn det fra hjælpen (?) eller
  med Ctrl+K.
- [Kom i gang](kom-igang.md): trin for trin med almindelige spørgsmål.
- [Hurtig start med Dataregium](snabbstart.md): tyve minutter fra ingenting til en sag oprettet i 3D-visningen og synlig på serveren.
- [Brugervejledning](anvandarguide.md): hele arbejdsgangen fra fil til rapport.
- [Ofte stillede spørgsmål](faq.md): lager, sikkerhed, R, API'er og opdateringer.
- [De otte tilstande](lagen.md): hvad der findes hvor og hvorfor.
- [Søg](soka.md) og [Del](dela.md): find uden kode, og giv data til andre.
- [Dataspatium Mobil](mobil.md): telefonen som kurer, modtager og fremviser; overførsel mellem enheder.
- [Notesbog](anteckningsbok.md): tekst, R og SQL i celler, der bliver til en rapport.
- [Dokumenter og billeder](dokument.md): PDF, Word, OpenDocument, Markdown og billeder som datasæt; dokumentvisning, galleri og værktøjerne Tekst og Billeder.
- [Kort](kartor.md): kortet i Bearbejd, kortvisninger i Visualisér, geoværktøjerne og QGIS-projekter.
- [Regulære udtryk](regex.md): mønstre til at analysere, rette og opdele tekst i datasæt.
- [Formater og import](format.md): filformater, tegnkodning, decimaltegn, datoer og kolonnetyper.
- [Åbne API'er](api-konfiguration.md): de forudindstillede kilder, nøgler og egne konfigurationer.
- [R i Dataspatium](r-guide.md): R-konsollen, `dm_read()`, `dm_write()` og de medfølgende pakker.
- [Python i Dataspatium](python.md): Python-konsollen, `dm_read()`, `dm_write()` og pakker, der hentes efter behov.
- [Visualisér](visualisera.md): diagrambyggeren, D3-skabeloner, R-diagrammer, kort og dashboards.
- [Dokumenter og skabeloner](dokumentmallar.md): skabelonsproget og outputformaterne.
- [Sikkerhed](sakerhet.md): trusselsmodel, kontrollerne og de test, der viser dem, personoplysninger og opbevaring, og hvordan en sårbarhed rapporteres.
- [Licenser](licenser.md): hvad du må med appen, og hvilke licenser tredjepartskomponenterne har.
- Hvordan bidrag modtages, står i [CONTRIBUTING.md](../../CONTRIBUTING.md) (svensk).

### Videre læsning

- [BCF API](https://github.com/buildingSMART/BCF-API), [Foundation API](https://github.com/buildingSMART/foundation-API) og [Documents API](https://github.com/buildingSMART/documents-API): specifikationerne, appen følger mod en server.
- [IFC](https://github.com/buildingSMART/IFC4.x-development): filformatet for bygningsmodeller, og [IDS](https://github.com/buildingSMART/IDS): kravspecifikationer, som modeller kontrolleres mod.
- Eksterne ressourcer: [WebR](https://docs.r-wasm.org/webr/latest/), [R for begyndere](https://www.r-project.org/),
  [Vega-Lite](https://vega.github.io/vega-lite/), [Danmarks Statistiks API](https://www.dst.dk/da/Statistik/brug-statistikken/muligheder-i-statistikbanken/api).

## Begrænsninger i korte træk

- Appen skal åbnes fra en udpakket mappe (file://) eller en almindelig webserver; den fungerer ikke direkte inde i en
  ZIP-fil.
- API'er uden CORS-understøttelse (for eksempel Energi Data Service) kan ikke kaldes direkte fra browseren.
- Et datasæt bør holde sig under et par millioner rækker; browserens hukommelse sætter grænsen.
- Når appen åbnes fra en mappe, kan R-kode ikke afbrydes midt i en beregning; brug *Genstart R*. Fra en webserver
  (localhost eller https) findes knappen *Afbryd*.
- Flere faner fungerer og holder hinanden orienteret, men redigér ikke samme datasæt i to faner samtidig: den, der
  gemmer sidst, vinder.
- Den portable mappe kræver Edge eller Chrome; Firefox mangler mappeadgang (File System Access). Backup som ZIP
  fungerer overalt.
- Hele appen er lavet til computere; på telefoner og tablets bruges Dataspatium Mobil
  (<https://marwiss.github.io/Dataspatium/m/>), der modtager, viser og sender videre. Safari understøttes ikke for
  hele appen. I smalle vinduer åbnes panelerne som ark over arbejdsfladen.
- De medfølgende eksempeldata og kortgrænser er svenske; selve appen fungerer med data fra hvor som helst.

## Personoplysninger

Dataspatium kører i din browser, og du er selv ansvarlig for de oplysninger, du lægger ind. Alt, appen gemmer (datasæt og deres
versioner, lister, diagrammer, dokumenter, notesbøger, kommentarer og indstillinger), ligger i browserens lager på din computer og
forlader den kun, når du eksporterer, deler eller publicerer; da gennemgås alt i sin helhed først, og personoplysninger kan beholdes,
pseudonymiseres eller fjernes i kopien. Til en Dataregium-server sendes dit login (tokens holdes i sessionen eller krypteret med din
adgangsfrase, aldrig i klartekst), de sager, kommentarer, forslag og filer, du opretter under dit navn på serveren, og et X-Request-ID
pr. kald; serverens egen behandling står i Dataregiums README. Til en AI-leverandør sendes kun det, du spørger om, og de svar,
værktøjerne henter fra modellen, efter samtykke til formålet AI, med din egen nøgle gemt krypteret; projektets politik kan begrænse
til lokale modeller. Kommentarer og pakker bærer det navn, du selv angiver. Kontrollerne og de prøver, der viser dem, står i
[sakerhet.md](sakerhet.md).

## Næste i 3-serien

3.0.0 er 3-seriens første udgivelse, lavet sammen med Dataregium 3.0.0: kontrollen af modeller, kollisionskontrollen, AI-trinnene og
versionssammenligningen, som [Hvad du kan](#hvad-du-kan) beskriver. Som hvert hovednummer har serien én udgivelse, der
udgives igen, når den vokser. Det, der følger, gør appen til den klient, der redigerer serverens model og viser dens versioner: AI'en
foreslår, mennesket gennemgår og godkender, serveren afprøver og sammenfletter. Dette afsnit siger, hvad der er besluttet, for den,
menneske eller AI-agent, der fører en del af det videre; serverens side står i Dataregiums README under samme overskrift.

### Besluttet

- **Modelleringen sker i appen, ikke på serveren.** Modelleringshjulet (skriveværktøjerne og IfcOpenShell i appens Python) er
  Dataspatiums eget, under Dataspatiums licens, og bærer ingen kode fra IFC-LPG; serveren når det kun gennem API'erne.
- **AI'en foreslår, mennesket godkender.** Et ændringssæt forhåndsvises i 3D, kontrolleres lokalt og af serverens forhåndskontrol og
  anvendes først, når du godkender; sletning bekræftes endnu en gang; publicering og forslag til serveren er knapper, aldrig
  værktøjer, AI'en kan kalde. Bygget i 3.0.0.
- **Versionsmodellen.** Et ændringssæt sendes til serveren som en BCF-sag med en snippet i serverens form (GlobalId og sti som
  nøgle), serveren afprøver det mod basisversionen, og en *manager* godkender det til næste version; en publicering med forældet
  basis afvises (412), og kollisionerne vises. Bygget i 3.0.0. Dernæst: trevejssammenfletning i appen ved kollision,
  versionshistorikken pr. dokument og en BCF-sag pr. godkendt ændringssæt.
- **Sammenlign versioner** fra tre kilder: øjebliksbilleder og andre modeller i appen, serverens ændringssæt pr. version og serverens
  diff mellem versioner. Bygget i 3.0.0.
- **Projektets forvalter** får en side i appen, når Dataregiums API for medlemmer og roller findes.
- **Trin 4 og 5, efter trin 3:** repo-tilstand pr. projekt med en lokal Dataregium på egen computer og hent og publicer mellem den
  lokale og den fjerne; store modeller tegnet fra serverens geometri-API, når browseren ikke rækker; projektprofiler med IDS og bSDD,
  IDS skrevet af AI'en og buildingSMART-regler knyttet til elementer.
- **Åbne formater** gælder udvekslingsformater og lagrede data, ikke AI-API'er; AI-leverandør vælges af brugeren med egen nøgle,
  gemt krypteret, og projektets politik kan begrænse til lokale modeller.

## Fejl og forslag

Rapportér fejl eller ønsker som *Issues* her på GitHub. Beskriv browser, version af Dataspatium (vises under
hjælpeknappen), og hvad du gjorde. Se [CONTRIBUTING.md](../../CONTRIBUTING.md). Vedlæg ingen personoplysninger og ingen hemmeligheder. For en
sikkerhedssårbarhed, følg [SECURITY.md](../../SECURITY.md) i stedet for at åbne et issue.

## Udvikling

- Intet byggetrin, ingen node.js. Åbn `index.html` direkte, eller servér mappen med `python -m http.server 8080`.
- Arkitektur kort fortalt: al egen kode er klassiske scripts, der registreres med `Dataspatium.define` i rækkefølgen i `src/boot.js`; `src/platform` bærer alt, der er specifikt for file:// (ressourcer, shims, workers, lagring, samtykke); motorerne SQLite, R (WebR) og Python (Pyodide) kører i workers; `src/ui` har designvariablerne, komponenterne (`dm-*`), skallen og én tilstand pr. fil. Alt, der renderes, escapes, og intet hentes fra nettet uden din handling og dit samtykke.
- Tredjepartskomponenter: `python tools/fetch_vendor.py` efterfulgt af `python tools/wrap_assets.py`.
- Test: `powershell -File tools/run-tests.ps1` eller `tools/run-tests.sh` (headless Edge og Firefox).
  (svensk).
- Sikkerhed: testene for samtykke, hemmeligheder, gennemgang før deling, OAuth2 (PKCE, state, tilbagekald) og loggens maskering indgår i suiten; se [sakerhet.md](sakerhet.md).

## Licens

Dataspatiums egen kode, dokumentation og forudindstillinger (alt undtagen `vendor/`) er licenseret under
[PolyForm Strict 1.0.0](../../LICENSE): fri at downloade og bruge til ikke-kommercielle formål, også i myndigheder og
andre offentlige institutioner, men ikke at ændre, bygge videre på eller videredistribuere uden skriftlig
tilladelse. Licensgiver er Dataspatiums ophavsperson, der kan kontaktes via GitHub-kontoen
[marwiss](https://github.com/marwiss); opret et issue for andre vilkår. Hvad licensen betyder i praksis, forklares i
[licenser.md](licenser.md).

Tredjepartskomponenter i `vendor/` har deres egne licenser (MIT, BSD, Apache-2.0, ISC, OFL, MPL, LGPL og GPL), se
[THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md). R og de GPL-licenserede R-pakker distribueres uændret;
kildekoden findes hos [R-projektet](https://cran.r-project.org/sources.html), [webR](https://github.com/r-wasm/webr)
og [CRAN](https://cran.r-project.org/) i de versioner, der angives der. Se [SECURITY.md](../../SECURITY.md) for, hvordan en sårbarhed rapporteres,
og hvad projektet gør for at forblive sikkert.
