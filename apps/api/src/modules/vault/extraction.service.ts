import { Injectable, Logger } from "@nestjs/common";

/**
 * Pulls searchable text out of uploaded files.
 *
 * This is what connects the vault to the rest of the product: without it an upload is
 * an opaque blob that search cannot find and the assistant cannot ground an answer in.
 * It runs only for WORKING-tier files — a SEALED file has no server-readable text by
 * design, and that is the trade the classification makes explicit.
 *
 * Extraction failure is never fatal. A file that cannot be parsed is still stored and
 * still downloadable; it is simply not full-text searchable.
 */
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  /** Guards against a huge document blowing out row size and embedding cost. */
  private static readonly MAX_TEXT_LENGTH = 500_000;

  private truncate(text: string): string {
    const normalised = text.replace(/\s+/g, " ").trim();
    return normalised.length > ExtractionService.MAX_TEXT_LENGTH
      ? normalised.slice(0, ExtractionService.MAX_TEXT_LENGTH)
      : normalised;
  }

  supports(mimeType: string, filename: string): boolean {
    return this.kindOf(mimeType, filename) !== null;
  }

  private kindOf(mimeType: string, filename: string): "text" | "pdf" | "docx" | null {
    const ext = filename.toLowerCase().split(".").pop() ?? "";

    if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      return "docx";
    }
    if (
      mimeType.startsWith("text/") ||
      mimeType === "application/json" ||
      ["txt", "md", "markdown", "csv", "json", "html", "xml"].includes(ext)
    ) {
      return "text";
    }
    return null;
  }

  async extract(buffer: Buffer, mimeType: string, filename: string): Promise<string | null> {
    const kind = this.kindOf(mimeType, filename);
    if (!kind) return null;

    try {
      switch (kind) {
        case "text":
          return this.truncate(buffer.toString("utf8"));

        case "pdf": {
          // Required lazily: these parsers are heavy, and most deployments will never
          // upload the format they handle.
          const { PDFParse } = await import("pdf-parse");
          const parser = new PDFParse({ data: new Uint8Array(buffer) });
          try {
            const result = await parser.getText();
            return this.truncate(result.text);
          } finally {
            await parser.destroy();
          }
        }

        case "docx": {
          const mammoth = await import("mammoth");
          const result = await mammoth.extractRawText({ buffer });
          return this.truncate(result.value);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Text extraction failed for ${filename} (${mimeType}): ${(err as Error).message}. ` +
          "The file is stored and downloadable but will not be full-text searchable.",
      );
      return null;
    }
  }
}
