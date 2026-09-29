import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "");

const textOf = (node: React.ReactNode): string =>
  typeof node === "string" || typeof node === "number"
    ? String(node)
    : Array.isArray(node)
      ? node.map(textOf).join("")
      : node && typeof node === "object" && "props" in node
        ? textOf((node as { props: { children?: React.ReactNode } }).props.children)
        : "";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-doc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children: heading }) => <h2 id={slugify(textOf(heading))}>{heading}</h2>,
          h3: ({ children: heading }) => <h3 id={slugify(textOf(heading))}>{heading}</h3>,
          a: ({ href = "", children: label }) =>
            href.startsWith("/") ? <Link href={href}>{label}</Link> : <a href={href}>{label}</a>,
          // Mixed-language cells (French, Arabic) pick their own direction.
          td: ({ children: cell }) => <td dir="auto">{cell}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
