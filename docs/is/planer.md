# Skipulag: stafrænt deiliskipulag og aðalskipulag

Dataspatium opnar stafrænt skipulag sem skipulag: sænskt detaljplan (deiliskipulag) er teiknað sem skipulagskort með
litum og merkingum Boverket, ákvæðin eru talin upp og flett upp í skrá Boverket yfir skipulagsákvæði
(Planbestämmelsekatalogen), og översiktsplan (aðalskipulag) er sýnt þema fyrir þema. Skipulagið er gagnasafn af
tegundinni *skipulag*: ein skipulagsfitja á hverja röð (skipulagssvæðið og hvert ákvæði eða innihaldsfitja) með
rúmfræði í WGS 84, upplýsingar skipulagsins í lýsigögnum og upprunalega skráin vistuð í gagnasafninu. Taflan er alltaf
einum smelli frá.

## Snið sem eru lesin

| Snið | Þekkist á | Innihald |
|---|---|---|
| Landsforskrift Detaljplan (Lantmäteriet, útgáfa 4.1) | GeoJSON með `feature:mediatyp application/vnd.lm.detaljplan.v4+json` eða `feature:typ` (detaljplan, användningsbestämmelse, egenskapsbestämmelse, administrativ bestämmelse; einnig skrifað án å, ä og ö) | Skipulagssvæði, ákvæði með tilvísun í skrá, orðalagi, gildum og rökstuðningi, rúmfræði sem fletir, línur, punktar og rúmmál (með hæð í RH 2000), upplýsingar um ákvörðun (hafið, samþykkt, tekið gildi, framkvæmdatími, málsnúmer) og heiti greinargerðarinnar |
| Tilvísunarfitjur af landsvettvangi landupplýsinga | STAC-fitjur með `properties.detaljplan` og `properties.planbestammelse` (svar deiliskipulags-API Lantmäteriet) | Upplýsingar skipulagsins, orðalag ákvæðanna, skrártilvísun, flokkur og gildi |
| Landsforskrift Översiktsplan (Lantmäteriet, útgáfa 2.0, prófútgáfa 4) | GeoJSON með `feature:mediatyp application/vnd.lm.oversiktsplan.v2+json` eða `feature:typ` oversiktsplan, innehallOP, beslutOP | Upplýsingar og ákvörðun skipulagsins (tekin, tekur gildi), efnishlutir með efnistegund, þema eftir flokki ÖP-skrárinnar, heiti, nánari lýsingu, skipulagsatburði, tengslastigi og tengingum, einnig efni sem aðeins er lýst í texta |
| ÖP-líkan Boverket (GeoPackage, gagnagrunnslíkan 0.4) | Töflur `innehall_op_<þema>_<rúmfræðitegund>` og `oversiktsplan` | Öll efnislög sem eitt skipulag með þema fyrir hvert lag, ákvörðun skipulagsins (`beslut_op`), tengingar milli efnis og kafla í skipulagsgögnum (bókamerki) |
| Detaljplan í GeoPackage | Töflurnar `detaljplan`, `bestammelse` og `anvandning_yta`, `egenskap_yta`, `egenskap_linje`, `egenskap_punkt` með reitaheitum landsforskriftarinnar | Skipulagið eins og skipulagsverkfærið vistar það: skipulagssvæði, fletir, línur og punktar með ákvæðum sínum, auðkennum, litum, rökstuðningi og hæðum, upplýsingar um ákvörðun og skjöl; fletir sem enn vantar ákvæði eru sýndir eins og þeir eru teiknaðir |

Hnit í SWEREF 99 TM og staðbundnu SWEREF 99-beltunum (EPSG:3006–3018, lesin úr `koordinatsystemPlan`) auk Web
Mercator eru umreiknuð í WGS 84. GeoJSON-skrá þekkist á innihaldinu, ekki endingunni: slepptu henni í Safna og
upplýsingar skipulagsins birtast með hnappinum *Flytja inn*. GeoPackage-skrá í ÖP-líkaninu fær valið *Allt
aðalskipulagið sem skipulag*; slökkt er ein tafla flutt inn í einu eins og áður. Deiliskipulag í GeoPackage fær valið *Allt skipulagið sem skipulag*. Hnitakerfi GeoPackage-skrár er lesið úr skránni, einnig þegar það er aðeins gefið með heiti (til dæmis *SWEREF99 15 00*).

## Skipulagskortið í Vinna

