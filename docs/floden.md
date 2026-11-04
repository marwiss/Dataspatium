# Flöden och bevakningar

Ett **flöde** är en sparad kedja av steg som körs med ett klick eller när appen startar: hämta nya data, bearbeta, rita
diagram, skriv dokument och exportera. Det är månadsrapporten på en knapp. En **bevakning** håller reda på om källan till
en datamängd har ändrats och säger till i statusraden. Båda finns under *Flöden och bevakningar* i objektpanelen i Hantera.

## Skapa ett flöde

Tryck på *Nytt flöde*, ge det ett namn och lägg till steg. Stegen körs uppifrån och ned, och du flyttar dem med pilarna.

| Steg | Vad det gör |
|---|---|
| Hämta nya data | Läser källan igen och spelar upp datamängdens recept, för en datamängd eller alla hämtade |
| Spela upp ett recept | Gör samma bearbetning på en annan datamängd |
| Kör ett R- eller Python-skript | Kör ett sparat skript från Analysera; det som skrivs med `dm_write` blir datamängder |
| Spara en lista som datamängd | Kör en sparad lista eller fråga från Söka; nästa körning uppdaterar samma datamängd, så diagram på den fortsätter fungera |
| Exportera ett diagram | Ritar ett sparat diagram som PNG, SVG eller PDF; med en grupperingskolumn ett diagram per värde |
| Exportera en dashboard | Skriver dashboarden som en fristående HTML-fil |
| Skapa ett dokument | Fyller en dokumentmall; med en grupperingskolumn ett dokument per värde |
| Exportera en datamängd | Skriver datamängden som fil |

Ett diagram eller dokument som bygger på en datamängd ritas med de data som finns när steget körs, så lägg dem efter de
steg som hämtar och bearbetar.

## Köra ett flöde

*Kör* startar flödet. Statusraden visar vilket steg som körs, och loggen får en rad per steg. *Avbryt* stoppar flödet före
nästa steg. Ett flöde stannar vid första felet, om du inte har slagit på *Fortsätt med nästa steg efter ett fel*. Då räknas
körningen ändå som misslyckad. Inspektören visar den senaste körningen steg för steg, med felet där det uppstod.

Filerna från en körning ligger kvar tills du hämtar dem med *Hämta resultatet* eller stänger appen. En fil kommer som den
är, och flera blir en ZIP-fil.

Ett flöde skickar aldrig något ur appen. Det du vill dela med andra går genom läget Dela, där personuppgifter granskas först.

## Köra vid start

Med *Kör när appen startar* körs flödet strax efter att appen öppnats. Det körs bara om det inte behöver fråga något:

- Steg som hämtar från nätet kräver att samtycket redan är givet.
- Steg som läser genom databasbryggan körs inte vid start, eftersom bryggan kopplas upp för hand.
- Python-skript kräver att Python redan är hämtat.

Annars hoppas flödet över och loggen säger varför. Inget körs när appen är stängd.

## Bevaka en källa

Bevakning gäller datamängder som hämtats från ett API eller en databas, och länkade filer. Slå på den med *Bevaka källan*
på datamängdens sida i Hantera, eller på fliken *Bevakningar*.

*Kontrollera nu* läser alla bevakade källor. Appen jämför raderna med hur de såg ut senast datamängden uppdaterades. Kommer
samma rader i en annan ordning är det inga nyheter. Har något ändrats visar statusraden *Nya data*, och fliken talar om hur
många rader källan har nu, hur många som är nya eller ändrade, och vilka kolumner som tillkommit eller försvunnit.

En ändrad rad räknas både som ny och som borta, eftersom appen inte vet vilka kolumner som identifierar en rad.

Datamängden ändras inte förrän du trycker på *Uppdatera*. Då hämtas de nya uppgifterna och receptet spelas upp, och
bevakningen jämför därefter med den nya versionen. Det gäller också när du uppdaterar på annat sätt, till exempel i ett flöde.

Med *Kontrollera när appen startar* görs kontrollen vid start, men bara för källor du redan gett samtycke till. Länkade
filer kontrolleras då bara om webbläsaren fortfarande har kvar din tillåtelse, annars står det *Inte kontrollerad*.

## Säkerhetskopior

Flöden följer med i säkerhetskopior och den portabla mappen, men inte i paket till andra, eftersom de pekar på datamängder i
din arbetsyta. Ett flöde ur en säkerhetskopia startar aldrig av sig självt förrän du har slagit på det igen.

## Begränsningar

- Kontrollen hämtar hela svaret från källan. Stora källor tar lika lång tid som en vanlig hämtning.
- Bara ett flöde körs åt gången.
- Ett steg kan inte använda resultatet av ett annat utöver det som hamnar i datamängderna.
- Uppdatering av flera datamängder i samma steg avbryts inte mitt i en hämtning.
