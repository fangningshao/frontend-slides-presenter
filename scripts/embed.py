#!/usr/bin/env python3
"""Embed/update Presenter Mode without rewriting a deck's CSS or controller."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
import re

BEGIN = '<!-- frontend-slides-presenter:begin -->'
END = '<!-- frontend-slides-presenter:end -->'


class BodyEnd(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=False)
        self.offsets = [0]
        for line in html.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.position = None
        self.feed(html)

    def handle_endtag(self, tag):
        if tag == 'body':
            line, col = self.getpos()
            self.position = self.offsets[line - 1] + col


def embed(html, runtime):
    if html.count(BEGIN) != html.count(END) or html.count(BEGIN) > 1:
        raise ValueError('Ambiguous Presenter markers; repair the existing block first.')
    if BEGIN in html:
        html = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END) + r'\n?', '', html, flags=re.S)
    if 'window.frontendSlidesPresenterAdapter' not in html:
        raise ValueError('Define window.frontendSlidesPresenterAdapter next to the deck controller first (see references/integration.md).')
    position = BodyEnd(html).position
    if position is None:
        raise ValueError('No closing body tag found in HTML.')
    # Protect inline JS against an HTML parser terminating a script in a JS string.
    runtime = re.sub(r'</script', r'<\/script', runtime, flags=re.I)
    block = f'''{BEGIN}
<script>
{runtime}
FrontendSlidesPresenter.mount(window.frontendSlidesPresenterAdapter);
</script>
{END}
'''
    return html[:position] + block + html[position:]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path, help='May equal input for an intentional in-place update.')
    args = parser.parse_args()
    runtime = Path(__file__).resolve().parents[1] / 'assets' / 'presenter.js'
    try:
        result = embed(args.input.read_text(encoding='utf-8'), runtime.read_text(encoding='utf-8'))
        args.output.write_text(result, encoding='utf-8')
    except (ValueError, OSError) as error:
        parser.exit(1, f'Presenter: {error}\n')
    print(f'Presenter embedded: {args.output}')


if __name__ == '__main__':
    main()