Skipulag opnast sem skipulagskort: notkunarákvæði fyllt með litum Boverket (íbúðir gult, miðbær brúnt, iðnaður
blágrátt, gata ljósgrátt, garður ljósgrænt, vatn blátt og svo framvegis samkvæmt almennu ráðum við BFS 2020:5;
litbrigðin eru forritsins), eiginleikaákvæði sem blá strikuð útlínur, stjórnsýsluákvæði sem fjólublá punktuð,
skipulagsmörkin svört og merkingarnar sem merki. Smelltu á fitju og skoðarinn sýnir upplýsingar hennar og hvað skráin
segir um ákvæðið: kóða, tegund, gildi og orðalag skrárinnar. Lög eru kveikt og slökkt eftir tegund, bakgrunnskort birtist eftir samþykki, og hnapparnir gefa *Skipulagsákvæði* (listinn sem Markdown) og *Sýna sem töflu*.

Aðalskipulag er teiknað eftir þema: land- og vatnsnotkun fyllt eftir innihaldstegund, önnur þemu með einum lit á þema
og valkvæmum sýnileika. Skoðarinn sýnir flatarmál á hverja land- og vatnsnotkun.

Línur (bann við útkeyrslu, girðingar, þróunarstefnur) og punktar (til dæmis hæð lands) eru teiknuð eins og þau eru. Ákvæði sem er takmarkað í hæð er teiknað með fótspori sínu og skoðarinn sýnir hæðina í hæðarkerfi skipulagsins (RH 2000 í skipulagi til NGP): neðri mörk, efri mörk eða hvort tveggja. Skoðarinn sýnir einnig ákvörðun skipulagsins (samþykkt, tekið gildi, kært, framkvæmdatími, málsnúmer, tegund ákvörðunar), heiti greinargerðarinnar og skjölin, og fyrir valinn hlut aðrar upplýsingar eins og gildistíma, aukaleg eiginleikamörk, hvaða notkunarákvæðum eiginleiki stýrir, tengslastig, hvað efnið snertir og hvar í skipulagsgögnum því er lýst. Efni sem aðeins er lýst í texta, án staðsetningar á kortinu, er talið upp undir *hlutir án staðsetningar á kortinu* og má velja það þar.

## Hnitakerfi og hæðir

Deiliskipulag (detaljplaner) til NGP er gert í SWEREF 99 TM eða í staðbelti sveitarfélagsins í SWEREF 99 með hæðum í
RH 2000, og skráin gefur hvort tveggja upp (`koordinatsystemPlan` og `hojdsystem`). Aðalskipulag (översiktsplaner) er oftast
í SWEREF 99 TM. Skoðarinn sýnir hnitakerfi skipulagsins og, fyrir skipulag með hæðum, hæðarkerfið; GeoPackage-skrá gefur
ekkert hæðarkerfi upp, og þá stendur það.

Skipulagskortið er teiknað sem vefkort (Web Mercator með norður upp, þar sem OpenStreetMap getur verið bakgrunnur) eða í
eigin kerfi skipulagsins: veldu það á tækjastikunni, til dæmis *SWEREF 99 16 30*. Þá snýr norður hnitanetsins upp eins og á
skipulagsuppdrættinum, og hver fitja liggur á hnitum sínum. Bakgrunnurinn getur þá komið frá WMS-þjónustu sem býður sama
kerfi: veldu *WMS-þjónusta* sem bakgrunnskort og sláðu inn vistfang og lag (*Lesa lög* sækir lagalista þjónustunnar og
segir frá ef lagið vantar kerfið). OpenStreetMap er aðeins til sem vefkort. Bakgrunnurinn er sóttur eftir samþykki, eins og
önnur bakgrunnskort.

Skipulag í hnitakerfi sem forritið getur ekki umreiknað er lesið með öllum fitjum sínum, en fitjurnar eru ekki teiknaðar,
því þær lentu á röngum stað: Sækja og skoðarinn segja hvaða kerfi skráin gefur upp, og fitjurnar eru taldar upp undir
*hlutir án staðsetningar á kortinu*. Forritið umreiknar SWEREF 99 TM og tólf staðbeltin, RT 90 2,5 gon V, norrænu UTM- og TM-kerfin, ISN93 og Web Mercator;
umreikningurinn stemmir við PROJ (sem QGIS notar) innan millimetra, RT 90 innan tveggja desímetra.

## Skipulag úr skipulagsverkfærum

