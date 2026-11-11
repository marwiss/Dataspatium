# Flæði og vöktun

**Flæði** er vistuð keðja skrefa sem keyrð er með einum smelli eða þegar forritið ræsist: sækja ný gögn, vinna úr þeim, teikna
gröf, skrifa skjöl og flytja út. Það er mánaðarskýrslan á einum hnappi. **Vöktun** fylgist með því hvort heimild gagnasafns hafi
breyst og lætur vita á stöðustikunni. Hvort tveggja er undir *Flæði og vöktun* í hlutaspjaldinu í Umsjón.

## Að búa til flæði

Ýttu á *Nýtt flæði*, gefðu því heiti og bættu við skrefum. Skrefin eru keyrð ofan frá og niður og þú færir þau með örvunum.

| Skref | Hvað það gerir |
|---|---|
| Sækja ný gögn | Les heimildina aftur og spilar uppskrift gagnasafnsins, fyrir eitt gagnasafn eða öll sótt |
| Spila uppskrift | Gerir sömu vinnslu á öðru gagnasafni |
| Keyra R- eða Python-skriftu | Keyrir vistaða skriftu úr Greina; það sem hún skrifar með `dm_write` verður að gagnasöfnum |
| Vista lista sem gagnasafn | Keyrir vistaðan lista eða fyrirspurn úr Leita; næsta keyrsla uppfærir sama gagnasafn, svo gröf á því virka áfram |
| Flytja út graf | Teiknar vistað graf sem PNG, SVG eða PDF; með flokkunardálki eitt graf fyrir hvert gildi |
| Flytja út mælaborð | Skrifar mælaborðið sem sjálfstæða HTML-skrá |
| Búa til skjal | Fyllir skjalasnið; með flokkunardálki eitt skjal fyrir hvert gildi |
| Flytja út gagnasafn | Skrifar gagnasafnið sem skrá |
| Keyra skipun | Keyrir eina af skipunum forritsins með viðföngum sem JSON; svarið er gögn skipunarinnar |

Graf eða skjal sem byggir á gagnasafni er teiknað með þeim gögnum sem eru til þegar skrefið er keyrt, svo settu þau á eftir
skrefunum sem sækja og vinna.

## Skilyrði, lykkjur og spurningar

Flæði getur valið leið eftir því sem fyrri skref gáfu. Gefðu skrefi *Nafn svarsins*, þá ná síðari skref svarinu sem
`{{nafn.svið}}` í viðföngum, spurningum og skilaboðum og sem `nafn.svið` í skilyrðum. *Keyra skipun* keyrir eina af þeim
skipunum sem gervigreindin í forritinu notar líka, með viðföngin sem JSON. Ef skrefið heitir `fjoldi` og keyrir `run_sql` með
`{"dataset": "Mannfjöldi", "sql": "select count(*) from data"}`, er fjöldinn `fjoldi.rows[0][0]`.

Skipanirnar sem aðeins lesa eru `list_datasets`, `describe_dataset`, `read_rows`, `column_stats`, `run_sql`, `list_operations`, `describe_operation`, `list_items`, `list_files`. Þær sem breyta einhverju eða búa til skrár eru `apply_operation`, `undo`, `refresh_dataset`, `replay_recipe`, `run_script`, `list_to_dataset`, `render_chart`, `dashboard_html`, `generate_document`, `export_dataset`, `run_flow`, `run_r`, `run_python`. `run_sql` keyrir aðeins
eina setningu sem les.

| Skref | Svona virkar það |
|---|---|
| Ef skilyrði gildir | Keyrir skrefin undir *Þá* ef skilyrðið gildir, annars skrefin undir *Annars* |
| Fyrir hvert gildi í lista | Keyrir skrefin einu sinni fyrir hvert gildi í fyrra svari, til dæmis `sveitarfelog.rows`; gildið næst sem `{{item}}`, og talan n gefur umferðirnar 1 til n |
| Endurtaka þar til skilyrði gildir | Keyrir skrefin og prófar skilyrðið eftir hverja umferð, með hléi milli umferða; umferðin næst sem `{{round}}` |
| Spyrja mig | Sýnir spurningu með svarmöguleikum, einum í hverri línu, og bíður eftir svarinu, sem næst sem `{{nafn.answer}}` |
| Ljúka flæðinu | Lýkur flæðinu með skilaboðum í annálnum; það telst ekki villa |

Skilyrði er skrifað með samanburðinum `=`, `!=`, `<`, `<=`, `>`, `>=` og `contains`, orðunum `and`, `or` og `not`, svigum, tölum,
texta innan gæsalappa og tilvísunum í svör, til dæmis `fjoldi.rows[0][0] > 0 and nafn = 'Ale'`. Forritið les skilyrðið sjálft og
keyrir það aldrei sem kóða. Svar sem vantar telst tómt, og skilyrði sem ekki er hægt að lesa sést strax í ritlinum.

