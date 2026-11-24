import { useEffect, useRef } from 'react';
import { useEditor, EditorContent, type Editor, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Mention from '@tiptap/extension-mention';
import Suggestion from '@tiptap/suggestion';
import {
  Bold, Italic, Underline as U, Strikethrough, Code, List, ListOrdered, ListChecks, Quote, Heading1, Heading2, Heading3, Link2, Highlighter, Image as ImageIcon, Table as TableIcon, Minus, AlignLeft, AlignCenter, Undo2, Redo2,
} from 'lucide-react';
import { getState, useStore } from '../lib/store';
import { backend } from '../lib/backend';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------- suggestion popup (vanilla DOM, no deps)
function popupRenderer<T>(renderItem: (item: T, active: boolean) => string, pick: (item: T, props: any) => void) {
  return () => {
    let el: HTMLDivElement | null = null;
    let items: T[] = [];
    let idx = 0;
    let props: any;
    const draw = () => {
      if (!el) return;
      if (!items.length) { el.style.display = 'none'; return; }
      el.style.display = 'block';
      el.innerHTML = items.map((it, i) => `<button data-i="${i}" class="menu-item" data-active="${i === idx}">${renderItem(it, i === idx)}</button>`).join('');
      const r = props.clientRect?.();
      if (r) {
        const h = el.offsetHeight;
        const top = r.bottom + 6 + h > window.innerHeight ? r.top - h - 6 : r.bottom + 6;
        el.style.top = top + 'px';
        el.style.left = Math.min(r.left, window.innerWidth - 270) + 'px';
      }
    };
    return {
      onStart: (p: any) => {
        props = p; items = p.items; idx = 0;
        el = document.createElement('div');
        el.className = 'pop fixed z-[3000] p-1 w-64 max-h-72 overflow-auto';
        el.setAttribute('data-floating', '');
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const b = (e.target as HTMLElement).closest('button');
          if (b) pick(items[Number(b.dataset.i)], props);
        });
        document.body.appendChild(el);
        draw();
      },
      onUpdate: (p: any) => { props = p; items = p.items; idx = Math.min(idx, Math.max(0, items.length - 1)); draw(); },
      onKeyDown: ({ event }: any) => {
        if (!items.length) return false;
        if (event.key === 'ArrowDown') { idx = (idx + 1) % items.length; draw(); return true; }
        if (event.key === 'ArrowUp') { idx = (idx - 1 + items.length) % items.length; draw(); return true; }
        if (event.key === 'Enter' || event.key === 'Tab') { pick(items[idx], props); return true; }
        if (event.key === 'Escape') { el?.remove(); el = null; return true; }
        return false;
      },
      onExit: () => { el?.remove(); el = null; },
    };
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const MentionExt = Mention.configure({
  HTMLAttributes: { class: 'mention' },
  renderText: ({ node }) => '@' + (node.attrs.label || node.attrs.id),
  suggestion: {
    char: '@',
    items: ({ query }: { query: string }) =>
      getState().members.filter((m) => m.profile.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8).map((m) => ({ id: m.user_id, label: m.profile.name, color: m.profile.color })),
    render: popupRenderer<{ id: string; label: string; color: string }>(
      (m) => `<span style="width:20px;height:20px;border-radius:99px;background:${m.color};color:#fff;font-size:9px;display:inline-flex;align-items:center;justify-content:center;font-weight:600">${esc(m.label.slice(0, 2).toUpperCase())}</span><span>${esc(m.label)}</span>`,
      (m, props) => props.command({ id: m.id, label: m.label }),
    ),
  } as any,
});

interface SlashItem { title: string; hint: string; run: (e: Editor) => void }
const SLASH: SlashItem[] = [
  { title: 'Heading 1', hint: 'Big section heading', run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: 'Heading 2', hint: 'Medium heading', run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: 'Heading 3', hint: 'Small heading', run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { title: 'Text', hint: 'Plain paragraph', run: (e) => e.chain().focus().setParagraph().run() },
  { title: 'Bulleted list', hint: 'Simple bullet list', run: (e) => e.chain().focus().toggleBulletList().run() },
  { title: 'Numbered list', hint: 'Ordered list', run: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: 'Checklist', hint: 'Track to-dos', run: (e) => e.chain().focus().toggleTaskList().run() },
  { title: 'Quote', hint: 'Capture a quote', run: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: 'Code block', hint: 'Code snippet', run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { title: 'Divider', hint: 'Horizontal line', run: (e) => e.chain().focus().setHorizontalRule().run() },
  { title: 'Table', hint: '3×3 table', run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: 'Image', hint: 'Upload an image', run: (e) => pickImage(e) },
  { title: 'Highlight', hint: 'Mark text', run: (e) => e.chain().focus().toggleHighlight().run() },
];

const SlashExt = Extension.create({
  name: 'slash',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        items: ({ query }: { query: string }) => SLASH.filter((s) => s.title.toLowerCase().includes(query.toLowerCase())),
        command: ({ editor, range, props }: any) => {
          editor.chain().focus().deleteRange(range).run();
          (props as SlashItem).run(editor);
        },
        render: popupRenderer<SlashItem>(
          (s) => `<span style="flex:1"><div style="font-weight:500">${s.title}</div><div style="font-size:11px;color:var(--faint)">${s.hint}</div></span>`,
          (s, props) => props.command(s),
        ),
      } as any),
    ];
  },
});

