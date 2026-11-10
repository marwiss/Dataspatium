[Svenska](../../README.md) · [Dansk](../da/README.md) · **Norsk bokmål** · [Norsk nynorsk](../nn/README.md) · [Suomi](../fi/README.md) · [Íslenska](../is/README.md) · [English](../en/README.md)

<img src="../../src/ui/design/icon-192.png" alt="" width="64" height="64" align="left">

# Dataspatium OpenCDE-klient

Dataspatium er en nettapp for data fra kilde til rapport: hent data fra filer og åpne API-er, lagre og håndter datasett,
gå gjennom og rett verdier, analyser med R, visualiser og eksporter. Alt kjører i din egen nettleser. Ingen server, ingen
installasjon, ingen kontoer. Dataene dine forlater aldri datamaskinen med mindre du selv eksporterer dem. Sikkerheten er det første kravet: ingen nettverkskall uten din handling og ditt samtykke, hemmeligheter bare kryptert, komponenter låst og kontrollert, og alt som deles, gjennomgås først.

![Dataspatium i modusen Bearbeid med en tabell over svenske kommuner](../images/bearbeta.png)

**Innhold**

- [Last ned og kom i gang](#last-ned-og-kom-i-gang)
- [Hva som kreves](#hva-som-kreves)
- [Hva du kan gjøre](#hva-du-kan-gjøre)
- [OpenCDE-API-ene og klientene deres](#opencde-api-ene-og-klientene-deres)
- [Dataspatium og Dataregium](#dataspatium-og-dataregium)
- [Lær mer](#lær-mer)
- [Begrensninger i korte trekk](#begrensninger-i-korte-trekk)
- [Personopplysninger](#personopplysninger)
- [Neste i 3-serien](#neste-i-3-serien)
- [Feil og forslag](#feil-og-forslag)
- [Utvikling](#utvikling)
- [Lisens](#lisens)

Brukergrensesnittet finnes på svensk, dansk, norsk (bokmål og nynorsk), finsk, islandsk og engelsk. Skjermbildene i dokumentasjonen viser
appen på svensk.

## Last ned og kom i gang

1. **Last ned.** Gå til den [siste utgivelsen](https://github.com/marwiss/Dataspatium/releases/latest), og hent ZIP-filen
   under *Assets* (`dataspatium-<versjon>.zip`, rundt 100 MB; R og alle R-pakker er med).
2. **Pakk ut.** Høyreklikk på ZIP-filen, og velg *Pakk ut alle* (Windows), eller dobbeltklikk på den (macOS). Legg mappen
   der du vil ha den, for eksempel i Dokumenter. Appen fungerer ikke direkte inne i ZIP-filen.
3. **Åpne.** Dobbeltklikk på `index.html` i mappen, eller dra filen til et nettleservindu. Hvis Windows spør hvilken app som
   skal brukes, velger du Edge, Chrome eller Firefox. Første gang spør appen hvilket språk du vil ha (det kan endres med
   språkknappen øverst til høyre), og starter deretter **grunnkurset**, en interaktiv gjennomgang av alle moduser med
   eksempeldata som tar omtrent ti minutter. Åpne det igjen fra hjelpen (?).
4. **Importer.** I modusen *Hent* slipper du en fil på flaten (eller klikker på *Prøv med eksempeldata*), kontrollerer
   kolonnetypene og klikker på *Importer*. Datasettet lagres i nettleseren på datamaskinen din.
5. **Arbeid videre.** Bytt modus øverst: *Håndter* viser datasettene dine og arbeidsområdet, *Søk* finner rader i dem,
   *Bearbeid* viser tabellen med sortering, filtre og handlinger, *Analyser* åpner R- og SQL-konsollen, *Visualiser*
   lager diagrammer, *Eksporter* laster ned data, diagrammer og dokumenter, og *Del* gir dem til andre.

Data lagres i nettleserens egen database. Sletter du nettstedsdata, forsvinner de, så ta sikkerhetskopi regelmessig under
*Håndter > Arbeidsområde*. Sikkerhetskopien er en ZIP-fil som kan gjenopprettes på samme eller en annen datamaskin. Trinn
for trinn med flere detaljer: [kom-igang.md](kom-igang.md).

Appen finnes også direkte på nettet, uten nedlasting: <https://marwiss.github.io/Dataspatium/>. Fra en nettserver kan
den installeres som egen app (Edge og Chrome: *Installer* i adressefeltet) og fungerer deretter også uten nettverk.
Nettversjonen og mappeversjonen har atskilte arbeidsområder; flytt data mellom dem med en sikkerhetskopi eller en pakke.

## Hva som kreves

- Windows, macOS eller Linux.
- Microsoft Edge eller Google Chrome (versjon 120 eller nyere) eller Firefox (versjon 128 eller nyere). Safari støttes ikke.
- Rundt 300 MB ledig plass til appmappen og minst 4 GB minne (8 GB anbefales for store datasett). Det kreves ingen
  administratorrettigheter.
- Internett trengs bare når du henter data fra åpne API-er, sender til GitHub, ser etter oppdateringer eller henter en
  komponent eller en R-pakke som ikke følger med i mappen; appen spør om lov først.

## Hva du kan gjøre

Det som virker i versjon 1, virker også i versjon 2, og det som virker i versjon 2, virker også i versjon 3. Dataspatium og
Dataregium med samme hovednummer hører sammen.

### Versjon 1 (med Dataregium 1)

- **Hente**: filer i rundt førti formater, fra regneark og statistikkfiler til geodata og tabeller i dokumenter, og data fra åpne
  API-er hos nordiske og europeiske myndigheter, med lagrede hentinger (se [Åpne API-er](api-konfiguration.md)).
- **Bearbeide**: sortere, filtrere, rense, sette typer, omkode, pivotere og koble, med regler for datakvalitet, pseudonymisering,
  angre, versjoner og oppskrifter (se [Bearbeid](bearbeta.md)).
- **Analysere**: R med ggplot2 og tidyverse, SQL, notatbøker som blir rapporter, og regulære uttrykk, helt i nettleseren (se
  [R](r-guide.md)).
- **Planer**: svenske detaljplaner og översiktsplaner som plankart med Boverkets farger og betegnelser (se [Planer](planer.md)).
- **Visualisere og dokumentere**: diagrammer med Vega-Lite, D3 eller R, dashbord og rapporter fra maler som HTML, Word, PDF,
  PowerPoint eller LaTeX (se [Visualiser](visualisera.md)).
- **Eksportere og dele**: data i rundt ti formater, pakker, kommentarer, sikkerhetskopi, synkronisering med GitHub og en portabel mappe.
- **Dataregium som kilde**: dokumenter hentes som datasett, og datasett og filer sendes tilbake (Documents API).
- **Seks språk og grunnkurs**: svensk, dansk, norsk (bokmål), finsk, islandsk og engelsk, et interaktivt kurs gjennom alle moduser og
  kommandopaletten (Ctrl+K) som finner alt.

### Også i versjon 2 (med Dataregium 2)

- **Flere kilder**: databaser, åpne geodata og WMS, dokumenter og bilder som samlinger, og tekst fra skannede sider (se
  [Kilder](kallor.md)).
- **Kart, planer og grafer**: kartvisninger med lag og geoverktøy, planer fra hele Norden, og grafer som tegnes, spørres med Cypher og
  redigeres (se [Kart](kartor.md) og [Grafer](grafer.md)).
- **CAD og BIM**: IFC-modeller i 3D med tabeller, egenskaper og mengder, og DXF-tegninger (se [CAD og BIM](cad-bim.md)).
- **Python og statistikk uten kode**: en Python-konsoll og skjemaer for statistikk og tidsserier som skriver koden for deg (se
  [Statistikk](statistik.md)).
- **Søke og holde orden**: modusen *Søk* med fasetter og lagrede lister, spørringer uten kode, mapper, tagger og batchhandlinger (se
  [Søk](soka.md)).
- **Del og Mobil**: modusen *Del* med pakker og publisering, gjennomgang av personopplysninger før deling, overføring med QR-kode og
  *Dataspatium Mobil* for å vise og samle inn i felt (se [Del](dela.md)).
- **Flyter og slag**: lagrede kjeder som kjøres med ett klikk, overvåkede kilder, og moduser som kjenner igjen hva et datasett er og
  tilbyr de riktige visningene og verktøyene (se [Moduser](lagen.md)).
- **Dataregium med saker**: modeller og saker fra serveren, saker fra 3D-visningen, BCF-filer, serverens IFC-graf og administrasjonen
  (se [Dataspatium og Dataregium](#dataspatium-og-dataregium)).
- **Sju språk**: også nynorsk, med håndboken i appen og grunnkurset gjennom alle åtte modusene.

### Også i versjon 3 (med Dataregium 3)

- **Kontroll av modeller**: kortet *Valider modellen* med serverens og appens kontroller, og kollisjonskontroll med resultatene som
  BCF-saker (se [CAD og BIM](cad-bim.md)).
- **AI-modellering**: *Spør AI om modellen* og *Endre med AI*, der AI-en foreslår, og du forhåndsviser i 3D og godkjenner; AI-en kan
  aldri lagre eller publisere.
- **Versjoner mot Dataregium**: publisering med basisversjon, forhåndskontroll, endringsforslag som serveren prøver og en manager
  godkjenner, og *Sammenlign versjoner* markert i 3D.
- **Mer**: serverens IFC-graf i skjelettform, en lokal Dataregium på din egen datamaskin og Sundsvalls WFS blant geodatakildene.

## OpenCDE-API-ene og klientene deres

OpenCDE er buildingSMART Internationals familie av åpne web-API-er for et felles datamiljø, stedet der et prosjekt deler modellene,
dokumentene og sakene sine. En klient og en server som følger de samme spesifikasjonene, kan arbeide sammen, uansett hvem som har
bygd dem. Dataspatium bruker alle tre:

| API | Hva appen gjør med det | Spesifikasjon |
|---|---|---|
| Foundation API 1.0 | Leser hvilke API-er serveren tilbyr, hvor man logger inn og hvem brukeren er; registrerer appen som klient når serveren tillater det | [foundation-API](https://github.com/buildingSMART/foundation-API) |
| BCF API 3.0 og 2.1 | Leser og skriver saker om en modell, med kommentarer og viewpoints (kamera, komponenter og bilder) fra 3D-visningen; velger den nyeste versjonen serveren tilbyr | [BCF-API](https://github.com/buildingSMART/BCF-API) |
| Documents API 1.0 | Velger og henter dokumenter og versjoner via serverens egne sider, slik at en IFC-modell blir et datasett, og laster opp nye versjoner, datasett og pakker | [documents-API](https://github.com/buildingSMART/documents-API) |

**Dataregium er én server, ikke den eneste.** Appen skal kunne koble til enhver server som følger spesifikasjonene: ingenting i
appen avhenger av Dataregium, og Dataregiums utvidelser utenfor spesifikasjonene (kapabilitetsdokumentet, de navngitte
grafspørringene, forhåndskontrollen, basisversjonen, endringsforslagene og diffen mellom versjoner) vises bare når serveren selv
angir dem. Appen trenger tre ting av en server:

- at serveren tillater kall fra nettleseren (CORS) fra appens adresse: `null` når appen åpnes fra file://, `http://127.0.0.1:8080`
  fra en lokal webserver og `https://marwiss.github.io` fra nettet, med headerne Authorization, Content-Type og X-Request-ID;
- en klientregistrering, gjort av serverens administrator (en offentlig klient med omdirigeringsadressen
  `http://127.0.0.1:8080/oauth-callback.html`, eller tilsvarende for adressen appen serveres fra) eller av appen selv når serveren
  tillater det, og innlogging med OAuth2 authorization code med PKCE `S256`; fra file:// limer du inn adressen du havner på etter
  innloggingen;
- BCF API 3.0 eller 2.1; Documents API er valgfritt, men uten det kan appen verken hente eller publisere dokumenter.

Så langt er det vist mot Dataregium: live-suiten kjøres mot serveren i begge versjonene av BCF API, og en server med bare 2.1
fungerer. Andre servere er ikke prøvd; fortell hvordan det gikk under [Feil og forslag](#feil-og-forslag). Når appen og en
spesifikasjon ikke stemmer overens, avgjør spesifikasjonen. Serverens side beskrives i Dataregiums README og klientguide; appens i
[kallor.md](kallor.md).

## Dataspatium og Dataregium

*Dataregium het Kontroll fram til 8. november 2026.*

Dataspatium (appen i nettleseren) og [Dataregium](https://github.com/marwiss/Dataregium) (en server for buildingSMARTs OpenCDE-API-er Foundation, BCF og
Documents) er utviklet for å fungere sammen som klient og server. Appen legger til serveren som kilde i Hent, logger inn med OAuth2 og
registrerer seg selv som klient når serveren tillater det, henter prosjektets modeller og dokumenter, leser og skriver saker med
viewpoints fra 3D-visningen, sender datasett, filer og arbeidsområdepakker tilbake gjennom Documents API, spør serverens IFC-graf med
Cypher og logger hvert kall med samme X-Request-Id som serveren skriver i sin forespørselslogg. Spørringene mot grafen og administrasjonen er tillegg utenfor spesifikasjonene; alt annet går gjennom de tre OpenCDE-API-ene, så
andre OpenCDE-klienter fungerer også. Serveren trengs ikke for resten av appen: uten server fungerer alt annet som før. Dataregiums README og `docs/client-guide.md` beskriver samarbeidet fra serverens side;
her beskrives det i [kallor.md](kallor.md) og [cad-bim.md](cad-bim.md).

Appen snakker BCF API 3.0 og 2.1, så den også kobler seg til servere som bare har 2.1, og den tegner og spør serverens IFC-graf direkte fra Hent.

Dataspatium 3.0.0 fungerer med Dataregium 3.0.0. Begge får samme utgavenummer, så samme nummer hører sammen. Hurtigstarten
[snabbstart.md](snabbstart.md) tar paret fra ingenting til en sak på tjue minutter.

### Utgivelsene 1, 2 og 3

Det finnes én utgivelse per hovednummer, og Dataspatium og Dataregium med samme nummer hører sammen:

| Dataspatium | Hva den har | Hører sammen med |
|---|---|---|
| 1.0.0 | Hele 1-serien: datainnhenting, bearbeiding, R, Python, kart, diagrammer, dokumenter og deling, samt planer. Mot en server bare Documents API: hent dokumenter som datasett, og send datasett og filer tilbake. Ingen saker og ingen modeller | Dataregium 1.0.0 (bare Documents API) |
| 2.0.0 | Hele 2-serien: IFC-modeller i 3D med tabeller, egenskaper og mengder, saker med viewpoints (BCF API 3.0 og 2.1), serverens IFC-graf (IFC-LPG) tegnet og spurt, og planer fra planleggingsverktøy fullt ut | Dataregium 2.0.0 |
| 3.0.0 | 3-serien: kortet *Valider modellen*, kollisjonskontroll i nettleseren, BCF-kameraer i modellens koordinater, grafen i skjelettform, Spør AI og Endre med AI, Sammenlign versjoner, publisering med basisversjon og forhåndskontroll, endringsforslag som prøves og godkjennes på serveren | Dataregium 3.0.0 |

En ny utgivelse i samme hovednummer erstatter den forrige; bare den nyeste i hver serie rettes. Appens oppdateringskontroll tilbyr
neste hovednummer, og datasett, lister, diagrammer, maler og skript følger med når du åpner den nye versjonens `index.html`.

## Lær mer

Filnavnene er de samme på alle språk (de svenske originalene), så lenkene virker likt overalt.

- **Håndboken** i appen: den samme dokumentasjonen som her, med søk; åpne den med ? øverst til høyre eller F1.
- **Grunnkurset** i appen: en interaktiv gjennomgang av alle moduser med eksempeldata; åpne det fra hjelpen (?) eller
  med Ctrl+K.
- [Kom i gang](kom-igang.md): trinn for trinn med vanlige spørsmål.
- [Hurtigstart med Dataregium](snabbstart.md): tjue minutter fra ingenting til en sak opprettet i 3D-visningen og synlig på serveren.
- [Brukerveiledning](anvandarguide.md): hele arbeidsflyten fra fil til rapport.
- [Vanlige spørsmål](faq.md): lagring, sikkerhet, R, API-er og oppdateringer.
- [De åtte modusene](lagen.md): hva som finnes hvor og hvorfor.
- [Søk](soka.md) og [Del](dela.md): finn uten kode, og gi data til andre.
- [Dataspatium Mobil](mobil.md): telefonen som kurer, mottaker og viser; overføring mellom enheter.
- [Notatbok](anteckningsbok.md): tekst, R og SQL i celler som blir en rapport.
- [Dokumenter og bilder](dokument.md): PDF, Word, OpenDocument, Markdown og bilder som datasett; dokumentvisning, galleri og verktøyene Tekst og Bilder.
- [Kart](kartor.md): kartet i Bearbeid, kartvisninger i Visualiser, geoverktøyene og QGIS-prosjekter.
- [Regulære uttrykk](regex.md): mønstre for å analysere, rette og dele opp tekst i datasett.
- [Formater og import](format.md): filformater, tegnkoding, desimaltegn, datoer og kolonnetyper.
- [Åpne API-er](api-konfiguration.md): de forhåndsinnstilte kildene, nøkler og egne konfigurasjoner.
- [R i Dataspatium](r-guide.md): R-konsollen, `dm_read()`, `dm_write()` og de medfølgende pakkene.
- [Python i Dataspatium](python.md): Python-konsollen, `dm_read()`, `dm_write()` og pakker som hentes ved behov.
- [Visualiser](visualisera.md): diagrambyggeren, D3-maler, R-diagrammer, kart og dashbord.
- [Dokumenter og maler](dokumentmallar.md): malspråket og utdataformatene.
- [Sikkerhet](sakerhet.md): trusselmodell, kontrollene og testene som viser dem, personopplysninger og lagring, og hvordan en sårbarhet rapporteres.
- [Lisenser](licenser.md): hva du kan gjøre med appen, og hvilke lisenser tredjepartskomponentene har.
- Hvordan bidrag tas imot, står i [CONTRIBUTING.md](../../CONTRIBUTING.md) (svensk).

### Videre lesning

- [BCF API](https://github.com/buildingSMART/BCF-API), [Foundation API](https://github.com/buildingSMART/foundation-API) og [Documents API](https://github.com/buildingSMART/documents-API): spesifikasjonene appen følger mot en server.
- [IFC](https://github.com/buildingSMART/IFC4.x-development): filformatet for bygningsmodeller, og [IDS](https://github.com/buildingSMART/IDS): kravspesifikasjoner som modeller kontrolleres mot.
- Eksterne ressurser: [WebR](https://docs.r-wasm.org/webr/latest/), [R for nybegynnere](https://www.r-project.org/),
  [Vega-Lite](https://vega.github.io/vega-lite/), [SSBs API](https://www.ssb.no/api).

## Begrensninger i korte trekk

- Appen må åpnes fra en utpakket mappe (file://) eller en vanlig nettserver; den fungerer ikke direkte inne i en ZIP-fil.
- API-er uten CORS-støtte (for eksempel data.norge.no) kan ikke kalles direkte fra nettleseren.
- Et datasett bør holde seg under et par millioner rader; nettleserens minne setter grensen.
- Når appen åpnes fra en mappe, kan R-kode ikke avbrytes midt i en beregning; bruk *Start R på nytt*. Fra en
  nettserver (localhost eller https) finnes knappen *Avbryt*.
- Flere faner fungerer og holder hverandre oppdatert, men ikke rediger samme datasett i to faner samtidig: den som lagrer
  sist, vinner.
- Den portable mappen krever Edge eller Chrome; Firefox mangler mappetilgang (File System Access). Sikkerhetskopi som ZIP
  fungerer overalt.
- Hele appen er laget for datamaskiner; på telefoner og nettbrett brukes Dataspatium Mobil
  (<https://marwiss.github.io/Dataspatium/m/>), som tar imot, viser og sender videre. Safari støttes ikke for hele
  appen. I smale vinduer åpnes panelene som ark over arbeidsflaten.
- De medfølgende eksempeldataene og kartgrensene er svenske; selve appen fungerer med data fra hvor som helst.

## Personopplysninger

Dataspatium kjører i nettleseren din, og du er selv ansvarlig for opplysningene du legger inn. Alt appen lagrer (datasett og
versjonene deres, lister, diagrammer, dokumenter, notatbøker, kommentarer og innstillinger) ligger i nettleserens lager på din
datamaskin og forlater den bare når du eksporterer, deler eller publiserer; da gjennomgås alt i sin helhet først, og personopplysninger
kan beholdes, pseudonymiseres eller fjernes i kopien. Til en Dataregium-server sendes innloggingen din (token holdes i økten eller
kryptert med passfrasen din, aldri i klartekst), sakene, kommentarene, forslagene og filene du oppretter under navnet ditt på
serveren, og en X-Request-ID per kall; serverens egen behandling står i Dataregiums README. Til en AI-leverandør sendes bare det du
spør om og svarene verktøyene henter fra modellen, etter samtykke til formålet AI, med din egen nøkkel lagret kryptert; prosjektets
policy kan begrense til lokale modeller. Kommentarer og pakker bærer navnet du selv oppgir. Kontrollene og prøvene som viser dem står
i [sakerhet.md](sakerhet.md).

## Neste i 3-serien

3.0.0 er 3-seriens første utgivelse, laget sammen med Dataregium 3.0.0: kontrollen av modeller, kollisjonskontrollen, AI-stegene og
versjonssammenligningen, som [Hva du kan gjøre](#hva-du-kan-gjøre) beskriver. Som hvert hovednummer har serien én utgivelse, som gis
ut igjen når den vokser. Det som følger, gjør appen til klienten som redigerer serverens modell og viser versjonene dens: AI-en
foreslår, mennesket gjennomgår og godkjenner, serveren prøver og sammenfletter. Dette avsnittet sier hva som er besluttet, for den,
menneske eller AI-agent, som fører en del av det videre; serverens side står i Dataregiums README under samme overskrift.

### Besluttet

- **Modelleringen skjer i appen, ikke på serveren.** Modelleringshjulet (skriveverktøyene og IfcOpenShell i appens Python) er
  Dataspatiums eget, under Dataspatiums lisens, og bærer ingen kode fra IFC-LPG; serveren når det bare gjennom API-ene.
- **AI-en foreslår, mennesket godkjenner.** Et endringssett forhåndsvises i 3D, kontrolleres lokalt og av serverens forhåndskontroll,
  og brukes først når du godkjenner; sletting bekreftes én gang til; publisering og forslag til serveren er knapper, aldri verktøy
  AI-en kan kalle. Bygd i 3.0.0.
- **Versjonsmodellen.** Et endringssett sendes til serveren som en BCF-sak med en snippet i serverens form (GlobalId og sti som
  nøkkel), serveren prøver det mot basisversjonen, og en *manager* godkjenner det til neste versjon; en publisering med utdatert basis
  avvises (412), og kollisjonene vises. Bygd i 3.0.0. Neste: treveis sammenfletting i appen ved kollisjon, versjonshistorikken per
  dokument og en BCF-sak per godkjent endringssett.
- **Sammenlign versjoner** fra tre kilder: øyeblikksbilder og andre modeller i appen, serverens endringssett per versjon og serverens
  diff mellom versjoner. Bygd i 3.0.0.
- **Prosjektets forvalter** får en side i appen når Dataregiums API for medlemmer og roller finnes.
- **Steg 4 og 5, etter steg 3:** repomodus per prosjekt med en lokal Dataregium på egen datamaskin og hent og publiser mellom den
  lokale og den fjerne; store modeller tegnet fra serverens geometri-API når nettleseren ikke strekker til; prosjektprofiler med IDS
  og bSDD, IDS skrevet av AI-en og buildingSMART-regler knyttet til elementer.
- **Åpne formater** gjelder utvekslingsformater og lagrede data, ikke AI-API-er; AI-leverandør velges av brukeren med egen nøkkel,
  lagret kryptert, og prosjektets policy kan begrense til lokale modeller.

## Feil og forslag

Rapporter feil eller ønsker som *Issues* her på GitHub. Beskriv nettleser, versjon av Dataspatium (vises under
hjelpeknappen) og hva du gjorde. Se [CONTRIBUTING.md](../../CONTRIBUTING.md). Legg ikke ved personopplysninger eller hemmeligheter. For en
sikkerhetssårbarhet, følg [SECURITY.md](../../SECURITY.md) i stedet for å åpne et issue.

## Utvikling

- Ingen byggetrinn, ingen node.js. Åpne `index.html` direkte, eller server mappen med `python -m http.server 8080`.
- Arkitektur i korte trekk: all egen kode er klassiske skript som registreres med `Dataspatium.define` i rekkefølgen i `src/boot.js`; `src/platform` bærer alt som er spesifikt for file:// (ressurser, shims, workers, lagring, samtykke); motorene SQLite, R (WebR) og Python (Pyodide) kjører i workers; `src/ui` har designvariablene, komponentene (`dm-*`), skallet og én modus per fil. Alt som rendres escapes, og ingenting hentes fra nettet uten din handling og ditt samtykke.
- Tredjepartskomponenter: `python tools/fetch_vendor.py` etterfulgt av `python tools/wrap_assets.py`.
- Tester: `powershell -File tools/run-tests.ps1` eller `tools/run-tests.sh` (headless Edge og Firefox).
- Sikkerhet: testene for samtykke, hemmeligheter, gjennomgang før deling, OAuth2 (PKCE, state, tilbakekall) og loggens maskering er med i suiten; se [sakerhet.md](sakerhet.md).

## Lisens

Dataspatiums egen kode, dokumentasjon og forhåndsinnstillinger (alt unntatt `vendor/`) er lisensiert under
[PolyForm Strict 1.0.0](../../LICENSE): fri å laste ned og bruke til ikke-kommersielle formål, også i offentlige etater og
andre offentlige institusjoner, men ikke å endre, bygge videre på eller distribuere videre uten skriftlig tillatelse.
Lisensgiver er Dataspatiums opphavsperson, som kan kontaktes via GitHub-kontoen [marwiss](https://github.com/marwiss); opprett
et issue for andre vilkår. Hva lisensen betyr i praksis, forklares i [licenser.md](licenser.md).

Tredjepartskomponenter i `vendor/` har egne lisenser (MIT, BSD, Apache-2.0, ISC, OFL, MPL, LGPL og GPL), se
[THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md). R og de GPL-lisensierte R-pakkene distribueres uendret; kildekoden
finnes hos [R-prosjektet](https://cran.r-project.org/sources.html), [webR](https://github.com/r-wasm/webr) og
[CRAN](https://cran.r-project.org/) i versjonene som er oppgitt der. Se [SECURITY.md](../../SECURITY.md) for hvordan en sårbarhet rapporteres,
og hva prosjektet gjør for å forbli sikkert.
