# Indsamling i felten

Med **Indsamling i felten** udfylder du rækker på telefonen, med eller uden net, med foto og position. Formularen bygger på et datasæts
kolonner og regler, så en forkert række ses med det samme, der hvor du står. Rækkerne kommer derefter tilbage til computeren som en ny
version af datasættet. Fotoene bliver en billedsamling, og positionerne havner på kortet.

## Sådan foregår det

1. I **Hent** vælger du *Indsamling i felten* og derefter et datasæt eller *Nyt datasæt*.
2. Bestem, hvilke felter telefonen skal spørge om, og tryk på *Send til mobilen*.
3. Tilslut telefonen under **Enheder** i Del, og send formularen. Telefonen skal have net denne gang.
4. På telefonen åbner du formularen og indsamler rækker. Nu er der ikke brug for net.
5. Når du er tilbage, trykker du på *Send til computeren* og scanner computerens kode.
6. Computeren viser, hvad der er kommet, og du vælger *Tilføj*.

## Formularen

Hver kolonne bliver et felt. Du kan slå en kolonne fra, ændre etiketten og vælge, om feltet er påkrævet. *Behold til næste række* passer
til det, der er ens på mange rækker, for eksempel dato eller område.

Feltets type kommer fra kolonnen. Værdietiketter og reglen *tilladte værdier* bliver af sig selv til en valgliste. Du kan også skrive valg
selv, ét pr. linje som `værdi` eller `kode = tekst`, eller hente dem med *Hent valg fra kolonnen*.

Position og fotos kan være slået fra, valgfrie eller påkrævede. Fotos formindskes på telefonen, så længste side bliver 2048 pixels, medmindre
du vælger noget andet under *Flere indstillinger*.

*Nyt datasæt* tager én kolonne pr. linje, som `sted` eller `antal: heltal`.

Før formularen forlader computeren, viser appen, hvad der følger med. Det er felter, etiketter, valg og regler, aldrig rækker.

## Reglerne

Telefonen kontrollerer reglerne med samme SQLite som computeren, så en række vurderes ens begge steder.

- **Kontrolleres på telefonen:** intervaller, tilladte og forbudte værdier, mønstre, formater, længde, personnumre og andre identiteter,
  sammenligninger mellem kolonner og frie SQL-betingelser, der kun bruger formularens kolonner.
- **Unikke værdier** sammenlignes kun med rækkerne på telefonen. Computeren kontrollerer mod hele datasættet.
- **Kontrolleres kun på computeren:** fuldstændighed, værdier i et andet datasæt og regler om kolonner, der ikke er med i formularen.

En fejl i formularen, som et tomt påkrævet felt eller et bogstav i et talfelt, forhindrer, at rækken gemmes. En brudt regel forhindrer det én
gang. Trykker du på Gem igen, beholdes rækken med reglen noteret, da du, der står på stedet, kan vide bedre end reglen.

## På telefonen

Formularen ligger øverst på startsiden i Dataspatium Mobil. *Gem og ny række* er den almindelige vej videre.

En række, du er i gang med, gemmes som kladde fra første ændring, og fotos gemmes, så snart de er taget. Telefoner lukker undertiden siden, når
kameraet åbnes. Så tilbyder formularen *Fortsæt på kladden*, når du kommer tilbage.

Telefonen viser *Virker uden net på denne telefon*, når den har alt, den behøver. Står der i stedet, at siden skal åbnes en gang til, så gør det,
mens du har net. Installér gerne siden på hjemmeskærmen. Browsere kan ellers rydde lageret for sider, der ikke bruges, og på en iPhone kan
det ske efter en uge uden brug.

Rækker bliver på telefonen, indtil du vælger *Ryd sendte*. En sendt række kan ikke ændres på telefonen, kun på computeren.

Har du ingen forbindelse til computeren, kan du bruge *Del som fil* og sende filen på anden måde. Den modtages under **Modtag** i Del.

## På computeren

Rækkerne kommer via Enheder eller Modtag, og du ser dem, før noget tilføjes.

- Tabellen gemmes først som en version, så du kan gå tilbage.
- Manglende kolonner tilføjes: `falt_id`, `lat`, `lon`, `noggrannhet_m`, `foto`, `insamlad` og `insamlad_av`. Har datasættet allerede kolonner
  for længde- og breddegrad, bruges de.
- Datasættet åbnes som kort i Bearbejd, da rækkerne har positioner.
- Fotoene bliver billedsamlingen *Navn: fotos* med rækkens position og tid. Senere leverancer havner i samme samling.
- Datasættets regler køres på resultatet, og loggen siger, hvor mange der brydes.

Rækker genkendes på `falt_id`. Samme fil kan derfor modtages to gange, uden at noget fordobles, men en række, der er ændret på computeren,
overskrives ikke.

Findes datasættet ikke længere på computeren, foreslås et nyt med formularens kolonner.

## Personoplysninger

Position og fotos er ofte personoplysninger, og et foto kan vise mennesker. Spørg kun om det, der er nødvendigt, og slå ellers position og fotos fra.

Telefonen beder om lov, før den oplyser positionen, og selve positionen sendes ingen steder, før du sender rækkerne. Rækker og fotos ligger
ukrypteret i browserens lager på telefonen, så send dem og ryd op jævnligt.

## Begrænsninger

- Dataspatium Mobil køres fra en webadresse, ikke fra en fil, og skal have net første gang.
- Nøjagtigheden af en position afhænger af telefonen. Feltet `noggrannhet_m` siger, hvor sikker den er.
- Store indsamlinger deles op i flere filer, som modtages hver for sig.
- Flere telefoner kan indsamle med samme formular. Hver telefon har sine egne rækker, og de tilføjes hver for sig.
