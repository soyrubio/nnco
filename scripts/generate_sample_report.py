#!/usr/bin/env python3
"""Generate the verified NNCO Signal sample report."""

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "sample-operational-intelligence-scan.pdf"
PUBLIC = ROOT / "public" / "sample-report.pdf"

TEXT = HexColor("#222222")
MUTED = HexColor("#6B7280")
RULE = HexColor("#E5E7EB")
NEUTRAL = HexColor("#F5F5F5")
WHITE = HexColor("#FFFFFF")
BLACK = HexColor("#000000")

PAGE_W, PAGE_H = A4
MARGIN_X = 20 * mm
MARGIN_TOP = 18 * mm
MARGIN_BOTTOM = 15 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X
RADIUS = 1.4 * mm
CASE_ID = "SIGNAL-260729-071"
CLASSIFICATION = "Preview / confidential"


def first_existing(paths: tuple[str, ...]) -> str:
    for path in paths:
        if Path(path).exists():
            return path
    raise FileNotFoundError(f"No suitable font found in: {', '.join(paths)}")


def register_fonts() -> None:
    """Embed Czech-capable Helvetica-like fonts in the generated PDF."""
    regular = first_existing(
        (
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        )
    )
    bold = first_existing(
        (
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        )
    )
    pdfmetrics.registerFont(TTFont("NNC-Regular", regular))
    pdfmetrics.registerFont(TTFont("NNC-Bold", bold))


def draw_nnco_logo(canvas: Canvas, x: float, y: float, width: float) -> None:
    """Draw the official NNCO vector mark without rasterisation."""
    height = width * 700 / 900

    def polygon(points: tuple[tuple[int, int], ...], color=BLACK) -> None:
        path = canvas.beginPath()
        path.moveTo(*points[0])
        for point in points[1:]:
            path.lineTo(*point)
        path.close()
        canvas.setFillColor(color)
        canvas.drawPath(path, fill=1, stroke=0)

    canvas.saveState()
    canvas.translate(x, y + height)
    canvas.scale(width / 900, -height / 700)
    polygon(
        (
            (400, 0),
            (400, 300),
            (300, 300),
            (300, 100),
            (100, 100),
            (100, 300),
            (0, 300),
            (0, 0),
        )
    )
    polygon(
        (
            (600, 0),
            (900, 0),
            (900, 300),
            (800, 300),
            (800, 100),
            (600, 100),
            (600, 300),
            (500, 300),
            (500, 0),
        )
    )
    polygon(
        (
            (0, 400),
            (400, 400),
            (400, 500),
            (100, 500),
            (100, 600),
            (400, 600),
            (400, 700),
            (0, 700),
        )
    )
    polygon(((500, 400), (900, 400), (900, 700), (500, 700)))
    polygon(((600, 500), (800, 500), (800, 600), (600, 600)), color=WHITE)
    canvas.restoreState()


def paragraph(
    canvas: Canvas,
    text: str,
    x: float,
    y_top: float,
    width: float,
    *,
    font: str = "NNC-Regular",
    size: float = 8.5,
    leading: float = 12,
    color=TEXT,
    align=TA_LEFT,
) -> float:
    style = ParagraphStyle(
        name="inline",
        fontName=font,
        fontSize=size,
        leading=leading,
        textColor=color,
        alignment=align,
        spaceAfter=0,
        spaceBefore=0,
        splitLongWords=False,
    )
    block = Paragraph(text, style)
    _, height = block.wrap(width, PAGE_H)
    block.drawOn(canvas, x, y_top - height)
    return height


def label(
    canvas: Canvas,
    text: str,
    x: float,
    y: float,
    *,
    color=MUTED,
    size: float = 6.4,
    font: str = "NNC-Regular",
) -> None:
    canvas.setFont(font, size)
    canvas.setFillColor(color)
    canvas.drawString(x, y, text)


