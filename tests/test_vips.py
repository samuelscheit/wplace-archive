import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("tile_vips", Path(__file__).parents[1] / "scripts/vips.py")
vips = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vips)


class PyramidTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.blank = self.root / "blank.png"
        vips.make_blank_png(self.blank, 4, 4)

    def tile(self, x, y, color):
        path = self.root / "1" / str(x) / f"{y}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        image = vips.pyvips.Image.black(4, 4, bands=4).new_from_image(color)
        image.write_to_file(str(path))
        return path

    def test_sparse_quadrants_and_resume_leave_base_unchanged(self):
        source = self.tile(0, 0, [255, 0, 0, 255])
        self.tile(1, 1, [0, 255, 0, 255])
        before = source.read_bytes()
        vips.build_parent_levels(self.root, 1, self.blank)
        parent = self.root / "0/0/0.png"
        image = vips.read_rgba(parent)
        self.assertEqual((image.width, image.height), (4, 4))
        self.assertEqual(image(0, 0), [255, 0, 0, 255])
        self.assertEqual(image(3, 3), [0, 255, 0, 255])
        self.assertEqual(image(3, 0), [0, 0, 0, 0])
        mtime = parent.stat().st_mtime_ns
        vips.build_parent_levels(self.root, 1, self.blank)
        self.assertEqual(parent.stat().st_mtime_ns, mtime)
        self.assertEqual(source.read_bytes(), before)
        self.assertFalse(list(self.root.rglob("*.tmp.png")))

    def test_empty_world_stays_sparse(self):
        vips.build_parent_levels(self.root, 1, self.blank)
        self.assertFalse((self.root / "0/0/0.png").exists())

    def test_corrupt_input_fails_without_final_output(self):
        source = self.tile(0, 0, [1, 2, 3, 255])
        source.write_bytes(b"not a PNG")
        with self.assertRaises(vips.pyvips.Error):
            vips.build_parent_levels(self.root, 1, self.blank)
        self.assertFalse((self.root / "0/0/0.png").exists())


if __name__ == "__main__":
    unittest.main()
