# Vinna og SQL-stjórnborðið

Hamurinn Vinna er allt sem gert er við töfluna með hnöppum og gluggum: leiðrétta reiti, hreinsa texta, breyta gerðum, reikna
nýja dálka, snúa og tengja gagnasöfn. Hver aðgerð er skráð sem skref í uppskrift gagnasafnsins, má afturkalla og má keyra aftur
á annað gagnasafn. SQL-stjórnborðið í hamnum Greina vinnur á sama gagnasafn og skráir breytingar á sama hátt.

## Taflan

- Tvísmelltu á reit, eða veldu röð og ýttu á Enter eða F2 til að breyta. Enter vistar, Esc hættir við, Tab fer í næsta reit.
  Gildið er túlkað eftir gerð dálksins: ef þú skrifar texta í töludálk færðu villuboð og reiturinn heldur gildi sínu. Tómur
  texti verður vantandi gildi.
- Örvalyklarnir færa valið, Page Up/Page Down fletta, Home/End hoppa í fyrstu eða síðustu röð.
- Smelltu á dálkafyrirsögn til að raða (vaxandi, minnkandi, óraðað). Eiginleikaspjaldið til hægri sýnir þá dálkatölfræði
  (fjöldi, vantar, ólík gildi, lægst, hæst, meðaltal, summa, algengustu gildi) og þær aðgerðir sem henta gerð dálksins.
  Shift-smellur sýnir tölfræðina án þess að breyta röðuninni.
- Síureiturinn leitar í öllum dálkum. Breytingar virka líka í síuðu úrvali.
- *Listi* í tækjastikunni (birtist þegar gagnasafnið á vistaðar leitir úr Leita) afmarkar töfluna við raðir
  listans; merkið sýnir fjölda af heildinni. Breytingar og aðgerðir virka eins og venjulega.
- Taflan er sýndarvædd: aðeins sýnilegu raðirnar eru í DOM vafrans, afgangurinn er í SQLite. Milljón röðum er flett jafn hratt
  og hundrað.

## Aðgerðir

Hnappurinn **Aðgerðir** opnar spjaldið. Hver aðgerð hefur glugga með reitum sem myndaðir eru úr breytum aðgerðarinnar, og þar
sem því verður við komið sýnir forskoðun hversu margar raðir verða fyrir áhrifum og dæmi fyrir og eftir.

