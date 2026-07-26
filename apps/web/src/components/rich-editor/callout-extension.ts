import { Node, mergeAttributes } from "@tiptap/core";

/** Minimal callout/admonition block — renders as a styled <div class="kv-callout"> in both editor and viewer. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "div.kv-callout" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "kv-callout" }), 0];
  },

  addCommands() {
    return {
      setCallout:
        () =>
        ({ commands }: any) =>
          commands.wrapIn(this.name),
    } as any;
  },
});
