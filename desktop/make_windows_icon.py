"""Generate MELORIX's own 256px Windows ICO from its source SVG geometry.

Uses only simple vector primitives. Never downloads arbitrary icons.
Based on public/melorix-icon.svg (dark square, orange piano stripes).
"""
from pathlib import Path
from PIL import Image, ImageDraw

BASE = 64
SCALE = 16
size = BASE * SCALE
image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)

def sc(value):
    return round(value * SCALE)

def rect(box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(
        tuple(sc(i) for i in box),
        radius=sc(radius),
        fill=fill,
        outline=outline,
        width=sc(width),
    )

rect((0, 0, 64, 64), 12, "#181c24")
rect((9, 13, 55, 51), 5, "#242b35", "#69503b", 1.5)
for x, y0 in [(15, 29), (23, 22), (31, 15), (39, 20), (47, 27)]:
    draw.line(((sc(x), sc(y0)), (sc(x), sc(44))),
              fill="#ff9f4f", width=sc(4.2), joint="curve")
    r = sc(2.1)
    draw.ellipse((sc(x)-r, sc(y0)-r, sc(x)+r, sc(y0)+r),
                 fill="#ff9f4f")
    draw.ellipse((sc(x)-r, sc(44)-r, sc(x)+r, sc(44)+r),
                 fill="#ff9f4f")
draw.line(((sc(12), sc(47)), (sc(52), sc(47))),
          fill="#b8c7d8", width=sc(2.5))

out = Path(__file__).with_name("melorix.ico")
image.save(out, format="ICO", sizes=[
    (16, 16), (24, 24), (32, 32), (48, 48),
    (64, 64), (128, 128), (256, 256),
])
with Image.open(out) as check:
    assert (256, 256) in check.info.get("sizes", {(check.width, check.height)})
print(f"Generated Windows icon {out} ({out.stat().st_size} bytes), 256x256 included.")
