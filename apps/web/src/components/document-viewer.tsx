"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function extractHeadings(html: string): { html: string; toc: TocEntry[] } {
  if (typeof window === "undefined") return { html, toc: [] };
  const container = document.createElement("div");
  container.innerHTML = html;
  const toc: TocEntry[] = [];
  container.querySelectorAll("h1, h2, h3").forEach((el, index) => {
    const id = `heading-${index}`;
    el.id = id;
    toc.push({ id, text: el.textContent ?? "", level: Number(el.tagName[1]) });
  });
  return { html: container.innerHTML, toc };
}

export function DocumentViewer({ html }: { html: string }) {
  const { html: withAnchors, toc } = useMemo(() => extractHeadings(html), [html]);
  const safeHtml = useMemo(
    () => (typeof window === "undefined" ? withAnchors : DOMPurify.sanitize(withAnchors, { ADD_TAGS: ["iframe"], ADD_ATTR: ["allowfullscreen", "frameborder"] })),
    [withAnchors],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
      <div className="kv-prose max-w-none" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      {toc.length > 1 && (
        <aside className="hidden lg:block">
          <div className="kv-card sticky top-6 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kv-slate">On this page</p>
            <ul className="space-y-1.5 text-sm">
              {toc.map((entry) => (
                <li key={entry.id} style={{ paddingLeft: (entry.level - 1) * 10 }}>
                  <a href={`#${entry.id}`} className="text-kv-slate hover:text-kv-navy dark:hover:text-white">
                    {entry.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
