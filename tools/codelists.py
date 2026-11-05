#!/usr/bin/env python3
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
"""Fetch the standard code lists that ship with the app and write them to presets/kodlistor/.

Run by hand when a list needs updating:  python tools/codelists.py
The app itself never fetches them. Each list is written as JSON:
  {"id", "name", "source", "license", "url", "version", "languages": [...], "codes": [[code, label_lang1, label_lang2, ...], ...]}
Sources and licences are listed in presets/kodlistor/KALLA.md, which this script writes as well.
"""
import csv
import io
import json
import os
import sys
import urllib.parse
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'presets', 'kodlistor')
AGENT = 'Dataspatium code list tool'


def get(url, data=None, headers=None):
    head = {'User-Agent': AGENT, 'Accept': '*/*'}
    head.update(headers or {})
    request = urllib.request.Request(url, data=data, headers=head)
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def get_json(url, body=None):
    data = json.dumps(body).encode('utf-8') if body is not None else None
    return json.loads(get(url, data=data, headers={'Content-Type': 'application/json'} if body is not None else None).decode('utf-8-sig'))


# ---- SCB (PxWeb) -----------------------------------------------------------------------------------------------------
def scb(path, variable, lang):
    meta = get_json(f'https://api.scb.se/OV0104/v1/doris/{lang}/ssd/{path}')
    for v in meta['variables']:
        if v['code'] == variable:
            return dict(zip(v['values'], v['valueTexts']))
    raise SystemExit(f'SCB: no variable {variable} in {path}')


def strip_code(text, code):
    """SCB and DST put the code first in some labels."""
    return text[len(code):].strip(' .-') if text.startswith(code + ' ') else text


def scb_list(path, variable):
    sv = scb(path, variable, 'sv')
    en = scb(path, variable, 'en')
    return [[code, strip_code(sv[code], code), strip_code(en.get(code, ''), code)] for code in sv]


# ---- Eurostat ----------------------------------------------------------------------------------------------------------
def eurostat(code_list, lang):
    url = f'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/codelist/ESTAT/{code_list}?format=TSV&lang={lang}'
    text = get(url).decode('utf-8-sig')
    out = {}
    for row in csv.reader(io.StringIO(text), delimiter='\t'):
        if len(row) >= 2 and row[0]:
            out[row[0]] = row[1]
    return out


def eurostat_list(code_list, keep=None):
    en = eurostat(code_list, 'en')
    return [[code, label] for code, label in en.items() if keep is None or keep(code)]


# ---- Statistics Norway (KLASS) ---------------------------------------------------------------------------------------------
def klass(number, language):
    url = f'https://data.ssb.no/api/klass/v1/classifications/{number}/codesAt.json?date=2025-01-01&language={language}'
    return {c['code']: c['name'] for c in get_json(url)['codes']}


def klass_list(number):
    nb = klass(number, 'nb')
    en = klass(number, 'en')
    return [[code, nb[code], en.get(code, '')] for code in nb]


# ---- Statistics Denmark ------------------------------------------------------------------------------------------------------
def dst(table, variable, lang):
    info = get_json('https://api.statbank.dk/v1/tableinfo', {'table': table, 'format': 'JSON', 'lang': lang})
    for v in info['variables']:
        if v['id'] == variable:
            return {x['id']: x['text'] for x in v['values']}
    raise SystemExit(f'DST: no variable {variable} in {table}')


def dst_list(table, variable):
    da = dst(table, variable, 'da')
    en = dst(table, variable, 'en')
    return [[code, strip_code(da[code], code), strip_code(en.get(code, ''), code)] for code in da]


# ---- Statistics Finland -------------------------------------------------------------------------------------------------------
def stat_fi(classification, lang):
    url = f'https://data.stat.fi/api/classifications/v2/classifications/{classification}/classificationItems?content=data&format=json&lang={lang}&pageSize=3000'
    out = {}
    for item in get_json(url):
        names = item.get('classificationItemNames') or []
        if names:
            out[item['code']] = names[0].get('name', '')
    return out


def stat_fi_list(classification):
    fi = stat_fi(classification, 'fi')
    sv = stat_fi(classification, 'sv')
    en = stat_fi(classification, 'en')
    return [[code, fi[code], sv.get(code, ''), en.get(code, '')] for code in fi]


