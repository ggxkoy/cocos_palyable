#!/usr/bin/env python3
"""Render a production-style playable Markdown design document to PDF."""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)


PAGE_WIDTH, PAGE_HEIGHT = A4
PAGE_MARGIN = 18 * mm
CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
GREEN = colors.HexColor("#0F7A60")
PALE_GREEN = colors.HexColor("#EDF8F2")
LIGHT_GREEN = colors.HexColor("#DDF1E8")
INK = colors.HexColor("#172430")
MUTED = colors.HexColor("#5E6D79")
GRID = colors.HexColor("#C9D7D0")


def register_fonts() -> tuple[str, str]:
    regular_candidates = [
        Path(r"C:\Windows\Fonts\msyh.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf"),
        Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    ]
    bold_candidates = [
        Path(r"C:\Windows\Fonts\msyhbd.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf"),
        Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"),
    ]
    regular = next((path for path in regular_candidates if path.exists()), None)
    bold = next((path for path in bold_candidates if path.exists()), regular)
    if not regular:
        return "Helvetica", "Helvetica-Bold"
    pdfmetrics.registerFont(TTFont("PlannerCN", str(regular), subfontIndex=0))
    pdfmetrics.registerFont(TTFont("PlannerCN-Bold", str(bold), subfontIndex=0))
    return "PlannerCN", "PlannerCN-Bold"


FONT, FONT_BOLD = register_fonts()


def inline_markup(value: str) -> str:
    escaped = html.escape(value.strip())
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(
        r"`([^`]+)`",
        r'<font color="#0F7A60">\1</font>',
        escaped,
    )
    escaped = re.sub(
        r"\[([^\]]+)]\((https?://[^)]+)\)",
        r'<link href="\2" color="#0F7A60">\1</link>',
        escaped,
    )
    return escaped


def build_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "PlannerTitle",
            parent=base["Title"],
            fontName=FONT_BOLD,
            fontSize=24,
            leading=32,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=12,
        ),
        "h2": ParagraphStyle(
            "PlannerH2",
            parent=base["Heading1"],
            fontName=FONT_BOLD,
            fontSize=16,
            leading=22,
            textColor=GREEN,
            spaceBefore=8,
            spaceAfter=10,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "PlannerH3",
            parent=base["Heading2"],
            fontName=FONT_BOLD,
            fontSize=12,
            leading=17,
            textColor=INK,
            spaceBefore=7,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "PlannerBody",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=9.2,
            leading=14.5,
            textColor=INK,
            spaceAfter=5,
        ),
        "quote": ParagraphStyle(
            "PlannerQuote",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=9,
            leading=14,
            textColor=INK,
            leftIndent=5,
            rightIndent=5,
        ),
        "table": ParagraphStyle(
            "PlannerTable",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=7.6,
            leading=11,
            textColor=INK,
        ),
        "table_head": ParagraphStyle(
            "PlannerTableHead",
            parent=base["BodyText"],
            fontName=FONT_BOLD,
            fontSize=7.8,
            leading=11,
            textColor=INK,
            alignment=TA_CENTER,
        ),
        "caption": ParagraphStyle(
            "PlannerCaption",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=8,
            leading=11,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceBefore=3,
            spaceAfter=8,
        ),
        "code": ParagraphStyle(
            "PlannerCode",
            parent=base["Code"],
            fontName=FONT,
            fontSize=7.5,
            leading=10.5,
            textColor=INK,
            backColor=colors.HexColor("#F4F7F5"),
            borderColor=GRID,
            borderWidth=0.5,
            borderPadding=7,
            spaceAfter=8,
        ),
    }


STYLES = build_styles()
PAGE_BREAK_SECTIONS = {
    "资源循环",
    "角色&道具",
    "地编需求",
    "流程引导&数值设计",
    "UI&引导按钮",
    "音效",
    "模板映射（→ 代码落点）",
    "制作验收",
}


def image_flowable(markdown_line: str, markdown_dir: Path):
    match = re.fullmatch(r"!\[([^\]]*)]\(([^)]+)\)", markdown_line.strip())
    if not match:
        return None
    caption, target = match.groups()
    image_path = (markdown_dir / target).resolve()
    if not image_path.exists():
        return Paragraph(f"图片缺失：{html.escape(target)}", STYLES["caption"])
    image = Image(str(image_path))
    max_width = CONTENT_WIDTH * 0.72
    max_height = 115 * mm
    scale = min(max_width / image.imageWidth, max_height / image.imageHeight, 1)
    image.drawWidth = image.imageWidth * scale
    image.drawHeight = image.imageHeight * scale
    image.hAlign = "CENTER"
    items = [image]
    if caption:
        items.append(Paragraph(inline_markup(caption), STYLES["caption"]))
    return KeepTogether(items)


def parse_table(lines: list[str]) -> Table:
    rows = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", cell or "") for cell in cells):
            continue
        rows.append(cells)
    column_count = max(len(row) for row in rows)
    for row in rows:
        row.extend([""] * (column_count - len(row)))
    data = []
    for row_index, row in enumerate(rows):
        style = STYLES["table_head"] if row_index == 0 else STYLES["table"]
        data.append([Paragraph(inline_markup(cell), style) for cell in row])

    if column_count == 2:
        widths = [CONTENT_WIDTH * 0.30, CONTENT_WIDTH * 0.70]
    elif column_count == 3:
        widths = [CONTENT_WIDTH * 0.21, CONTENT_WIDTH * 0.39, CONTENT_WIDTH * 0.40]
    elif column_count == 4:
        widths = [CONTENT_WIDTH * 0.16, CONTENT_WIDTH * 0.26, CONTENT_WIDTH * 0.32, CONTENT_WIDTH * 0.26]
    elif column_count == 5:
        widths = [CONTENT_WIDTH / 5] * 5
    else:
        widths = [CONTENT_WIDTH / column_count] * column_count

    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GREEN),
                ("TEXTCOLOR", (0, 0), (-1, -1), INK),
                ("GRID", (0, 0), (-1, -1), 0.5, GRID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FBFA")]),
            ]
        )
    )
    return table


