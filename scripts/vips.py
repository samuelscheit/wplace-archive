import os
import math
import shutil
from pathlib import Path
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed, wait, FIRST_COMPLETED

# ---- concurrency defaults (overridable via env) ----
CPU_CORES = int(os.cpu_count() * 1.5)
os.environ.setdefault("TILE_JOBS", str(CPU_CORES))
os.environ.setdefault("VIPS_CONCURRENCY", str(min(4, CPU_CORES)))
# Use the env var for worker count so CLI/env can override
WORKERS = int(os.environ["TILE_JOBS"])

# Import pyvips after setting VIPS_CONCURRENCY so it takes effect
import pyvips

# Millions of independent tiles must not accumulate cached image pipelines.
pyvips.cache_set_max(0)

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
TILES_DIR = os.path.join(os.environ.get("TILES_ROOT", os.path.join(BASE_DIR, "..", "public", "tiles")), "11")   # tiles/YYYY/XXXX.png (4-digit padded)

IN_ROOT = Path(TILES_DIR)
OUT_ROOT = IN_ROOT.parent

TILE_SIZE = 1000          # your tile pixel size

# If you don't actually need every level, set e.g. MIN_Z = 6 to stop at z=6
MIN_Z = 0

# WORKERS is set above from TILE_JOBS

# -------- helpers --------

def discover_base_dim_yx(in_root: Path) -> int:
    ys = [int(p.name) for p in in_root.iterdir() if p.is_dir() and p.name.isdigit()]
    if not ys:
        raise RuntimeError(f"No y-directories found in {in_root}")
    dim = max(ys) + 1
    z = round(math.log2(dim))
    if 2**z != dim:
        raise RuntimeError(f"Base grid size must be a power-of-two, found {dim}")
    return dim  # e.g., 2048

def ensure_dir(p: Path, cache: set):
    # avoid millions of redundant mkdir calls
    if p not in cache:
        p.mkdir(parents=True, exist_ok=True)
        cache.add(p)

def make_blank_png(path: Path, width: int, height: int, bands: int = 4):
    # Transparent RGBA by default
    img = pyvips.Image.black(width, height, bands=bands)
    img.write_to_file(str(path))

def link_or_copy(src: Path, dst: Path, prefer="hardlink"):
    # Try hardlink (best for de-dup), then symlink, then copy.
    # Be concurrency-safe: if another worker created dst meanwhile, just return.
    if dst.exists():
        return "exists"
    try:
        if prefer == "hardlink":
            os.link(src, dst)
            return "hardlink"
        raise OSError
    except OSError:
        try:
            os.symlink(src, dst)
            return "symlink"
        except OSError:
            try:
                shutil.copyfile(src, dst)
                return "copy"
            except FileExistsError:
                return "exists"

def samefile(a: Path, b: Path) -> bool:
    try:
        return os.path.samefile(a, b)
    except FileNotFoundError:
        return False

def read_rgba(path: Path) -> pyvips.Image:
    img = pyvips.Image.new_from_file(str(path), access="sequential")
    # Normalize to RGBA so joins never fail
    if not img.hasalpha():
        img = img.addalpha()
    if img.bands < 4:
        # Paranoia: pad bands up to 4
        alpha = pyvips.Image.black(img.width, img.height, bands=1) + 255
        img = img.bandjoin(alpha)
    return img

# -------- pipeline --------

def stage_base_level(in_root: Path, out_root: Path, z_base: int, blank_png: Path):
    """Re-emit base level into z/x/y.png and fill any missing with the shared blank."""
    dim = 2 ** z_base
    made_dirs = set()
    out_z_root = out_root / str(z_base)
    for x in range(dim):
        ensure_dir(out_z_root / str(x), made_dirs)

    def do_one(yx):
        y, x = yx
        src = in_root / str(x) / f"{y}.png"
        dst = out_z_root / str(x) / f"{y}.png"
        if dst.exists():
            return
        if src.exists():
            # Prefer symlink/hardlink to avoid huge copies of your base
            try:
                os.symlink(src, dst)
            except OSError:
                try:
                    os.link(src, dst)
                except OSError:
                    try:
                        shutil.copyfile(src, dst)
                    except FileExistsError:
                        pass
        else:
            # link_or_copy(blank_png, dst, prefer="hardlink")
            pass

    tasks = [(y, x) for y in range(dim) for x in range(dim)]
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for _ in tqdm(as_completed([ex.submit(do_one, t) for t in tasks]), total=len(tasks), desc=f"Staging z={z_base}"):
            pass

