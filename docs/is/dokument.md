# Skjöl og myndir

Dataspatium les inn skjöl sem **skjalasöfn** og myndir sem **myndasöfn**. Skjalasafn opnast sem lestrarsýn og myndasafn
sem myndasýn. Undir yfirborðinu eru bæði gagnasöfn af eigin tegund, með einni málsgrein eða einni mynd í hverri röð og
skrárnar sjálfar í gagnasafninu, svo allt sem gildir um töflur gildir líka hér: síur, Leita, reglur, uppskriftir,
SQL, R og Python, útflutningur, pakkar og deiling. Þar við bætast tólin **Texti** og **Myndir** í Greina, sem virka án
kóða.

## Skjalasöfn

| Snið | Þekkist á | Málsgreinar | Fyrirsagnir | Síður |
|---|---|---|---|---|
| PDF | .pdf | Textalínur eru settar saman í málsgreinar eftir línubili | Línur með greinilega stærra letri en texti síðunnar | Raunverulegar síður |
| Word | .docx | Málsgreinar og töflulínur | Málsgreinastílar með nöfnum eins og Heading, Rubrik, Title | Síðuskil og vistuð síðuskil Words |
| OpenDocument | .odt | Málsgreinar, listar og töflulínur | `text:h`-stök | Mjúk síðuskil |
| Markdown | .md, .markdown | Blokkir aðskildar með auðri línu; punktalistar á einni línu | Línur sem byrja á `#` | Allt er síða 1 |
| Texti | .txt (veldu sniðið *Skjöl*) | Blokkir aðskildar með auðri línu | Engar | Allt er síða 1 |

Hvert skjalasafn hefur dálkana `dokument` (skráarheiti), `sida` (síða), `stycke` (hlaupandi
númer í skjalinu), `typ` (`rubrik`, `stycke` eða `tabell`), `text` og `tecken` (stafir). Raðir úr töflum fá
reitina aðskilda með ` | `. Frumskrárnar eru vistaðar í gagnasafninu svo að hægt sé að sýna PDF-síður og sækja
skrárnar aftur; þær teljast með í stærð gagnasafnsins undir Umsjón.

PDF-skrár eru lesnar með pdf.js í bakgrunnsþræði, svo forritið svarar meðan löng skýrsla er lesin inn; 200 síður taka
um eina sekúndu. Skannaðar PDF-skrár án textalags gefa engar málsgreinar fyrr en þú lest þær, sjá *Að lesa texta í myndum* hér á eftir.

### Innflutningur

Slepptu einni eða fleiri skrám í Sækja. Mörg skjöl í einu verða **eitt** gagnasafn með öllum málsgreinum, og
stillingaskrefið sýnir skráalistann, heitið og framvindustiku skrá fyrir skrá (síðu fyrir síðu í PDF). Eitt Word-
eða Markdown-skjal er líka lesið sem skjal; viljir þú frekar töflurnar í því velur þú sniðið *Töflur í skjölum*.
Textaskrá er lesin sem CSV þar til þú velur *Skjöl*. Dálkaskrefinu er sleppt því dálkarnir eru gefnir. Skjöl má
einnig sækja af vefslóð (Sækja > Vefslóð) á sama hátt.

## Skjalasýnin í Vinna

Skjalasafn opnast í Vinna sem lestrarsýn, og úr Umsjón með hnappinum *Lesa*; yfirlitsflipinn þar telur upp skjölin og
smellur á eitt þeirra opnar það. Veldu skjal og sýn: *Síða fyrir síðu*, *Allt skjalið* (samfelldur texti með
síðumerkjum, teiknaður í áföngum svo að löng skýrsla opnist strax) eða, fyrir PDF, *Síðan sem mynd*. Fyrirsagnir eru
sýndar sem fyrirsagnir og töflulínur með jafnbreiðu letri. Smelltu á málsgrein og skoðarinn sýnir síðu, númer, tegund
og fjölda stafa með hnappi til að afrita textann; efst í skoðaranum standa titill skjalsins, höfundur, síður,
málsgreinar og orð með hnappinum *Sækja frumritið*.

