"""Day 14 交付截图合成：修复前 / 修复后 左右对比，每格下方一行标注。
用法：python compose.py  （工作目录 outputs/Day14）
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
GAP = 18
PAD = 20
BAR = 46
PAPER = (251, 247, 240)
INK = (74, 64, 54)
LEAF = (90, 119, 69)
WARN = (168, 96, 74)


def font(size):
    for path in (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\simsun.ttc"):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def compose(items, out_name):
    tiles = []
    for label, sub, fname, is_before in items:
        img = Image.open(os.path.join(HERE, fname)).convert("RGB")
        tiles.append((label, sub, img, is_before))

    w, h = tiles[0][2].size
    cols, rows = 2, 1
    canvas_w = PAD * 2 + cols * w + GAP
    canvas_h = PAD * 2 + rows * (h + BAR) + GAP
    canvas = Image.new("RGB", (canvas_w, canvas_h), PAPER)
    draw = ImageDraw.Draw(canvas)
    f_label = font(24)
    f_sub = font(18)

    for idx, (label, sub, img, is_before) in enumerate(tiles):
        r, c = divmod(idx, cols)
        x = PAD + c * (w + GAP)
        y = PAD
        canvas.paste(img, (x, y))
        draw.rectangle([x, y + h, x + w, y + h + BAR], fill=(255, 255, 255))
        draw.text((x + 16, y + h + 11), label,
                  fill=WARN if is_before else LEAF, font=f_label)
        draw.text((x + 16 + 200, y + h + 15), sub, fill=INK, font=f_sub)

    out = os.path.join(HERE, out_name)
    canvas.save(out)
    print("saved", out, canvas.size)


# 对比一：保存后的落点（桌面 1280 宽）——修复前被带到「心迹」，修复后回到这本书
compose(
    [
        ("修复前 · 落在心迹", "从书页写下心得，保存后被带到 #/notes（day14 测试发现）", "shots/t4-after-redirect.png", True),
        ("修复后 · 回到这本书", "保存后落在 #/books/demo_b1，心得数 +1", "shots/f3-after-save.png", False),
    ],
    "day14-修复-保存落点.png",
)

# 对比二：手机宽度（375px）书页标题——修复前书名被挤成竖排，修复后横排完整
compose(
    [
        ("修复前 · 书名竖排", "375px：标题与按钮挤一行，书名一字一行", "shots/m2-book.png", True),
        ("修复后 · 标题横排", "375px：标题拿整行，按钮另起一行", "shots/m2-book-fixed.png", False),
    ],
    "day14-修复-手机书页标题.png",
)
