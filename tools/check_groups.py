#!/usr/bin/env python3
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
"""Checks the start list and the groups of scripts in src/boot.js against every file's Dataspatium.define.

The app loads the start list (`full`, with the language files) at start and each group of `GROUPS` the first time it is used
(Dataspatium.loadGroup / Dataspatium.ensure). This fails when:
  - a file is in no list, in two lists, or listed but missing; a group is named twice or needs a group that is not earlier;
  - a module depends (define's list) on a module that is neither in the start list nor in its own group or a group it needs;
  - a module requires one at run time (D.require, D.has, and the module names that data/workspace and io/url-import look up)
    that is not loaded with it, unless its file awaits the very group that module is in (D.ensure([...]) or D.loadGroup('...')
    naming it; a group that only needs that group does not count, so that the file names what it waits for);
  - the start list has a file that FORBIDDEN names (what the start must never load);
  - a module of the mobile page (MOBILE) depends on a module that is not in MOBILE.
Run from the repo root: python tools/check_groups.py (exit code 0 when everything holds; -v lists the awaited requires too).
"""
from __future__ import annotations

import glob
import io
import os
import re
import sys

BOOT = 'src/boot.js'
# Page scripts that the pages load themselves, not through the boot loader's lists.
PAGE_SCRIPTS = {'src/boot.js', 'src/start.js', 'src/mobile/start.js', 'src/mobile/profile.js'}
# What the start list must never have (a folder ends in /): the modes of the groups and the folders only groups use. It grows as
# parts of the start move to groups (PLAN 4).
FORBIDDEN = [
    'src/ui/modes/soka.js', 'src/ui/modes/bearbeta.js', 'src/ui/modes/kontrollera.js', 'src/ui/modes/analysera.js',
    'src/ui/modes/visualisera.js', 'src/ui/modes/exportera.js', 'src/ui/modes/dela.js',
    'src/ui/analysis/', 'src/ui/assistant/', 'src/ui/docs/', 'src/ui/viz/', 'src/mobile/',
]
PATH = re.compile(r"'((?:src|vendor|presets|tests)/[^']+\.js)'")
DEFINE = re.compile(r"(?<![\w$])(?:D|Dataspatium|globalThis\.Dataspatium)\.define\(\s*'([^']+)'\s*,\s*(\[[^\]]*\])?", re.S)
REQUIRE = re.compile(r"(?<![\w$.])(?:D|Dataspatium|globalThis\.Dataspatium)\.(require|has)\(\s*'([^']+)'\s*\)")
# Module names looked up through a helper or a table (data/workspace's optional() and importKind(), io/url-import's FORMAT_MODULES).
LOOKUP = re.compile(r"(?:\boptional\(\s*'([^']+)'\s*\)|\bimportKind\([^,]+,\s*'([^']+)'|\bmodule:\s*'([^']+)')")
ENSURE = re.compile(r"(?<![\w$])(?:D|Dataspatium)\.(?:ensure|loadGroup)\(\s*(\[[^\]]*\]|'[^']*')")
GROUP = re.compile(r"\{\s*name:\s*'([^']+)',\s*needs:\s*\[([^\]]*)\],\s*scripts:\s*\[([^\]]*)\]\s*\}", re.S)


def read(path: str) -> str:
    return io.open(path, encoding='utf-8').read()


def between(text: str, start: str, end: str) -> str:
    a = text.index(start)
    return text[a:text.index(end, a)]


def parse_boot() -> tuple[list[str], list[str], list[dict]]:
    """The start list (with the language files), the MOBILE list and the groups, as in src/boot.js."""
    text = read(BOOT)
    langs = re.findall(r"'([a-z]{2})'", between(text, 'const LANGUAGES = [', ']'))
    lang_files = ['src/ui/i18n/%s.js' % code for code in langs]
    lang_files.append('src/ui/i18n/languages.js')  # the chooser's words, in place of all seven at the first start (f51-lang)
    mobile = PATH.findall(between(text, 'const MOBILE = [', ']);')) + lang_files
    start = PATH.findall(between(text, 'const full = [', ']);')) + lang_files
    groups = []
    for m in GROUP.finditer(between(text, 'const GROUPS = [', '\n  ];')):
        groups.append({'name': m.group(1), 'needs': re.findall(r"'([^']+)'", m.group(2)), 'scripts': PATH.findall(m.group(3))})
    return start, mobile, groups


def parse_file(path: str) -> dict:
    text = read(path)
    defines = [(name, re.findall(r"'([^']+)'", deps or '')) for name, deps in DEFINE.findall(text)]
    lines = text.split('\n')
    uses = []
    for no, line in enumerate(lines, 1):
        for kind, name in REQUIRE.findall(line):
            uses.append((no, kind, name))
        for found in LOOKUP.findall(line):
            uses.append((no, 'lookup', next(x for x in found if x)))
    ensured = set()
    for arg in ENSURE.findall(text):
        ensured.update(re.findall(r"'([^']+)'", arg))
    return {'defines': defines, 'uses': uses, 'ensured': ensured, 'size': os.path.getsize(path)}


