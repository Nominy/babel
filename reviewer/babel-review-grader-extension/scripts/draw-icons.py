from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'icons'
root.mkdir(exist_ok=True)
image = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((8, 8, 504, 504), radius=110, fill='#0f766e')
draw.rounded_rectangle((126, 94, 394, 428), radius=28, fill='#ffffff')
draw.rounded_rectangle((198, 70, 322, 128), radius=18, fill='#99f6e4')
for y, width in [(196, 124), (280, 94), (364, 60)]:
    draw.line([(156, y), (171, y + 15), (197, y - 16)], fill='#0f766e', width=15, joint='curve')
    draw.rounded_rectangle((226, y - 11, 226 + width, y + 11), radius=8, fill='#99d6cb')
for size in [16, 32, 48, 128]:
    image.resize((size, size), Image.Resampling.LANCZOS).save(root / f'icon-{size}.png')
