from PIL import Image, ImageDraw

SIZE = 512
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

radius = 96
margin = 16
d.rounded_rectangle(
    [margin, margin, SIZE - margin, SIZE - margin],
    radius=radius,
    fill=(16, 24, 40, 255),
)

stroke_w = 44
color = (238, 242, 246, 255)
cx, top, bottom = SIZE / 2, 140, 372
half_w = 128

d.line([(cx - half_w, bottom), (cx - half_w, top)], fill=color, width=stroke_w)
d.line([(cx + half_w, bottom), (cx + half_w, top)], fill=color, width=stroke_w)
d.line([(cx - half_w, top), (cx, bottom - 40)], fill=color, width=stroke_w)
d.line([(cx, bottom - 40), (cx + half_w, top)], fill=color, width=stroke_w)

d.ellipse([SIZE - 128, SIZE - 128, SIZE - 64, SIZE - 64], fill=(52, 211, 153, 255))

img.save("src-tauri/icons/icon.png")
img.resize((128, 128), Image.LANCZOS).save("src-tauri/icons/128x128.png")
img.resize((32, 32), Image.LANCZOS).save("src-tauri/icons/32x32.png")
img.resize((256, 256), Image.LANCZOS).save("src-tauri/icons/256x256.png")
img.resize((256, 256), Image.LANCZOS).save(
    "src-tauri/icons/icon.ico",
    sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
)
print("icons generated")
