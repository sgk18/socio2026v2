from pathlib import Path
uncached_file = Path('graphify-out/.graphify_uncached.txt')
if not uncached_file.exists():
    print('No uncached list found')
    raise SystemExit(1)
uncached = uncached_file.read_text().splitlines()
uncached = [u for u in uncached if u]
chunk_size = 25
chunks = [uncached[i:i+chunk_size] for i in range(0,len(uncached),chunk_size)]
Path('graphify-out/semantic_chunks').mkdir(exist_ok=True)
for idx,chunk in enumerate(chunks, start=1):
    out = []
    for p in chunk:
        path = Path(p)
        if not path.exists():
            out.append(f'FILE: {p}\nMISSING FILE\n---')
            continue
        if path.suffix.lower() in ['.png','.jpg','.jpeg','.gif','.webp']:
            out.append(f'FILE: {p}\nTYPE: image\nNOTE: binary image omitted\n---')
        else:
            try:
                text = path.read_text(encoding='utf-8')
            except Exception:
                try:
                    text = path.read_text(encoding='latin-1')
                except Exception:
                    text = '<UNREADABLE BINARY>'
            out.append(f'FILE: {p}\nTYPE: {path.suffix.lstrip(".")}\n---\n'+text+'\n---')
    Path(f'graphify-out/semantic_chunks/chunk_{idx}.txt').write_text('\n\n'.join(out))
print(f'Wrote {len(chunks)} chunk files to graphify-out/semantic_chunks')
