#!/usr/bin/env python3
"""Regenerate icons/icon{16,48,128}.png (a white checklist/steps glyph on an
orange rounded square). Pure standard library — no Pillow/ImageMagick needed,
adapted from the icon generator in the sibling address-quick-display project:

    python3 scripts/generate-icons.py
"""
import os
import struct
import zlib

ORANGE = (234, 88, 12)  # background (#ea580c)
WHITE = (255, 255, 255)
SIZES = (16, 48, 128)
SUPERSAMPLE = 4  # subpixel grid per axis for antialiasing

# (center-x, center-y, half-width, half-height) of each checklist bar, drawn
# as a fully rounded pill (radius == half-height). A matching bullet circle
# sits to the left of each bar.
BARS = [
    (70, 40, 32, 6),
    (70, 64, 32, 6),
    (62, 88, 24, 6),
]
BULLET_RADIUS = 7


def rounded_rect_dist(x, y, half, radius):
    """Signed distance to a rounded square centered at origin (negative inside)."""
    qx = abs(x) - (half - radius)
    qy = abs(y) - (half - radius)
    outside = (max(qx, 0.0) ** 2 + max(qy, 0.0) ** 2) ** 0.5
    return outside + min(max(qx, qy), 0.0) - radius


def rounded_rect_dist2(x, y, half_w, half_h, radius):
    """Signed distance to a rounded rect (independent width/height)."""
    qx = abs(x) - (half_w - radius)
    qy = abs(y) - (half_h - radius)
    outside = (max(qx, 0.0) ** 2 + max(qy, 0.0) ** 2) ** 0.5
    return outside + min(max(qx, qy), 0.0) - radius


def sample(x, y):
    """Color + alpha at a point in the 128x128 design grid."""
    if rounded_rect_dist(x - 64, y - 64, 62, 24) > 0:
        return (0, 0, 0, 0)
    for cx, cy, half_w, half_h in BARS:
        if rounded_rect_dist2(x - cx, y - cy, half_w, half_h, half_h) <= 0:
            return (*WHITE, 255)
        if (x - (cx - half_w - 18)) ** 2 + (y - cy) ** 2 <= BULLET_RADIUS ** 2:
            return (*WHITE, 255)
    return (*ORANGE, 255)


def render(size):
    rows = []
    step = 128 / size / SUPERSAMPLE
    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = a = 0
            for sy in range(SUPERSAMPLE):
                for sx in range(SUPERSAMPLE):
                    x = (px * SUPERSAMPLE + sx + 0.5) * step
                    y = (py * SUPERSAMPLE + sy + 0.5) * step
                    cr, cg, cb, ca = sample(x, y)
                    r, g, b, a = r + cr * ca, g + cg * ca, b + cb * ca, a + ca
            n = SUPERSAMPLE * SUPERSAMPLE
            if a:
                row += bytes((round(r / a), round(g / a), round(b / a), round(a / n)))
            else:
                row += b"\x00\x00\x00\x00"
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    def chunk(tag, data):
        payload = tag + data
        return struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload))

    raw = b"".join(b"\x00" + row for row in rows)  # filter type 0 per scanline
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n")
        fh.write(chunk(b"IHDR", ihdr))
        fh.write(chunk(b"IDAT", zlib.compress(raw, 9)))
        fh.write(chunk(b"IEND", b""))


def main():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
    os.makedirs(out_dir, exist_ok=True)
    for size in SIZES:
        path = os.path.join(out_dir, f"icon{size}.png")
        write_png(path, size, render(size))
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