def rule(
    canvas: Canvas,
    y: float,
    x1: float = MARGIN_X,
    x2: float = PAGE_W - MARGIN_X,
    *,
    color=RULE,
    width: float = 0.6,
) -> None:
    canvas.setStrokeColor(color)
    canvas.setLineWidth(width)
    canvas.line(x1, y, x2, y)


def panel(
    canvas: Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    *,
    fill=WHITE,
    stroke=RULE,
    line_width: float = 0.7,
) -> None:
    canvas.setFillColor(fill)
    canvas.setStrokeColor(stroke)
    canvas.setLineWidth(line_width)
    canvas.roundRect(
        x,
        y,
        width,
        height,
        RADIUS,
        fill=1,
        stroke=1,
    )


def pill(
    canvas: Canvas,
    text: str,
    x: float,
    y: float,
    *,
    width: float,
    fill=NEUTRAL,
    color=TEXT,
    stroke=RULE,
) -> None:
    height = 7 * mm
    canvas.setFillColor(fill)
    canvas.setStrokeColor(stroke)
    canvas.setLineWidth(0.6)
    canvas.roundRect(
        x,
        y,
        width,
        height,
        height / 2,
        fill=1,
        stroke=1,
    )
    canvas.setFillColor(color)
    canvas.setFont("NNC-Regular", 6.2)
    canvas.drawCentredString(x + width / 2, y + 2.35 * mm, text)


def page_header(canvas: Canvas, title: str, page: int) -> None:
    draw_nnco_logo(
        canvas,
        MARGIN_X,
        PAGE_H - MARGIN_TOP - 2.1 * mm,
        7.1 * mm,
    )
    label(
        canvas,
        f"Signal / {page:02d}",
        MARGIN_X + 12 * mm,
        PAGE_H - MARGIN_TOP,
        color=MUTED,
        size=7,
    )
    classification_width = 34 * mm
    pill(
        canvas,
        CLASSIFICATION,
        PAGE_W - MARGIN_X - classification_width,
        PAGE_H - MARGIN_TOP - 2.4 * mm,
        width=classification_width,
        fill=WHITE,
    )
    rule(canvas, PAGE_H - MARGIN_TOP - 7 * mm)
    paragraph(
        canvas,
        title,
        MARGIN_X,
        PAGE_H - MARGIN_TOP - 14 * mm,
        CONTENT_W,
        size=22,
        leading=25,
    )


def page_footer(canvas: Canvas, page: int, total: int = 6) -> None:
    rule(canvas, MARGIN_BOTTOM + 8 * mm)
    label(canvas, f"Case {CASE_ID}", MARGIN_X, MARGIN_BOTTOM, color=MUTED)
    label(
        canvas,
        CLASSIFICATION,
        PAGE_W / 2 - 17 * mm,
        MARGIN_BOTTOM,
        color=MUTED,
    )
    canvas.setFont("NNC-Regular", 6.4)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(
        PAGE_W - MARGIN_X,
        MARGIN_BOTTOM,
        f"{page:02d} / {total:02d}",
    )


def metric_card(
    canvas: Canvas,
    x: float,
    y_top: float,
    width: float,
    title: str,
    value: str,
    detail: str,
) -> None:
    height = 32 * mm
    panel(canvas, x, y_top - height, width, height, fill=WHITE)
    label(canvas, title, x + 5 * mm, y_top - 8 * mm)
    paragraph(
        canvas,
        value,
        x + 5 * mm,
        y_top - 13 * mm,
        width - 10 * mm,
        size=17,
        leading=19,
    )
    paragraph(
        canvas,
        detail,
        x + 5 * mm,
        y_top - 23 * mm,
        width - 10 * mm,
        size=6.5,
        leading=8.5,
        color=MUTED,
    )