Leitarreiturinn leitar í öllu safninu og telur upp niðurstöðurnar með samhengi (leitarorð í samhengi); smelltu á
niðurstöðu til að hoppa á síðuna. *Sýna sem töflu* gefur venjulegu töfluna með öllum aðgerðum í Vinna, og *Sýna sem
skjal* fer með þig til baka. Gagnasafnið sjálft er alltaf taflan: það sem þú gerir í töflunni (sía, leiðrétta, eyða
röðum) sést einnig í lestrarsýninni.

## Tólið Texti í Greina

Þegar skjalasafn er valið fær Greina flipann **Texti** (eftir Regex, á undan Minnisbókinni) með fjórum tólum. Allar
niðurstöður má vista sem nýtt gagnasafn með hnappinum *Búa til gagnasafn*, og hægt er að velja eitt skjal í stað
alls safnsins.

| Tól | Hvað það gerir | Stillingar |
|---|---|---|
| Yfirlit | Síður, málsgreinar, fyrirsagnir, töflulínur, orð, stafir, ólík orð og orðaforðabreytileiki (type/token-hlutfall) fyrir hvert skjal | |
| Orðtíðni | Algengustu orðin með fjölda, hlutfalli og fjölda skjala | Tungumál stopporða (sænska, danska, norska, finnska, íslenska, enska), eigin stopporð, minnsta orðlengd, telja tölur, hve mörg skal sýna |
| Leitarorð í samhengi | Öll tilvik orðs eða orðasambands með textanum á undan og eftir, skjali og síðu | Heil orð, greina há- og lágstafi, regluleg segð |
| Samtíðni | Orðapör sem koma fyrir saman í sömu málsgrein eða innan fárra orða | Gluggi, stopporð, minnsta orðlengd |

Orð eru runur af bókstöfum og tölustöfum með bandstrikum og úrfellingarmerkjum inni í (`tölvu-póstur`, `don't`) og
eru talin með lágstöfum. Stopporðalistarnir eru stuttir listar af kerfisorðum; slökktu á rofanum til að telja öll
orð. Sömu texta má greina áfram í R og Python: `dm_read("heiti")` gefur málsgreinatöfluna sem data.frame eða
DataFrame.

## Myndasöfn

Myndir (JPEG, PNG, WebP, GIF, BMP og AVIF þar sem vafrinn getur lesið þær) verða myndasafn með
einni röð fyrir hverja mynd: `fil`, `typ`, `storlek` (bæti), `bredd`, `hojd`, `datum`, `kamera`, `lon`, `lat`,
`altitud` og `beskrivning`. Dagsetning, myndavél, staðsetning og lýsing eru lesin úr EXIF í JPEG-skrám; önnur snið
fá aðeins stærð og mál. Forskoðun (lengri hlið mest 1600 px) og smámynd (320 px) eru vistaðar í gagnasafninu;
frumritin eru ekki vistuð, svo að safn með hundruðum mynda sé viðráðanlegt í vafranum. Slepptu öllum myndunum í einu
í Sækja og þær verða eitt safn.

Staðsetningarnar má teikna á kortaritið í Myndgera (lon og lat sem hnit), og dagsetningarnar virka eins og allar
aðrar dagsetningar í síum, Fyrirspurn og ritum.

## Myndasafnið í Vinna

Myndasafn opnast í Vinna sem safn smámynda með síu og röðun (skráarheiti, dagsetning, stærð), og úr Umsjón með
hnappinum *Sýna myndir*; yfirlitsflipinn þar sýnir fyrstu smámyndirnar og smellur á eina þeirra opnar hana í
myndasýninni. Smelltu á mynd og skoðarinn sýnir stærri forskoðun, tegund, stærð, mál, dagsetningu, myndavél,
staðsetningu og hæð auk lýsingarinnar, sem má breyta og vista: breytingin er skráð sem uppskriftarskref eins og aðrar
reitabreytingar og má afturkalla. Tvísmelltu til að sjá myndina stóra eða sæktu forskoðunina á tölvuna. *Sýna sem
töflu* gefur töfluna með öllum aðgerðum.

## Tólið Myndir í Greina

Þegar myndasafn er valið fær Greina flipann **Myndir** með tveimur tólum:

- **Yfirlit**: fjöldi, stærð, myndpunktar, hve margar myndir hafa dagsetningu, myndavél og staðsetningu, tímabil, og
  skipting eftir tegund, myndavél, ári eða mánuði sem má vista sem gagnasafn.
