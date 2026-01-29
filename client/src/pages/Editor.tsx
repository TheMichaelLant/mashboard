import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Type, FileText, BookOpen, Plus, Trash2, GripVertical, Lock, Save } from 'lucide-react';
import RichTextEditor from '../components/RichTextEditor';
import { postApi, categoryApi } from '../services/api';
import type { PostType, Category } from '../types';

interface ChapterData {
  id?: number;
  title: string;
  content: string;
}

export default function Editor() {
  const { type: urlType, id: editId } = useParams<{ type?: string; id?: string }>();
  const navigate = useNavigate();

  const [postType, setPostType] = useState<PostType>(
    (urlType as PostType) || 'page'
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [chapters, setChapters] = useState<ChapterData[]>([
    { title: 'Chapter 1', content: '' },
  ]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  // Fetch existing post for editing
  useEffect(() => {
    const fetchPost = async () => {
      if (!editId) return;
      try {
        const post = await postApi.getById(parseInt(editId));
        setPostType(post.type);
        setTitle(post.title || '');
        setContent(post.content);
        setExcerpt(post.excerpt || '');
        setIsPaid(post.isPaid);
        setSelectedCategories(
          post.categories?.map((pc) => pc.category) || []
        );
        if (post.type === 'book' && post.chapters) {
          setChapters(
            post.chapters.map((ch) => ({
              id: ch.id,
              title: ch.title,
              content: ch.content,
            }))
          );
        }
      } catch (error) {
        console.error('Failed to fetch post:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [editId, navigate]);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await categoryApi.getAll(categorySearch || undefined);
        setAvailableCategories(cats);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
    fetchCategories();
  }, [categorySearch]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const categoryIds = selectedCategories.map((c) => c.id);

      if (editId) {
        // Update existing post
        await postApi.update(parseInt(editId), {
          title: postType === 'line' ? undefined : title,
          content: postType === 'book' ? content : content,
          excerpt,
          isPaid,
          categoryIds,
          chapters: postType === 'book' ? chapters : undefined,
        });
        navigate(`/post/${editId}`);
      } else {
        // Create new post
        const newPost = await postApi.create({
          type: postType,
          title: postType === 'line' ? undefined : title,
          content: postType === 'book' ? content : content,
          excerpt,
          isPaid,
          categoryIds,
          chapters: postType === 'book' ? chapters : undefined,
        });
        navigate(`/post/${newPost.id}`);
      }
    } catch (error) {
      console.error('Failed to save post:', error);
      alert('Failed to save post. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async (category: Category) => {
    if (!selectedCategories.find((c) => c.id === category.id)) {
      setSelectedCategories([...selectedCategories, category]);
    }
    setCategorySearch('');
  };

  const createCategory = async () => {
    if (!categorySearch.trim()) return;
    try {
      const newCat = await categoryApi.create({ name: categorySearch.trim() });
      addCategory(newCat);
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  const removeCategory = (id: number) => {
    setSelectedCategories(selectedCategories.filter((c) => c.id !== id));
  };

  const addChapter = () => {
    setChapters([
      ...chapters,
      { title: `Chapter ${chapters.length + 1}`, content: '' },
    ]);
    setCurrentChapter(chapters.length);
  };

  const removeChapter = (index: number) => {
    if (chapters.length <= 1) return;
    const newChapters = chapters.filter((_, i) => i !== index);
    setChapters(newChapters);
    if (currentChapter >= newChapters.length) {
      setCurrentChapter(newChapters.length - 1);
    }
  };

  const updateChapter = (index: number, field: 'title' | 'content', value: string) => {
    const newChapters = [...chapters];
    newChapters[index] = { ...newChapters[index], [field]: value };
    setChapters(newChapters);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-8 bg-paper-200 rounded w-1/4 mb-8" />
        <div className="h-12 bg-paper-200 rounded mb-4" />
        <div className="h-64 bg-paper-200 rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold text-ink-900">
          {editId ? 'Edit' : 'Create'} {postType === 'line' ? 'a Line' : postType === 'page' ? 'a Page' : 'a Book'}
        </h1>
        <button
          onClick={handleSave}
          disabled={saving || (postType !== 'line' && !content)}
          className="btn btn-primary disabled:opacity-50"
        >
          <Save size={18} className="mr-2" />
          {saving ? 'Saving...' : 'Publish'}
        </button>
      </div>

      {/* Post Type Selector (only for new posts) */}
      {!editId && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-ink-500">Type:</span>
          <PostTypeButton
            active={postType === 'line'}
            onClick={() => setPostType('line')}
            icon={Type}
            label="Line"
          />
          <PostTypeButton
            active={postType === 'page'}
            onClick={() => setPostType('page')}
            icon={FileText}
            label="Page"
          />
          <PostTypeButton
            active={postType === 'book'}
            onClick={() => setPostType('book')}
            icon={BookOpen}
            label="Book"
          />
        </div>
      )}

      {/* Title (for Pages and Books) */}
      {postType !== 'line' && (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full text-4xl font-display font-bold text-ink-900 bg-transparent border-none focus:outline-none placeholder:text-ink-300"
        />
      )}

      {/* Book Chapter Management */}
      {postType === 'book' && (
        <div className="flex space-x-4">
          {/* Chapter List */}
          <div className="w-64 flex-shrink-0">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-semibold text-ink-900">Chapters</h3>
                <button
                  onClick={addChapter}
                  className="p-1 rounded hover:bg-paper-100"
                  title="Add chapter"
                >
                  <Plus size={20} />
                </button>
              </div>
              <div className="space-y-2">
                {chapters.map((chapter, index) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      currentChapter === index
                        ? 'bg-ink-900 text-paper-50'
                        : 'hover:bg-paper-100'
                    }`}
                    onClick={() => setCurrentChapter(index)}
                  >
                    <GripVertical
                      size={16}
                      className={currentChapter === index ? 'text-paper-200' : 'text-ink-300'}
                    />
                    <span className="flex-1 truncate text-sm">
                      {chapter.title || `Chapter ${index + 1}`}
                    </span>
                    {chapters.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeChapter(index);
                        }}
                        className={`p-1 rounded hover:bg-red-100 ${
                          currentChapter === index
                            ? 'text-paper-200 hover:text-red-500'
                            : 'text-ink-400 hover:text-red-500'
                        }`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Book Description */}
            <div className="mt-4">
              <label className="text-sm font-medium text-ink-700 block mb-2">
                Book Description
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe your book..."
                className="input min-h-[100px] text-sm"
              />
            </div>
          </div>

          {/* Chapter Editor */}
          <div className="flex-1">
            <input
              type="text"
              value={chapters[currentChapter]?.title || ''}
              onChange={(e) => updateChapter(currentChapter, 'title', e.target.value)}
              placeholder="Chapter title"
              className="w-full text-xl font-heading font-semibold text-ink-900 bg-transparent border-none focus:outline-none placeholder:text-ink-300 mb-4"
            />
            <RichTextEditor
              content={chapters[currentChapter]?.content || ''}
              onChange={(value) => updateChapter(currentChapter, 'content', value)}
              placeholder="Write your chapter content..."
              className="min-h-[400px]"
            />
          </div>
        </div>
      )}

      {/* Content Editor (for Lines and Pages) */}
      {postType !== 'book' && (
        <RichTextEditor
          content={content}
          onChange={setContent}
          placeholder={
            postType === 'line'
              ? 'Write your line...'
              : 'Start writing...'
          }
          minimal={postType === 'line'}
          className={postType === 'line' ? 'min-h-[100px]' : 'min-h-[400px]'}
        />
      )}

      {/* Post Settings */}
      <div className="card p-6 space-y-6">
        <h3 className="font-heading font-semibold text-ink-900">Post Settings</h3>

        {/* Excerpt */}
        <div>
          <label className="text-sm font-medium text-ink-700 block mb-2">
            Excerpt (optional)
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="A brief preview of your post..."
            className="input min-h-[80px]"
          />
        </div>

        {/* Categories */}
        <div>
          <label className="text-sm font-medium text-ink-700 block mb-2">
            Categories
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedCategories.map((category) => (
              <span
                key={category.id}
                className="inline-flex items-center space-x-1 px-3 py-1 bg-ink-100 text-ink-700 rounded-full text-sm"
              >
                <span>#{category.name}</span>
                <button
                  onClick={() => removeCategory(category.id)}
                  className="hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="relative">
            <input
              type="text"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Search or create categories..."
              className="input"
            />
            {categorySearch && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-paper-100 z-10 max-h-48 overflow-y-auto">
                {availableCategories
                  .filter((c) => !selectedCategories.find((s) => s.id === c.id))
                  .map((category) => (
                    <button
                      key={category.id}
                      onClick={() => addCategory(category)}
                      className="w-full px-4 py-2 text-left hover:bg-paper-50 text-sm"
                    >
                      #{category.name}
                    </button>
                  ))}
                {!availableCategories.find(
                  (c) => c.name.toLowerCase() === categorySearch.toLowerCase()
                ) && (
                  <button
                    onClick={createCategory}
                    className="w-full px-4 py-2 text-left hover:bg-paper-50 text-sm text-ink-500"
                  >
                    Create "#{categorySearch}"
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Paid Content Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-ink-700 flex items-center space-x-2">
              <Lock size={18} />
              <span>Paid Content</span>
            </label>
            <p className="text-sm text-ink-500">
              Only subscribers can view this post
            </p>
          </div>
          <button
            onClick={() => setIsPaid(!isPaid)}
            className={`w-12 h-6 rounded-full transition-colors ${
              isPaid ? 'bg-ink-900' : 'bg-paper-300'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                isPaid ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

interface PostTypeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}

function PostTypeButton({ active, onClick, icon: Icon, label }: PostTypeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
        active
          ? 'bg-ink-900 text-paper-50'
          : 'bg-paper-100 text-ink-600 hover:bg-paper-200'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}
