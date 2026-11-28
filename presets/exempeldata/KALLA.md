# Exempeldata

Exemplen i Inhämta under *Exempeldata*. Översiktsplanen, detaljplanen och huset ligger på samma plats: huset står i
detaljplanens bostadsområde, och planområdet ligger i Lomma kommun, som översiktsplanen omfattar, och i dess
utbyggnadsområde för bostäder i Björreds vångar. Allt utom tabellen byggs av `python -I tools/build_examples.py <mapp>`,
som hämtar källorna till en egen mapp utanför repot, läser dem och skriver filerna här; sedan `python -I tools/wrap_local.py`.

| Fil | Vad | Källa | Licens | Verklig eller exempel |
|---|---|---|---|---|
| `befolkning-kommuner-2024.csv` | Folkmängd 31 december 2024 och landareal 1 januari 2025 per kommun | SCB, Statistikdatabasen (BE0101N1, MI0802) | CC0 | Verklig |
| `lomma-op-2020.geojson` | Översiktsplan 2020 för Lomma kommun, Plankarta 2030, i utbytesformatet Översiktsplan 2.0 | Lomma kommun, öppna data; kommungränsen från SCB | CC0 | Verklig, bearbetad |
| `lomma-dp-bjorreds-vangar.geojson` | Detaljplan för del av Björred 9:1 m.fl. (Björreds vångar etapp I) i Detaljplan 4.1 | Lomma kommun, öppna data (pågående detaljplaner) | CC0 | Planområdet verkligt, bestämmelserna ett exempel |
| `bjorreds-vangar-hus.ifc` | Ett litet enbostadshus i IFC4, placerat på en tomt i detaljplanen | buildingSMART International, Sample-Test-Files | CC BY 4.0 | Verklig exempelmodell, bearbetad |
| `fardigstallda-lagenheter-2024.json` | Färdigställda lägenheter i nybyggda hus 2024 per kommun och hustyp, SCB:s svar i JSON-stat 2.0 | SCB, Statistikdatabasen (BO0101) | CC0 | Verklig |
| `kommungrannar.cypher` | Kommunerna och vilka som gränsar till varandra, som Cypher-skript för Neo4j | Uträknat ur SCB:s Digitala gränser (`presets/geo/kommuner.geojson`) | CC0 | Uträknad |

Kartlagret bland exemplen är *Kommungränser (SCB)* i `presets/geo/` (se `presets/geo/KALLA.md`).

## SCB

Statistikdatabasen, https://www.statistikdatabasen.scb.se/, via API:t https://api.scb.se/OV0104/v1/doris/sv/ssd/:
tabellen BE0101N1 (folkmängden, som tabellen hade sedan tidigare), `MI/MI0802/Areal2025` (landareal i kvadratkilometer,
arealtyp 01, år 2025) och `BO/BO0101/BO0101A/LghReHustypAr` (färdigställda lägenheter, BO0101A5, år 2024). SCB: "Vi
använder licensen CC0 för dessa data". JSON-filen är SCB:s svar som det är, utan svarets kontaktuppgift.

## Lomma kommun

Lomma kommuns öppna data (https://catalog.lomma.se/, även på dataportal.se), båda under CC0 1.0 enligt katalogen:

- *Översiktsplan 2020 – Plankarta 2030* (https://catalog.lomma.se/store/1/resource/159), GeoPackage i SWEREF 99 13 30,
  hämtad från https://catalog.lomma.se/store/1/resource/164 den 28 november 2026 (SHA-256 `eae62e88fabe9fedff587f211e5725217931866a156c7e49bf767c2735188b53`).
- *Pågående detaljplaner i Lomma kommun* (https://catalog.lomma.se/store/1/resource/198), GeoPackage i WGS 84, hämtad från
  https://catalog.lomma.se/store/1/resource/201 samma dag (SHA-256 `60692fc82925a40d20256d68bc12a1fbdab1d1c75129993d845b868f21244906`).

Bearbetning av översiktsplanen: Lommas 23 lager har förts in i kategorier i Boverkets ÖP-katalog 2.3 (till exempel
*Utbyggnadsområde bostäder* som Mark- och vattenanvändning, Bostadsbebyggelse; *Ekologisk korridor* som Utvecklingsinriktning,
Grön- och blåstruktur; *Översvämningsområde* som Klimatrelaterade risker, Risk för översvämning). Placeringen i katalogen
är exemplets, inte kommunens. Delar med samma text är sammanslagna till ett objekt, linjerna förenklade till en meter,
lägen utanför kommunen (ett fel i källan) borttagna, och kommungränsen ur SCB:s Digitala gränser (CC0, förenklad) är planens
geometri. Antagandets datum står inte i källan och har lämnats tomt.

Bearbetning av detaljplanen: planområdet, namnet, syftet, diarienumret (SBN 2022:388.214) och samrådet i december 2022 är
kommunens. Användningarna B (bostäder), GATA och NATUR och egenskapsbestämmelserna (högsta nockhöjd 9 meter, största
byggnadsarea 250 m² per fastighet och prickmark mot gatan) är ett exempel som Dataspatium har ritat inne i planområdet
med bestämmelser ur Boverkets planbestämmelsekatalog (`presets/plan/`); de är inte kommunens planförslag.

## buildingSMART

*Building-Architecture.ifc* ur Sample-Test-Files (https://github.com/buildingSMART/Sample-Test-Files), mappen
`IFC 4.0.2.1 (IFC 4 ADD2 TC1)/Simple-Scene`, commit `8832bddc04d8597d69e6a414e5f67a65e8b3b626` (SHA-256
`8790a1e193e82b8e7e7f337ec2633cd40f2120590317a1443503a25b079e2e80`). Licens: CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/). Källangivelse: "© buildingSMART International Ltd.".

Ändringar av Dataspatium: filen heter `bjorreds-vangar-hus.ifc`; personen i ägarhistoriken är ersatt med appens neutrala
användare (inget namn); `IfcProjectedCRS` är SWEREF 99 13 30 + RH 2000 (EPSG:3008) och `IfcMapConversion` placerar modellen
utan vridning på en tomt i detaljplanens bostadsområde, som appens `set_site` skriver det; platsernas latitud, longitud och
höjd och byggnadens höjd är satta. Höjden, 10 meter över havet, är ungefärlig. Geometrin är oförändrad.

## Kommungrannar

Två kommuner är grannar när deras ytor i `presets/geo/kommuner.geojson` delar minst en sträcka av gränsen; att bara mötas
i en punkt räcker inte. Gränsens längd är summan av de gemensamma sträckorna i kilometer. Gränserna är förenklade för
tematiska kartor och följer land, så kommuner som bara består av öar (Ekerö, Gotland, Lidingö, Tjörn och Öckerö) får
inga grannar, och grannar som bara möts över vatten saknas. Skriptet följer APOC:s exportform (`UNIQUE IMPORT ID` är
kommunkoden) och går att köra i Neo4j.