def draw_cover(canvas: Canvas) -> None:
    canvas.setFillColor(WHITE)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    draw_nnco_logo(
        canvas,
        MARGIN_X,
        PAGE_H - MARGIN_TOP - 2.4 * mm,
        8.2 * mm,
    )
    label(
        canvas,
        "Signal / 01",
        MARGIN_X + 13 * mm,
        PAGE_H - MARGIN_TOP,
        color=MUTED,
        size=8,
    )
    classification_width = 34 * mm
    pill(
        canvas,
        CLASSIFICATION,
        PAGE_W - MARGIN_X - classification_width,
        PAGE_H - MARGIN_TOP - 2.4 * mm,
        width=classification_width,
        fill=WHITE,
    )
    rule(canvas, PAGE_H - MARGIN_TOP - 8 * mm)

    label(
        canvas,
        "Operational intelligence scan",
        MARGIN_X,
        PAGE_H - 63 * mm,
        color=MUTED,
        size=8,
    )
    paragraph(
        canvas,
        "Where the operation<br/>loses signal.",
        MARGIN_X,
        PAGE_H - 77 * mm,
        150 * mm,
        size=39,
        leading=40,
        color=TEXT,
    )
    paragraph(
        canvas,
        "A sample diagnostic of fragmented monthly management reporting.",
        MARGIN_X,
        PAGE_H - 123 * mm,
        100 * mm,
        size=11,
        leading=15,
        color=MUTED,
    )

    flow_y = 98 * mm
    flow_items = [
        ("1", "Sources"),
        ("2", "Handoffs"),
        ("3", "Decisions"),
        ("4", "Outcomes"),
    ]
    flow_gap = 5 * mm
    flow_w = (CONTENT_W - 3 * flow_gap) / 4
    for index, (number, title) in enumerate(flow_items):
        x = MARGIN_X + index * (flow_w + flow_gap)
        panel(canvas, x, flow_y, flow_w, 25 * mm, fill=WHITE)
        pill(
            canvas,
            number,
            x + 4 * mm,
            flow_y + 13 * mm,
            width=7 * mm,
            fill=NEUTRAL,
        )
        label(canvas, title, x + 4 * mm, flow_y + 6 * mm, color=TEXT, size=7)
        if index < len(flow_items) - 1:
            canvas.setStrokeColor(RULE)
            canvas.setLineWidth(0.7)
            canvas.line(
                x + flow_w,
                flow_y + 12.5 * mm,
                x + flow_w + flow_gap,
                flow_y + 12.5 * mm,
            )

    meta_top = 77 * mm
    rule(canvas, meta_top)
    columns = [
        ("Case", CASE_ID),
        ("Sector", "Finance"),
        ("Scope", "Monthly reporting"),
    ]
    col_w = CONTENT_W / 3
    for index, (key, value) in enumerate(columns):
        x = MARGIN_X + index * col_w
        label(canvas, key, x, meta_top - 8 * mm)
        label(canvas, value, x, meta_top - 16 * mm, color=TEXT, size=7.4)
    rule(canvas, meta_top - 23 * mm)

    paragraph(
        canvas,
        "Sample diagnostic only. Findings and estimates require validation and do not constitute an offer.",
        MARGIN_X,
        41 * mm,
        120 * mm,
        size=7,
        leading=9.5,
        color=MUTED,
    )
    label(canvas, "NNCO / Prague / 29 July 2026", MARGIN_X, MARGIN_BOTTOM, color=MUTED)
    label(
        canvas,
        CLASSIFICATION,
        PAGE_W / 2 - 17 * mm,
        MARGIN_BOTTOM,
        color=MUTED,
    )
    canvas.setFont("NNC-Regular", 6.4)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W - MARGIN_X, MARGIN_BOTTOM, "01 / 06")


