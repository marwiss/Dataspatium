# Dataspatium Mobil och överföring mellan enheter

Dataspatium Mobil är en liten sida för telefoner och surfplattor som tar emot, visar och skickar vidare data från
Dataspatium. Den körs från webben (<https://marwiss.github.io/Dataspatium/m/> eller samma mapp som appen på en egen
webbserver) och kan installeras som app. Hela Dataspatium körs inte på telefonen: mobilsidan är en kurir, en
mottagare, en visare och en vidaredelare.

Överföringen går direkt mellan enheterna över det lokala nätverket med WebRTC, utan server och utan att data
passerar internet. Datorn visar en QR-kod, telefonen skannar den, och båda visar samma kontrollkod. Samma teknik
kopplar ihop två datorer med koder som klistras in.

## Första gången: para telefonen

1. På datorn: öppna *Dela → Enheter*, låt *Anslut till* stå på *Ny enhet* och klicka på *Visa QR-kod*.
2. På telefonen: öppna kameran och rikta den mot QR-koden. Mobilsidan öppnas i webbläsaren (första gången hämtas
   den från webben; sedan ligger den i telefonens cache). Telefonen visar en kod på 52 tecken.
3. På datorn: skriv in telefonens kod i fältet under QR-koden och klicka på *Anslut*. Har datorn kamera kan den i
   stället skanna telefonens QR-kod i en kommande version.
4. Båda enheterna visar nu samma sexsiffriga kontrollkod. Stämmer den: klicka på *Para enheten* på datorn.
   Telefonen får veta det och sparar parningen också.

Nästa gång räcker det att välja telefonen under *Anslut till* på datorn, visa QR-koden och skanna: anslutningen
sker utan någon kod tillbaka. Parningen består av telefonens certifikat och en hemlighet som enheterna delar; den
sparas i webbläsaren på båda sidor och kan tas bort under *Parade enheter* (datorn) eller genom att rensa
webbplatsdata (telefonen).

## Skicka från datorn

Under *Skicka* väljer du valda datamängder eller alla datamängder som paket, eller filer från datorn. Datamängder
går först genom granskningen före delning (se [dela.md](dela.md)): kolumner som ser ut att innehålla
identitetsnummer, e-post eller telefonnummer kan pseudonymiseras eller tas bort i kopian. Telefonen frågar innan
den tar emot och visar kontrollkoden en gång till. Överföringen går i block med kontrollsumma; bryts den återupptas
den från de block som redan kommit fram när ni ansluter igen.

## På telefonen

- **Mottaget** listar paket och filer med antal datamängder, storlek och avsändare. Ett paket öppnas med en lista
  över sina datamängder; en datamängd visas som tabell med filter och bläddring, med första kolumnen fast när
  tabellen rullas i sidled.
- **Dela vidare** skickar paketet eller filen genom telefonens delningsmeny (e-post, meddelanden, molnlagring).
- **Skicka till en dator** lägger paketet i kö: skanna den andra datorns QR-kod, så skickas det dit när
  anslutningen är uppe. Så fungerar kurirflödet dator → telefon → dator, även mellan två nätverk.
- Telefonen kan också skicka egna filer (*Skicka filer från telefonen*) till en ansluten dator; de importeras där
  som datamängder, eller öppnas under *Ta emot* om det är ett paket.
- Appar på telefonen kan dela filer till Dataspatium Mobil genom delningsmenyn när mobilsidan är installerad
  som app; filerna hamnar under *Mottaget*.
- *Inställningar* har telefonens namn (det datorn visar), dess kod och språk.

## Dator till dator

Välj *Annan dator (klistra in kod)* på den ena datorn och klistra in koden från den andra datorns *Visa
QR-kod*-vy (knappen *Kopiera* under QR-koden). Den första datorn visar då en svarskod som klistras in på den andra
under *Kod från enheten*. Därefter fungerar allt som mellan dator och telefon, inklusive parning.

## Samla in i fält

Ett formulär från datorn hamnar överst på startsidan. Telefonen fyller i rader utan nät, med foto och position, och kontrollerar dem direkt mot
formuläret och datamängdens regler. *Skicka till datorn* för dem tillbaka över samma anslutning. Se [insamling.md](insamling.md).

## Krav och begränsningar

- Enheterna måste nå varandra på nätverket. På hemmanätverk och de flesta kontorsnätverk fungerar det; nätverk
  som isolerar klienter från varandra (gästnätverk, vissa företagsnätverk) stoppar anslutningen. Dela då ut
  datorns eller telefonens eget nätverk (surfdelning) tillfälligt.
- Datorn behöver Edge, Chrome eller Firefox. Telefonen behöver en webbläsare med WebRTC och, för skanning,
  kamera; i Android Chrome avläses QR-koder direkt i sidan, i andra webbläsare öppnas koden via kameraappen eller
  klistras in.
- Telefonen behöver nå webben första gången för att hämta mobilsidan; sedan fungerar den utan nätverk utom
  själva överföringen, som går lokalt.
- Inga data skickas till någon server. QR-koden innehåller datorns nätverksadress och en engångsnyckel;
  kontrollkoden skyddar mot att någon annan på nätverket kopplar in sig. Para bara enheter vars kontrollkod du har
  jämfört.
- En överföring håller sig i minnet; mycket stora paket (flera hundra megabyte) kan vara för stora för en
  telefon.

## Felsökning

- *Väntar på att enheten ansluter* försvinner inte: enheterna är på olika nätverk, eller nätverket blockerar
  trafik mellan dem. Prova surfdelning från telefonen och anslut datorn till den.
- *Motparten är inte den enhet som koden pekar på*: koden som skrevs in hör till en annan telefon. Skriv in den
  igen.
- Kontrollkoderna skiljer sig: koppla från. Någon annan kan ha skannat koden.
- Loggen längst ned på datorn visar varje steg i anslutningen.