SCB_LICENSE = ('SCB', 'CC0', 'https://www.scb.se/vara-tjanster/oppna-data/')
EUROSTAT_LICENSE = ('Eurostat', 'CC BY 4.0', 'https://ec.europa.eu/eurostat/about-us/policies/copyright')
SSB_LICENSE = ('Statistisk sentralbyrå (SSB)', 'NLOD', 'https://www.ssb.no/en/informasjon/copyright')
DST_LICENSE = ('Danmarks Statistik', 'CC BY 4.0', 'https://www.dst.dk/en/Statistik/brug-statistikken/kildeangivelse')
STATFI_LICENSE = ('Tilastokeskus (Statistics Finland)', 'CC BY 4.0', 'https://stat.fi/org/lainsaadanto/copyright_en.html')
NUTS_LIKE = lambda c: len(c) >= 2 and c[:2].isalpha() and c[:2].isupper() and all(ch.isalnum() for ch in c) and len(c) <= 5  # noqa: E731

LISTS = [
    ('ssyk2012', 'SSYK 2012', ['sv', 'en'], SCB_LICENSE, 'PxWeb AM/AM0208/AM0208M/YREG60N, Yrke2012', lambda: scb_list('AM/AM0208/AM0208M/YREG60N', 'Yrke2012')),
    ('sni2007', 'SNI 2007', ['sv', 'en'], SCB_LICENSE, 'PxWeb NV/NV0101/FDBR07N, SNI2007', lambda: scb_list('NV/NV0101/FDBR07N', 'SNI2007')),
    ('cofog', 'COFOG', ['en'], EUROSTAT_LICENSE, 'SDMX codelist COFOG99', lambda: eurostat_list('COFOG99')),
    ('isced', 'ISCED 2011', ['en'], EUROSTAT_LICENSE, 'SDMX codelist ISCED11', lambda: eurostat_list('ISCED11')),
    ('nace', 'NACE Rev. 2', ['en'], EUROSTAT_LICENSE, 'SDMX codelist NACE_R2', lambda: eurostat_list('NACE_R2')),
    ('nuts', 'NUTS', ['en'], EUROSTAT_LICENSE, 'SDMX codelist GEO, the codes shaped as NUTS', lambda: eurostat_list('GEO', NUTS_LIKE)),
    ('sn2007', 'SN2007 (Norge)', ['nb', 'en'], SSB_LICENSE, 'KLASS 6', lambda: klass_list(6)),
    ('styrk08', 'STYRK-08 (Norge)', ['nb', 'en'], SSB_LICENSE, 'KLASS 7', lambda: klass_list(7)),
    ('db07', 'DB07 (Danmark)', ['da', 'en'], DST_LICENSE, 'Statbank ERHV1, BRANCHE07', lambda: dst_list('ERHV1', 'BRANCHE07')),
    ('tol2008', 'TOL 2008 (Suomi)', ['fi', 'sv', 'en'], STATFI_LICENSE, 'toimiala_1_20080101', lambda: stat_fi_list('toimiala_1_20080101')),
    ('ammatti2010', 'Ammattiluokitus 2010 (Suomi)', ['fi', 'sv', 'en'], STATFI_LICENSE, 'ammatti_1_20100101', lambda: stat_fi_list('ammatti_1_20100101')),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    wanted = set(sys.argv[1:])
    notes = ['# Kodlistor', '', 'Listorna hämtas med `python tools/codelists.py` och följer med appen. Appen hämtar dem aldrig själv.', '',
             '| Lista | Källa | Licens | Hämtad ur |', '|---|---|---|---|']
    for list_id, name, languages, (source, license_name, url), where, fetch in LISTS:
        path = os.path.join(OUT, list_id + '.json')
        if not wanted or list_id in wanted:
            try:
                codes = fetch()
            except Exception as err:  # A source that is down leaves the earlier file in place.
                print(f'{list_id}: {err}')
                codes = None
            if codes:
                with open(path, 'w', encoding='utf-8', newline='\n') as fh:
                    json.dump({'id': list_id, 'name': name, 'source': source, 'license': license_name, 'url': url, 'languages': languages, 'codes': codes}, fh, ensure_ascii=False, separators=(',', ':'))
                print(f'{list_id}: {len(codes)} codes')
        notes.append(f'| {name} | {source} | {license_name} | {where} |')
    notes += ['', 'Landnamn kommer från webbläsaren (`Intl.DisplayNames`). Kommun- och länskoder följer med gränserna under `presets/geo/`.', '',
              'Hagstofa Íslands svarar med 429 på skript, så ingen isländsk lista följer med. ÍSAT stämmer med NACE på fyra siffror.', '']
    with open(os.path.join(OUT, 'KALLA.md'), 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(notes))


if __name__ == '__main__':
    main()
