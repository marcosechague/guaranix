"""Builds the logo and icon files from the originals in docs/brand/.

The originals have a black background baked in. The logo is light on black,
so brightness works as alpha: each pixel is "un-multiplied" from black, which
keeps the steel, the lime glow and the soft edges without a dark halo.

Run from the repo root with Pillow installed: python3 scripts/brand/generate-brand-assets.py
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / 'docs' / 'brand'
UI_ASSETS = ROOT / 'packages' / 'ui' / 'src' / 'assets'
APPS = ['member', 'admin', 'platform']
BACKGROUND = (14, 15, 17)  # --gx-color-background (dark)
NOISE_FLOOR = 10  # JPEG-ish noise in the black background


def unmultiply_black(image: Image.Image) -> Image.Image:
    rgb = image.convert('RGB')
    r, g, b = rgb.split()
    alpha = ImageChops.lighter(ImageChops.lighter(r, g), b)
    alpha = alpha.point(lambda v: 0 if v <= NOISE_FLOOR else round((v - NOISE_FLOOR) * 255 / (255 - NOISE_FLOOR)))

    pixels = rgb.load()
    alpha_pixels = alpha.load()
    out = Image.new('RGBA', rgb.size)
    out_pixels = out.load()
    width, height = rgb.size
    for y in range(height):
        for x in range(width):
            a = alpha_pixels[x, y]
            if a == 0:
                out_pixels[x, y] = (0, 0, 0, 0)
                continue
            pr, pg, pb = pixels[x, y]
            scale = 255 / a
            out_pixels[x, y] = (min(255, round(pr * scale)), min(255, round(pg * scale)), min(255, round(pb * scale)), a)
    return out


def trim(image: Image.Image, pad: int = 0) -> Image.Image:
    box = image.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    left, top, right, bottom = box
    return image.crop((max(0, left - pad), max(0, top - pad), min(image.width, right + pad), min(image.height, bottom + pad)))


def resize_width(image: Image.Image, width: int) -> Image.Image:
    return image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)


def save_pair(image: Image.Image, stem: str) -> None:
    image.save(UI_ASSETS / f'{stem}.png', optimize=True)
    image.save(UI_ASSETS / f'{stem}.webp', quality=88, method=6)


def square_icon(glyph: Image.Image, size: int, glyph_ratio: float, radius_ratio: float) -> Image.Image:
    """The GX glyph centered on the dark background; radius 0 is full bleed."""
    icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    plate = Image.new('RGBA', (size, size), BACKGROUND + (255,))
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * radius_ratio), fill=255)
    icon.paste(plate, (0, 0), mask)
    mark = resize_width(glyph, round(size * glyph_ratio))
    icon.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return icon


def splash(glyph: Image.Image, width: int, height: int) -> Image.Image:
    screen = Image.new('RGBA', (width, height), BACKGROUND + (255,))
    mark = resize_width(glyph, round(min(width, height) * 0.36))
    screen.alpha_composite(mark, ((width - mark.width) // 2, (height - mark.height) // 2))
    return screen.convert('RGB')


# iPhone portrait screens in device pixels, for apple-touch-startup-image.
IOS_SPLASHES = [
    (750, 1334, 375, 667, 2),
    (828, 1792, 414, 896, 2),
    (1125, 2436, 375, 812, 3),
    (1170, 2532, 390, 844, 3),
    (1179, 2556, 393, 852, 3),
    (1284, 2778, 428, 926, 3),
    (1290, 2796, 430, 932, 3),
]


def main() -> None:
    wordmark = trim(unmultiply_black(Image.open(BRAND / 'guaranix-wordmark-original.png')), pad=8)
    # The tagline is dropped: at app sizes it is unreadable, so GuaranixLogo
    # sets it as live text. It starts at the first empty row under the letters.
    alpha = wordmark.getchannel('A')
    rows = [alpha.crop((0, y, wordmark.width, y + 1)).getextrema()[1] for y in range(wordmark.height)]
    letters_end = next(y for y in range(wordmark.height // 2, wordmark.height) if rows[y] < 24)
    letters = trim(wordmark.crop((0, 0, wordmark.width, letters_end)), pad=6)

    save_pair(resize_width(letters, 640), 'guaranix-wordmark')

    icon_source = unmultiply_black(Image.open(BRAND / 'gx-icon-original.png'))
    # Skip the faint rounded-square outline: only keep the bright glyph.
    glyph = trim(icon_source.crop((120, 330, 1140, 860)), pad=12)
    save_pair(resize_width(glyph, 192), 'gx-mark')

    for app in APPS:
        public = ROOT / 'apps' / app / 'public'
        public.mkdir(exist_ok=True)
        square_icon(glyph, 64, 0.8, 0.22).save(public / 'favicon.png', optimize=True)
        square_icon(glyph, 180, 0.66, 0).convert('RGB').save(public / 'apple-touch-icon.png', optimize=True)
        square_icon(glyph, 192, 0.66, 0.22).save(public / 'icon-192.png', optimize=True)
        square_icon(glyph, 512, 0.66, 0.22).save(public / 'icon-512.png', optimize=True)
        # Maskable: full bleed, glyph inside the 80% safe zone.
        square_icon(glyph, 512, 0.56, 0).convert('RGB').save(public / 'icon-512-maskable.png', optimize=True)
        splash_dir = public / 'splash'
        splash_dir.mkdir(exist_ok=True)
        for width, height, *_ in IOS_SPLASHES:
            splash(glyph, width, height).save(splash_dir / f'splash-{width}x{height}.png', optimize=True)


if __name__ == '__main__':
    main()
