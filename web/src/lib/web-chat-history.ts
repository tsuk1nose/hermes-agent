export interface HistoryImageAttachment {
  name: string;
  path: string;
  type: string;
}

const IMAGE_REF_LINE_RE = /^@image:(?:`([^`\n]+)`|"([^"\n]+)"|'([^'\n]+)'|([^\n]+))\r?\n?/gm;
const SCREENSHOT_PLACEHOLDER_LINE_RE = /^\[screenshot\]\r?\n?/gm;

function imageMimeType(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  if (extension === "bmp") return "image/bmp";
  if (extension === "svg") return "image/svg+xml";
  return "image/png";
}

function imageName(path: string): string {
  return path.split(/[\\/]/).pop() || "image";
}

/** Lift persisted @image directives out of user-visible text. Hermes stores
 * these references in the transcript; /api/media resolves the path without
 * exposing arbitrary files from the gateway host. */
export function extractHistoryImages(content: string): {
  attachments: HistoryImageAttachment[];
  content: string;
} {
  const attachments: HistoryImageAttachment[] = [];
  let cleaned = content.replace(IMAGE_REF_LINE_RE, (_match, backtick, doubleQuote, singleQuote, plain) => {
    const path = String(backtick ?? doubleQuote ?? singleQuote ?? plain ?? "").trim();
    if (path) {
      attachments.push({ name: imageName(path), path, type: imageMimeType(path) });
    }
    return "";
  });

  if (attachments.length > 0) {
    cleaned = cleaned.replace(SCREENSHOT_PLACEHOLDER_LINE_RE, "");
  }

  return { attachments, content: cleaned };
}