| Hópur | Aðgerð | Hvað hún gerir |
|---|---|---|
| Dálkar | Endurnefna dálk | Nýtt dálkheiti; merkimiðinn fylgir ef hann var sá sami og heitið |
| | Merkimiði, lýsing og eining | Merkimiðinn er birtingarheitið í töflufyrirsögnum og myndritum; lýsing og eining birtast í eiginleikaspjaldinu og kóðabókinni, fylgja SQLite-skránni og ná til R sem eigindirnar `description` og `unit` |
| | Gildismerkimiðar | Heiti á kóðum dálksins, einn í hverri línu `kóði = merkimiði` (til dæmis `1 = Karl`); gildunum er ekki breytt. Merkimiðarnir birtast í eiginleikaspjaldinu (líka við algengustu gildin) og kóðabókinni, ná til R sem `haven::labelled` og eru skrifaðir í .sav og .dta. Auður texti fjarlægir þá |
| | Eyða dálkum | Fjarlægir valda dálka |
| | Endurraða dálkum | Færa dálka upp og niður |
| | Breyta gerð | Texti í heiltölu, tugabrot, dagsetningu, dagsetningu og tíma eða já/nei. Tilgreina má tugabrotstákn og dagsetningarsnið; gildi sem ekki er hægt að túlka verða tóm og fjöldi þeirra er tilkynntur |
| | Afrita dálk | Afrit með nýju heiti, til dæmis áður en upprunalega dálknum er breytt |
| | Snyrta dálkaheiti | Öll heiti verða lágstafir, tölustafir og undirstrik (`Folkmängd 2024` verður `folkmangd_2024`) sem auðvelt er að skrifa í SQL og R; merkimiðarnir halda upprunalegu heitunum |
| Gildi | Finna og skipta út | Texti eða regluleg segð í völdum textadálkum, með forskoðun |
| | Fjarlægja bil | Bil fremst og aftast og (valfrjálst) tvöföld bil |
| | Breyta há- og lágstöfum | HÁSTAFIR, lágstafir eða Stór Upphafsstafur |
| | Lagfæra stafakóðun | Lagfærir brenglaða stafi (Ã¶ verður ö) sem urðu til við innflutning með rangri kóðun |
| | Skipta út gildi | Einu nákvæmu gildi fyrir annað; tómt gildi má velja sem frá eða til |
| | Endurkóða gildi | Mörg gildi í einu eftir lista með einni línu fyrir hvert gildi, `gamalt = nýtt` (til dæmis `01 = Stockholms län`); önnur gildi haldast eða eru tæmd |
| | Skipta kóðum út fyrir merkimiða | Skiptir kóðum dálksins út fyrir gildismerkimiða þeirra, eða til baka. Merkimiðarnir eru vistaðir, svo .sav og .dta fá kóðana aftur við útflutning; gildi án merkimiða haldast óbreytt, og til baka í kóða verður dálkurinn tölur ef allir kóðar eru tölur |
| | Fylla í vantandi gildi | Fast gildi, gildi fyrri eða næstu raðar, meðaltal, miðgildi eða algengasta gildi |
| | Námunda tölur | Í valinn fjölda aukastafa: að næsta (helmingur námundast frá núlli), niður, upp eða með því að sleppa aukastöfunum; neikvæður fjöldi námundar að tugum (−1), hundruðum (−2) og svo framvegis |
| | Fylla með núllum í upphafi | Upp í tiltekna lengd, til dæmis sveitarfélagsnúmerið 114 í 0114; tölur verða texti svo að núllin haldist |
| | Fjarlægja tákn | Halda aðeins tölustöfum (síma- og fyrirtækjanúmer), halda aðeins bókstöfum og bilum, fjarlægja greinarmerki og tákn eða fjarlægja öll bil |
| Raðir | Eyða röðum | SQL-skilyrði, til dæmis `befolkning < 1000`; veldu Halda til að halda þess í stað aðeins röðum sem passa |
| | Fjarlægja tvítök | Á völdum dálkum eða allri röðinni; fyrsta tilvikinu er haldið |
| | Fjarlægja auðar raðir og dálka | Raðir þar sem öll gildi vantar og, ef þú vilt, dálka sem eru alveg án gilda |
| | Raða röðum | Breytir röð raðanna varanlega, hækkandi eða lækkandi eftir einum dálki, svo að útflutningur og skjöl fái sömu röð; tóm gildi koma síðast |
| | Halda efstu röðunum | Raðirnar með hæsta eða lægsta gildið, alls eða eftir hópum (til dæmis þrjú stærstu sveitarfélögin í hverjum landshluta) |
| | Slembiúrtak | Fjöldi raða eða hlutfall í prósentum; sama fræ gefur alltaf sama úrtak svo að hægt er að keyra uppskriftina aftur |
| Uppbygging | Nýr reiknaður dálkur | SQL-segð, til dæmis `round(befolkning / 1000.0, 1)` eða `case when andel > 5 then 'stor' else 'liten' end` |
| | Sameina dálka | Marga dálka í einn textadálk með aðgreini |
| | Skipta dálki | Einn textadálk í marga við aðgreini |
| | Taka hluta úr texta | Nýr dálkur með tilteknum fjölda stafa, talið frá upphafi eða enda textans, frá valinni stöðu (sænski lénskóðinn er fyrstu tveir stafirnir í sveitarfélagsnúmerinu) |
| | Snúa í langt snið | Valdir dálkar verða raðir með heiti og gildi |
| | Snúa í breitt snið | Gildin í heitisdálki verða nýir dálkar |
| | SQL-setning | Hvaða UPDATE, DELETE eða ALTER TABLE sem er á töfluna `data` |
| Útreikningar | Hlutfall af summu | Hlutfall hvers gildis af summunni í prósentum eða sem hlutfallstala, alls eða eftir hópum (hlutur sveitarfélagsins í íbúafjölda landshlutans) |
| | Raða í sæti | Sæti í röðinni, hæsta eða lægsta fyrst, alls eða eftir hópum; jöfn gildi fá sama sæti (með eða án bils á eftir) eða samfelld sæti |
| | Uppsöfnuð summa | Uppsafnaða summan í þeirri röð sem annar dálkur segir til um, alls eða eftir hópum |
| | Breyting frá fyrri | Mismunurinn eða prósentubreytingin frá fyrri röð í þeirri röð sem annar dálkur segir til um, til dæmis frá fyrra ári eftir sveitarfélögum |
| | Skipta í flokka | Tölur í flokka með eigin neðri mörkum (`0, 18, 65` gefur `0–17`, `18–64` og `65–`), tiltekinn fjölda jafnbreiðra flokka eða hópa með jafnmörgum röðum (hlutfallsmörk) |
| | Staðla | z-gildi (fjarlægð frá meðaltali í staðalfrávikum, staðalfrávik úrtaks) eða gildin kvörðuð á bilið 0–1 |
| | Taka hluta úr dagsetningu | Ár, ársfjórðung, mánuð, ISO-viku, vikudag (1 = mánudagur), dag, dag ársins, ár og mánuð (`2024-03`) eða klukkustund úr dagsetningu |
| | Tími milli dagsetninga | Fjöldi heilla daga, vikna, mánaða eða ára milli tveggja dagsetninga, til dæmis aldur; án lokadagsetningar er talið til dagsins í dag þegar skrefið er keyrt |
| Reglulegar segðir | Sía með mynstri | Heldur eða fjarlægir raðir eftir því hvort dálkur passar við reglulega segð |
| | Draga út með mynstri | Nýir dálkar úr hópum mynstursins eða allri samsvöruninni, til dæmis ártalið úr texta |
| | Merkja samsvaranir | Já/nei-dálkur sem sýnir hvort gildið passar |
| | Telja samsvaranir | Dálkur með fjölda samsvarana í hverju gildi |
| | Skipta upp með mynstri | Skiptir dálki í marga þar sem mynstrið passar; síðasti hlutinn fær afganginn af textanum |
| Ný gagnasöfn | Hópa og taka saman | Summa, meðaltal, lægst, hæst, fjöldi, fjöldi ólíkra eða miðgildi fyrir hvern hóp, í nýtt gagnasafn |
| | Tengja gagnasöfn | Vinstri eða innri tenging við annað gagnasafn á lykli |
| | Skeyta gagnasöfnum saman | Staflar röðum úr mörgum gagnasöfnum; dálkar eru paraðir eftir heiti |
| | Hreinsa flokka | Finnur rittilbrigði af sama gildi (há-/lágstafir, bil, broddstafir) og sameinar þau |

