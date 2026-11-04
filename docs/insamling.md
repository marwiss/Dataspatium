# Insamling i fält

Med **Insamling i fält** fyller du i rader på telefonen, med eller utan nät, med foto och position. Formuläret bygger på en
datamängds kolumner och regler, så en felaktig rad syns direkt där du står. Raderna kommer sedan tillbaka till datorn som en ny
version av datamängden. Fotona blir en bildsamling och positionerna hamnar på kartan.

## Så går det till

1. I **Inhämta** väljer du *Insamling i fält*, och där en datamängd eller *Ny datamängd*.
2. Bestäm vilka fält telefonen ska fråga efter, och tryck på *Skicka till mobilen*.
3. Anslut telefonen under **Enheter** i Dela, och skicka formuläret. Telefonen behöver nät den här gången.
4. På telefonen öppnar du formuläret och samlar in rader. Nu behövs inget nät.
5. När du är tillbaka trycker du på *Skicka till datorn* och skannar datorns kod.
6. Datorn visar vad som kommit, och du väljer *Lägg till*.

## Formuläret

Varje kolumn blir ett fält. Du kan stänga av en kolumn, ändra etiketten och välja om fältet krävs. *Behåll till nästa rad* passar
för sådant som är lika på många rader, till exempel datum eller område.

Fältets typ kommer från kolumnen. Värdeetiketter och regeln *tillåtna värden* blir en vallista av sig själva. Du kan också skriva
val själv, ett per rad som `värde` eller `kod = text`, eller hämta dem ur kolumnen med *Hämta val ur kolumnen*.

Position och foton kan vara avstängda, valfria eller krävas. Foton förminskas på telefonen så att längsta sidan blir 2048
bildpunkter, om du inte väljer något annat under *Fler alternativ*.

*Ny datamängd* tar en kolumn per rad, som `plats` eller `antal: heltal`.

Innan formuläret lämnar datorn visar appen vad som följer med. Det är fält, etiketter, val och regler, aldrig rader.

## Reglerna

Telefonen kontrollerar reglerna med samma SQLite som datorn, så en rad bedöms lika på båda ställena.

- **Kontrolleras på telefonen:** intervall, tillåtna och förbjudna värden, mönster, format, längd, personnummer och andra
  identiteter, jämförelser mellan kolumner och fria SQL-villkor som bara använder formulärets kolumner.
- **Unika värden** jämförs bara med raderna på telefonen. Datorn kontrollerar mot hela datamängden.
- **Kontrolleras bara på datorn:** fullständighet, värden i en annan datamängd och regler om kolumner som inte är med i formuläret.

Ett fel i formuläret, som ett tomt krävt fält eller en bokstav i ett talfält, hindrar att raden sparas. En bruten regel hindrar
den en gång. Trycker du på Spara igen behålls raden, med regeln noterad, eftersom du som står på platsen kan veta bättre än regeln.

## På telefonen

Formuläret ligger överst på startsidan i Dataspatium Mobil. *Spara och ny rad* är den vanliga vägen vidare.

En rad du håller på med sparas som utkast från första ändringen, och foton lagras så fort de är tagna. Telefoner stänger ibland sidan när
kameran öppnas. Då erbjuder formuläret *Fortsätt på utkastet* när du kommer tillbaka.

Telefonen visar *Fungerar utan nät på den här telefonen* när den har allt den behöver. Står det i stället att sidan ska öppnas en gång till, gör
det medan du har nät. Installera gärna sidan på hemskärmen. Webbläsare kan annars rensa lagringen för sidor som inte används, och på
iPhone kan det ske efter en vecka utan användning.

Rader finns kvar på telefonen tills du väljer *Rensa skickade*. En skickad rad kan inte ändras på telefonen, utan ändras på datorn.

Saknar du anslutning till datorn kan du använda *Dela som fil* och skicka filen på annat sätt. Den tas emot under **Ta emot** i Dela.

## På datorn

Raderna kommer via Enheter eller Ta emot, och du ser dem innan något läggs till.

- Tabellen sparas först som en version, så att du kan gå tillbaka.
- Kolumner som saknas läggs till: `falt_id`, `lat`, `lon`, `noggrannhet_m`, `foto`, `insamlad` och `insamlad_av`. Har datamängden redan
  kolumner för longitud och latitud används de.
- Datamängden öppnas som karta i Bearbeta, eftersom raderna har positioner.
- Fotona blir bildsamlingen *Namn: foton*, med radens position och tid. Senare leveranser hamnar i samma samling.
- Datamängdens regler körs på resultatet, och loggen säger hur många som bryts.

Rader känns igen på `falt_id`. Samma fil kan därför tas emot två gånger utan att något dubbleras, men en rad som ändrats på datorn
skrivs inte över.

Finns datamängden inte längre på datorn föreslås en ny med formulärets kolumner.

## Personuppgifter

Position och foton är ofta personuppgifter, och ett foto kan visa människor. Fråga bara efter det som behövs, och stäng av position och foton annars.

Telefonen frågar om lov innan den lämnar ut positionen, och själva positionen skickas ingenstans förrän du skickar raderna. Rader och foton ligger
okrypterade i webbläsarens lagring på telefonen, så skicka dem och rensa regelbundet.

## Begränsningar

- Dataspatium Mobil körs från en webbadress, inte från en fil, och behöver nät första gången.
- Noggrannheten i en position beror på telefonen. Fältet `noggrannhet_m` säger hur säker den är.
- Stora insamlingar delas upp i flera filer, som tas emot var för sig.
- Flera telefoner kan samla in med samma formulär. Varje telefon har sina egna rader, och de läggs till var för sig.
