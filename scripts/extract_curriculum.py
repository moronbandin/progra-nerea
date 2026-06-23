#!/usr/bin/env python3
"""Create traceable JSON curriculum records from the official PDF text extraction."""

from __future__ import annotations

import json
import re
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tmp/extracted/curriculo.txt"
OUT = ROOT / "src/data/curriculum"
PUBLIC_OUT = ROOT / "public/curriculum"
PDF_SOURCE = ROOT / "curriculo/AnuncioG0655-190922-0002_es.pdf"


def clean_lines(start: int, end: int) -> list[str]:
    raw = SOURCE.read_text(encoding="utf-8").splitlines()[start - 1 : end]
    result = []
    for line in raw:
        text = re.sub(r"\s+", " ", line).strip()
        if not text:
            continue
        if (
            text.startswith(("DOG Núm.", "CVE-DOG:", "ISSN1130", "Depósito legal"))
            or "https://www.xunta.gal/diario-oficial-galicia" in text
            or text == "\f"
        ):
            continue
        result.append(text)
    return result


def records_from_markers(lines: list[str], pattern: str, prefix: str) -> list[dict]:
    marker = re.compile(pattern)
    records: list[dict] = []
    current: dict | None = None
    for line in lines:
        match = marker.match(line)
        if match:
            if current:
                records.append(current)
            code = match.group("code")
            text = match.group("text")
            objective = None
            obj_match = re.search(r"\s+(OBJ\d+)\s*$", text)
            if obj_match:
                objective = obj_match.group(1)
                text = text[: obj_match.start()].strip()
            current = {
                "id": f"{prefix}-{code.lower().replace('.', '-')}",
                "code": code,
                "legalText": text,
                "sourceReference": "Decreto 156/2022, anexo II, materia 14, 4.º ESO",
            }
            if objective:
                current["specificCompetenceId"] = f"sc-{objective.lower()}"
        elif current:
            if line in {"Criterios de evaluación Objetivos", "Criterios de evaluación", "Objetivos"}:
                continue
            if line.startswith(("Bloque ", "Contenidos", "14.4.", "• ", "– ")):
                records.append(current)
                current = None
                continue
            current["legalText"] = join_wrapped(current["legalText"], line)
    if current:
        records.append(current)
    return records


def extract_contents(lines: list[str]) -> tuple[list[dict], list[dict]]:
    blocks = []
    contents = []
    block_id = None
    in_contents = False
    item_index = 0
    current: dict | None = None
    for line in lines:
        if match := re.match(r"Bloque (?P<number>[1-5])\. (?P<title>.+)", line):
            if current:
                contents.append(current)
                current = None
            block_id = f"block-{match.group('number')}"
            blocks.append(
                {
                    "id": block_id,
                    "code": f"B{match.group('number')}",
                    "legalText": match.group("title"),
                    "shortLabel": match.group("title"),
                    "sourceReference": "Decreto 156/2022, anexo II, materia 14, 4.º ESO",
                }
            )
            in_contents = False
            item_index = 0
            continue
        if line == "Contenidos":
            if current:
                contents.append(current)
                current = None
            in_contents = True
            continue
        if re.match(r"• CE\d", line):
            in_contents = False
            continue
        if not in_contents or not block_id:
            continue
        if line.startswith(("• ", "– ")):
            if current:
                contents.append(current)
            item_index += 1
            code = f"{blocks[-1]['code']}.{item_index}"
            current = {
                "id": f"content-{code.lower().replace('.', '-')}",
                "code": code,
                "legalText": line[2:].strip(),
                "blockId": block_id,
                "sourceReference": "Decreto 156/2022, anexo II, materia 14, 4.º ESO",
            }
        elif current:
            current["legalText"] = join_wrapped(current["legalText"], line)
    if current:
        contents.append(current)
    return blocks, contents


def dump(name: str, value) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUT.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    (OUT / name).write_text(text, encoding="utf-8")
    (PUBLIC_OUT / name).write_text(text, encoding="utf-8")