async function uploadImage(file: File): Promise<string | null> {
  const ws = getState().workspace;
  if (!ws) return null;
  try { return await backend.uploadFile(ws.id, file, file.name); } catch (e: any) { getState().toast(e.message, 'error'); return null; }
}
function pickImage(e: Editor) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    const url = await uploadImage(f);
    if (url) e.chain().focus().setImage({ src: url }).run();
  };
  input.click();
}

export interface RichEditorProps {
  value: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  toolbar?: boolean;
  slash?: boolean;
  onSubmit?: () => void;
  autofocus?: boolean;
  editorRef?: React.MutableRefObject<Editor | null>;
  compact?: boolean;
}

export function RichEditor({ value, onChange, placeholder = 'Write something, or type / for commands', editable = true, className, toolbar, slash = true, onSubmit, autofocus, editorRef, compact }: RichEditorProps) {
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const touched = useRef(!!autofocus);
  const editor = useEditor({
    editable,
    autofocus: autofocus ? 'end' : false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: !editable, autolink: true }),
      Underline,
      Highlight,
      Image,
      Table.configure({ resizable: false }),
      TableRow, TableCell, TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      MentionExt,
      ...(slash ? [SlashExt] : []),
      Extension.create({
        name: 'submitShortcut',
        addKeyboardShortcuts: () => ({
          'Mod-Enter': () => { submitRef.current?.(); return !!submitRef.current; },
        }),
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: { class: cn('prose-pm', compact && 'prose-sm', className || '') },
      handleDOMEvents: { mousedown: () => { touched.current = true; return false; } },
      handlePaste: (view, event) => {
        const file = Array.from(event.clipboardData?.files || []).find((f) => f.type.startsWith('image/'));
        if (!file) return false;
        uploadImage(file).then((url) => url && editor?.chain().focus().setImage({ src: url }).run());
        return true;
      },
      handleDrop: (view, event) => {
        const file = Array.from((event as DragEvent).dataTransfer?.files || []).find((f) => f.type.startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        uploadImage(file).then((url) => url && editor?.chain().focus().setImage({ src: url }).run());
        return true;
      },
    },
    // Only propagate edits after the user has interacted. TipTap may normalise content on
    // load and fire an update; writing that back would clobber teammates' concurrent edits.
    onFocus: () => { touched.current = true; },
    onUpdate: ({ editor }) => { if (touched.current) changeRef.current?.(editor.isEmpty ? '' : editor.getHTML()); },
  });

  useEffect(() => { if (editorRef) editorRef.current = editor; }, [editor, editorRef]);
  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);
  // Accept external updates (realtime) when the user isn't actively editing.
  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return;
    if ((value || '') !== (editor.isEmpty ? '' : editor.getHTML())) editor.commands.setContent(value || '', false);
  }, [value, editor]);

  return (
    <div>
      {toolbar && editor && editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  useStore((s) => s.data.doc); // re-render on doc changes so active states refresh
  const B = ({ on, run, children, title }: { on?: boolean; run: () => void; children: React.ReactNode; title: string }) => (
    <button title={title} onMouseDown={(e) => { e.preventDefault(); run(); }} className={cn('icon-btn !w-7 !h-7', on && '!bg-[var(--hover)] !text-[var(--text)]')}>{children}</button>
  );
  const c = () => editor.chain().focus();
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-[var(--panel)] py-1 mb-4">
      <B title="Undo" run={() => c().undo().run()}><Undo2 size={15} /></B>
      <B title="Redo" run={() => c().redo().run()}><Redo2 size={15} /></B>
      <span className="w-px h-5 bg-[var(--border)] mx-1" />
      <B title="Heading 1" on={editor.isActive('heading', { level: 1 })} run={() => c().toggleHeading({ level: 1 }).run()}><Heading1 size={15} /></B>
      <B title="Heading 2" on={editor.isActive('heading', { level: 2 })} run={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></B>
      <B title="Heading 3" on={editor.isActive('heading', { level: 3 })} run={() => c().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></B>
      <span className="w-px h-5 bg-[var(--border)] mx-1" />
      <B title="Bold" on={editor.isActive('bold')} run={() => c().toggleBold().run()}><Bold size={15} /></B>
      <B title="Italic" on={editor.isActive('italic')} run={() => c().toggleItalic().run()}><Italic size={15} /></B>
      <B title="Underline" on={editor.isActive('underline')} run={() => c().toggleUnderline().run()}><U size={15} /></B>
      <B title="Strikethrough" on={editor.isActive('strike')} run={() => c().toggleStrike().run()}><Strikethrough size={15} /></B>
      <B title="Highlight" on={editor.isActive('highlight')} run={() => c().toggleHighlight().run()}><Highlighter size={15} /></B>
      <B title="Inline code" on={editor.isActive('code')} run={() => c().toggleCode().run()}><Code size={15} /></B>
      <B title="Link" on={editor.isActive('link')} run={() => {
        const url = prompt('Link URL', editor.getAttributes('link').href || 'https://');
        if (url === null) return;
        if (!url) c().unsetLink().run(); else c().extendMarkRange('link').setLink({ href: url }).run();
      }}><Link2 size={15} /></B>
      <span className="w-px h-5 bg-[var(--border)] mx-1" />
      <B title="Bullet list" on={editor.isActive('bulletList')} run={() => c().toggleBulletList().run()}><List size={15} /></B>
      <B title="Numbered list" on={editor.isActive('orderedList')} run={() => c().toggleOrderedList().run()}><ListOrdered size={15} /></B>
      <B title="Checklist" on={editor.isActive('taskList')} run={() => c().toggleTaskList().run()}><ListChecks size={15} /></B>
      <B title="Quote" on={editor.isActive('blockquote')} run={() => c().toggleBlockquote().run()}><Quote size={15} /></B>
      <B title="Divider" run={() => c().setHorizontalRule().run()}><Minus size={15} /></B>
      <B title="Table" run={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={15} /></B>
      <B title="Image" run={() => pickImage(editor)}><ImageIcon size={15} /></B>
      <span className="w-px h-5 bg-[var(--border)] mx-1" />
      <B title="Align left" on={editor.isActive({ textAlign: 'left' })} run={() => c().setTextAlign('left').run()}><AlignLeft size={15} /></B>
      <B title="Align center" on={editor.isActive({ textAlign: 'center' })} run={() => c().setTextAlign('center').run()}><AlignCenter size={15} /></B>
      {editor.isActive('table') && (
        <>
          <span className="w-px h-5 bg-[var(--border)] mx-1" />
          <button className="btn btn-ghost !px-2 !py-0.5 !text-xs" onMouseDown={(e) => { e.preventDefault(); c().addRowAfter().run(); }}>+ Row</button>
          <button className="btn btn-ghost !px-2 !py-0.5 !text-xs" onMouseDown={(e) => { e.preventDefault(); c().addColumnAfter().run(); }}>+ Col</button>
          <button className="btn btn-ghost !px-2 !py-0.5 !text-xs" onMouseDown={(e) => { e.preventDefault(); c().deleteRow().run(); }}>− Row</button>
          <button className="btn btn-ghost !px-2 !py-0.5 !text-xs" onMouseDown={(e) => { e.preventDefault(); c().deleteColumn().run(); }}>− Col</button>
          <button className="btn btn-ghost !px-2 !py-0.5 !text-xs text-red-600" onMouseDown={(e) => { e.preventDefault(); c().deleteTable().run(); }}>Delete table</button>
        </>
      )}
    </div>
  );
}

/** Read-only HTML renderer for comments/messages (content was produced by our editor). */
export function Html({ html, className }: { html: string; className?: string }) {
  return <div className={cn('prose-pm prose-sm', className)} dangerouslySetInnerHTML={{ __html: sanitize(html) }} />;
}

// Minimal sanitizer: strips scripts, event handlers and javascript: URLs from user HTML.
export function sanitize(html: string) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      if (a.name.startsWith('on')) el.removeAttribute(a.name);
      if ((a.name === 'href' || a.name === 'src') && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    }
    if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
  });
  return doc.body.innerHTML;
}
