# Baixa para img/teams/ os logos de todos os times de todas as ligas do site, já reduzidos, para a imagem
# de compartilhar poder desenhá-los (o servidor do lolesports não libera CORS para o canvas).
# Uso: python tools/logos.py   (precisa do Pillow; só baixa o que ainda não existe, rode de novo quando
# surgirem times novos)
import io
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = (ROOT / "js" / "api.js").read_text(encoding="utf-8")
KEY = re.search(r'API_KEY = "([^"]+)"', SRC)[1]
LEAGUE_IDS = re.findall(r'"(\d+)"', re.search(r"const LEAGUES = \{(.*?)\};", SRC, re.S)[1])
DIR = ROOT / "img" / "teams"
SIZE = 96  # na página o logo tem 22px; 96 sobra para telas de alta densidade


def get(url, headers=None):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=30) as res:
        return res.read()


def api(path, **params):
    query = urllib.parse.urlencode({"hl": "pt-BR", **params})
    url = f"https://esports-api.lolesports.com/persisted/gw/{path}?{query}"
    return json.loads(get(url, {"x-api-key": KEY}))["data"]


urls = {}  # nome do arquivo (o fim da URL, o mesmo que o js/ui.js procura) -> URL
for league_id in LEAGUE_IDS:
    for t in api("getTournamentsForLeague", leagueId=league_id)["leagues"][0]["tournaments"]:
        standings = api("getStandings", tournamentId=t["id"])["standings"]
        stages = standings[0]["stages"] if standings else []
        for team in (tm for g in stages for s in g["sections"] for m in s["matches"] for tm in m["teams"]):
            url = team.get("image")
            if not url:
                continue
            name = url.split("/")[-1]
            if urls.setdefault(name, url) != url:
                print(f"nome repetido, fica o primeiro: {name}")

DIR.mkdir(parents=True, exist_ok=True)
saved = 0
for name, url in urls.items():
    file = DIR / name
    if file.exists():
        continue
    try:
        im = Image.open(io.BytesIO(get(re.sub(r"^http:", "https:", url))))
        im.thumbnail((SIZE, SIZE))
        im.save(file, optimize=True)
        saved += 1
    except Exception as e:  # um logo quebrado não impede os outros
        print(f"falhou: {url} ({e})")
print(f"{len(urls)} logos, {saved} baixados agora")
