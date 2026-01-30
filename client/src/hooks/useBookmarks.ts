import { useState, useEffect, useCallback } from 'react';
import { bookmarkApi, appreciationApi } from '../services/api';
import type { Post } from '../types';

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookmarks = async () => {
      setLoading(true);
      try {
        const data = await bookmarkApi.getMyBookmarks();
        setBookmarks(data);
      } catch (error) {
        console.error('Failed to fetch bookmarks:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBookmarks();
  }, []);

  const removeBookmark = useCallback(async (postId: number) => {
    try {
      await bookmarkApi.unbookmark(postId);
      setBookmarks((prev) => prev.filter((p) => p.id !== postId));
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
    }
  }, []);

  const toggleAppreciation = useCallback(async (postId: number) => {
    try {
      const post = bookmarks.find((p) => p.id === postId);
      if (post?.isAppreciated) {
        await appreciationApi.unappreciate(postId);
      } else {
        await appreciationApi.appreciate(postId);
      }
      setBookmarks((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                isAppreciated: !p.isAppreciated,
                appreciationCount: p.isAppreciated
                  ? (p.appreciationCount || 1) - 1
                  : (p.appreciationCount || 0) + 1,
              }
            : p
        )
      );
    } catch (error) {
      console.error('Failed to toggle appreciation:', error);
    }
  }, [bookmarks]);

  return {
    bookmarks,
    loading,
    removeBookmark,
    toggleAppreciation,
  };
}
