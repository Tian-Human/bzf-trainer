"""Erzeugt data/fragen.json aus dem BNetzA-Fragenkatalog (PDF).

Aufruf (aus dem Projektordner):
    python tools/parse_catalog.py quelle/2024Pruefungsfragen_BZFII_BZFI.pdf data/fragen.json

Voraussetzung: `pdftotext` (xpdf oder Poppler) ist installiert und im PATH.
Der Text wird mit `-raw` extrahiert, also in der Reihenfolge des PDF-Inhalts.
Damit bleiben mehrzeilige Antworten zusammen.

Im Katalog ist die richtige Antwort immer A. In der JSON-Datei steht die
richtige Antwort deshalb immer an Index 0 von `antworten`; die Website mischt
die Reihenfolge beim Anzeigen.
"""

import json
import re
import subprocess
import sys

# Manuelle Korrekturen, falls die Extraktion eine Frage falsch zerlegt.
# Format: {nr: {"frage": "...", "antworten": {"A": "...", ...}}}
FIXES = {}

# Fragen mit Abbildung. Die Bilder sind aus dem PDF extrahiert und liegen in
# data/bilder/. Bei einem neuen Katalog müssen sie von Hand geprüft werden.
BILDER = {
    117: 'data/bilder/frage117.png',  # Kartensymbol: ausgefülltes Dreieck im Kreis
    118: 'data/bilder/frage118.png',  # Kartensymbol: offenes Dreieck im Kreis
}

SKIP = re.compile(r'^(Prüfungsfragen im Prüfungsteil|Stand: \d{4} richtige Antwort immer A)')
QUESTION = re.compile(r'^(\d{1,3})(?:\s+(\S.*))?$')
ANSWER = re.compile(r'^([A-D])(?:\s+(\S.*))?$')


def extract_text(pdf_path):
    return subprocess.run(
        ['pdftotext', '-enc', 'UTF-8', '-raw', pdf_path, '-'],
        check=True, capture_output=True,
    ).stdout.decode('utf-8')


def parse(text):
    fragen, cur, field = [], None, None
    started = False
    for raw in text.split('\n'):
        line = raw.replace('\f', '').strip()
        if not started:
            started = bool(re.match(r'^1\s+Welche zwischenstaatliche', line))
            if not started:
                continue
        if not line or SKIP.match(line):
            continue

        m = QUESTION.match(line)
        if m and (cur is None or int(m.group(1)) == cur['nr'] + 1):
            cur = {'nr': int(m.group(1)), 'frage': m.group(2) or '', 'a': {}}
            fragen.append(cur)
            field = 'frage'
            continue

        m = ANSWER.match(line)
        if m and cur is not None and len(cur['a']) == 'ABCD'.index(m.group(1)):
            field = m.group(1)
            cur['a'][field] = m.group(2) or ''
            continue

        if field == 'frage':
            cur['frage'] += ' ' + line
        else:
            cur['a'][field] += ' ' + line

    result = []
    for q in fragen:
        fix = FIXES.get(q['nr'], {})
        answers = {**q['a'], **fix.get('antworten', {})}
        entry = {
            'nr': q['nr'],
            'frage': clean(fix.get('frage', q['frage'])),
            'antworten': [clean(answers.get(k, '')) for k in 'ABCD'],
        }
        if q['nr'] in BILDER:
            entry['bild'] = BILDER[q['nr']]
        result.append(entry)
    return result


def clean(s):
    return re.sub(r'\s+', ' ', s).strip()


def validate(fragen):
    problems = []
    nums = [q['nr'] for q in fragen]
    if nums != list(range(1, len(nums) + 1)):
        problems.append('Nummerierung nicht fortlaufend')
    for q in fragen:
        if not q['frage'] or any(not a for a in q['antworten']):
            problems.append(f"Frage {q['nr']}: leeres Feld")
        for part in [q['frage'], *q['antworten']]:
            if re.search(r'Seite \d+ von|richtige Antwort immer|Prüfungsfragen im Prüfungsteil', part):
                problems.append(f"Frage {q['nr']}: Kopf-/Fußzeile im Text")
    return problems


def main():
    pdf_path, out_path = sys.argv[1], sys.argv[2]
    fragen = parse(extract_text(pdf_path))
    problems = validate(fragen)
    for p in problems:
        print('WARNUNG:', p)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(fragen, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(fragen)} Fragen nach {out_path} geschrieben.')


if __name__ == '__main__':
    main()