def draw_executive(canvas: Canvas) -> None:
    canvas.setFillColor(WHITE)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(canvas, "Executive snapshot", 2)

    label(canvas, "Situation / reported", MARGIN_X, PAGE_H - 58 * mm)
    paragraph(
        canvas,
        "The monthly reporting workflow crosses seven source systems. Analysts collect files from email and portals, normalise them in spreadsheets, investigate differences through email and copy approved figures into the final reporting layer.",
        MARGIN_X,
        PAGE_H - 66 * mm,
        CONTENT_W,
        size=15,
        leading=20,
    )

    cards_y = PAGE_H - 112 * mm
    gap = 4 * mm
    card_w = (CONTENT_W - 2 * gap) / 3
    metric_card(
        canvas,
        MARGIN_X,
        cards_y,
        card_w,
        "Reported effort",
        "16-30 h",
        "Per monthly cycle. Validate against two representative cycles.",
    )
    metric_card(
        canvas,
        MARGIN_X + card_w + gap,
        cards_y,
        card_w,
        "Source systems",
        "7",
        "Email, portals, ERP exports, spreadsheets and business intelligence.",
    )
    metric_card(
        canvas,
        MARGIN_X + 2 * (card_w + gap),
        cards_y,
        card_w,
        "Readiness",
        "Medium",
        "Process is visible. Access and source ownership still need proof.",
    )

    section_y = PAGE_H - 158 * mm
    label(canvas, "Priority signals", MARGIN_X, section_y, color=TEXT, size=8)
    priorities = [
        (
            "1",
            "Source-to-output lineage is incomplete",
            "Numbers can be reproduced, but the path from source file to approved output is partly manual.",
            "High impact",
        ),
        (
            "2",
            "Exceptions operate outside a visible queue",
            "Missing inputs and mapping differences are resolved in email without shared categories or ownership.",
            "High impact",
        ),
        (
            "3",
            "Mapping logic lives in analyst spreadsheets",
            "Business logic is reusable but not centrally governed, measured or tested.",
            "Medium impact",
        ),
    ]
    row_y = section_y - 7 * mm
    for number, title, detail, band in priorities:
        row_h = 26 * mm
        panel(canvas, MARGIN_X, row_y - row_h, CONTENT_W, row_h, fill=WHITE)
        pill(
            canvas,
            number,
            MARGIN_X + 4 * mm,
            row_y - 17 * mm,
            width=8 * mm,
            fill=NEUTRAL,
        )
        label(
            canvas,
            title,
            MARGIN_X + 17 * mm,
            row_y - 8 * mm,
            color=TEXT,
            size=8.2,
        )
        paragraph(
            canvas,
            detail,
            MARGIN_X + 17 * mm,
            row_y - 12 * mm,
            105 * mm,
            size=6.5,
            leading=8.5,
            color=MUTED,
        )
        pill(
            canvas,
            band,
            PAGE_W - MARGIN_X - 29 * mm,
            row_y - 17 * mm,
            width=25 * mm,
            fill=NEUTRAL,
        )
        row_y -= row_h + 3 * mm

    label(canvas, "Evidence confidence", MARGIN_X, 42 * mm, color=MUTED)
    label(canvas, "78%", MARGIN_X + 41 * mm, 42 * mm, color=TEXT, size=7)
    canvas.setFillColor(RULE)
    canvas.roundRect(MARGIN_X, 35 * mm, CONTENT_W, 1.8 * mm, 0.9 * mm, fill=1, stroke=0)
    canvas.setFillColor(TEXT)
    canvas.roundRect(
        MARGIN_X,
        35 * mm,
        CONTENT_W * 0.78,
        1.8 * mm,
        0.9 * mm,
        fill=1,
        stroke=0,
    )
    page_footer(canvas, 2)