Aðgerðir sem búa til nýtt gagnasafn láta frumgögnin óhreyfð og velja nýja gagnasafnið þegar því er lokið.
Útreikningarnir bæta við nýjum dálki og láta þá sem fyrir eru óhreyfða; þeir byggja á gluggaföllum SQL og eru fluttir
út í R sem dplyr-kóði með `group_by()` og `mutate()`.
Aðgerðirnar með reglulegum segðum er auðveldast að prófa í Regex-flipanum í Greina, þar sem samsvaranirnar sjást
meðan mynstrið er skrifað; þar eru líka mynsturasafnið og mynsturyfirlitið (sjá [regex.md](regex.md)). Sama
JavaScript-málskipan gildir í *Finna og skipta út*, þar sem `(?i)` fremst í mynstrinu eða valið *Hunsa há- og
lágstafi* gerir leitina óháða há- og lágstöfum.

## Afturkalla

Hnappurinn **Afturkalla** tekur síðasta skrefið til baka, allt að tíu skref aftur í sömu setu. Breytingar á reitum eru
afturkallaðar með því að skrifa gamla gildið til baka; aðrar aðgerðir með því að endurheimta skyndimynd af gagnasafninu. Fyrir
mjög stór gagnasöfn tekur skyndimyndin dálitla stund og að hámarki 80 MB af skyndimyndum eru geymd í minni. Afturköllun eftir
endurhleðslu síðunnar gerirðu með útgáfum.

## Gagnagæði

Hnappurinn **Gagnagæði** greinir gagnasafnið: fjölda raða og tvítaka og fyrir hvern dálk vantandi gildi, ólík gildi, bil og
athugasemdir. Athugasemdirnar benda á aðgerð sem lagfærir þær með einum smelli:

- bil fremst eða aftast, tvöföld bil: Fjarlægja bil
- tómir textar sem ekki eru vantandi gildi: Skipta út gildi (tómt í vantandi)
- tölur eða dagsetningar geymdar sem texti: Breyta gerð
- líkleg kóðunarskemmd: Lagfæra stafakóðun
- gildi sem eru aðeins ólík í há- og lágstöfum: Breyta há- og lágstöfum
- gildi sem líta út eins og kennitölur: Dulnefna
- dálkur með sama gildi í öllum röðum (upplýsing)

## Reglur

Hnappurinn **Reglur** opnar gæðareglur gagnasafnsins: hvað þarf að gilda til að gögnin séu rétt. Gerðir reglna eru:

