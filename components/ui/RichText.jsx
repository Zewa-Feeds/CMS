"use client";

import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Unlink,
  Minus,
  Undo2,
  Redo2,
  RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Field, Input } from "./Field";

function ToolBtn({ active, disabled, onClick, title, children }) {
  return (
    <button
      type="button"
      // keep the editor selection while clicking the toolbar
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={!!active}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-md text-muted transition-colors",
        "hover:bg-grey-wash hover:text-ink disabled:pointer-events-none disabled:opacity-40",
        active && "bg-teal-wash text-teal-deep"
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-4 w-px shrink-0 bg-line" />;

/**
 * Tiptap WYSIWYG editor (spec §16.1) — headings, bold/italic, lists, quotes,
 * and links. Emits sanitised HTML; there is no raw-HTML input by design.
 *
 * `compact` drops headings and block elements for shorter fields where only
 * inline emphasis and lists make sense.
 */
export function RichText({
  value,
  onChange,
  placeholder = "Start writing…",
  compact = false,
  minHeight = compact ? 120 : 220,
  limit,
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: compact ? false : { levels: [2, 3] },
        blockquote: compact ? false : undefined,
        horizontalRule: compact ? false : undefined,
        codeBlock: false,
      }),
      LinkExt.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "tiptap prose-cms px-4 py-3 focus:outline-none",
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });

  // reflect external value changes (e.g. loading a record after mount)
  useEffect(() => {
    if (!editor) return;
    const incoming = value || "";
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className="rounded-md border border-line bg-card"
        style={{ minHeight: minHeight + 40 }}
      />
    );
  }

  const chars = editor.storage.characterCount?.characters?.() ?? editor.getText().length;
  const over = limit != null && chars > limit;

  const openLink = () => {
    setLinkUrl(editor.getAttributes("link").href || "");
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = /^https?:\/\/|^mailto:|^\//.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  return (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-md border bg-card transition-colors",
          over ? "border-red" : "border-line",
          "focus-within:border-[#CFD6E0]"
        )}
      >
        <div className="flex flex-wrap items-center gap-0.5 border-b border-line-soft bg-canvas px-2 py-1.5">
          <ToolBtn
            title="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={15} />
          </ToolBtn>
          <ToolBtn
            title="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic size={15} />
          </ToolBtn>
          <ToolBtn
            title="Strikethrough"
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough size={15} />
          </ToolBtn>

          {!compact && (
            <>
              <Divider />
              <ToolBtn
                title="Heading"
                active={editor.isActive("heading", { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                <Heading2 size={15} />
              </ToolBtn>
              <ToolBtn
                title="Subheading"
                active={editor.isActive("heading", { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              >
                <Heading3 size={15} />
              </ToolBtn>
            </>
          )}

          <Divider />
          <ToolBtn
            title="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List size={15} />
          </ToolBtn>
          <ToolBtn
            title="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={15} />
          </ToolBtn>

          {!compact && (
            <>
              <ToolBtn
                title="Quote"
                active={editor.isActive("blockquote")}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              >
                <Quote size={15} />
              </ToolBtn>
              <ToolBtn
                title="Divider"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              >
                <Minus size={15} />
              </ToolBtn>
            </>
          )}

          <Divider />
          <ToolBtn title="Add link" active={editor.isActive("link")} onClick={openLink}>
            <Link2 size={15} />
          </ToolBtn>
          <ToolBtn
            title="Remove link"
            disabled={!editor.isActive("link")}
            onClick={() => editor.chain().focus().unsetLink().run()}
          >
            <Unlink size={15} />
          </ToolBtn>
          <ToolBtn
            title="Clear formatting"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          >
            <RemoveFormatting size={15} />
          </ToolBtn>

          <Divider />
          <ToolBtn
            title="Undo"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 size={15} />
          </ToolBtn>
          <ToolBtn
            title="Redo"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 size={15} />
          </ToolBtn>

          {limit != null && (
            <span
              className={cn(
                "ml-auto pr-1 font-mono text-[11px]",
                over ? "font-semibold text-red-deep" : "text-muted-2"
              )}
            >
              {chars}/{limit}
            </span>
          )}
        </div>

        <EditorContent editor={editor} />
      </div>

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Add link"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={applyLink}>
              Apply link
            </Button>
          </>
        }
      >
        <div className="pb-2">
          <Field label="URL" hint="Leave blank to remove the link. https:// is added if omitted.">
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://zewafeeds.com/products"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && applyLink()}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
