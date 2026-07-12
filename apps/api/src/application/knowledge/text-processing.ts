import { createHash } from "node:crypto";
import { inflateSync, inflateRawSync } from "node:zlib";
import { PDFParse } from "pdf-parse";
import { badRequest } from "../../shared/errors/app-error.js";

export type ExtractInput = {
  title: string;
  mimeType?: string | null;
  fileName?: string | null;
  contentBase64?: string;
  contentText?: string;
};

export type KnowledgeChunk = {
  content: string;
  tokenCount: number;
  position: number;
};

const maxChunkChars = 1800;
const chunkOverlapChars = 220;
const maxPdfStreams = 200;
const maxPdfSourceChars = 1_000_000;
const maxPdfTextOperators = 5_000;
const pdfParseTimeoutMs = 45_000;

export function checksum(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function cleanText(text: string) {
  return text
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function decodeBase64(contentBase64: string) {
  try {
    return Buffer.from(contentBase64, "base64");
  } catch {
    throw badRequest("Uploaded content is not valid base64");
  }
}

function ensureReadableText(text: string, sourceType: "PDF" | "DOCX" | "TXT" | "CSV" | "URL") {
  const cleaned = cleanText(text);
  const controlChars = cleaned.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g)?.length ?? 0;
  const visibleChars = cleaned.replace(/\s/g, "").length;
  const controlRatio = visibleChars ? controlChars / visibleChars : 1;

  if (visibleChars < 20 || controlRatio > 0.03) {
    throw badRequest(
      `${sourceType} text extraction did not produce readable text. Upload a selectable text document, DOCX, TXT, CSV, or add the content as a website/text source.`
    );
  }

  return cleaned;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await withTimeout(
      parser.getText(),
      pdfParseTimeoutMs,
      "PDF text extraction timed out"
    );
    const text = cleanText(result.text);

    if (text) {
      return ensureReadableText(text, "PDF");
    }
  } catch {
    // Fall through to the bounded low-level extractor for simple PDFs.
  } finally {
    await parser.destroy().catch(() => undefined);
  }

  return ensureReadableText(extractPdfTextFallback(buffer), "PDF");
}

function extractPdfTextFallback(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const streamTexts = extractPdfStreams(raw)
    .map((stream) => decodePdfStream(stream))
    .flatMap((stream) => extractPdfTextOperators(stream));
  const directTexts = streamTexts.length ? [] : extractPdfTextOperators(raw.slice(0, maxPdfSourceChars));
  const text = [...streamTexts, ...directTexts].join("\n");

  if (!text.trim()) {
    throw badRequest(
      "PDF text extraction needs a text-based PDF. Scanned PDFs require OCR, which is not enabled yet."
    );
  }

  return text;
}

function extractPdfStreams(raw: string) {
  const streams: string[] = [];
  let cursor = 0;

  while (streams.length < maxPdfStreams) {
    const streamStart = raw.indexOf("stream", cursor);
    if (streamStart < 0) {
      break;
    }

    const dictionaryStart = raw.lastIndexOf("<<", streamStart);
    const dictionaryEnd = raw.lastIndexOf(">>", streamStart);
    const streamEnd = raw.indexOf("endstream", streamStart);
    if (dictionaryStart < 0 || dictionaryEnd < dictionaryStart || streamEnd < 0) {
      cursor = streamStart + "stream".length;
      continue;
    }

    const dictionary = raw.slice(dictionaryStart, dictionaryEnd + 2);
    let dataStart = streamStart + "stream".length;
    if (raw[dataStart] === "\r" && raw[dataStart + 1] === "\n") {
      dataStart += 2;
    } else if (raw[dataStart] === "\n" || raw[dataStart] === "\r") {
      dataStart += 1;
    }

    let dataEnd = streamEnd;
    if (raw[dataEnd - 1] === "\n") {
      dataEnd -= 1;
    }
    if (raw[dataEnd - 1] === "\r") {
      dataEnd -= 1;
    }

    const stream = raw.slice(dataStart, dataEnd);

    if (/\/FlateDecode/.test(dictionary)) {
      streams.push(stream);
    } else if (/\/Length\s+\d+/.test(dictionary)) {
      streams.push(stream);
    }

    cursor = streamEnd + "endstream".length;
  }

  return streams;
}

function decodePdfStream(stream: string) {
  const buffer = Buffer.from(stream, "latin1");
  try {
    return inflateSync(buffer).toString("latin1");
  } catch {
    try {
      return inflateRawSync(buffer).toString("latin1");
    } catch {
      return stream;
    }
  }
}