def draw_priority_field(canvas: Canvas) -> None:
    canvas.setFillColor(WHITE)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(canvas, "Priority field", 3)

    label(
        canvas,
        "Impact × feasibility / confidence shown by outline",
        MARGIN_X,
        PAGE_H - 58 * mm,
    )
    plot_x = MARGIN_X + 10 * mm
    plot_y = 65 * mm
    plot_w = 106 * mm
    plot_h = 150 * mm
    panel(canvas, plot_x, plot_y, plot_w, plot_h, fill=WHITE)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    for index in range(1, 5):
        x = plot_x + index * plot_w / 5
        y = plot_y + index * plot_h / 5
        canvas.line(x, plot_y, x, plot_y + plot_h)
        canvas.line(plot_x, y, plot_x + plot_w, y)
    label(canvas, "Lower feasibility", plot_x, plot_y - 8 * mm)
    canvas.setFont("NNC-Regular", 6.4)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(plot_x + plot_w, plot_y - 8 * mm, "Higher feasibility")
    canvas.saveState()
    canvas.translate(plot_x - 7 * mm, plot_y)
    canvas.rotate(90)
    label(canvas, "Impact", 0, 0)
    canvas.restoreState()

    points = [
        ("1", 0.78, 0.88, "High", "Lineage"),
        ("2", 0.64, 0.79, "Medium", "Exceptions"),
        ("3", 0.83, 0.62, "Medium", "Mapping logic"),
        ("4", 0.43, 0.49, "Low", "Approval timing"),
    ]
    confidence_dashes = {
        "High": (),
        "Medium": (3, 2),
        "Low": (1, 2),
    }
    for number, feasibility, impact, confidence, _ in points:
        cx = plot_x + plot_w * feasibility
        cy = plot_y + plot_h * impact
        canvas.setFillColor(WHITE)
        canvas.setStrokeColor(TEXT)
        canvas.setLineWidth(1.2)
        dash = confidence_dashes[confidence]
        canvas.setDash(*dash) if dash else canvas.setDash()
        canvas.circle(cx, cy, 4.5 * mm, fill=1, stroke=1)
        canvas.setDash()
        canvas.setFillColor(TEXT)
        canvas.setFont("NNC-Bold", 6.5)
        canvas.drawCentredString(cx, cy - 2, number)

    legend_x = 145 * mm
    legend_y = PAGE_H - 67 * mm
    label(canvas, "Priority order", legend_x, legend_y, color=TEXT, size=8)
    descriptions = [
        "Trace every reported figure to its source and transformation.",
        "Create one owned exception queue with resolution evidence.",
        "Move stable mappings into governed and tested rules.",
        "Measure approval latency before changing the approval model.",
    ]
    for index, (number, _, _, confidence, title) in enumerate(points):
        top = legend_y - 10 * mm - index * 31 * mm
        panel(canvas, legend_x, top - 24 * mm, 45 * mm, 24 * mm, fill=WHITE)
        pill(
            canvas,
            number,
            legend_x + 3 * mm,
            top - 10 * mm,
            width=7 * mm,
            fill=NEUTRAL,
        )
        label(canvas, title, legend_x + 13 * mm, top - 6 * mm, color=TEXT, size=7)
        paragraph(
            canvas,
            descriptions[index],
            legend_x + 13 * mm,
            top - 10 * mm,
            28 * mm,
            size=5.8,
            leading=7.4,
            color=MUTED,
        )
        label(
            canvas,
            f"{confidence} confidence",
            legend_x + 3 * mm,
            top - 20 * mm,
            size=5.8,
        )

    label(canvas, "Readiness", legend_x, 92 * mm, color=TEXT, size=8)
    readiness = [
        ("Data", 72),
        ("System access", 46),
        ("Process clarity", 81),
        ("Governance", 61),
        ("Ownership", 68),
    ]
    y = 81 * mm
    for title, score in readiness:
        label(canvas, title, legend_x, y, color=MUTED)
        canvas.setFillColor(RULE)
        canvas.roundRect(legend_x, y - 5 * mm, 37 * mm, 1.5 * mm, 0.75 * mm, fill=1, stroke=0)
        canvas.setFillColor(TEXT)
        canvas.roundRect(
            legend_x,
            y - 5 * mm,
            37 * mm * score / 100,
            1.5 * mm,
            0.75 * mm,
            fill=1,
            stroke=0,
        )
        canvas.setFont("NNC-Regular", 6)
        canvas.setFillColor(TEXT)
        canvas.drawRightString(legend_x + 45 * mm, y - 1 * mm, str(score))
        y -= 12 * mm

    page_footer(canvas, 3)


