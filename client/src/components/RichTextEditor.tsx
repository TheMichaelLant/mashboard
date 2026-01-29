import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  Highlighter,
  Type,
  Heading1,
  Heading2,
  Heading3,
} from 'lucide-react';
import { useCallback } from 'react';

const fontFamilies = [
  { name: 'Classic', value: 'Playfair Display' },
  { name: 'Modern', value: 'Inter' },
  { name: 'Elegant', value: 'Lora' },
  { name: 'Bold', value: 'Montserrat' },
  { name: 'Script', value: 'Dancing Script' },
  { name: 'Code', value: 'JetBrains Mono' },
];

const fontSizes = ['12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px'];

const textColors = [
  '#1a1a1a', // ink-900
  '#515151', // ink-600
  '#818181', // ink-400
  '#7c2d12', // amber-900
  '#1e3a8a', // blue-900
  '#14532d', // green-900
  '#7f1d1d', // red-900
  '#581c87', // purple-900
];

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  minimal?: boolean;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  className = '',
  minimal = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Underline,
      TextStyle,
      FontFamily,
      Color,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const setFontFamily = useCallback(
    (font: string) => {
      editor?.chain().focus().setFontFamily(font).run();
    },
    [editor]
  );

  const setColor = useCallback(
    (color: string) => {
      editor?.chain().focus().setColor(color).run();
    },
    [editor]
  );

  if (!editor) {
    return null;
  }

  return (
    <div className={`border border-paper-200 rounded-xl bg-white ${className}`}>
      {/* Toolbar */}
      <div className="border-b border-paper-100 p-2">
        {!minimal && (
          <>
            {/* Font Family */}
            <div className="flex flex-wrap items-center gap-2 mb-2 pb-2 border-b border-paper-100">
              <select
                onChange={(e) => setFontFamily(e.target.value)}
                className="px-2 py-1 text-sm border border-paper-200 rounded-lg bg-white"
              >
                {fontFamilies.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.name}
                  </option>
                ))}
              </select>

              {/* Font Size */}
              <select
                onChange={() => {
                  // Note: TipTap doesn't have native font-size, using custom styles
                  editor.chain().focus().run();
                }}
                className="px-2 py-1 text-sm border border-paper-200 rounded-lg bg-white"
              >
                {fontSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>

              {/* Text Color */}
              <div className="flex items-center gap-1">
                {textColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setColor(color)}
                    className="w-6 h-6 rounded-full border border-paper-200"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Main Toolbar */}
        <div className="flex flex-wrap items-center gap-1">
          {/* Headings */}
          {!minimal && (
            <>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Heading 1"
              >
                <Heading1 size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Heading 2"
              >
                <Heading2 size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                title="Heading 3"
              >
                <Heading3 size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().setParagraph().run()}
                isActive={editor.isActive('paragraph')}
                title="Paragraph"
              >
                <Type size={18} />
              </ToolbarButton>
              <div className="w-px h-6 bg-paper-200 mx-1" />
            </>
          )}

          {/* Text Formatting */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold"
          >
            <Bold size={18} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic"
          >
            <Italic size={18} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="Underline"
          >
            <UnderlineIcon size={18} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="Strikethrough"
          >
            <Strikethrough size={18} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            isActive={editor.isActive('highlight')}
            title="Highlight"
          >
            <Highlighter size={18} />
          </ToolbarButton>

          <div className="w-px h-6 bg-paper-200 mx-1" />

          {/* Alignment */}
          {!minimal && (
            <>
              <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                isActive={editor.isActive({ textAlign: 'left' })}
                title="Align Left"
              >
                <AlignLeft size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                isActive={editor.isActive({ textAlign: 'center' })}
                title="Align Center"
              >
                <AlignCenter size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                isActive={editor.isActive({ textAlign: 'right' })}
                title="Align Right"
              >
                <AlignRight size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                isActive={editor.isActive({ textAlign: 'justify' })}
                title="Justify"
              >
                <AlignJustify size={18} />
              </ToolbarButton>

              <div className="w-px h-6 bg-paper-200 mx-1" />
            </>
          )}

          {/* Lists */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <List size={18} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Numbered List"
          >
            <ListOrdered size={18} />
          </ToolbarButton>

          <div className="w-px h-6 bg-paper-200 mx-1" />

          {/* Block Elements */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="Quote"
          >
            <Quote size={18} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive('codeBlock')}
            title="Code Block"
          >
            <Code size={18} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal Rule"
          >
            <Minus size={18} />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className="p-4 min-h-[200px] tiptap-editor"
      />
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-ink-900 text-paper-50'
          : 'text-ink-600 hover:bg-paper-100'
      }`}
    >
      {children}
    </button>
  );
}