| Gerð reglu | Brotin af |
|---|---|
| Má ekki vanta | Vantandi gildum |
| Einkvæmt | Gildum (eða samsetningum margra dálka) sem koma oftar en einu sinni fyrir |
| Innan bils | Tölum, dagsetningum eða texta utan markanna |
| Í lista | Gildum sem eru ekki í listanum |
| Engin bönnuð gildi | Gildum sem eru í listanum, til dæmis `óþekkt` eða `-99` |
| Passar við mynstur | Texta sem passar ekki við reglulegu segðina |
| Ákveðið snið | Texta sem er ekki netfang, veffang, ISO-dagsetning, póstnúmer (sænskt, danskt, norskt, finnskt eða íslenskt) eða sænskur sveitarfélags- eða lénskóði |
| Textalengd | Texta sem er styttri eða lengri en mörkin |
| Engin óþörf bil | Texta með bilum fremst eða aftast, eða tvöföldum bilum |
| Hægt að lesa sem gerð | Texta sem ekki er hægt að lesa sem heiltölu, tugabrot, dagsetningu, dagsetningu og tíma eða já/nei |
| Gilt auðkennisnúmer | Númerum á röngu formi, með ógilda dagsetningu eða ranga vartölu, sjá hér á eftir |
| Bera saman tvo dálka | Röðum þar sem skilyrðið milli tveggja dálka gildir ekki, til dæmis að upphafsdagsetning sé minni en eða jöfn lokadagsetningu |
| Er í öðru gagnasafni | Gildum sem vantar í dálk í öðru gagnasafni (tilvísunarheilleiki, eins og ytri lykill) |
| Hlutfall útfylltra gilda | Dálkinum í heild, þegar hlutfall útfylltra gilda er lægra en þröskuldurinn (til dæmis 95 %) |
| Engin frávik | Tölum sem eru lengra frá fjórðungsmörkunum en valinn fjöldi fjórðungsbila (sjálfgefið 1,5) eða lengra frá meðaltalinu en valinn fjöldi staðalfrávika (sjálfgefið 3) |
| SQL-skilyrði | Röðum þar sem frjálsa SQL-skilyrðið er ekki satt |

Auðkennisnúmerin eru athuguð svona: sænskt personnummer og samordningsnummer (10 eða 12 tölustafir, gild dagsetning,
dagur plús 60 fyrir samordningsnummer, vartala samkvæmt Luhn), sænskt organisationsnummer (þriðji tölustafurinn að
minnsta kosti 2, Luhn), norskt fødselsnummer og D-númer (báðar vartölurnar samkvæmt modulus 11), danskt CPR-númer
(gild dagsetning; modulus 11 er ekki athugað þar sem það hefur ekki gilt um öll númer síðan 2007), finnskt
henkilötunnus (aldarmerki og vartákn) og íslensk kennitala (vartala samkvæmt modulus 11, gild dagsetning,
aldartölustafur). Athugunin segir aðeins að númerið geti verið til, ekki að það tilheyri einhverjum.

**Leggja til reglur** bætir við reglum úr gagnagæðasniðinu: dálkum án vantandi gilda, einkvæmum dálkum og kóðum með
fasta lengd. Dálkar með kennitala, personnummer, CPR, fødselsnummer eða henkilötunnus í heitinu fá reglu fyrir þá
tegund auðkennisnúmers sem að minnsta kosti helmingur gildanna stenst, dálkar með póstnúmer í heitinu reglu fyrir það
póstnúmerasnið sem flest gildin fylgja og dálkar með netfang eða e-mail í heitinu reglu fyrir netföng.

**Keyra reglur** telur raðirnar sem brjóta hverja reglu, sýnir hlutfallið og nokkur dæmi og skráir keyrsluna í sögu
gagnasafnsins. Fyrir brotna reglu má vista raðirnar sem bregðast sem sérstakt gagnasafn, og hlaða má allri niðurstöðunni niður
sem HTML-skýrslu. Reglurnar eru vistaðar í lýsigögnum gagnasafnsins og fylgja því afritum, pökkum og færanlegu möppunni.

## Dulnefna

Aðgerðin **Dulnefna** (hópurinn Gildi, líka í dálkavalmyndinni og skipanaspjaldinu) skiptir auðkennum eins og kennitölum eða
viðskiptavinanúmerum út áður en deilt er. Þrjár aðferðir:

