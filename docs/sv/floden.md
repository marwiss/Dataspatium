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
| Kör ett kommando | Kör ett av appens kommandon med argument som JSON; svaret är kommandots data |

Ett diagram eller dokument som bygger på en datamängd ritas med de data som finns när steget körs, så lägg dem efter de
steg som hämtar och bearbetar.

## Villkor, slingor och frågor

Ett flöde kan välja väg efter vad tidigare steg gav. Ge ett steg ett *Namn på svaret*, så når senare steg svaret som
`{{namn.fält}}` i argument, frågor och meddelanden och som `namn.fält` i villkor. *Kör ett kommando* kör ett av de kommandon
som AI:n i appen också använder, med argumenten som JSON. Heter steget `antal` och kör `run_sql` med
`{"dataset": "Befolkning", "sql": "select count(*) from data"}`, så är antalet `antal.rows[0][0]`.

Kommandona som bara läser är `list_datasets`, `describe_dataset`, `read_rows`, `column_stats`, `run_sql`, `list_operations`, `describe_operation`, `list_items`, `list_files`. De som ändrar eller gör filer är `apply_operation`, `undo`, `refresh_dataset`, `replay_recipe`, `run_script`, `list_to_dataset`, `render_chart`, `dashboard_html`, `generate_document`, `export_dataset`, `run_flow`, `run_r`, `run_python`. `run_sql` kör bara en sats som läser.

Fler kommandon (F42 b): `create_chart`, `create_map`, `add_map_layer`, `create_document` och `make_document` gör diagram, kartor och
dokument från grunden (dokumentet blir en fil som hämtas som andra); `list_cde_sources`, `cde_projects`, `cde_topics` och `cde_files` läser
från en OpenCDE-källa som är inloggad under Inhämta, och `cde_create_topic`, `cde_comment` och `cde_fetch_file` skriver ärenden,
kommentarer och hämtar filer efter godkännande. Grafer redigeras med `apply_operation` och åtgärderna `graph_add_node`,
`graph_set_node`, `graph_add_edge`, `graph_set_edge`, `graph_delete_nodes`, `graph_delete_edges` och `graph_merge_nodes`.

| Steg | Så fungerar det |
|---|---|
| Om ett villkor håller | Kör stegen under *Då* om villkoret håller, annars stegen under *Annars* |
| För varje värde i en lista | Kör stegen en gång för varje värde i ett tidigare svar, till exempel `kommuner.rows`; värdet nås som `{{item}}`, och ett tal n ger varven 1 till n; en datamängd i stället för listan ger en rad per varv, med kolumnerna som fält (`{{item.kommun}}`) |
| Upprepa tills ett villkor håller | Kör stegen och prövar villkoret efter varje varv, med en paus mellan varven; varvet nås som `{{round}}` |
| Fråga mig | Visar en fråga med svarsalternativ, ett per rad, och väntar på svaret, som nås som `{{namn.answer}}` |
| Avsluta flödet | Avslutar flödet med ett meddelande i loggen; det räknas inte som ett fel |

Ett villkor skrivs med jämförelserna `=`, `!=`, `<`, `<=`, `>`, `>=` och `contains`, orden `and`, `or` och `not`, parenteser, tal,
text inom citattecken och hänvisningar till svar, till exempel `antal.rows[0][0] > 0 and namn = 'Ale'`. Appen läser villkoret
själv och kör det aldrig som kod. Ett svar som saknas räknas som tomt, och ett villkor som inte går att läsa syns direkt i
redigeraren.

Båda slingorna har ett tak, *Högst antal varv* (förvalt 100, högst 1 000) och *Högst antal sekunder*, och den gräns som nås först
gäller. Slingans svar säger hur många varv den gick (`rounds`) och varför den slutade (`reason`: `done`, `until`, `rounds` eller
`time`), så att ett senare villkor kan välja efter det.

*Stoppa*, i flödesvyn och i statusraden, stoppar flödet före nästa steg och efter varje varv, och en pågående paus avbryts direkt.
Ett steg som redan har börjat körs klart. Loggen säger var flödet stoppades, till exempel *Stoppad av dig i varv 37 av 250*, och
det som hann göras kan ångras som vanligt.

## Köra ett flöde

*Kör* startar flödet. Statusraden visar vilket steg som körs, och loggen får en rad per steg. *Stoppa* stoppar flödet före
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
- Ett flöde som frågar dig (*Fråga mig*) körs aldrig vid start.

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
- Bara steg med ett namn ger svar som senare steg kan läsa: ett kommando ger sina data, en slinga `rounds` och `reason`, en fråga
  `answer`, och övriga steg sitt meddelande och sina filer.
- Uppdatering av flera datamängder i samma steg avbryts inte mitt i en hämtning.