Báðar lykkjurnar hafa mörk, *Í mesta lagi umferðir* (sjálfgefið 100, í mesta lagi 1.000) og *Í mesta lagi sekúndur*, og þau mörk
sem nást fyrst gilda. Svar lykkjunnar segir hve margar umferðir hún fór (`rounds`) og hvers vegna hún endaði (`reason`: `done`,
`until`, `rounds` eða `time`), svo að síðara skilyrði geti valið eftir því.

*Stöðva*, í flæðisskjánum og á stöðustikunni, stöðvar flæðið fyrir næsta skref og eftir hverja umferð, og hlé sem stendur yfir
endar strax. Skref sem er þegar hafið er keyrt til enda. Annállinn segir hvar flæðið var stöðvað, til dæmis *Þú stöðvaðir í umferð
37 af 250*, og það sem náðist að gera má afturkalla eins og venjulega.

## Að keyra flæði

*Keyra* ræsir flæðið. Stöðustikan sýnir hvaða skref er í gangi og skráin fær eina línu fyrir hvert skref. *Stöðva* stöðvar
flæðið fyrir næsta skref. Flæði stöðvast við fyrstu villu nema þú hafir kveikt á *Halda áfram með næsta skref eftir villu*.
Keyrslan telst samt misheppnuð. Skoðarinn sýnir síðustu keyrslu skref fyrir skref, með villunni þar sem hún kom upp.

Skrár úr keyrslu haldast þar til þú sækir þær með *Sækja niðurstöðuna* eða lokar forritinu. Ein skrá kemur eins og hún er og
margar verða að ZIP-skrá.

Flæði sendir aldrei neitt út úr forritinu. Það sem þú vilt deila með öðrum fer um hamurinn Deila, þar sem persónuupplýsingar eru
yfirfarnar fyrst.

## Keyrsla við ræsingu

Með *Keyra þegar forritið ræsist* er flæðið keyrt skömmu eftir að forritið opnast. Það er aðeins keyrt ef það þarf ekki að spyrja
um neitt:

- Skref sem sækja af netinu krefjast þess að samþykki hafi þegar verið gefið.
- Skref sem lesa um gagnagrunnsbrúna eru ekki keyrð við ræsingu, því brúin er tengd handvirkt.
- Python-skriftur krefjast þess að Python hafi þegar verið sótt.
- Flæði sem spyr þig (*Spyrja mig*) er aldrei keyrt við ræsingu.

Annars er flæðinu sleppt og skráin segir hvers vegna. Ekkert er keyrt á meðan forritið er lokað.

## Að vakta heimild

Vöktun á við um gagnasöfn sótt úr API eða gagnagrunni og tengdar skrár. Kveiktu á henni með *Vakta heimildina* á síðu gagnasafnsins
í Umsjón eða á flipanum *Vöktun*.

*Athuga núna* les allar vaktaðar heimildir. Forritið ber raðirnar saman við hvernig þær voru þegar gagnasafnið var síðast uppfært.
Sömu raðir í annarri röð eru engar fréttir. Ef eitthvað hefur breyst sýnir stöðustikan *Ný gögn* og flipinn segir hve margar raðir
heimildin hefur núna, hve margar eru nýjar eða breyttar og hvaða dálkar hafa bæst við eða horfið.

Breytt röð telst bæði ný og horfin, því forritið veit ekki hvaða dálkar auðkenna röð.

Gagnasafnið breytist ekki fyrr en þú ýtir á *Uppfæra*. Þá eru nýju gögnin sótt og uppskriftin spiluð, og vöktunin ber síðan saman
við nýju útgáfuna. Það á einnig við þegar þú uppfærir á annan hátt, til dæmis í flæði.

Með *Athuga þegar forritið ræsist* fer athugunin fram við ræsingu, en aðeins fyrir heimildir sem þú hefur þegar samþykkt. Tengdar
skrár eru þá aðeins athugaðar ef vafrinn hefur enn leyfi þitt; annars stendur *Ekki athugað*.

## Öryggisafrit

Flæði fylgja öryggisafritum og færanlegu möppunni, en ekki pökkum til annarra, því þau vísa á gagnasöfn á vinnusvæði þínu. Flæði úr
öryggisafriti ræsist aldrei af sjálfu sér fyrr en þú hefur kveikt á því aftur.

## Takmarkanir

- Athugunin sækir allt svarið frá heimildinni. Stórar heimildir taka jafn langan tíma og venjuleg sókn.
- Aðeins eitt flæði er keyrt í einu.
- Aðeins skref með nafni gefa svör sem síðari skref geta lesið: skipun gefur gögn sín, lykkja `rounds` og `reason`, spurning
  `answer`, og önnur skref skilaboð sín og skrár.
- Uppfærsla margra gagnasafna í einu skrefi er ekki stöðvuð í miðri sókn.
