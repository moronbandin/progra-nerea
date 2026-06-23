import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import Placeholder from "@tiptap/extension-placeholder";
import { useUiStore } from "../store/uiStore";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder = "Escribe aquí…" }: Props) {
  const debounceRef = useRef<number | undefined>(undefined);
  const pendingHtmlRef = useRef<string | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Image.configure({ inline: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder })
    ],
    content: value,
    editorProps: {
      attributes: { class: "rich-editor__surface", "aria-label": "Editor de contenido enriquecido" },
      transformPastedHTML(html) {
        return html
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/\s(?:class|style|lang|data-[\w-]+)="[^"]*"/gi, "")
          .replace(/<(\/?)font[^>]*>/gi, "<$1span>");
      }
    },
    onUpdate({ editor: current }) {
      useUiStore.getState().setSaveState("pending");
      pendingHtmlRef.current = current.getHTML();
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        if (pendingHtmlRef.current !== undefined) onChangeRef.current(pendingHtmlRef.current);
        pendingHtmlRef.current = undefined;
      }, 500);
    }
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => () => {
    window.clearTimeout(debounceRef.current);
    if (pendingHtmlRef.current !== undefined) onChangeRef.current(pendingHtmlRef.current);
  }, []);

  if (!editor) return null;

  return (
    <div className="rich-editor">
      <div className="rich-editor__toolbar" role="toolbar" aria-label="Formato">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} aria-pressed={editor.isActive("bold")}><strong>N</strong></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} aria-pressed={editor.isActive("italic")}><em>C</em></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} aria-pressed={editor.isActive("underline")}><u>S</u></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} aria-pressed={editor.isActive("strike")}><s>T</s></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>• Lista</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. Lista</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()}>Cita</button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("justify").run()}>Justificar</button>
        <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Tabla</button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()}>Salto visual</button>
        <button type="button" onClick={() => editor.chain().focus().undo().run()}>Deshacer</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
