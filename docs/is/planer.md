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
| Landsforskrift Detaljplan (Lantmäteriet, útgáfa 4) | GeoJSON með `feature:typ` (detaljplan, anvandningsbestammelse, egenskapsbestammelse, administrativBestammelse, beslutsinformation, planbestammelsebeskrivning) eða `feature:mediatyp application/vnd.lm.detaljplan.v4+json` | Skipulagssvæði, ákvæði með skrártilvísun, orðalagi og gildi, ákvörðunarupplýsingar (hafið, samþykkt, gildistaka, framkvæmdatími), rökstuðningur |
| Tilvísunarfitjur af landsvettvangi landupplýsinga | STAC-fitjur með `properties.detaljplan` og `properties.planbestammelse` (svar deiliskipulags-API Lantmäteriet) | Upplýsingar skipulagsins, orðalag ákvæðanna, skrártilvísun, flokkur og gildi |
| Landsforskrift Översiktsplan (prófunarútgáfa 1.0) | GeoJSON með `feature:typ` oversiktsplan, innehallOP, beslutOP | Upplýsingar skipulagsins og innihaldsfitjur með innihaldstegund, heiti, nánari skilgreiningu og skipulagsatburði |
| ÖP-líkan Boverket (GeoPackage) | Töflur `innehall_op_<þema>_<rúmfræðitegund>` og `oversiktsplan` | Öll innihaldslög sem eitt skipulag með þema á hvert lag |

Hnit í SWEREF 99 TM og staðbundnu SWEREF 99-beltunum (EPSG:3006–3018, lesin úr `koordinatsystemPlan`) auk Web
Mercator eru umreiknuð í WGS 84. GeoJSON-skrá þekkist á innihaldinu, ekki endingunni: slepptu henni í Safna og
upplýsingar skipulagsins birtast með hnappinum *Flytja inn*. GeoPackage-skrá í ÖP-líkaninu fær valið *Allt
aðalskipulagið sem skipulag*; slökkt er ein tafla flutt inn í einu eins og áður.

Úr deiliskipulags-API Lantmäteriet (uppsprettan *Lantmäteriet geodataplattformen: detaljplaner*, krefst lykils frá
tengdri stofnun) er svar vistað sem skipulag með hnappinum *Vista sem skipulag* í stað töflu.

## Skipulagskortið í Vinna

Skipulag opnast sem skipulagskort: notkunarákvæði fyllt með litum Boverket (íbúðir gult, miðbær brúnt, iðnaður
blágrátt, gata ljósgrátt, garður ljósgrænt, vatn blátt og svo framvegis samkvæmt almennu ráðum við BFS 2020:5;
litbrigðin eru forritsins), eiginleikaákvæði sem blá strikuð útlínur, stjórnsýsluákvæði sem fjólublá punktuð,
skipulagsmörkin svört og merkingarnar sem merki. Smelltu á fitju og skoðarinn sýnir upplýsingar hennar og hvað skráin
segir um ákvæðið: kóða, tegund, gildi og orðalag skrárinnar. Lög eru kveikt og slökkt eftir tegund, bakgrunnskort
birtist eftir samþykki, og hnapparnir gefa *Vista sem kortasýn* (fyrir Myndgera, mælaborð og Birta),
*Skipulagsákvæði* (listinn sem Markdown) og *Sýna sem töflu*.

Aðalskipulag er teiknað eftir þema: land- og vatnsnotkun fyllt eftir innihaldstegund, önnur þemu með einum lit á þema
og valkvæmum sýnileika. Skoðarinn sýnir flatarmál á hverja land- og vatnsnotkun.

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
- Deiliskipulags-API Lantmäteriet krefst lykils; forritið er prófað gegn skjalfesta líkaninu með eigin prófunargögnum.
