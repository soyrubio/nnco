import {
  PDFDocument,
  PDFName,
  PDFString,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { Buffer } from "node:buffer";
import fontkit from "@pdf-lib/fontkit";
import { discoveryReportCopy as copy } from "../../data/discovery.ts";
import {
  isDiscoveryReleaseReport,
  type DiscoveryReleaseReport,
} from "../../lib/discovery-release.ts";
import assets from "./pdf-assets.json" with { type: "json" };

const mm = 72 / 25.4;
const width = 210 * mm;
const height = 297 * mm;
const inset = 20 * mm;
const rail = width - 2 * inset;
const ink = rgb(17 / 255, 17 / 255, 17 / 255);
const paper = rgb(245 / 255, 245 / 255, 245 / 255);
type Span = { text: string; font: PDFFont };

/** Separate paper renderer; follows the existing two-page print geometry. No network or AI calls. */
export async function renderReportPdf(
  report: DiscoveryReleaseReport,
  company: string,
): Promise<Uint8Array> {
  if (!isDiscoveryReleaseReport(report) || report.schemaVersion !== 2)
    throw new Error("Unsupported report");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(Buffer.from(assets.regular, "base64"), {
    subset: true,
  });
  const medium = await doc.embedFont(Buffer.from(assets.medium, "base64"), {
    subset: true,
  });
  const bold = await doc.embedFont(Buffer.from(assets.bold, "base64"), {
    subset: true,
  });
  const generatedAt = new Date(report.generatedAt);
  doc.setTitle(copy.title);
  doc.setAuthor("NNCo");
  doc.setCreationDate(generatedAt);
  doc.setModificationDate(generatedAt);
  let page: PDFPage;
  let y = 0;
  const footerTop = height - inset - 10 * mm;

  function text(
    spans: Span[],
    size = 9,
    indent = 0,
    leading = size * 1.5,
  ): void {
    let x = inset + indent;
    let started = false;
    // Break long unspaced input as well as ordinary words. No truncation or clipping.
    for (const span of spans) {
      for (const word of span.text.replace(/\s+/gu, " ").split(/(?<=\s)/u)) {
        let part = "";
        for (const character of word) {
          if (
            span.font.widthOfTextAtSize(part + character, size) >
            rail - indent
          ) {
            paint(part, span.font);
            part = character;
          } else part += character;
        }
        paint(part, span.font);
      }
    }
    if (started) y += leading;
    function paint(word: string, font: PDFFont) {
      if (!word) return;
      const wordWidth = font.widthOfTextAtSize(word, size);
      if (x > inset + indent && x + wordWidth > width - inset + 0.01) {
        y += leading;
        x = inset + indent;
      }
      if (y + leading > footerTop - 3 * mm)
        throw new Error("Report exceeds two-page layout");
      page.drawText(word, { x, y: height - y - size, size, font, color: ink });
      x += wordWidth;
      started = true;
    }
  }
  function paragraph(value: string, indent = 0) {
    text([{ text: value, font: regular }], 9, indent);
  }
  function heading(value: string) {
    text([{ text: value, font: medium }], 13, 0, 15.6);
    y += 5 * mm;
  }
  function startPage(number: number) {
    page = doc.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: paper });
    const titleSize = 9 * mm;
    page.drawText(copy.title, {
      x: inset,
      y: height - inset - titleSize,
      size: titleSize,
      font: bold,
      color: ink,
    });
    for (const path of assets.logoPaths) {
      page.drawSvgPath(path, {
        x: width - inset - 12 * mm,
        y: height - inset,
        scale: (12 * mm) / 700,
        color: ink,
      });
    }
    y = inset + 12 * mm + 5 * mm;
    page.drawLine({
      start: { x: inset, y: height - y },
      end: { x: width - inset, y: height - y },
      thickness: 3.75,
      color: ink,
    });
    y += 3.75;
    page.drawLine({
      start: { x: inset, y: height - footerTop },
      end: { x: width - inset, y: height - footerTop },
      thickness: 0.75,
      color: ink,
    });
    // The disclaimer is intentionally split to match its natural browser wrap.
    page.drawText(
      "Prepared by NNCo automated Opportunity Discovery process.",
      {
        x: inset,
        y: height - footerTop - 3 * mm - 8,
        size: 8,
        font: regular,
        color: ink,
      },
    );
    page.drawText("Not a formal assessment.", {
      x: inset,
      y: height - footerTop - 3 * mm - 19.2,
      size: 8,
      font: regular,
      color: ink,
    });
    page.drawText(`${number} / 2`, {
      x: width - inset - regular.widthOfTextAtSize(`${number} / 2`, 8),
      y: height - footerTop - 3 * mm - 8,
      size: 8,
      font: regular,
      color: ink,
    });
  }
  startPage(1);
  y += 5 * mm;
  const date = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(generatedAt);
  text(
    [
      {
        text: `Prepared for ${company || "your organisation"}, ${date}`,
        font: regular,
      },
    ],
    8,
    0,
    11.2,
  );
  y += 8 * mm;
  heading(copy.summary);
  paragraph(copy.purpose);
  y += 10 * mm;
  heading(copy.context);
  paragraph(report.providedContext);
  y += 10 * mm;
  heading(copy.sectorOpportunities);
  paragraph(report.sectorOpportunities);

  startPage(2);
  y += 10 * mm;
  heading(copy.opportunities);
  paragraph(report.areasIntro);
  y += 6 * mm;
  for (const [index, area] of report.areas.entries()) {
    page!.drawText(`${index + 1}.`, {
      x: inset,
      y: height - y - 9,
      font: medium,
      size: 9,
      color: ink,
    });
    text(
      [
        { text: `${area.name.replace(/[.!?:;]+$/, "")}. `, font: bold },
        { text: area.explanation, font: regular },
      ],
      9,
      6 * mm,
    );
    if (index < report.areas.length - 1) y += 6 * mm;
  }
  y += 10 * mm;
  heading(`${copy.detail}: ${report.detail.areaName}`);
  for (const [index, value] of report.detail.paragraphs.entries()) {
    if (index) y += 13.5;
    paragraph(value);
  }
  y += 8 * mm;
  paragraph(copy.assessment);
  const linkY = height - y - 9;
  paragraph(copy.assessmentEmail + ".");
  const linkWidth = regular.widthOfTextAtSize(copy.assessmentEmail, 9);
  page!.drawLine({
    start: { x: inset, y: linkY - 2 },
    end: { x: inset + linkWidth, y: linkY - 2 },
    thickness: 0.5,
    color: ink,
  });
  const annotation = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [inset, linkY - 2, inset + linkWidth, linkY + 10],
      Border: [0, 0, 0],
      A: { S: "URI", URI: PDFString.of(`mailto:${copy.assessmentEmail}`) },
    }),
  );
  page!.node.set(PDFName.of("Annots"), doc.context.obj([annotation]));
  return doc.save();
}
