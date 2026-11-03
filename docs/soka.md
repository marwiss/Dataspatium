# Söka

Läget Söka hittar och listar utan kod. Det ligger mellan Hantera och Bearbeta: först hittar du det du letar
efter, sedan bearbetar du det. Två flikar finns från 2.0, Sök och Listor; fliken Fråga, en visuell frågebyggare
som visar den SQL den skapar, kommer i 2.2.

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

## Listor

En lista är en sparad sökning i en datamängd: texten, avgränsningarna och antalet träffar senast den kördes.
*Kör* visar dagens träffar i fliken Sök (datan kan ha ändrats sedan listan sparades), *Spara som datamängd* gör
träffarna till en ny datamängd och *Ta bort* tar bort listan. Listor följer datamängden: tas datamängden bort,
försvinner dess listor.

## Kommandopaletten

Ctrl+K hittar objekt och kommandon som förut. Kommandot *Sök i data* öppnar Söka med sökfältet i fokus.

## Tangentbord

Enter i sökfältet söker. Fasetternas knappar och tabellens rader nås med Tabb; en rad öppnas i inspektören med
Enter.