def markdown_story(markdown_path: Path):
    lines = markdown_path.read_text(encoding="utf-8").splitlines()
    story = []
    paragraph_buffer: list[str] = []
    quote_buffer: list[str] = []
    code_buffer: list[str] = []
    in_code = False
    first_title = True

    def flush_paragraph():
        if paragraph_buffer:
            story.append(Paragraph(inline_markup(" ".join(paragraph_buffer)), STYLES["body"]))
            paragraph_buffer.clear()

    def flush_quote():
        if quote_buffer:
            text = "<br/>".join(inline_markup(line) for line in quote_buffer)
            box = Table([[Paragraph(text, STYLES["quote"])]], colWidths=[CONTENT_WIDTH])
            box.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), PALE_GREEN),
                        ("BOX", (0, 0), (-1, -1), 0.5, LIGHT_GREEN),
                        ("LEFTPADDING", (0, 0), (-1, -1), 9),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                        ("TOPPADDING", (0, 0), (-1, -1), 8),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ]
                )
            )
            story.extend([box, Spacer(1, 8)])
            quote_buffer.clear()

    index = 0
    while index < len(lines):
        raw = lines[index]
        stripped = raw.strip()

        if stripped.startswith("```"):
            flush_paragraph()
            flush_quote()
            if in_code:
                story.append(Preformatted("\n".join(code_buffer), STYLES["code"]))
                code_buffer.clear()
                in_code = False
            else:
                in_code = True
            index += 1
            continue
        if in_code:
            code_buffer.append(raw)
            index += 1
            continue

        if stripped.startswith(">"):
            flush_paragraph()
            quote_buffer.append(stripped.lstrip("> ").strip())
            index += 1
            continue
        flush_quote()

        if stripped.startswith("|") and stripped.endswith("|"):
            flush_paragraph()
            table_lines = []
            while index < len(lines):
                candidate = lines[index].strip()
                if not (candidate.startswith("|") and candidate.endswith("|")):
                    break
                table_lines.append(candidate)
                index += 1
            if len(table_lines) >= 2:
                story.extend([parse_table(table_lines), Spacer(1, 9)])
            continue

        image = image_flowable(stripped, markdown_path.parent)
        if image:
            flush_paragraph()
            story.append(image)
            index += 1
            continue

        heading = re.match(r"^(#{1,3})\s+(.+)$", stripped)
        if heading:
            flush_paragraph()
            level = len(heading.group(1))
            title = heading.group(2).strip()
            if level == 1:
                if not first_title:
                    story.append(PageBreak())
                story.append(Paragraph(inline_markup(title), STYLES["title"]))
                story.append(Spacer(1, 3))
                first_title = False
            elif level == 2:
                if title in PAGE_BREAK_SECTIONS:
                    story.append(PageBreak())
                story.append(Paragraph(inline_markup(title), STYLES["h2"]))
            else:
                story.append(Paragraph(inline_markup(title), STYLES["h3"]))
            index += 1
            continue

        list_item = re.match(r"^[-*]\s+(.+)$", stripped)
        numbered_item = re.match(r"^\d+\.\s+(.+)$", stripped)
        if list_item or numbered_item:
            flush_paragraph()
            value = (list_item or numbered_item).group(1)
            bullet = "•" if list_item else f"{re.match(r'^(\d+)', stripped).group(1)}."
            story.append(
                Paragraph(
                    inline_markup(value),
                    ParagraphStyle(
                        "PlannerList",
                        parent=STYLES["body"],
                        leftIndent=12,
                        firstLineIndent=-8,
                    ),
                    bulletText=bullet,
                )
            )
            index += 1
            continue

        if not stripped:
            flush_paragraph()
            index += 1
            continue

        paragraph_buffer.append(stripped.rstrip("  "))
        index += 1

    flush_paragraph()
    flush_quote()
    if code_buffer:
        story.append(Preformatted("\n".join(code_buffer), STYLES["code"]))
    return story


def draw_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LIGHT_GREEN)
    canvas.setLineWidth(0.7)
    canvas.line(PAGE_MARGIN, PAGE_HEIGHT - 13 * mm, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 13 * mm)
    canvas.setFont(FONT, 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(PAGE_MARGIN, PAGE_HEIGHT - 10 * mm, "Playable 广告生产策划案")
    canvas.drawRightString(PAGE_WIDTH - PAGE_MARGIN, 9 * mm, f"{doc.page}")
    canvas.restoreState()


def render(markdown_path: Path, output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    frame = Frame(
        PAGE_MARGIN,
        15 * mm,
        CONTENT_WIDTH,
        PAGE_HEIGHT - 31 * mm,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    template = PageTemplate(id="content", frames=[frame], onPage=draw_page)
    doc = BaseDocTemplate(
        str(output_path),
        pagesize=A4,
        title=markdown_path.stem,
        author="Playable Planner",
        leftMargin=PAGE_MARGIN,
        rightMargin=PAGE_MARGIN,
        topMargin=16 * mm,
        bottomMargin=15 * mm,
    )
    doc.addPageTemplates([template])
    doc.build(markdown_story(markdown_path))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("markdown", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    render(args.markdown.resolve(), args.output.resolve())
    print(args.output.resolve())


if __name__ == "__main__":
    main()
