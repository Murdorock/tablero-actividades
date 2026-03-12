#!/usr/bin/env python3
"""Rename photo files sequentially using a provided list of target names.

Example:
  python .tools/rename_personal_photos_sequential.py --dir ".tools/fotos"

By default it reads target names from .tools/target_photo_names.txt.
It matches files named like image1.png, image2.jpeg, ... in natural order.
"""

from __future__ import annotations

import argparse
import csv
import re
import uuid
from pathlib import Path

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}


def natural_key(path: Path) -> tuple[int, str]:
    match = re.search(r"(\d+)$", path.stem)
    if match:
        return int(match.group(1)), path.name.lower()
    return 10**12, path.name.lower()


def read_names(names_file: Path) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()

    for raw_line in names_file.read_text(encoding="utf-8").splitlines():
        name = raw_line.strip()
        if not name:
            continue
        if name in seen:
            raise ValueError(f"Duplicate target name detected: {name}")
        seen.add(name)
        names.append(name)

    if not names:
        raise ValueError("No target names found in names file.")

    return names


def collect_source_files(folder: Path, prefix: str) -> list[Path]:
    files = []
    pattern = f"{prefix}*"
    for item in folder.glob(pattern):
        if not item.is_file():
            continue
        if item.suffix.lower() not in ALLOWED_EXTENSIONS:
            continue
        files.append(item)

    files.sort(key=natural_key)
    return files


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rename image files in order using a custom list of target names."
    )
    parser.add_argument(
        "--dir",
        default=".",
        help="Folder containing files like image1.png, image2.png, ...",
    )
    parser.add_argument(
        "--prefix",
        default="image",
        help="Source filename prefix (default: image)",
    )
    parser.add_argument(
        "--names-file",
        default=str(Path(__file__).with_name("target_photo_names.txt")),
        help="Text file with one target name per line.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview rename operations without changing files.",
    )
    parser.add_argument(
        "--manifest",
        default="rename_manifest.csv",
        help="CSV file name to write rename log.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    folder = Path(args.dir).expanduser().resolve()
    names_file = Path(args.names_file).expanduser().resolve()

    if not folder.exists() or not folder.is_dir():
        raise SystemExit(f"Folder does not exist: {folder}")
    if not names_file.exists() or not names_file.is_file():
        raise SystemExit(f"Names file does not exist: {names_file}")

    target_names = read_names(names_file)
    source_files = collect_source_files(folder, args.prefix)

    if not source_files:
        raise SystemExit(
            f"No source images found in {folder} with prefix '{args.prefix}'"
        )

    if len(source_files) != len(target_names):
        raise SystemExit(
            "Count mismatch: "
            f"{len(source_files)} source files vs {len(target_names)} target names."
        )

    operations: list[tuple[Path, Path]] = []
    planned_destinations: set[Path] = set()

    for src, target_name in zip(source_files, target_names):
        ext = src.suffix.lower()
        dst = folder / f"{target_name}{ext}"

        if dst in planned_destinations:
            raise SystemExit(f"Duplicate final destination planned: {dst.name}")

        if dst.exists() and dst not in source_files:
            raise SystemExit(f"Destination already exists and is not a source file: {dst}")

        planned_destinations.add(dst)
        operations.append((src, dst))

    manifest_path = folder / args.manifest

    print(f"Folder: {folder}")
    print(f"Names file: {names_file}")
    print(f"Source files: {len(source_files)}")
    print(f"Dry run: {args.dry_run}")

    with manifest_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(["source", "destination", "status", "detail"])

        if args.dry_run:
            for src, dst in operations:
                print(f"[DRY] {src.name} -> {dst.name}")
                writer.writerow([src.name, dst.name, "planned", "dry-run"])
            print(f"Manifest: {manifest_path}")
            return 0

        temp_moves: list[tuple[Path, Path, Path]] = []

        for src, dst in operations:
            temp_name = f".__tmp__{uuid.uuid4().hex}{src.suffix.lower()}"
            tmp = folder / temp_name
            src.rename(tmp)
            temp_moves.append((tmp, src, dst))

        try:
            for tmp, src, dst in temp_moves:
                tmp.rename(dst)
                writer.writerow([src.name, dst.name, "ok", "renamed"])
                print(f"[OK] {src.name} -> {dst.name}")
        except Exception as exc:  # noqa: BLE001
            for tmp, src, _ in reversed(temp_moves):
                if tmp.exists():
                    tmp.rename(src)
            writer.writerow(["", "", "error", str(exc)])
            raise

    print(f"Manifest: {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
