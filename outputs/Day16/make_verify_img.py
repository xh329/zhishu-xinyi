# -*- coding: utf-8 -*-
"""生成本地验证图：两张核心表各 ≥5 行，含表名（标注为本地验证，非 CloudBase 控制台）。"""
import sqlite3, os, re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONT = "C:/Windows/Fonts/msyh.ttc"

def to_sqlite(sql):
    sql = sql.replace("ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", "")
    sql = re.sub(r" COMMENT '[^']*'", "", sql)
    sql = re.sub(r" COMMENT='[^']*'", "", sql)
    sql = sql.replace("JSON", "TEXT")
    sql = re.sub(r"UNIQUE KEY `[^`]*` \(", "UNIQUE (", sql)
    return sql

con = sqlite3.connect(":memory:")
con.execute("PRAGMA foreign_keys=ON;")
for fn in ("db/schema.sql", "db/seed.sql"):
    raw = open(os.path.join(ROOT, fn), encoding="utf-8").read()
    for st in [s.strip() for s in to_sqlite(raw).split(";") if s.strip()]:
        con.execute(st)

books = con.execute("SELECT id,title,user_id,created_at FROM books").fetchall()
notes = con.execute("""SELECT n.id,b.title,n.content,n.mood,n.created_at,n.updated_at
                       FROM notes n JOIN books b ON n.book_id=b.id ORDER BY n.created_at""").fetchall()

f = ImageFont.truetype(FONT, 22)
fb = ImageFont.truetype(FONT, 30)

def draw_table(d, x, y, title, headers, rows, col_w):
    d.text((x, y), title, font=fb, fill=(176, 122, 132))
    y += 44
    # header
    cx = x
    for h, w in zip(headers, col_w):
        d.text((cx, y), h, font=f, fill=(120, 80, 90)); cx += w
    y += 34
    d.line((x, y-8, x+sum(col_w), y-8), fill=(210,190,195), width=2)
    # rows
    for r in rows:
        cx = x
        for val, w in zip(r, col_w):
            txt = "" if val is None else str(val)
            if len(txt) > 18: txt = txt[:17] + "…"
            d.text((cx, y), txt, font=f, fill=(60,50,55)); cx += w
        y += 32
    return y

img = Image.new("RGB", (1100, 720), (252, 248, 245))
d = ImageDraw.Draw(img)
d.text((40, 24), "栀书心驿 · 本地验证（SQLite 等价执行）", font=fb, fill=(90, 60, 70))
d.text((40, 70), "说明：本图为本地执行 db/schema.sql + db/seed.sql 的验证证据；CloudBase 控制台截图请运行脚本后自行截取。", font=f, fill=(140,120,125))

y1 = draw_table(d, 40, 120, "表 books（书籍表）  5 行",
                ["id", "title", "user_id", "created_at"],
                books, [140, 200, 120, 320])
draw_table(d, 40, y1 + 30, "表 notes（读书心得/心迹表）  6 行",
           ["id", "book", "content", "mood", "created_at"],
           [(r[0], r[1], r[2], r[3], r[4]) for r in notes],
           [140, 160, 430, 130, 220])

out = os.path.join(ROOT, "outputs", "Day16", "Day16-本地验证-表数据.png")
img.save(out)
print("saved", out)
