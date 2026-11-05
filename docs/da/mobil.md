# Dataspatium Mobil og overførsel mellem enheder

Dataspatium Mobil er en lille side til telefoner og tablets, der modtager, viser og sender data fra Dataspatium
videre. Den kører fra nettet (<https://marwiss.github.io/Dataspatium/m/> eller samme mappe som appen på en egen
webserver) og kan installeres som app. Hele Dataspatium kører ikke på telefonen: mobilsiden er en kurer, en
modtager, en fremviser og en videresender.

Overførslen går direkte mellem enhederne over det lokale netværk med WebRTC, uden server og uden at data passerer
internettet. Computeren viser en QR-kode, telefonen scanner den, og begge viser samme kontrolkode. Samme teknik
forbinder to computere med koder, der indsættes.

## Første gang: par telefonen

1. På computeren: åbn *Del → Enheder*, lad *Forbind til* stå på *Ny enhed*, og klik på *Vis QR-kode*.
2. På telefonen: åbn kameraet, og ret det mod QR-koden. Mobilsiden åbnes i browseren (første gang hentes den fra
   nettet; derefter ligger den i telefonens cache). Telefonen viser en kode på 52 tegn.
3. På computeren: skriv telefonens kode ind i feltet under QR-koden, og klik på *Forbind*. En computer med kamera
   vil i en kommende version kunne scanne telefonens QR-kode i stedet.
4. Begge enheder viser nu samme sekscifrede kontrolkode. Stemmer den: klik på *Par enheden* på computeren.
   Telefonen får besked og gemmer også parringen.

Næste gang er det nok at vælge telefonen under *Forbind til* på computeren, vise QR-koden og scanne: forbindelsen
oprettes uden nogen kode tilbage. Parringen består af telefonens certifikat og en hemmelighed, som enhederne deler;
den gemmes i browseren på begge sider og kan fjernes under *Parrede enheder* (computeren) eller ved at rydde
webstedsdata (telefonen).

## Send fra computeren

Under *Send* vælger du de valgte datasæt eller alle datasæt som pakke, eller filer fra computeren. Datasæt går
først gennem gennemgangen før deling (se [dela.md](dela.md)): kolonner, der ser ud til at indeholde
identitetsnumre, e-mail eller telefonnumre, kan pseudonymiseres eller fjernes i kopien. Telefonen spørger, før den
modtager, og viser kontrolkoden en gang til. Overførslen går i blokke med kontrolsum; afbrydes den, genoptages den
fra de blokke, der allerede er nået frem, når I forbinder igen.

## På telefonen

- **Modtaget** viser pakker og filer med antal datasæt, størrelse og afsender. En pakke åbnes med en liste over
  sine datasæt; et datasæt vises som tabel med filter og bladring, med første kolonne fast, når tabellen rulles
  sidelæns.
- **Del videre** sender pakken eller filen gennem telefonens delingsmenu (e-mail, beskeder, skylager).
- **Send til en computer** sætter pakken i kø: scan den anden computers QR-kode, så sendes den dertil, når
  forbindelsen er oppe. Sådan fungerer kurerflowet computer → telefon → computer, også mellem to netværk.
- Telefonen kan også sende egne filer (*Send filer fra telefonen*) til en forbundet computer; de importeres der
  som datasæt eller åbnes under *Modtag*, hvis det er en pakke.
- Apps på telefonen kan dele filer til Dataspatium Mobil gennem delingsmenuen, når mobilsiden er installeret som
  app; filerne havner under *Modtaget*.
- *Indstillinger* har telefonens navn (det, computeren viser), dens kode og sprog.

Et datasæt vises i sin egen form: billeder at bladre i, dokumenter at læse, steder som punkter, en grafs knuder med antal kanter, hvad en model består af, og en plans bestemmelser. Rækkerne ligger under *Rækkerne*.

## Computer til computer

Vælg *Anden computer (indsæt kode)* på den ene computer, og indsæt koden fra den anden computers *Vis
QR-kode*-visning (knappen *Kopiér* under QR-koden). Den første computer viser så en svarkode, der indsættes på den
anden under *Kode fra enheden*. Derefter fungerer alt som mellem computer og telefon, inklusive parring.

## Indsaml i felten

En formular fra computeren havner øverst på startsiden. Telefonen udfylder rækker uden net, med foto og position, og kontrollerer dem straks mod
formularen og datasættets regler. *Send til computeren* fører dem tilbage over samme forbindelse. Se [insamling.md](insamling.md).

## Krav og begrænsninger

- Enhederne skal kunne nå hinanden på netværket. På hjemmenetværk og de fleste kontornetværk fungerer det;
  netværk, der isolerer klienter fra hinanden (gæstenetværk, visse virksomhedsnetværk), stopper forbindelsen. Del
  så computerens eller telefonens eget netværk (internetdeling) midlertidigt.
- Computeren har brug for Edge, Chrome eller Firefox. Telefonen har brug for en browser med WebRTC og, til
  scanning, kamera; i Android Chrome aflæses QR-koder direkte på siden, i andre browsere åbnes koden via
  kameraappen eller indsættes.
- Telefonen skal nå nettet første gang for at hente mobilsiden; derefter fungerer den uden netværk bortset fra
  selve overførslen, som går lokalt.
- Ingen data sendes til nogen server. QR-koden indeholder computerens netværksadresse og en engangsnøgle;
  kontrolkoden beskytter mod, at en anden på netværket kobler sig på. Par kun enheder, hvis kontrolkode du har
  sammenlignet.
- En overførsel holdes i hukommelsen; meget store pakker (flere hundrede megabyte) kan være for store til en
  telefon.

## Fejlfinding

- *Venter på, at enheden forbinder* forsvinder ikke: enhederne er på forskellige netværk, eller netværket blokerer
  trafik mellem dem. Prøv internetdeling fra telefonen, og forbind computeren til den.
- *Modparten er ikke den enhed, som koden peger på*: koden, der blev skrevet ind, hører til en anden telefon. Skriv
  den ind igen.
- Kontrolkoderne er forskellige: afbryd. En anden kan have scannet koden.
- Loggen nederst på computeren viser hvert trin i forbindelsen.
