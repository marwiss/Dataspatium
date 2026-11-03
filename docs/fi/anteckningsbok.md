# Muistikirja

Muistikirja yhdistää tekstiä, R-koodia ja SQL:ää soluihin, jotka suoritetaan järjestyksessä, ja jokaisen solun tuloste
tallennetaan sen alle. Se on Analysoi-tilan kolmas välilehti ja tie analyysistä valmiiseen raporttiin sovelluksesta
poistumatta.

## Luo ja työskentele

Napsauta kohdepaneelin *Muistikirjat*-kohdan plusmerkkiä (tai valitse komentopaletista *Uusi muistikirja*), anna
muistikirjalle nimi ja aloita ensimmäisestä solusta. Uusi muistikirja saa otsikkosolun, R-solun, joka lukee valitun aineiston
sen lyhytnimellä, ja SQL-solun. Aineisto, jota vastaan SQL-solut suoritetaan, valitaan oikeanpuoleisesta
ominaisuuspaneelista.

Jokaisella solulla on tyyppi (Teksti, R tai SQL), jonka voi vaihtaa, painikkeet suorittamiseen, siirtämiseen ylös tai alas ja
poistamiseen sekä tulosalue. Ctrl+Enter suorittaa solun, jossa olet; *Suorita kaikki* suorittaa muistikirjan ylhäältä alas.
Soluja lisätään loppuun painikkeilla *Teksti*, *R* ja *SQL*. Kaikki tallennetaan automaattisesti, myös tulosteet.

- **Tekstisolut** kirjoitetaan Markdown-muodossa (otsikot `#`-merkillä, luettelot `-`-merkillä, `**lihavoitu**`,
  `*kursivoitu*`, linkit ja taulukot), ja ne näytetään muotoiltuina muokkauskentän alla.
- **R-solut** suoritetaan samassa R-istunnossa kuin R-konsoli, joten muuttujat säilyvät solujen ja suorituskertojen välillä,
  kunnes R käynnistetään uudelleen. Tulosteet, virheet, kaaviot ja `dm_write()`-funktiolla luodut aineistot kootaan solun
  alle. Kaaviot tallennetaan PNG-muodossa.
- **SQL-solut** suoritetaan muistikirjan aineiston taulua `data` vastaan. SELECT-kyselyt näyttävät enintään 1 000 riviä
  (näkymässä ensimmäiset 50); UPDATE, DELETE ja muut muuttavat lauseet suoritetaan aineiston reseptin vaiheena ja kirjataan
  sinne.

## Vie ja jaa

*Vie* luo asiakirjan koko muistikirjasta: HTML (itsenäinen sivu), Word, PDF, Markdown (kuvat ZIP-tiedostossa, kun mukana on
kaavioita) tai LaTeX (ZIP, jossa `main.tex` ja kuvat). Tekstisoluista tulee leipätekstiä, koodista koodilohkoja (voi jättää
pois), taulukoista taulukoita ja kaavioista kuvia. Käytössä ovat samat rakentajat kuin asiakirjamalleissa (ks.
[dokumentmallar.md](dokumentmallar.md)).

*Jaa (tiedosto)* lataa muistikirjan `*.nb.json`-tiedostona soluineen ja tallennettuine tulosteineen; toinen käyttäjä lataa
tiedoston toiminnolla *Tuo muistikirja (tiedosto)*, ja aineisto yhdistetään lyhytnimen tai nimen perusteella. Muistikirjat
kulkevat mukana myös varmuuskopiossa, paketeissa ja siirrettävässä kansiossa.

## Rajoitukset

- R-koodia ei voi keskeyttää file://-tilassa; käytä R-välilehden toimintoa *Käynnistä R uudelleen*, jos solu jumittuu.
  Kun sovellus ajetaan verkkopalvelimelta, R-välilehden painike *Keskeytä* pysäyttää myös käynnissä olevan solun.
- Tulosteet tallennetaan selaimeen muistikirjan mukana. Monet suuret kaaviot kasvattavat muistikirjaa.
- Tekstin muokkauskentässä ei ole Markdown-syntaksin korostusta.