Skipulag sem er teiknað í skipulagsverkfæri er lesið eins og allt skipulag af sama tagi, sama hvaða verkfæri bjó það til. Dæmi er [Rita Detaljplan og Rita Översiktsplan](https://github.com/ritaplan), viðbætur við QGIS. Það sem þær vista og afhenda opnast svona:

| Skrá | Opnast sem |
|---|---|
| Afhendingarskrá deiliskipulagsins til NGP (JSON, Detaljplan 4.1) | Skipulagsuppdráttur með auðkennum og litum úr Planbestämmelsekatalogen |
| Deiliskipulag í GeoPackage með reitaheitum landsforskriftarinnar | Skipulagsuppdráttur með eigin auðkennum og litum skipulagsins, rökstuðningi og hæðum |
| Afhendingarskrá aðalskipulagsins til NGP (JSON, Översiktsplan 2.0) | Aðalskipulag eftir þema með ákvörðun |
| Aðalskipulag í GeoPackage (gagnagrunnslíkan Boverket 0.4) | Aðalskipulag eftir þema með ákvörðun, tengingum og köflum skipulagsgagna |
| Skjalasafnspakki (mappa eða ZIP-skrá með `metadata/PREMIS.xml`) | Skipulagið úr möppunni `content` með skjölunum, og athugun skránna |

Slepptu skránni í Sækja, eða sæktu hana með *Af vefslóð* þegar hún er á vefnum (til dæmis skipulag sem sveitarfélagið birtir); skrá án skráarendingar er þekkt af efnistegund sinni. Skjalasafnspakka er sleppt sem möppu eða sem ZIP-skrá: appið les skipulagið úr möppunni `content` (GeoPackage-skrána fyrst, annars afhendingarskrána), geymir skrár pakkans með skipulaginu og ber hverja skrá saman við gátsummu hennar (SHA-256) í `PREMIS.xml`. Skoðarinn sýnir undir *Skjalasafnspakki* hvort skrárnar passa, hverjum hefur verið breytt eða hverjar vantar, og opnar skjölin (skipulagsuppdrátt og greinargerð) í nýjum flipa. Staður sem vísar út fyrir pakkann er ekki athugaður og aldrei lesinn.

## Flipinn Skipulag í Greina

Skipulag fær flipann **Skipulag** eftir Regex:

- **Samantekt**: upplýsingar skipulagsins, fjöldi fitja eftir tegund, staða skrártilvísana og notkunarflatarmál skipulagsins.
- **Ákvæði**: öll ákvæði sem tafla með merkingu, orðalagi, flokki, gildi, kóða og stöðu í skrá; má vista sem gagnasafn
  eða sækja sem Markdown. Fyrir aðalskipulag: innihaldið eftir þema.
- **Flatarmál**: flatarmál á hverja landnotkun (summa flatanna, reiknuð í SWEREF 99 TM) og hlutur af notkunarflatarmáli.
- **Skráreftirlit**: hver skrártilvísun er flett upp í skránni: í gildi, komið í stað (og af hverju), fallið úr gildi,
  óþekkt eða vantar, og hvort orðalagið fylgir sniði skrárinnar.
- **Leita í skránni**: frjáls textaleit í 3 700 ákvæðum skrárinnar með síu á tegund, notkunarform og gildi;
  niðurstöðuna má vista sem gagnasafn.

## Skráin yfir skipulagsákvæði

Forritið hefur innbyggt eintak af Planbestämmelsekatalogen Boverket (opin gögn; útgáfa 20251201) svo að uppflettingar,
litir og skráreftirlit virki án nets. Heimild skal tilgreina: Boverket og Planbestämmelsekatalogen. Skráin er einnig
uppspretta í Safna (*Boverket Planbestämmelsekatalogen*): flettu upp ákvæði eftir UUID þess, listaðu útgáfur, liti,
notkunarform, flokka og tákn um opið API Boverket. Eintakið er uppfært með `python tools/plan_catalog.py` fyrir nýja
útgáfu.

## Takmarkanir

- Litir Boverket eru gefnir upp sem heiti í reglugerðunum; litbrigðin í forritinu eru þess eigin. Táknmerkingar
  (punktað land, krossað land og aðrar) eru dregnar sem útlínur með merkingu, ekki með táknum Boverket.
- Ákvæðalýsingar, skipulagsgögn og ákvörðunarskjöl fylgja aðeins með sem texti (rökstuðningur) eða sem upplýsingar í
  lýsigögnum skipulagsins; skjölin eru ekki sótt.
- Flatarmál eru flatar reikningar í SWEREF 99 TM; fyrir skipulag í staðbundnum beltum er skekkjan óveruleg.
