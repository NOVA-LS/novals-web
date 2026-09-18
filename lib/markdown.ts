import "server-only";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Markdown → HTML saneado. El staff es de confianza, pero una cuenta robada
 * no debería poder inyectar scripts en la portada del servidor.
 */
export function renderMarkdown(markdown: string): string {
  const bruto = marked.parse(markdown, { async: false, gfm: true, breaks: true });

  return sanitizeHtml(bruto, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "del",
      "blockquote",
      "ul",
      "ol",
      "li",
      "h2",
      "h3",
      "h4",
      "a",
      "code",
      "pre",
      "hr",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title", "loading"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noreferrer noopener",
        target: "_blank",
      }),
      img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
    },
  });
}