function decodePdfLiteral(value: string) {
  return value
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\([0-7]{1,3})/g, (_match, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}

function decodePdfHex(value: string) {
  const normalized = value.replace(/\s/g, "");
  const padded = normalized.length % 2 === 0 ? normalized : `${normalized}0`;
  const bytes = padded.match(/.{1,2}/g) ?? [];
  return Buffer.from(bytes.map((byte) => parseInt(byte, 16))).toString("utf8").replace(/\u0000/g, "");
}

function extractPdfTextOperators(source: string) {
  const text: string[] = [];
  const boundedSource = source.length > maxPdfSourceChars ? source.slice(0, maxPdfSourceChars) : source;
  const literalPattern = /\((?:\\.|[^\\()]){1,2000}\)\s*Tj/g;
  const arrayPattern = /\[([\s\S]{1,12000}?)\]\s*TJ/g;
  const hexPattern = /<([\da-fA-F\s]{4,8000})>\s*Tj/g;
  let operatorCount = 0;

  for (const match of boundedSource.matchAll(literalPattern)) {
    operatorCount += 1;
    if (operatorCount > maxPdfTextOperators) {
      break;
    }
    const raw = match[0]?.replace(/\s*Tj$/, "").slice(1, -1) ?? "";
    const decoded = decodePdfLiteral(raw).trim();
    if (decoded.length > 1) {
      text.push(decoded);
    }
  }

  for (const match of boundedSource.matchAll(arrayPattern)) {
    operatorCount += 1;
    if (operatorCount > maxPdfTextOperators) {
      break;
    }
    const arrayBody = match[1] ?? "";
    const parts = [...arrayBody.matchAll(/\((?:\\.|[^\\()])*\)|<[\da-fA-F\s]+>/g)]
      .map((part) => {
        const value = part[0] ?? "";
        return value.startsWith("<")
          ? decodePdfHex(value.slice(1, -1))
          : decodePdfLiteral(value.slice(1, -1));
      })
      .join("");
    const decoded = parts.trim();
    if (decoded.length > 1) {
      text.push(decoded);
    }
  }

  for (const match of boundedSource.matchAll(hexPattern)) {
    operatorCount += 1;
    if (operatorCount > maxPdfTextOperators) {
      break;
    }
    const decoded = decodePdfHex(match[1] ?? "").trim();
    if (decoded.length > 1) {
      text.push(decoded);
    }
  }

  return text;
}

function findZipEntry(buffer: Buffer, entryName: string) {
  const endSignature = 0x06054b50;
  let endOffset = -1;

  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === endSignature) {
      endOffset = offset;
      break;
    }
  }

  if (endOffset < 0) {
    return null;
  }

  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  let cursor = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (cursor < end) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer.toString("utf8", cursor + 46, cursor + 46 + fileNameLength);

    if (fileName === entryName) {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) {
        return compressed;
      }

      if (compressionMethod === 8) {
        return inflateRawSync(compressed);
      }

      throw badRequest("DOCX compression method is not supported");
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return null;
}

function xmlToText(xml: string) {
  const textMatches = xml.match(/<w:t[^>]*>(.*?)<\/w:t>/g) ?? [];
  return textMatches
    .map((match) =>
      match
        .replace(/^<w:t[^>]*>/, "")
        .replace(/<\/w:t>$/, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
    )
    .join(" ");
}

function extractDocxText(buffer: Buffer) {
  const documentXml = findZipEntry(buffer, "word/document.xml");
  const raw = documentXml?.toString("utf8") ?? buffer.toString("utf8");
  const text = xmlToText(raw);

  if (!text.trim()) {
    throw badRequest(
      "DOCX text extraction did not find readable document text."
    );
  }

  return text;
}

function extractCsvText(buffer: Buffer) {
  return buffer
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.trim()).filter(Boolean).join(" | "))
    .filter(Boolean)
    .join("\n");
}

export async function extractText(input: ExtractInput) {
  if (input.contentText?.trim()) {
    return ensureReadableText(input.contentText, "TXT");
  }

  if (!input.contentBase64) {
    throw badRequest("Document content is required");
  }

  const buffer = decodeBase64(input.contentBase64);
  const mimeType = input.mimeType?.toLowerCase() ?? "";
  const fileName = input.fileName?.toLowerCase() ?? input.title.toLowerCase();

  if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }

  if (
    mimeType.includes("wordprocessingml") ||
    mimeType.includes("msword") ||
    fileName.endsWith(".docx")
  ) {
    return ensureReadableText(extractDocxText(buffer), "DOCX");
  }

  if (mimeType.includes("csv") || fileName.endsWith(".csv")) {
    return ensureReadableText(extractCsvText(buffer), "CSV");
  }

  return ensureReadableText(buffer.toString("utf8"), "TXT");
}

export function splitIntoChunks(text: string): KnowledgeChunk[] {
  const cleaned = cleanText(text);
  if (!cleaned) {
    return [];
  }

  const chunks: KnowledgeChunk[] = [];
  let cursor = 0;

  while (cursor < cleaned.length) {
    const end = Math.min(cursor + maxChunkChars, cleaned.length);
    const slice = cleaned.slice(cursor, end);
    const nextBreak = slice.lastIndexOf("\n\n");
    const chunkText =
      end < cleaned.length && nextBreak > maxChunkChars * 0.45 ? slice.slice(0, nextBreak) : slice;
    const content = cleanText(chunkText);

    if (content) {
      chunks.push({
        content,
        tokenCount: estimateTokens(content),
        position: chunks.length
      });
    }

    if (end >= cleaned.length) {
      break;
    }

    cursor += Math.max(content.length - chunkOverlapChars, 1);
  }

  return chunks;
}