def join_wrapped(existing: str, continuation: str) -> str:
    if existing.endswith("-"):
        return existing[:-1] + continuation
    return existing + " " + continuation


def extract_descriptors_from_pdf(codes: list[str]) -> list[dict]:
    import pdfplumber

    lines: list[str] = []
    with pdfplumber.open(PDF_SOURCE) as pdf:
        for page_index in range(51, 60):
            grouped: dict[float, list[dict]] = defaultdict(list)
            for word in pdf.pages[page_index].extract_words():
                if word["x0"] >= 305 and 145 <= word["top"] <= 785:
                    grouped[round(word["top"], 1)].append(word)
            for top in sorted(grouped):
                line = " ".join(word["text"] for word in sorted(grouped[top], key=lambda item: item["x0"]))
                if line and "https://www.xunta.gal" not in line:
                    lines.append(line)
            lines.append("__PAGE__")

    wanted = set(codes)
    records: dict[str, str] = {}
    current_code: str | None = None
    current_text = ""
    for line in lines:
        match = re.match(r"(?:•\s+)?(?P<code>(?:CCL|CP|STEM|CD|CPSAA|CC|CE|CCEC)\d)\.\s+(?P<text>.+)", line)
        if match:
            if current_code in wanted:
                records[current_code] = current_text.strip()
            current_code = match.group("code")
            current_text = match.group("text")
        elif current_code:
            if line == "__PAGE__":
                if current_code in wanted:
                    records[current_code] = current_text.strip()
                current_code = None
                current_text = ""
                continue
            if "ANEXO II" in line:
                if current_code in wanted:
                    records[current_code] = current_text.strip()
                current_code = None
                current_text = ""
                continue
            if current_text.rstrip().endswith("."):
                if current_code in wanted:
                    records[current_code] = current_text.strip()
                current_code = None
                current_text = ""
                continue
            if line.startswith(("Descriptores operativos", "Al completar", "la alumna")):
                continue
            current_text = join_wrapped(current_text, line)
    if current_code in wanted:
        records[current_code] = current_text.strip()

    return [
        {
            "id": f"descriptor-{code.lower()}",
            "code": code,
            "legalText": records.get(code, f"Descriptor operativo {code} del perfil de salida."),
            "sourceReference": "Decreto 156/2022, anexo I",
        }
        for code in codes
    ]


