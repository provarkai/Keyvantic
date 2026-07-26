"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect } from "react";
import { Callout } from "./callout-extension";
import { Embed } from "./embed-extension";
import { EditorToolbar } from "./toolbar";

interface RichEditorProps {
  contentHtml: string;
  onChange: (html: string, markdown: string) => void;
  editable?: boolean;
}

/** Best-effort HTML→Markdown for storage; the source of truth is contentHtml, this keeps contentMarkdown export/search useful. */
function htmlToMarkdown(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;
  return (container.textContent ?? "").trim();
}

export function RichEditor({ contentHtml, onChange, editable = true }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: { HTMLAttributes: { class: "kv-codeblock" } } }),
      Underline,
      Link.configure({ openOnClick: false }),
      ImageExt,
      Placeholder.configure({ placeholder: "Start writing… use the toolbar for tables, callouts, and more." }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Callout,
      Embed,
    ],
    content: contentHtml,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      onChange(html, htmlToMarkdown(html));
    },
  });

  useEffect(() => {
    if (editor && contentHtml !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(contentHtml);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentHtml]);

  return (
    <div className="kv-card overflow-hidden">
      {editable && editor && <EditorToolbar editor={editor} />}
      <div className="kv-prose max-w-none px-5 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export type { Editor };