def draw_workflow(canvas: Canvas) -> None:
    canvas.setFillColor(WHITE)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(canvas, "Current workflow map", 4)

    label(canvas, "Reported process / one monthly cycle", MARGIN_X, PAGE_H - 58 * mm)
    nodes = [
        ("1", "Collect", "7 source inputs"),
        ("2", "Normalise", "Rename and map"),
        ("3", "Reconcile", "Investigate breaks"),
        ("4", "Approve", "Email sign-off"),
        ("5", "Publish", "Copy into BI"),
    ]
    node_w = 30 * mm
    gap = 5 * mm
    x = MARGIN_X
    y = PAGE_H - 92 * mm
    for index, (number, title, detail) in enumerate(nodes):
        panel(canvas, x, y, node_w, 25 * mm, fill=WHITE)
        pill(
            canvas,
            number,
            x + 3 * mm,
            y + 14 * mm,
            width=7 * mm,
            fill=NEUTRAL,
        )
        label(canvas, title, x + 3 * mm, y + 7 * mm, color=TEXT, size=7.4)
        label(canvas, detail, x + 3 * mm, y + 3 * mm, color=MUTED, size=5.5)
        if index < len(nodes) - 1:
            canvas.setStrokeColor(RULE)
            canvas.setLineWidth(0.8)
            canvas.line(
                x + node_w,
                y + 12.5 * mm,
                x + node_w + gap,
                y + 12.5 * mm,
            )
        x += node_w + gap

    label(canvas, "Handoffs and fractures", MARGIN_X, PAGE_H - 111 * mm, color=TEXT, size=8)
    table_top = PAGE_H - 119 * mm
    columns = [11 * mm, 42 * mm, 40 * mm, 48 * mm, 29 * mm]
    headers = ["#", "Step", "Owner", "Observed fracture", "Evidence"]
    x = MARGIN_X
    for width, header in zip(columns, headers):
        canvas.setFillColor(NEUTRAL)
        canvas.setStrokeColor(RULE)
        canvas.rect(x, table_top - 10 * mm, width, 10 * mm, fill=1, stroke=1)
        label(canvas, header, x + 2 * mm, table_top - 6.3 * mm, color=TEXT, size=5.8)
        x += width
    rows = [
        ("1", "Source intake", "Operations analyst", "Inputs arrive at different cut-offs", "Reported"),
        ("2", "Normalisation", "Operations analyst", "Mapping rules live in workbook tabs", "Reported"),
        ("3", "Exception review", "Controller", "Resolution happens in email threads", "Reported"),
        ("4", "Approval", "Finance lead", "No measured approval cycle time", "Inferred"),
        ("5", "Publication", "Analyst", "Lineage to final BI figure is manual", "Reported"),
    ]
    y = table_top - 10 * mm
    for row_index, row in enumerate(rows):
        row_h = 18 * mm
        x = MARGIN_X
        if row_index % 2 == 0:
            canvas.setFillColor(NEUTRAL)
            canvas.rect(MARGIN_X, y - row_h, sum(columns), row_h, fill=1, stroke=0)
        for column_index, (width, cell) in enumerate(zip(columns, row)):
            paragraph(
                canvas,
                cell,
                x + 2 * mm,
                y - 4 * mm,
                width - 4 * mm,
                font="NNC-Bold" if column_index == 1 else "NNC-Regular",
                size=6,
                leading=8,
                color=TEXT if column_index < 4 else MUTED,
            )
            x += width
        rule(canvas, y - row_h, MARGIN_X, MARGIN_X + sum(columns))
        y -= row_h

    validate_y = 45 * mm
    panel(canvas, MARGIN_X, validate_y, CONTENT_W, 29 * mm, fill=NEUTRAL)
    label(canvas, "Validate next", MARGIN_X + 5 * mm, validate_y + 20 * mm, color=TEXT, size=7.4)
    paragraph(
        canvas,
        "Observe two complete reporting cycles. Capture file arrival times, exception categories, mapping changes, approval timestamps and the exact path from source line item to final output.",
        MARGIN_X + 5 * mm,
        validate_y + 15 * mm,
        CONTENT_W - 10 * mm,
        size=7.2,
        leading=10,
        color=MUTED,
    )
    page_footer(canvas, 4)


