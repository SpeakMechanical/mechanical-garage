"""Draw the Mechanical Garage app icon (white gear on the orange accent) and splash screens into the
Android project, replacing Capacitor's placeholders. Run again after `npx cap add android`:

    python scripts/android_icons.py
"""
import math, pathlib, re
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
ORANGE, PAPER, WHITE = (201, 72, 26, 255), (244, 241, 234, 255), (255, 255, 255, 255)

def gear(draw, cx, cy, r_out, colour, hole_colour):
    teeth, r_root, r_hole = 10, r_out * 0.8, r_out * 0.32
    pts = []
    for k in range(teeth * 4):
        a = 2 * math.pi * k / (teeth * 4) - math.pi / 2
        r = r_out if k % 4 in (1, 2) else r_root
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    draw.polygon(pts, fill=colour)
    draw.ellipse([cx - r_hole, cy - r_hole, cx + r_hole, cy + r_hole], fill=hole_colour)

def icon(size, shape):
    """Legacy launcher icon: orange square (rounded) or circle with a white gear, drawn 4x and scaled down."""
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if shape == "round":
        d.ellipse([0, 0, S - 1, S - 1], fill=ORANGE)
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.18, fill=ORANGE)
    gear(d, S / 2, S / 2, S * 0.3, WHITE, ORANGE)
    return img.resize((size, size), Image.LANCZOS)

def foreground(size):
    """Adaptive icon foreground: the gear only, inside the central safe zone."""
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gear(ImageDraw.Draw(img), S / 2, S / 2, S * 0.22, WHITE, (0, 0, 0, 0))
    return img.resize((size, size), Image.LANCZOS)

def splash(w, h):
    img = Image.new("RGBA", (w, h), PAPER)
    r = min(w, h) * 0.12
    gear(ImageDraw.Draw(img), w / 2, h / 2, r, ORANGE, PAPER)
    return img

done = 0
for f in RES.glob("mipmap-*/*.png"):
    size = Image.open(f).size[0]
    img = foreground(size) if "foreground" in f.name else icon(size, "round" if "round" in f.name else "square")
    img.save(f, optimize=True); done += 1
for f in RES.glob("drawable*/splash.png"):
    w, h = Image.open(f).size
    splash(w, h).convert("RGB").save(f, optimize=True); done += 1
bg = RES / "values/ic_launcher_background.xml"
if bg.exists():
    bg.write_text(re.sub(r"#[0-9A-Fa-f]{6,8}", "#C9481A", bg.read_text()))
print(f"wrote {done} images")
