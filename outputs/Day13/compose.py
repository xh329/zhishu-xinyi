"""Day 13 交付截图合成：把单张截图拼成 2x2 四宫格，并在每格下方加一行小标注。
用法：python compose.py  （工作目录 outputs/Day13）
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
GAP = 18
PAD = 20
BAR = 46          # 每格下方的标注条高度
PAPER = (251, 247, 240)
INK = (74, 64, 54)
LEAF = (90, 119, 69)


def font(size):
    for path in (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\simsun.ttc"):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def compose(items, out_name, title_text):
    tiles = []
    for label, sub, fname in items:
        img = Image.open(os.path.join(HERE, fname)).convert("RGB")
        tiles.append((label, sub, img))

    w, h = tiles[0][2].size
    cols, rows = 2, 2
    canvas_w = PAD * 2 + cols * w + GAP
    canvas_h = PAD * 2 + rows * (h + BAR) + GAP
    canvas = Image.new("RGB", (canvas_w, canvas_h), PAPER)
    draw = ImageDraw.Draw(canvas)
    f_label = font(26)
    f_sub = font(20)

    for idx, (label, sub, img) in enumerate(tiles):
        r, c = divmod(idx, cols)
        x = PAD + c * (w + GAP)
        y = PAD + r * (h + BAR + GAP)
        canvas.paste(img, (x, y))
        draw.rectangle([x, y + h, x + w, y + h + BAR], fill=(255, 255, 255))
        draw.text((x + 16, y + h + 11), label, fill=LEAF, font=f_label)
        draw.text((x + 16 + 190, y + h + 15), sub, fill=INK, font=f_sub)

    out = os.path.join(HERE, out_name)
    canvas.save(out)
    print("saved", out, canvas.size, "title:", title_text)


compose(
    [
        ("① 今日", "#/home · 诗意引导与概览", "p1-home.png"),
        ("② 书架", "#/books · 全部书籍（成功态）", "p2-books.png"),
        ("③ 书页", "#/books/:id · 二级路由", "p3-book.png"),
        ("④ 心迹", "#/notes · 全部心得", "p4-notes.png"),
    ],
    "day13-视图切换.png",
    "视图切换",
)

compose(
    [
        ("① 加载中", "#/books?preview=loading", "s1-loading.png"),
        ("② 空状态", "#/books?preview=empty", "s2-empty.png"),
        ("③ 错误态", "#/books?preview=error", "s3-error.png"),
        ("④ 正常态", "#/books · 读到真实本地数据", "s4-success.png"),
    ],
    "day13-四种状态.png",
    "四种状态",
)