def draw_blind_spots(canvas: Canvas) -> None:
    canvas.setFillColor(WHITE)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(canvas, "Ten blind spots", 5)
    label(
        canvas,
        "Unresolved questions, ordered by decision value",
        MARGIN_X,
        PAGE_H - 58 * mm,
    )
    items = [
        ("1", "Who owns each source at cut-off?", "Ownership"),
        ("2", "Which input is authoritative when figures disagree?", "Data"),
        ("3", "How often do mapping rules change?", "Stability"),
        ("4", "What percentage of cycles require material rework?", "Impact"),
        ("5", "Where are exception reasons recorded?", "Control"),
        ("6", "Can each source be accessed by export or API?", "Feasibility"),
        ("7", "Which approvals require maker-checker separation?", "Governance"),
        ("8", "What retention rule applies to source evidence?", "Compliance"),
        ("9", "Who would own a pilot and measure benefit?", "Adoption"),
        ("10", "What is the accepted reporting cut-off policy?", "Process"),
    ]
    y = PAGE_H - 69 * mm
    col_gap = 5 * mm
    col_w = (CONTENT_W - col_gap) / 2
    for index, (number, text, category) in enumerate(items):
        col = index % 2
        row = index // 2
        x = MARGIN_X + col * (col_w + col_gap)
        top = y - row * 34 * mm
        panel(canvas, x, top - 29 * mm, col_w, 29 * mm, fill=WHITE)
        pill(
            canvas,
            number,
            x + 4 * mm,
            top - 11 * mm,
            width=8 * mm,
            fill=NEUTRAL,
        )
        label(canvas, category, x + 16 * mm, top - 7 * mm, color=MUTED, size=6)
        paragraph(
            canvas,
            text,
            x + 16 * mm,
            top - 12 * mm,
            col_w - 20 * mm,
            size=9,
            leading=11.5,
            color=TEXT,
        )

    panel(canvas, MARGIN_X, 34 * mm, CONTENT_W, 28 * mm, fill=NEUTRAL)
    label(canvas, "Confidence rule", MARGIN_X + 5 * mm, 53 * mm, color=TEXT, size=7.2)
    paragraph(
        canvas,
        "Missing evidence does not erase a potentially severe problem. High-impact, low-confidence findings are labelled “Validate next” and carried into the first workshop agenda.",
        MARGIN_X + 5 * mm,
        48 * mm,
        CONTENT_W - 10 * mm,
        size=7,
        leading=9.5,
        color=MUTED,
    )
    page_footer(canvas, 5)