- **Tætigildi**: SHA-256 af salti og gildinu, stytt í valfrjálsa lengd (sjálfgefið 16 stafir). Sama gildi gefur sama
  tætigildi, svo tengingar milli taflna haldast ef sama salt er notað. Saltið er leynilegur texti sem þú velur; það er aldrei
  vistað í dagbókinni eða uppskriftinni (þar stendur `***`), og uppskrift með slíku skrefi er ekki hægt að keyra án þess að
  saltið sé gefið upp aftur.
- **Hylja stafi**: heldur valfrjálsum fjölda stafa fremst og aftast auk aðgreina og skiptir afganginum út fyrir `*`
  (`19800101-1234` verður `198001**-****` með sex stöfum fremst).
- **Raðnúmer**: hvert ólíkt gildi fær raðnúmer með forskeyti í raðaðri röð (`P0001`, `P0002`).

Tæting með salti er dulnefning, ekki nafnleysing: sá sem þekkir saltið getur prófað tilgátur, og samsetningar annarra dálka
geta enn bent á einstaklinga. Fjarlægðu eða grófflokkaðu aðra viðkvæma dálka, og deildu saltinu aldrei með gögnunum.
SQL-útflutningur uppskriftarinnar notar föll Dataspatium `dm_hash` og `dm_mask`; R-útflutningurinn notar pakkann digest fyrir
tætigildi.

## Landupplýsingar

Aðgerðahópurinn *Landupplýsingar* vinnur með rúmfræðidálka (GeoJSON eða WKT sem texta, í lengd/breidd eða SWEREF 99 TM) og
hnitadálka:

- **Miðpunktur úr rúmfræði** bætir við lengd og breidd (WGS 84) fyrir miðju hvers svæðis eða línu, til dæmis til að teikna
  sveitarfélög sem bólur á punktakorti.
- **Flatarmál úr rúmfræði** bætir við flatarmáli í ferkílómetrum (í sléttu fyrir SWEREF 99 TM, á jarðkúlunni fyrir
  lengd/breidd; göt eru dregin frá).
- **Umvarpa hnitum** umreiknar tvo dálka milli SWEREF 99 TM (austur, norður) og WGS 84 (lengd, breidd) í nýja dálka með formúlum
  Lantmäteriet.
- **Sveitarfélag og lén úr hnitum** finnur í hvaða sænska sveitarfélagi og léni hver punktur liggur með meðfylgjandi mörkum SCB
  og bætir við `kommunkod`, `kommun`, `lanskod` og `lan` (eða aðeins léni). Hnit í SWEREF 99 TM eru greind. Mörkin eru
  einfölduð landmörk SCB fyrir þemakort: punktar í vötnum, sjó eða utan Svíþjóðar verða tómir og punktar mjög nálægt mörkum
  geta lent í nágrannasveitarfélaginu.

Allar fjórar eru skref í uppskriftinni sem má afturkalla og keyra aftur. Í SQL-útflutningnum birtast þær sem köll á föll
Dataspatium (`dm_geo_lon`, `dm_geo_area`, `dm_to_lon`, `dm_region` og fleiri); R-útflutningurinn gefur samsvarandi kóða með
pakkanum sf.

## Útgáfur

Hnappurinn **Útgáfur** (líka í Umsjón) vistar skyndimynd af gagnasafninu með lýsingu. Bera má útgáfu saman við núverandi stöðu
(fjöldi raða, viðbættir, fjarlægðir og breyttir dálkar), endurheimta hana eða eyða. Útgáfur eru vistaðar í gagnagrunni
vafrans og fylgja afriti vinnusvæðisins. Vistaðu útgáfu fyrir stærri breytingar.

## Uppskrift

Hnappurinn **Uppskrift** sýnir öll skref sem gerð hafa verið við gagnasafnið, í röð. Héðan geturðu:

- afritað uppskriftina sem R-kóða (`dm_read()` með stuttheitinu, dplyr/tidyr/stringr-köll, `dm_write()`) eða sem SQL á töfluna
  `data`,
- hlaðið niður uppskriftinni sem JSON til að deila með öðrum,
- keyrt sömu skref á annað gagnasafn í vinnusvæðinu,
- keyrt uppskrift úr JSON-skrá á valda gagnasafnið.

Keyrslan stöðvast við fyrsta skref sem mistekst (til dæmis dálk sem er ekki til) og segir hversu mörg skref voru framkvæmd.
Uppskriftarskráin er á forminu

```json
{ "app": "Dataspatium", "kind": "recipe", "version": "0.3.0", "name": "Hreinsun sveitarfélaga",
  "steps": [ { "op": "trim", "params": { "columns": ["kommun"], "squish": true }, "description": "Fjarlægja bil í kommun" } ] }
```

