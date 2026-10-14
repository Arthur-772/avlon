import zipfile
import shutil
import sys
import os

src = r"E:\opt\android-sdk\platforms\android-36\android.jar"
dst = r"E:\opt\android-sdk\platforms\android-36\android17.jar"

print(f"Reading {src}...")
print(f"Writing {dst}...")

count = 0
with zipfile.ZipFile(src, 'r') as zin:
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename.endswith('.class') and len(data) >= 8:
                magic = int.from_bytes(data[0:4], 'big')
                if magic == 0xCAFEBABE:
                    major = int.from_bytes(data[6:8], 'big')
                    if major == 65:
                        data = data[:6] + (61).to_bytes(2, 'big') + data[8:]
                        count += 1
            zout.writestr(item, data)

print(f"Downgraded {count} class files from version 65 to 61")
print(f"Output: {dst}")
print(f"Size: {os.path.getsize(dst) / (1024*1024):.1f} MB")