def draw_solutions(canvas: Canvas) -> None:
    canvas.setFillColor(WHITE)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(canvas, "Solution variants and roadmap", 6)

    pill(
        canvas,
        "Validate before scope",
        MARGIN_X,
        PAGE_H - 64 * mm,
        width=35 * mm,
        fill=NEUTRAL,
    )
    label(
        canvas,
        "Indicative options, not a final offer",
        MARGIN_X + 40 * mm,
        PAGE_H - 61.7 * mm,
        color=MUTED,
        size=6.6,
    )
    solutions = [
        (
            "A",
            "Process-first control",
            "Standard input template, cut-off policy and one exception taxonomy.",
            "1-2 weeks",
            "Low complexity",
            "EUR 8k-15k",
        ),
        (
            "B",
            "Reusable workflow",
            "Ingestion, schema mapping, validation rules, evidence lineage and owned exception queue.",
            "4-6 weeks",
            "Medium complexity",
            "EUR 35k-65k",
        ),
        (
            "C",
            "Agent-assisted review",
            "Draft exception analysis and reporting commentary with human approval and complete traceability.",
            "6-10 weeks",
            "Medium-high complexity",
            "EUR 60k-110k",
        ),
    ]
    y = PAGE_H - 75 * mm
    for index, (code, title, detail, timing, complexity, price) in enumerate(solutions):
        height = 42 * mm
        top = y - index * (height + 4 * mm)
        panel(
            canvas,
            MARGIN_X,
            top - height,
            CONTENT_W,
            height,
            fill=NEUTRAL if index == 1 else WHITE,
            stroke=TEXT if index == 1 else RULE,
            line_width=1 if index == 1 else 0.7,
        )
        pill(
            canvas,
            code,
            MARGIN_X + 5 * mm,
            top - 13 * mm,
            width=8 * mm,
            fill=WHITE,
            stroke=TEXT if index == 1 else RULE,
        )
        label(
            canvas,
            "Recommended" if index == 1 else "Variant",
            MARGIN_X + 18 * mm,
            top - 8 * mm,
            color=MUTED,
        )
        paragraph(
            canvas,
            title,
            MARGIN_X + 18 * mm,
            top - 13 * mm,
            84 * mm,
            size=13,
            leading=15,
        )
        paragraph(
            canvas,
            detail,
            MARGIN_X + 18 * mm,
            top - 24 * mm,
            86 * mm,
            size=6.6,
            leading=8.5,
            color=MUTED,
        )
        meta_x = PAGE_W - MARGIN_X - 49 * mm
        label(canvas, "Time", meta_x, top - 8 * mm)
        label(canvas, timing, meta_x + 16 * mm, top - 8 * mm, color=TEXT)
        label(canvas, "Delivery", meta_x, top - 18 * mm)
        label(canvas, complexity, meta_x + 16 * mm, top - 18 * mm, color=TEXT)
        label(canvas, "Indicative", meta_x, top - 28 * mm)
        label(canvas, price, meta_x + 16 * mm, top - 28 * mm, color=TEXT)

    label(canvas, "Recommended roadmap", MARGIN_X, 77 * mm, color=TEXT, size=8)
    roadmap = [
        ("0-30 days", "Validate two cycles", "Confirm sources, mappings, exceptions and owners."),
        ("30-90 days", "Pilot the workflow", "Automate ingestion and evidence lineage for one reporting pack."),
        ("3-6 months", "Add agent assistance", "Introduce exception investigation after controls are proven."),
    ]
    gap = 4 * mm
    col_w = (CONTENT_W - 2 * gap) / 3
    for index, (period, title, detail) in enumerate(roadmap):
        x = MARGIN_X + index * (col_w + gap)
        panel(canvas, x, 47 * mm, col_w, 24 * mm, fill=WHITE)
        label(canvas, period, x + 4 * mm, 64 * mm, color=MUTED)
        label(canvas, title, x + 4 * mm, 57 * mm, color=TEXT, size=7)
        paragraph(
            canvas,
            detail,
            x + 4 * mm,
            53 * mm,
            col_w - 8 * mm,
            size=5.8,
            leading=7.2,
            color=MUTED,
        )

    paragraph(
        canvas,
        "<b>Next step.</b> Run a 90-minute evidence review with the process owner, controller and systems lead. Čeština: Připraveno pro lokalizaci.",
        MARGIN_X,
        40 * mm,
        CONTENT_W,
        font="NNC-Regular",
        size=7,
        leading=9.5,
        color=TEXT,
    )
    paragraph(
        canvas,
        "Estimates are indicative and do not constitute an offer.",
        MARGIN_X,
        32 * mm,
        CONTENT_W,
        size=6.5,
        leading=8,
        color=MUTED,
    )
    page_footer(canvas, 6)


def generate(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas = Canvas(str(path), pagesize=A4, pageCompression=1)
    canvas.setTitle("NNCO Signal - Sample operational intelligence scan")
    canvas.setAuthor("NNCO")
    canvas.setSubject("Sample agentic discovery diagnostic")
    canvas.setKeywords("NNCO, Signal, operational intelligence, diagnostic, preview")
    for draw_page in (
        draw_cover,
        draw_executive,
        draw_priority_field,
        draw_workflow,
        draw_blind_spots,
        draw_solutions,
    ):
        draw_page(canvas)
        canvas.showPage()
    canvas.save()


def main() -> None:
    register_fonts()
    generate(OUTPUT)
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC.write_bytes(OUTPUT.read_bytes())
    print(OUTPUT)
    print(PUBLIC)


if __name__ == "__main__":
    main()
