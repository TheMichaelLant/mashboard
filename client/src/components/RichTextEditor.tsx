import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
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
  Link as LinkIcon,
  Unlink,
} from 'lucide-react';
import { useCallback, useState } from 'react';

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
  '#f5f5f5', // ink-100
  '#d4d4d4', // ink-200
  '#a3a3a3', // ink-400
  '#fbbf24', // amber-400
  '#60a5fa', // blue-400
  '#4ade80', // green-400
  '#f87171', // red-400
  '#c084fc', // purple-400
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
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-gold-500 underline hover:text-gold-400',
        },
      }),
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

  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const handleSetLink = useCallback(() => {
    if (!editor) return;

    // Get current link if any
    const previousUrl = editor.getAttributes('link').href || '';
    setLinkUrl(previousUrl);
    setShowLinkInput(true);
  }, [editor]);

  const handleLinkSubmit = useCallback(() => {
    if (!editor) return;

    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      // Ensure URL has protocol
      const url = linkUrl.match(/^https?:\/\//) ? linkUrl : `https://${linkUrl}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }

    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const handleRemoveLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={`border border-ink-700 rounded-xl bg-ink-800 ${className}`}>
      {/* Toolbar */}
      <div className="border-b border-ink-700 p-2">
        {!minimal && (
          <>
            {/* Font Family */}
            <div className="flex flex-wrap items-center gap-2 mb-2 pb-2 border-b border-ink-700">
              <select
                onChange={(e) => setFontFamily(e.target.value)}
                className="px-2 py-1 text-sm border border-ink-600 rounded-lg bg-ink-900 text-ink-200"
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
                className="px-2 py-1 text-sm border border-ink-600 rounded-lg bg-ink-900 text-ink-200"
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
                    className="w-6 h-6 rounded-full border border-ink-600"
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
              <div className="w-px h-6 bg-ink-600 mx-1" />
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

          <div className="w-px h-6 bg-ink-600 mx-1" />

          {/* Link */}
          <div className="relative">
            <ToolbarButton
              onClick={handleSetLink}
              isActive={editor.isActive('link')}
              title="Add Link"
            >
              <LinkIcon size={18} />
            </ToolbarButton>
            {showLinkInput && (
              <div className="absolute top-full left-0 mt-1 z-10 bg-ink-800 border border-ink-600 rounded-lg p-2 shadow-lg flex items-center gap-2">
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLinkSubmit();
                    } else if (e.key === 'Escape') {
                      setShowLinkInput(false);
                      setLinkUrl('');
                    }
                  }}
                  placeholder="https://example.com"
                  className="px-2 py-1 text-sm bg-ink-900 border border-ink-600 rounded text-ink-200 w-48 focus:outline-none focus:border-gold-600"
                  autoFocus
                />
                <button
                  onClick={handleLinkSubmit}
                  className="px-2 py-1 text-sm bg-gold-600 text-ink-950 rounded hover:bg-gold-500"
                >
                  {linkUrl ? 'Set' : 'Remove'}
                </button>
                <button
                  onClick={() => {
                    setShowLinkInput(false);
                    setLinkUrl('');
                  }}
                  className="px-2 py-1 text-sm text-ink-400 hover:text-ink-200"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          {editor.isActive('link') && (
            <ToolbarButton
              onClick={handleRemoveLink}
              title="Remove Link"
            >
              <Unlink size={18} />
            </ToolbarButton>
          )}

          <div className="w-px h-6 bg-ink-600 mx-1" />

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

              <div className="w-px h-6 bg-ink-600 mx-1" />
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

          <div className="w-px h-6 bg-ink-600 mx-1" />

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
          ? 'bg-gold-600 text-ink-950'
          : 'text-ink-400 hover:bg-ink-700 hover:text-ink-200'
      }`}
    >
      {children}
    </button>
  );
}
