import { BadRequestException, Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { Document as DocxDocument, Packer, Paragraph, HeadingLevel } from "docx";
import type { Document, DocumentVersion } from "@prisma/client";

interface ExportFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

function stripMarkdown(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*_~`-]/g, "")
    .trim();
}

/**
 * Real, dependency-backed exporters for Markdown/HTML/PDF/DOCX. PDF and DOCX
 * render title + metadata + plain-text body (markdown/HTML structure is
 * flattened) — sufficient for distribution; a richer WYSIWYG-to-PDF pipeline
 * is tracked in the roadmap (docs/07-development-roadmap.md).
 */
@Injectable()
export class ExportService {
  async export(
    document: Document & { code: string; title: string },
    version: DocumentVersion | null,
    format: string,
  ): Promise<ExportFile> {
    const content = version?.contentMarkdown ?? "";
    const baseName = `${document.code}-${document.title}`.replace(/[^A-Za-z0-9-_]+/g, "_");

    switch (format.toUpperCase()) {
      case "MARKDOWN":
        return {
          buffer: Buffer.from(`# ${document.title}\n\n${content}`, "utf-8"),
          contentType: "text/markdown",
          filename: `${baseName}.md`,
        };
      case "HTML":
        return {
          buffer: Buffer.from(version?.contentHtml ?? `<h1>${document.title}</h1>`, "utf-8"),
          contentType: "text/html",
          filename: `${baseName}.html`,
        };
      case "PDF":
        return this.toPdf(document, content, baseName);
      case "DOCX":
        return this.toDocx(document, content, baseName);
      default:
        throw new BadRequestException(`Unsupported export format: ${format}`);
    }
  }

  private async toPdf(document: Document, content: string, baseName: string): Promise<ExportFile> {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(20).text(document.title, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#555").text(`Document ID: ${document.code}  •  Status: ${document.status}`);
    doc.moveDown(1);
    doc.fontSize(11).fillColor("#000").text(stripMarkdown(content), { align: "left" });
    doc.end();

    return { buffer: await done, contentType: "application/pdf", filename: `${baseName}.pdf` };
  }

  private async toDocx(document: Document, content: string, baseName: string): Promise<ExportFile> {
    const paragraphs = stripMarkdown(content)
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((p) => new Paragraph({ text: p }));

    const doc = new DocxDocument({
      sections: [
        {
          children: [
            new Paragraph({ text: document.title, heading: HeadingLevel.TITLE }),
            new Paragraph({ text: `Document ID: ${document.code}  •  Status: ${document.status}` }),
            new Paragraph({ text: "" }),
            ...paragraphs,
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return {
      buffer,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filename: `${baseName}.docx`,
    };
  }
}
