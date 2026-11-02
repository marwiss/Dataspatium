# Vanliga frågor

## Var lagras mina data?

I webbläsarens egen databas (IndexedDB) på den dator och i den webbläsarprofil du använder. Ingenting skickas
någonstans. Rensar du webbplatsdata, byter profil eller avinstallerar webbläsaren försvinner datan. Ta därför
säkerhetskopior under *Hantera → Arbetsyta*, eller använd en portabel mapp i Edge och Chrome så att arbetsytan
även ligger som vanliga filer på disk (se [kom-igang.md](kom-igang.md)).

## Behöver jag internet?

Nej. Internet behövs bara när du hämtar data från ett API eller klickar på *Sök efter uppdatering*. Allt annat,
även R, fungerar utan nätverk.

## Varför tar det tid första gången jag använder R?

R laddas som WebAssembly (ungefär 50 MB) och startar på några sekunder. Paket som ggplot2 installeras i
R-sessionen när du använder dem första gången, vilket tar ytterligare några sekunder. R-sessionen börjar om när du
laddar om sidan, men dina datamängder och skript finns kvar.

## Kan jag avbryta R-kod som fastnat?

Nej. Under file:// tillåter webbläsaren inte den mekanism som krävs för att avbryta R mitt i en beräkning.
Använd *Starta om R* i Analysera; datamängderna påverkas inte.

## Varför fungerar inte ett API?

Oftast saknar API:et CORS-stöd, det vill säga webbläsaren får inte läsa svaret. Då kan Dataspatium bara nå det
via en proxy som du själv driver (inställning under Inhämta). Vissa API:er kräver dessutom en nyckel, till exempel
Boverket och Lantmäteriet Direkt. Se [api-konfiguration.md](api-konfiguration.md), som också beskriver hur du
skaffar nycklar.

## Hur sparas API-nycklar?

Antingen bara i minnet under sessionen eller krypterade med en lösenfras du väljer. Aldrig i klartext, och de följer
aldrig med när du delar en konfiguration.

## Hur stora datamängder klarar appen?

Ett par miljoner rader i Edge och Chrome, något mindre i Firefox; minnet i webbläsaren sätter gränsen. Uppmätta
tider för en miljon rader finns i [utveckling.md](utveckling.md).

## Vad skiljer Firefox från Edge och Chrome?

Utseende och funktioner är desamma, men Firefox saknar mappåtkomst, så den portabla mappen finns inte där.
Säkerhetskopia som ZIP fungerar överallt.

## Kan appen köras från en webbserver eller ett intranät?

Ja. Lägg mappen oförändrad på valfri statisk webbserver. Inga serverfunktioner behövs.

## Kan jag öppna index.html direkt i ZIP-filen?

Nej. Packa upp ZIP-filen först (högerklicka och välj *Extrahera alla* i Windows) och öppna sedan `index.html` i
den uppackade mappen.

## Hur uppdaterar jag?

Ladda ned den nya versionen och packa upp den i en ny mapp. Dina data ligger i webbläsaren, inte i mappen, så de
finns kvar när du öppnar den nya versionens `index.html` på samma dator och i samma webbläsare. Under hjälpknappen
finns *Sök efter uppdatering*, som jämför din version med den senaste utgåvan på GitHub. Kontrollen görs bara när
du klickar.

## Kan en annan lokal HTML-fil läsa mina data?

I Edge och Chrome delar alla filer som öppnas via file:// samma lagringsutrymme. Öppna därför inte okända
HTML-filer lokalt medan du har känsliga data i appen. Nycklar lagras aldrig i klartext. Firefox håller lokala
filer isär.

## Får jag använda appen på jobbet?

Ja, om arbetsgivaren är en myndighet, kommun, region, skola, ett lärosäte eller en ideell organisation, det vill
säga icke-kommersiell användning. Kommersiell användning kräver tillstånd från licensgivaren. Se
[licenser.md](licenser.md).

## Kan jag ta bort personnummer innan jag delar en datamängd?

Ja. Åtgärden *Pseudonymisera* i Bearbeta ersätter identifierare med saltade hashvärden, maskerade värden eller
löpnummer, och datakvalitetsprofilen föreslår den när en kolumn ser ut att innehålla personnummer. Det är
pseudonymisering, inte anonymisering: andra kolumner kan fortfarande peka ut personer, så gå igenom hela
datamängden innan du delar den. Se [bearbeta.md](bearbeta.md).

## Hur delar jag data med en kollega?

Exportera datamängden som SQLite (behåller typer, etiketter och historik) eller ta en säkerhetskopia av hela
arbetsytan som kollegan återställer under *Hantera → Arbetsyta*. Diagram och dokumentmallar kan exporteras som
JSON-filer, API-konfigurationer som `.api.json`, och recept som JSON, R eller SQL.

## Hittar jag inte svaret här?

Läs [anvandarguide.md](anvandarguide.md) eller öppna ett ärende på GitHub (se [CONTRIBUTING.md](../CONTRIBUTING.md)).