## SQL-stjórnborðið

Hvert gagnasafn hefur **stuttheiti** (birtist undir heitinu í hlutaspjaldinu og undir Umsjón, þar sem því má breyta ásamt
heitinu): lágstafir a–z, tölustafir og undirstrik, að hámarki 20 stafir og helst 15, aldrei frátekið orð í SQL eða R. Tillagan
er mynduð úr heitinu án smáorða og með ártal sem viðskeyti: *Mannfjöldi 2024* verður `mannfjoldi_2024`. Stuttheiti
meðfylgjandi sýnigagna eru föst (`befolkning_2024`, `kommungranser`, `lansgranser`) á öllum tungumálum. Í SQL-stjórnborðinu
heitir valda gagnasafnið `data` en næst líka með stuttheiti sínu, og önnur gagnasöfn nást með stuttheitum sínum, svo ein
fyrirspurn getur tengt mörg gagnasöfn:

```sql
select k.kommun, k.lan, b.folkmangd
from befolkning_2024 b
join kommungranser k on k.kommunkod = b.kommunkod
order by b.folkmangd desc
```

Önnur gagnasöfn eru skrifvarin í fyrirspurninni; UPDATE, DELETE og ALTER gilda um valda gagnasafnið en mega lesa hin (til dæmis
`update data set lan = (select lan from kommungranser k where k.kommunkod = data.kommunkod)`). Að hámarki níu önnur gagnasöfn
mega vera í sömu fyrirspurn. Niðurstöðuna má vista sem nýtt gagnasafn. Stuttheitin virka líka í R (`dm_read("stuttheiti")`;
hnappurinn *Setja inn dm_read()*, R-dæmin, nýjar minnisbækur og R-útflutningur uppskrifta nota stuttheitið) og eru notuð þegar
myndrit og minnisbækur eru tengd gagnasöfnum við innflutning.

SQL-stjórnborðið er í hamnum Greina undir flipanum SQL og vinnur á valda gagnasafnið, þar sem taflan heitir `data`. Ctrl+Enter
keyrir alla skriftuna, valinn texti keyrir sér.

- `SELECT`, `WITH`, `VALUES`, `PRAGMA` og `EXPLAIN` sýna niðurstöðuna í töflu (fyrstu 5 000 raðirnar). **Vista niðurstöðuna sem
  gagnasafn** býr til nýtt gagnasafn úr allri niðurstöðunni án raðatakmarks.
- `UPDATE`, `DELETE`, `ALTER TABLE` og aðrar setningar breyta gagnasafninu, eru skráðar sem uppskriftarskrefið SQL-setning og
  má afturkalla í Vinna.
- Eiginleikaspjaldið sýnir dálka gagnasafnsins (smellur setur heitið inn), stuttheiti allra gagnasafna og aukaföll SQL sem
  Dataspatium bætir við: `regexp`, `regexp_replace`, `dm_parse_number`, `dm_parse_date`, `dm_fix_encoding`, `dm_upper`,
  `dm_lower`, `dm_title`, `dm_squish`, `dm_round`, `dm_pad`, `dm_date_part`, `dm_date_diff` og
  `dm_valid_id` (til dæmis `select * from data where dm_valid_id(kennitala, 'is_kt') = 0`), auk regex-fallanna
  `dm_regex_test`, `dm_regex_extract`, `dm_regex_all`, `dm_regex_count`, `dm_regex_split` og `dm_shape` sem lýst
  er í [regex.md](regex.md).
- SQL-skriftur eru vistaðar í hlutaspjaldinu á sama hátt og R-skriftur.

SQLite-mállýskan gildir: `||` fyrir samtengingu texta, `cast(x as integer)`, `strftime()` fyrir dagsetningar, `group_concat()`,
gluggaföll eins og `row_number() over (partition by …)`.

## Takmarkanir

- Afturköllun gildir innan setunnar; notaðu útgáfur til að fara til baka eftir endurhleðslu.
- Aðgerðir sem endurbyggja dálk (Breyta gerð, Skipta dálki, snúningur) flytja gagnasafnið fyrst út fyrir afturköllun. Á
  gagnasöfnum yfir nokkur hundruð MB tekur það merkjanlegan tíma.
- R-útflutningur uppskrifta nær yfir innbyggðu aðgerðirnar; frjálst SQL er flutt út sem athugasemd, því ekki er hægt að þýða það
  sjálfkrafa yfir í R.
