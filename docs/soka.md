# Söka

Läget Söka hittar och listar utan kod. Det ligger mellan Hantera och Bearbeta: först hittar du det du letar
efter, sedan bearbetar du det. Tre flikar: *Sök* (fritext med fasetter), *Fråga* (en visuell frågebyggare över en
eller flera datamängder som visar den SQL den skapar) och *Listor* (sparade sökningar och frågor).

## Sök

Skriv ett ord eller en fras i sökfältet, välj om du söker i alla datamängder eller bara i den valda, och tryck på
Sök (eller Enter). Alla kolumner söks igenom, oavsett typ, och varje ord måste finnas någonstans på raden. Stora
och små bokstäver spelar ingen roll, inte heller för å, ä och ö. Tecken som annars har särskild betydelse i mönster
(punkt, parentes, stjärna) betyder här bara sig själva; för mönstersökning finns fliken Regex i Analysera.

Träffarna visas per datamängd med antal. Varje kort har:

- **Fasetter**: för kolumner med få olika värden bland träffarna visas de vanligaste värdena med antal. Klicka på
  ett värde för att avgränsa sökningen till det; de aktiva avgränsningarna visas som märkta knappar och tas bort med
  ett klick. Kolumner där varje träff har sitt eget värde (namn, identifierare) visas inte som fasetter, eftersom de
  inte avgränsar något.
- **En tabell** med de första hundra träffarna. Klicka på en rad för att se hela posten i inspektören till höger,
  med radnumret och knappen *Öppna i Bearbeta*.
- **Spara som lista** sparar sökningen (text och avgränsningar) för den datamängden under fliken Listor.
- **Spara som datamängd** gör träffarna till en ny datamängd med samma kolumner och typer.
- **Öppna i Bearbeta** väljer datamängden och byter läge.

Sökningen körs i SQLite i en worker, så sidan låser sig inte. I en datamängd med en miljon rader tar en sökning
någon sekund per ord.

**Öppna träffen** där den finns. Knappen i inspektören tar dig till rätt sida i ett dokument, rätt bild i en samling, noden med sina grannar i en graf, elementet i en modell, objektet på en plan, platsen på kartan eller raden i en tabell.

## Fråga

Fliken Fråga bygger en fråga utan att du skriver SQL och visar den SQL som skapas. Kortet **Datamängder** väljer
datamängden att fråga i och kopplar på fler med *Lägg till koppling*: välj datamängd, om bara rader med träff i båda
eller alla rader i den första ska med, och vilka kolumner som ska matcha (fler nycklar går att lägga till; de
kopplade datamängderna behöver kortnamn). **Kolumner** väljer vad som visas, som värde eller som beräkning (antal,
antal unika, summa, medelvärde, minsta, största) med valfritt namn i resultatet; finns en beräkning grupperas
raderna automatiskt på de övriga kolumnerna. **Villkor** läggs i grupper där alla villkor ska gälla eller något
räcker (är, är inte, är större än, är minst, är mindre än, är högst, innehåller, börjar med, är något av, är mellan,
är tomt, är inte tomt), och **Sortering och antal** avslutar. *Kör frågan* visar resultatet som tabell med den
genererade SQL:en under; *Öppna i Analysera* lägger SQL:en i SQL-konsolen, där den kan ändras vidare. I SQL:en heter
den första datamängden `t0` och de kopplade `t1`, `t2` och så vidare.

*Spara som lista* sparar frågan under Listor, där den körs igen på dagens data, och *Spara som datamängd* gör
resultatet till en ny datamängd med resultatets kolumner.

## Listor

En lista är en sparad sökning i en datamängd: texten, avgränsningarna och antalet träffar senast den kördes.
*Kör* visar dagens träffar i fliken Sök (datan kan ha ändrats sedan listan sparades), *Spara som datamängd* gör
träffarna till en ny datamängd och *Ta bort* tar bort listan. Listor följer datamängden: tas datamängden bort,
försvinner dess listor.

Listor används också på andra håll. I Bearbeta väljer *Lista* i tabellens verktygsrad en sparad sökning som
avgränsar tabellen (märket visar antal rader av totalen), och i diagrambyggaren väljer *Lista* under filtren vilka
rader ett diagram bygger på; valet följer med diagrammet i dashboards och exporter och körs om på dagens data.
Frågor som sparats från fliken Fråga visas med sin SQL i Listor och körs i Fråga.

## Kommandopaletten

Ctrl+K hittar objekt och kommandon som förut. Kommandot *Sök i data* öppnar Söka med sökfältet i fokus.

## Tangentbord

Enter i sökfältet söker. Fasetternas knappar och tabellens rader nås med Tabb; en rad öppnas i inspektören med
Enter.