def main(argv: list[str]) -> int:
    verbose = '-v' in argv
    errors: list[str] = []
    start, mobile, groups = parse_boot()
    names = [g['name'] for g in groups]
    # Which list each file is in.
    where: dict[str, str] = {}
    for label, paths in [('start', start)] + [(g['name'], g['scripts']) for g in groups]:
        for p in paths:
            if p in where:
                errors.append('%s is in two lists: %s and %s' % (p, where[p], label))
            where.setdefault(p, label)
    for p in list(where) + mobile:
        if not os.path.exists(p):
            errors.append('%s is listed but does not exist' % p)
    for p in mobile:
        if p not in where:
            errors.append('%s is in MOBILE but in no list of the app' % p)
    for p in sorted(set(f.replace(os.sep, '/') for f in glob.glob('src/**/*.js', recursive=True)) - PAGE_SCRIPTS - set(where)):
        errors.append('%s is in no list of src/boot.js' % p)
    def forbidden(f: str, p: str) -> bool:
        return p == f or (f.endswith('/') and p.startswith(f))
    for f in FORBIDDEN:
        if not any(forbidden(f, p) for p in where):
            errors.append('FORBIDDEN names %s, which no listed file is' % f)
        for p in start:
            if forbidden(f, p):
                errors.append('%s is in the start list, which must never load it (FORBIDDEN %s)' % (p, f))
    # Each group's needs: earlier groups, and the closure of them.
    closure: dict[str, set[str]] = {'start': {'start'}}
    for i, g in enumerate(groups):
        if g['name'] in names[:i]:
            errors.append('group %s is defined twice' % g['name'])
        own = {g['name']}
        for n in g['needs']:
            if n not in names[:i]:
                errors.append('group %s needs %s, which is not an earlier group' % (g['name'], n))
                continue
            own |= closure[n]
        closure[g['name']] = own | {'start'}
    info = {p: parse_file(p) for p in where if os.path.exists(p)}
    module_list: dict[str, str] = {}
    module_file: dict[str, str] = {}
    for p, f in info.items():
        for name, _deps in f['defines']:
            if name in module_file:
                errors.append('module %s is defined in %s and %s' % (name, module_file[name], p))
            module_list[name] = where[p]
            module_file[name] = p
    awaited = []
    for p, f in sorted(info.items()):
        label = where[p]
        allowed = closure.get(label, {'start'})
        for name, deps in f['defines']:
            for d in deps:
                if d not in module_list:
                    errors.append('%s (%s) depends on %s, which no listed file defines' % (name, p, d))
                elif module_list[d] not in allowed:
                    errors.append('%s (%s, %s) depends on %s (%s): not in the start list, its own group or a group it needs'
                                  % (name, p, label, d, module_list[d]))
        lazy = set(allowed)
        for g in f['ensured']:
            if g not in closure:
                errors.append('%s awaits the group %s, which src/boot.js does not have' % (p, g))
                continue
            lazy |= {g}
        for no, kind, target in f['uses']:
            if target not in module_list:
                if kind == 'require' and not target.startswith('tests/'):
                    errors.append('%s:%d requires %s, which no listed file defines' % (p, no, target))
                continue
            group = module_list[target]
            if group in allowed:
                continue
            if group in lazy:
                awaited.append('%s:%d %s %s (%s)' % (p, no, kind, target, group))
                continue
            errors.append('%s:%d (%s) %s %s, which is in the group %s: await it with D.ensure([\'%s\'], ...) in the file, or move it'
                          % (p, no, label, 'requires' if kind == 'require' else ('checks for' if kind == 'has' else 'looks up'), target, group, group))
    # The mobile page loads only its own list.
    mobile_modules = {name for p in mobile if p in info for name, _deps in info[p]['defines']}
    for p in mobile:
        for name, deps in (info[p]['defines'] if p in info else []):
            for d in deps:
                if d not in mobile_modules and not d.startswith('i18n/'):
                    errors.append('%s (%s) on the mobile page depends on %s, which MOBILE does not load' % (name, p, d))
    # Summary: files and bytes per list (the language files counted once, Swedish, as after the first choice).
    def size(paths: list[str]) -> int:
        return sum(info[p]['size'] for p in paths if p in info and not (p.startswith('src/ui/i18n/') and p != 'src/ui/i18n/sv.js' and not p.endswith('i18n.js')))
    one_lang = [p for p in start if not p.startswith('src/ui/i18n/') or p.endswith(('/sv.js', '/i18n.js'))]
    print('%-12s %5s %10s  %s' % ('list', 'files', 'bytes', 'needs'))
    print('%-12s %5d %10d' % ('start', len(one_lang), size(one_lang)))
    for g in groups:
        print('%-12s %5d %10d  %s' % (g['name'], len(g['scripts']), size(g['scripts']), ', '.join(g['needs'])))
    lazy_files = [p for g in groups for p in g['scripts']]
    print('%-12s %5d %10d' % ('groups', len(lazy_files), size(lazy_files)))
    print('%-12s %5d %10d  (mobile page)' % ('MOBILE', len([p for p in mobile if not p.startswith('src/ui/i18n/') or p.endswith(('/sv.js', '/i18n.js'))]), size(mobile)))
    if verbose:
        print('awaited requires:')
        for a in awaited:
            print('  ' + a)
    else:
        print('%d requires of a later group, each in a file that awaits it (-v lists them)' % len(awaited))
    for e in errors:
        print('ERROR ' + e)
    print('check_groups: %s' % ('ok' if not errors else '%d error(s)' % len(errors)))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
