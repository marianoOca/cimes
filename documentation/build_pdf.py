#!/usr/bin/env python3
import re, base64, html, pathlib

BASE = pathlib.Path(__file__).parent
md = (BASE / "propuesta-comercial-cimes.md").read_text(encoding="utf-8")
logo_b64 = base64.b64encode((BASE / "logo-cimes.png").read_bytes()).decode()

def inline(t):
    t = html.escape(t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', t)
    t = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', t)
    return t

lines = md.split("\n")
out, i = [], 0
n = len(lines)

def indent(s):
    return len(s) - len(s.lstrip(" "))

while i < n:
    ln = lines[i]
    s = ln.strip()
    if s == "":
        i += 1; continue
    if s == "---":
        out.append("<hr>"); i += 1; continue
    m = re.match(r'^(#{1,6})\s+(.*)$', s)
    if m:
        lvl = len(m.group(1)); out.append(f"<h{lvl}>{inline(m.group(2))}</h{lvl}>"); i += 1; continue
    # table
    if s.startswith("|"):
        tbl = []
        while i < n and lines[i].strip().startswith("|"):
            tbl.append(lines[i].strip()); i += 1
        cells = lambda r: [c.strip() for c in r.strip("|").split("|")]
        head = cells(tbl[0]); body = tbl[2:]
        out.append('<table><thead><tr>' + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>")
        for r in body:
            out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in cells(r)) + "</tr>")
        out.append("</tbody></table>"); continue
    # blockquote
    if s.startswith(">"):
        buf = []
        while i < n and lines[i].strip().startswith(">"):
            buf.append(lines[i].strip()[1:].strip()); i += 1
        out.append(f"<blockquote>{inline(' '.join(buf))}</blockquote>"); continue
    # lists (ordered / unordered, with nesting by indent)
    if re.match(r'^\s*([-*]|\d+\.)\s+', ln):
        ordered_top = bool(re.match(r'^\s*\d+\.\s+', ln))
        tag = "ol" if ordered_top else "ul"
        out.append(f"<{tag}>")
        stack = [(indent(ln), tag)]
        while i < n and re.match(r'^\s*([-*]|\d+\.)\s+', lines[i]):
            cur = lines[i]; ci = indent(cur)
            txt = re.sub(r'^\s*([-*]|\d+\.)\s+', '', cur)
            is_ord = bool(re.match(r'^\s*\d+\.\s+', cur))
            if ci > stack[-1][0]:
                t2 = "ol" if is_ord else "ul"
                out.append(f"<{t2}>"); stack.append((ci, t2))
            while ci < stack[-1][0] and len(stack) > 1:
                out.append(f"</{stack[-1][1]}>"); stack.pop()
            out.append(f"<li>{inline(txt)}</li>"); i += 1
        while stack:
            out.append(f"</{stack[-1][1]}>"); stack.pop()
        continue
    # paragraph
    buf = []
    while i < n and lines[i].strip() and not re.match(r'^(#{1,6}\s|>|\||\s*([-*]|\d+\.)\s)', lines[i]) and lines[i].strip() != "---":
        buf.append(lines[i].strip()); i += 1
    out.append(f"<p>{inline(' '.join(buf))}</p>")

body = "\n".join(out)

# Pull the first h1 as document title/header block, remove leading meta paragraph styling handled by CSS
tpl = f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{{
  --bg:hsl(240 64% 6%); --card:hsl(240 50% 10%); --fg:hsl(0 0% 98%);
  --muted:hsl(220 20% 72%); --gold:hsl(43 64% 55%); --gold-d:hsl(43 60% 42%);
  --electric:hsl(195 100% 55%); --border:hsl(240 30% 24%);
}}
*{{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
@page{{size:A4;margin:1cm;}}
html,body{{margin:0;padding:0;background:var(--bg);}}
body{{font-family:'Outfit',system-ui,sans-serif;background:var(--bg);color:var(--fg);
  font-size:13pt;line-height:1.55;}}
.page{{padding:0;}}
.masthead{{display:flex;align-items:center;gap:16px;border-bottom:2px solid var(--gold);
  padding-bottom:16px;margin-bottom:8px;}}
.masthead img{{height:52px;background:#fff;border-radius:10px;padding:5px;}}
.masthead .t{{font-size:8.5pt;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;}}
.masthead .t b{{color:var(--gold);font-size:11pt;display:block;letter-spacing:1px;}}
h1{{font-size:27pt;font-weight:700;line-height:1.15;margin:6px 0 14px;color:var(--gold);}}
h2{{font-size:18pt;font-weight:700;color:var(--gold);margin:24px 0 9px;
  padding-bottom:6px;border-bottom:1px solid var(--border);}}
h3{{font-size:14pt;font-weight:600;color:var(--electric);margin:16px 0 5px;}}
p{{margin:7px 0;}}
strong{{color:#fff;font-weight:600;}}
em{{color:var(--muted);}}
a{{color:var(--electric);text-decoration:none;}}
ul,ol{{margin:7px 0 7px 4px;padding-left:20px;}}
li{{margin:3px 0;}}
li::marker{{color:var(--gold);}}
hr{{border:none;border-top:1px solid var(--border);margin:16px 0;}}
blockquote{{background:var(--card);border-left:3px solid var(--gold);border-radius:0 8px 8px 0;
  margin:12px 0;padding:10px 16px;color:var(--fg);font-weight:500;}}
table{{width:100%;border-collapse:collapse;margin:12px 0;font-size:12pt;
  background:var(--card);border-radius:8px;overflow:hidden;}}
th{{background:var(--gold-d);color:hsl(240 64% 8%);text-align:left;padding:8px 12px;font-weight:600;}}
td{{padding:7px 12px;border-top:1px solid var(--border);vertical-align:top;}}
tr:nth-child(even) td{{background:hsl(240 50% 12%);}}
h2,h3{{break-after:avoid;}}
table,blockquote,li{{break-inside:avoid;}}
</style></head><body><div class="page">
<div class="masthead">
  <img src="data:image/png;base64,{logo_b64}" alt="CIMES">
  <div class="t"><b>Fallen Angel Automations</b>Propuesta comercial · faautomations.net</div>
</div>
{body}
</div></body></html>"""

(BASE / "propuesta-comercial-cimes.html").write_text(tpl, encoding="utf-8")
print("html written")