def build_parent_levels(out_root: Path, z_base: int, blank_png: Path, min_z: int = 0):
    """For each level, join 2x2 children and downsample by 2. Link blank if all 4 are blank."""
    def process_tile(child_root: Path, parent_root: Path, X: int, Y: int):
        dst = parent_root / str(X) / f"{Y}.png"
        if dst.exists():
            return

        ch_paths = [
            child_root / str(2*X)   / f"{2*Y}.png",
            child_root / str(2*X+1) / f"{2*Y}.png",
            child_root / str(2*X)   / f"{2*Y+1}.png",
            child_root / str(2*X+1) / f"{2*Y+1}.png",
        ]

        ch_use = [p if p.exists() else blank_png for p in ch_paths]

        # If all four are the shared blank, just link the blank.
        if all(samefile(p, blank_png) for p in ch_use):
            # link_or_copy(blank_png, dst, prefer="hardlink")
            return

        imgs = [read_rgba(p) for p in ch_use]
        big = pyvips.Image.arrayjoin(imgs, across=2)

        # Pixel art: keep colours crisp and prevent darkening at edges.
        # 1) Premultiply alpha so resampling doesn't blend with black.
        # 2) Resize by 0.5 using nearest-neighbour (no smoothing).
        # 3) Unpremultiply back to straight alpha.
        # parent = big.premultiply().resize(0.5, kernel="nearest").unpremultiply()

        # parent = big.shrink(2, 2, kernel="nearest")
        parent = big.shrink(2, 2)

        # Ensure sRGB interpretation for consistent brightness in viewers
        # parent = parent.copy(interpretation=pyvips.Interpretation.SRGB)

        # A stopped run must never leave a truncated PNG that a retry skips.
        temporary = dst.with_suffix(".tmp.png")
        try:
            parent.write_to_file(str(temporary))
            os.replace(temporary, dst)
        finally:
            temporary.unlink(missing_ok=True)
        # parent.pngsave(str(dst), palette=True, bitdepth=8, Q=100, dither=0, effort=10)

    for level in range(z_base - 1, min_z - 1, -1):
        dim_parent = 2 ** level
        z_child = level + 1
        z_parent = level

        parent_root = out_root / str(z_parent)
        child_root  = out_root / str(z_child)

        made_dirs = set()
        for x in range(dim_parent):
            ensure_dir(parent_root / str(x), made_dirs)

        tasks = iter((X, Y) for X in range(dim_parent) for Y in range(dim_parent))
        with ThreadPoolExecutor(max_workers=WORKERS) as ex:
            pending = set()
            with tqdm(total=dim_parent ** 2, desc=f"Build z={level}", mininterval=30) as progress:
                while True:
                    while len(pending) < WORKERS * 2:
                        task = next(tasks, None)
                        if task is None:
                            break
                        pending.add(ex.submit(process_tile, child_root, parent_root, *task))
                    if not pending:
                        break
                    done, pending = wait(pending, return_when=FIRST_COMPLETED)
                    for future in done:
                        # Propagate decoder/write errors instead of publishing an incomplete pyramid.
                        future.result()
                        progress.update(1)

def main():
    OUT_ROOT.mkdir(parents=True, exist_ok=True)

    dim = discover_base_dim_yx(IN_ROOT)   # e.g., 2048
    z_base = int(round(math.log2(dim)))   # e.g., 11

    # One shared transparent PNG, hard-linked wherever possible
    blank_png = OUT_ROOT / "blank.png"
    if not blank_png.exists():
        make_blank_png(blank_png, TILE_SIZE, TILE_SIZE, bands=4)

    # 1) Re-emit base to standard naming and fill any gaps with the blank (multithreaded)
    # stage_base_level(IN_ROOT, OUT_ROOT, z_base, blank_png)

    # 2) Build all parents down to MIN_Z
    build_parent_levels(OUT_ROOT, z_base, blank_png, MIN_Z)

# Tune overall parallelism with TILE_JOBS (Python threads) and VIPS_CONCURRENCY (libvips internal threads).

if __name__ == "__main__":
    main()