- **Tvítök**: hver smámynd er gerð að grátónamynd með 8 × 8 reitum; reitir ljósari en meðaltalið verða einn og gefa
  64 bita hakk. Myndir þar sem hökkin eru ólík í mest völdum fjölda bita eru flokkaðar saman: 0 bitar gefa aðeins
  nákvæm afrit, 5 bitar venjuleg tvítök (önnur stærð, önnur þjöppun), 12 bitar einnig skornar eða litbreyttar útgáfur
  með fleiri röngum niðurstöðum. Hóparnir eru sýndir með smámyndum og má vista sem gagnasafn með skrá, hópi, fjarlægð
  og hakki.

## Að lesa texta í myndum

Skönnuð PDF-skrá hefur engan texta og gefur því engar málsgreinar. Skjalasýnin segir hve margar síður það á við, og hnappurinn
*Lesa texta í myndunum* les þær með textagreiningu. Veldu tungumálið í myndunum; enska er alltaf lesin með, því nöfn og fagorð
eru oft á ensku. Textinn verður að venjulegum málsgreinum í töflu skjalsins, svo hægt er að leita í honum, telja og flytja hann
út, og aðgerðina má afturkalla. Ef þú hættir við halda þær síður sem þegar eru lesnar sér.

Vélrænt lesinn texti getur innihaldið villur. Þess vegna stendur *Vélrænt lesinn texti* og öryggi lestursins á síðunni, með hnappi
sem sýnir síðuna sem mynd.

Í myndasafninu býr *Lesa texta í myndunum* til nýtt skjalasafn úr myndunum sem sýndar eru, eitt skjal fyrir hverja mynd.
Myndasafnið breytist ekki. *Lesa texta í myndinni* í skoðaranum setur textann í lýsingu myndarinnar, þar sem þú getur leiðrétt
hann áður en þú vistar.

Mynd af töflu má líka flytja inn. Veldu *Líma* í Sækja og síðan *Lesa töflu úr mynd*, eða límdu myndina beint í reitinn. Textinn
fer í reitinn með semíkommu milli dálka. Leiðréttu hann þar, og síðan fer hann í gegnum venjulegan innflutning.

Lesturinn fer alfarið fram í vafranum og ekkert er sent neitt. Lesvélin Tesseract og tungumálagögn fylgja ekki forritinu: þau eru
sótt í fyrsta sinn, með samþykki þínu, frá föstum slóðum og borin saman við gátsummur. Eftir það eru þau í vafranum og sjást undir
Íhlutir í Umsjón.

## Myndir í skjalasniðmátum

Í skjalasniðmátum (Flytja út > Skjöl) setur merkið `{{bild "skra.jpg" | bredd: 400}}` inn mynd úr myndasafni. Myndin
er fyrst leituð í gagnasafni sniðmátsins og síðan í öllum myndasöfnum; forskoðunin er notuð og skölud í gefna breidd
(`bredd`, sjálfgefið mest 720 px; `hojd` má einnig gefa). Merkið virkar í Word, PDF, HTML, Markdown og LaTeX eins og
`{{diagram}}`, einnig í hópkeyrslum.

## Deiling og útflutningur

Skjala- og myndasöfn eru venjuleg gagnasöfn: þau eru hluti af pökkum, má setja á GitHub og senda á annað tæki með
skrárnar óskertar. Yfirferðin fyrir deilingu gildir um töfluna (textann í `text`, lýsingar) eins og um önnur
gagnasöfn. Útflutningur í CSV, Excel og önnur töflusnið gefur málsgreina- eða myndatöfluna án skránna; SQLite-skrá
Dataspatiums og pakkarnir taka skrárnar með.

## Takmarkanir

- Vélrænt lesinn texti getur innihaldið villur, einkum í töflum, handskrift og lélegum skönnunum.
- Síðunúmer í Word og OpenDocument fylgja síðuskilunum í skránni og geta vikið frá því sem ritvinnsluforrit sýnir.
- EXIF er aðeins lesið úr JPEG. HEIC-myndum úr símum þarf að umbreyta fyrst, því vafrinn getur ekki afkóðað þær.
- Mjög stór söfn (þúsundir mynda eða tugþúsundir síðna) taka tíma að lesa inn og pláss í geymslu vafrans; skiptu þeim
  í fleiri gagnasöfn.
