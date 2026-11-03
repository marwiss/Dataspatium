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
- Taflan er sýndarvædd: aðeins sýnilegu raðirnar eru í DOM vafrans, afgangurinn er í SQLite. Milljón röðum er flett jafn hratt
  og hundrað.

## Aðgerðir

Hnappurinn **Aðgerðir** opnar spjaldið. Hver aðgerð hefur glugga með reitum sem myndaðir eru úr breytum aðgerðarinnar, og þar
sem því verður við komið sýnir forskoðun hversu margar raðir verða fyrir áhrifum og dæmi fyrir og eftir.

| Hópur | Aðgerð | Hvað hún gerir |
|---|---|---|
| Dálkar | Endurnefna dálk | Nýtt dálkheiti; merkimiðinn fylgir ef hann var sá sami og heitið |
| | Merkimiði, lýsing og eining | Merkimiðinn er birtingarheitið í töflufyrirsögnum og myndritum; lýsing og eining birtast í eiginleikaspjaldinu og kóðabókinni, fylgja SQLite-skránni og ná til R sem eigindirnar `description` og `unit` |
| | Eyða dálkum | Fjarlægir valda dálka |
| | Endurraða dálkum | Færa dálka upp og niður |
| | Breyta gerð | Texti í heiltölu, tugabrot, dagsetningu, dagsetningu og tíma eða já/nei. Tilgreina má tugabrotstákn og dagsetningarsnið; gildi sem ekki er hægt að túlka verða tóm og fjöldi þeirra er tilkynntur |
| Gildi | Finna og skipta út | Texti eða regluleg segð í völdum textadálkum, með forskoðun |
| | Fjarlægja bil | Bil fremst og aftast og (valfrjálst) tvöföld bil |
| | Breyta há- og lágstöfum | HÁSTAFIR, lágstafir eða Stór Upphafsstafur |
| | Lagfæra stafakóðun | Lagfærir brenglaða stafi (Ã¶ verður ö) sem urðu til við innflutning með rangri kóðun |
| | Skipta út gildi | Einu nákvæmu gildi fyrir annað; tómt gildi má velja sem frá eða til |
| | Fylla í vantandi gildi | Fast gildi eða gildi fyrri raðar |
| Raðir | Eyða röðum | SQL-skilyrði, til dæmis `befolkning < 1000`; veldu Halda til að halda þess í stað aðeins röðum sem passa |
| | Fjarlægja tvítök | Á völdum dálkum eða allri röðinni; fyrsta tilvikinu er haldið |
| Uppbygging | Nýr reiknaður dálkur | SQL-segð, til dæmis `round(befolkning / 1000.0, 1)` eða `case when andel > 5 then 'stor' else 'liten' end` |
| | Sameina dálka | Marga dálka í einn textadálk með aðgreini |
| | Skipta dálki | Einn textadálk í marga við aðgreini |
| | Snúa í langt snið | Valdir dálkar verða raðir með heiti og gildi |
| | Snúa í breitt snið | Gildin í heitisdálki verða nýir dálkar |
| | SQL-setning | Hvaða UPDATE, DELETE eða ALTER TABLE sem er á töfluna `data` |
| Ný gagnasöfn | Hópa og taka saman | Summa, meðaltal, lægst, hæst, fjöldi, fjöldi ólíkra eða miðgildi fyrir hvern hóp, í nýtt gagnasafn |
| | Tengja gagnasöfn | Vinstri eða innri tenging við annað gagnasafn á lykli |
| | Skeyta gagnasöfnum saman | Staflar röðum úr mörgum gagnasöfnum; dálkar eru paraðir eftir heiti |
| | Hreinsa flokka | Finnur rittilbrigði af sama gildi (há-/lágstafir, bil, broddstafir) og sameinar þau |

Aðgerðir sem búa til nýtt gagnasafn láta frumgögnin óhreyfð og velja nýja gagnasafnið þegar því er lokið.

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

Hnappurinn **Reglur** opnar gæðareglur gagnasafnsins: hvað þarf að gilda til að gögnin séu rétt. Sjö gerðir reglna eru til: má
ekki vanta, einkvæmt (einn eða fleiri dálkar saman), innan bils (tölur, dagsetningar eða texti), í lista, passar við mynstur
(regluleg segð), textalengd og frjálst SQL-skilyrði sem þarf að vera satt fyrir hverja röð. **Leggja til reglur** bætir við
reglum úr gagnagæðasniðinu: dálkar án vantandi gilda, einkvæmir dálkar og kóðar með fasta lengd.

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
  `dm_lower`, `dm_title`, `dm_squish`.
- SQL-skriftur eru vistaðar í hlutaspjaldinu á sama hátt og R-skriftur.

SQLite-mállýskan gildir: `||` fyrir samtengingu texta, `cast(x as integer)`, `strftime()` fyrir dagsetningar, `group_concat()`,
gluggaföll eins og `row_number() over (partition by …)`.

## Takmarkanir

- Afturköllun gildir innan setunnar; notaðu útgáfur til að fara til baka eftir endurhleðslu.
- Aðgerðir sem endurbyggja dálk (Breyta gerð, Skipta dálki, snúningur) flytja gagnasafnið fyrst út fyrir afturköllun. Á
  gagnasöfnum yfir nokkur hundruð MB tekur það merkjanlegan tíma.
- R-útflutningur uppskrifta nær yfir innbyggðu aðgerðirnar; frjálst SQL er flutt út sem athugasemd, því ekki er hægt að þýða það
  sjálfkrafa yfir í R.
