"""
Unit tests for backend/utils/data_loader.py — extended edge cases.

Builds on the existing test_data_loader.py by covering save_json_data
edge cases, get_data_dir, and additional error paths.
"""

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(
    0,
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
)

from backend.utils.data_loader import (
    load_json_data,
    save_json_data,
    get_data_dir,
)


class TestSaveJsonData(unittest.TestCase):
    def test_save_and_reload(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "sub", "data.json")
            self.assertTrue(save_json_data(path, [{"a": 1}, {"b": 2}]))
            data = load_json_data(path)
            self.assertEqual(data, [{"a": 1}, {"b": 2}])

    def test_creates_parent_directories(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "deeply", "nested", "path", "f.json")
            self.assertTrue(save_json_data(path, [1, 2, 3]))
            self.assertTrue(os.path.exists(path))

    def test_save_empty_list(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "f.json")
            self.assertTrue(save_json_data(path, []))
            self.assertEqual(load_json_data(path), [])

    def test_save_non_list_data(self):
        # save_json_data does not validate type; just writes JSON
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "f.json")
            self.assertTrue(save_json_data(path, {"a": 1}))
            with open(path) as f:
                content = f.read()
            self.assertIn('"a"', content)


class TestLoadJsonDataExtended(unittest.TestCase):
    def test_non_list_json_returns_empty(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"key": "value"}, f)
            f.flush()
            try:
                self.assertEqual(load_json_data(f.name), [])
            finally:
                os.unlink(f.name)

    def test_string_json_returns_empty(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            f.write('"just a string"')
            f.flush()
            try:
                self.assertEqual(load_json_data(f.name), [])
            finally:
                os.unlink(f.name)

    def test_number_json_returns_empty(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            f.write("42")
            f.flush()
            try:
                self.assertEqual(load_json_data(f.name), [])
            finally:
                os.unlink(f.name)

    def test_unicode_content(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump([{"name": "\u4e2d\u6587"}], f, ensure_ascii=False)
            f.flush()
            try:
                data = load_json_data(f.name)
                self.assertEqual(data, [{"name": "\u4e2d\u6587"}])
            finally:
                os.unlink(f.name)

    def test_nested_list(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump([[1, 2], [3, 4]], f)
            f.flush()
            try:
                self.assertEqual(load_json_data(f.name), [[1, 2], [3, 4]])
            finally:
                os.unlink(f.name)


class TestGetDataDir(unittest.TestCase):
    def test_returns_absolute_path(self):
        path = get_data_dir()
        self.assertTrue(os.path.isabs(path))

    def test_ends_with_data(self):
        path = get_data_dir()
        self.assertTrue(path.endswith("data") or path.endswith("data/"))


if __name__ == "__main__":
    unittest.main()