def main() -> None:
    lcl = clean_lines(3161, 4400)
    fourth_source = clean_lines(3600, 4400)
    fourth_start = next(
        index for index, line in enumerate(fourth_source) if line == "Bloque 1. Las lenguas y sus hablantes"
    )
    fourth_end = next(
        index for index, line in enumerate(fourth_source[fourth_start:], fourth_start)
        if line.startswith("14.4. Orientaciones pedagógicas")
    )
    fourth = fourth_source[fourth_start:fourth_end]
    stage = clean_lines(474, 552)

    specific = records_from_markers(
        lcl,
        r"(?P<code>OBJ\d+)\.\s+(?P<text>.+)",
        "sc",
    )
    criteria = records_from_markers(
        fourth,
        r"•\s+(?P<code>CE\d+\.\d+)\.\s+(?P<text>.+)",
        "criterion",
    )
    blocks, contents = extract_contents(fourth)

    stage_records = []
    current = None
    for line in stage:
        if match := re.match(r"(?P<code>[a-n])\)\s+(?P<text>.+)", line):
            if current:
                stage_records.append(current)
            current = {
                "id": f"stage-{match.group('code')}",
                "code": match.group("code"),
                "legalText": match.group("text"),
                "sourceReference": "Decreto 156/2022, artículo 7",
            }
        elif current and not line.startswith("Artículo"):
            current["legalText"] = join_wrapped(current["legalText"], line)
    if current:
        stage_records.append(current)

    key_competences = [
        ("CCL", "Competencia en comunicación lingüística"),
        ("CP", "Competencia plurilingüe"),
        ("STEM", "Competencia matemática y competencia en ciencia, tecnología e ingeniería"),
        ("CD", "Competencia digital"),
        ("CPSAA", "Competencia personal, social y de aprender a aprender"),
        ("CC", "Competencia ciudadana"),
        ("CE", "Competencia emprendedora"),
        ("CCEC", "Competencia en conciencia y expresión culturales"),
    ]
    key_records = [
        {
            "id": f"key-{code.lower()}",
            "code": code,
            "legalText": label,
            "shortLabel": label,
            "sourceReference": "Decreto 156/2022, anexo I",
        }
        for code, label in key_competences
    ]

    # The official objective/descriptor matrix is explicit in section 14.4.
    matrix = {
        "OBJ1": ["CCL1", "CCL5", "CP2", "CP3", "CC1", "CC2", "CCEC1", "CCEC3"],
        "OBJ2": ["CCL2", "CP2", "STEM1", "CD2", "CD3", "CPSAA4", "CC3"],
        "OBJ3": ["CCL1", "CCL3", "CCL5", "CP2", "STEM1", "CD2", "CD3", "CC2", "CE1"],
        "OBJ4": ["CCL2", "CCL3", "CCL5", "CP2", "STEM4", "CD1", "CPSAA4", "CC3"],
        "OBJ5": ["CCL1", "CCL3", "CCL5", "STEM1", "CD2", "CD3", "CPSAA5", "CC2"],
        "OBJ6": ["CCL3", "CD1", "CD2", "CD3", "CD4", "CPSAA4", "CC2", "CE3"],
        "OBJ7": ["CCL1", "CCL4", "CD3", "CPSAA1", "CCEC1", "CCEC2", "CCEC3"],
        "OBJ8": ["CCL1", "CCL4", "CC1", "CCEC1", "CCEC2", "CCEC3", "CCEC4"],
        "OBJ9": ["CCL1", "CCL2", "CP2", "STEM1", "STEM2", "CPSAA5"],
        "OBJ10": ["CCL1", "CCL5", "CP3", "CD3", "CPSAA3", "CC1", "CC2", "CC3"],
    }
    descriptor_codes = sorted({code for codes in matrix.values() for code in codes})
    descriptors = extract_descriptors_from_pdf(descriptor_codes)

    relationships = []
    for criterion in criteria:
        objective_id = criterion.get("specificCompetenceId")
        relationships.append(
            {
                "id": f"rel-{criterion['code'].lower().replace('.', '-')}",
                "criterionId": criterion["id"],
                "specificCompetenceId": objective_id,
                "descriptorIds": [
                    f"descriptor-{code.lower()}"
                    for code in matrix.get((objective_id or "").replace("sc-", "").upper(), [])
                ],
                "contentIds": [],
                "relationType": "normative",
                "sourceReference": criterion["sourceReference"],
                "note": "La relación criterio-objetivo es explícita. Los contenidos se seleccionan manualmente porque la tabla normativa los agrupa por bloque, no por criterio individual.",
            }
        )

    dump(
        "manifest.json",
        {
            "schemaVersion": 1,
            "datasetVersion": "2026-06-23",
            "title": "Lengua Castellana y Literatura - 4.º ESO - Galicia",
            "source": "Decreto 156/2022, de 15 de septiembre (DOG núm. 183, 26-09-2022)",
            "sourceFile": "curriculo/AnuncioG0655-190922-0002_es.pdf",
            "scope": "Materia 14, Lengua Castellana y Literatura, 4.º curso de ESO",
            "traceability": "sourceReference conserva artículo, anexo o sección normativa.",
        },
    )
    dump("stage-objectives.json", stage_records)
    dump("key-competences.json", key_records)
    dump("descriptors.json", descriptors)
    dump("specific-competences.json", specific[:10])
    dump("assessment-criteria.json", criteria)
    dump("content-blocks.json", blocks)
    dump("contents.json", contents)
    dump("relationships.json", relationships)


if __name__ == "__main__":
    main()
