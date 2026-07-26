import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Generic iframe embed for videos and PDFs (YouTube/Vimeo/direct PDF URLs).
 * v1 scope: URL-based embed only — see docs/07-development-roadmap.md for
 * planned native PDF viewer / upload-based video hosting.
 */
export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: "" },
      kind: { default: "video" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-kv-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, kind } = HTMLAttributes;
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-kv-embed": kind, class: "kv-embed" }),
      ["iframe", { src, class: "aspect-video w-full rounded-md border", frameborder: "0", allowfullscreen: "true" }],
    ];
  },

  addCommands() {
    return {
      setEmbed:
        (attrs: { src: string; kind: "video" | "pdf" }) =>
        ({ commands }: any) =>
          commands.insertContent({ type: this.name, attrs }),
    } as any;
  },
});
