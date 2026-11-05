"""The shared glossary: the words Dataspatium and Kontroll have in common, in seven languages, as presets/i18n-shared.json. The keys
are listed in presets/shared-keys.txt (one per line, # comments); the values come from src/ui/i18n/<lang>.js, so the app's own
translations are the source and Kontroll compares its files against the JSON. Run from the repo root; --check fails when the JSON on
disk differs from what the i18n files give (CI and tests)."""
from __future__ import annotations

import io
import json
import re
import sys

LANGS = ['sv', 'en', 'da', 'nb', 'nn', 'fi', 'is']
KEYS_FILE = 'presets/shared-keys.txt'
OUT = 'presets/i18n-shared.json'
LINE = re.compile(r"^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$", re.M)


def load_lang(lang: str) -> dict[str, str]:
    text = io.open(f'src/ui/i18n/{lang}.js', encoding='utf-8').read()
    out = {}
    for m in LINE.finditer(text):
        out[m.group(1)] = m.group(2).replace("\\'", "'").replace('\\\\', '\\')
    return out


def keys() -> list[str]:
    lines = io.open(KEYS_FILE, encoding='utf-8').read().splitlines()
    return [l.strip() for l in lines if l.strip() and not l.strip().startswith('#')]


def build() -> dict:
    langs = {lang: load_lang(lang) for lang in LANGS}
    wanted = keys()
    missing = [(lang, k) for lang in LANGS for k in wanted if k not in langs[lang]]
    if missing:
        raise SystemExit('missing in i18n files: ' + ', '.join(f'{l}:{k}' for l, k in missing[:20]))
    return {
        'name': 'Dataspatium and Kontroll shared glossary',
        'version': 1,
        'source': 'Dataspatium src/ui/i18n/<lang>.js, chosen by presets/shared-keys.txt; regenerate with python tools/shared_glossary.py',
        'languages': LANGS,
        'keys': {k: {lang: langs[lang][k] for lang in LANGS} for k in wanted},
    }


def main(argv: list[str]) -> int:
    data = build()
    text = json.dumps(data, ensure_ascii=False, indent=1) + '\n'
    if '--check' in argv:
        try:
            current = io.open(OUT, encoding='utf-8').read()
        except OSError:
            current = ''
        if current != text:
            print(f'{OUT} differs from the i18n files; run python tools/shared_glossary.py')
            return 1
        print(f'{OUT} is current ({len(data["keys"])} keys, {len(LANGS)} languages)')
        return 0
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(text)
    print(f'wrote {OUT}: {len(data["keys"])} keys in {len(LANGS)} languages')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
