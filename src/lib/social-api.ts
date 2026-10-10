import { classifySocialError, SocialError } from '@/lib/social-errors';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Fn = Database['public']['Functions'];

export type TripSocialRow = Fn['get_trip_social']['Returns'][number];
export type CommentRow = Fn['get_comments']['Returns'][number];
export type CreatedCommentRow = Fn['create_comment']['Returns'][number];
export type LikerRow = Fn['get_trip_likers']['Returns'][number];
export type SavedTripRow = Fn['get_saved_trips']['Returns'][number];

type Cursor = { createdAt: string; id: string } | null;

/**
 * Runs one RPC and turns every failure into a SocialError with a stable kind. Never logs
 * arguments (comment bodies are user text).
 */
async function call<T>(run: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  let result: { data: T | null; error: unknown };
  try {
    result = await run();
  } catch {
    throw new SocialError('network');
  }
  if (result.error) {
    const error = result.error as { code?: string; message?: string };
    const kind = classifySocialError(error);
    // supabase-js reports a dropped connection as a fetch error without a Postgres code.
    throw new SocialError(kind === 'other' && !error.code ? 'network' : kind);
  }
  if (result.data === null) throw new SocialError('other');
  return result.data;
}

export async function fetchTripSocial(tripId: string): Promise<TripSocialRow | null> {
  const rows = await call(() => supabase.rpc('get_trip_social', { p_trip_id: tripId }));
  return rows[0] ?? null;
}

export async function setTripLike(tripId: string, liked: boolean) {
  const rows = await call(() => supabase.rpc('set_trip_like', { p_trip_id: tripId, p_liked: liked }));
  const row = rows[0];
  if (!row) throw new SocialError('other');
  return { liked: row.liked, likeCount: row.like_count };
}

export async function setTripSave(tripId: string, saved: boolean) {
  const rows = await call(() => supabase.rpc('set_trip_save', { p_trip_id: tripId, p_saved: saved }));
  const row = rows[0];
  if (!row) throw new SocialError('other');
  return { saved: row.saved };
}

export async function setCommentLike(commentId: string, liked: boolean) {
  const rows = await call(() =>
    supabase.rpc('set_comment_like', { p_comment_id: commentId, p_liked: liked }),
  );
  const row = rows[0];
  if (!row) throw new SocialError('other');
  return { liked: row.liked, likeCount: row.like_count };
}

export async function createComment(tripId: string, parentId: string | null, body: string) {
  const rows = await call(() =>
    supabase.rpc('create_comment', { p_trip_id: tripId, p_parent_id: parentId, p_body: body }),
  );
  const row = rows[0];
  if (!row) throw new SocialError('other');
  return row;
}

/** Resolves the trip's new comment_count (the whole deleted subtree is subtracted). */
export async function deleteComment(commentId: string): Promise<number> {
  return call(() => supabase.rpc('delete_comment', { p_comment_id: commentId }));
}

export async function createRepost(tripId: string, caption: string | null) {
  const rows = await call(() =>
    supabase.rpc('create_repost', { p_trip_id: tripId, p_caption: caption }),
  );
  const row = rows[0];
  if (!row) throw new SocialError('other');
  return { repostId: row.repost_id, repostCount: row.repost_count };
}

/** Null when the repost was already gone (callers treat that as success). */
export async function deleteRepost(repostId: string) {
  const rows = await call(() => supabase.rpc('delete_repost', { p_repost_id: repostId }));
  const row = rows[0];
  return row ? { tripId: row.trip_id, repostCount: row.repost_count } : null;
}

/** The viewer's own repost id for a trip (RLS lets users read their own reposts). */
export async function findMyRepostId(tripId: string, userId: string): Promise<string | null> {
  const row = await call(async () => {
    const { data, error } = await supabase
      .from('reposts')
      .select('id')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .maybeSingle();
    return { data: error ? null : (data ?? { id: null }), error };
  });
  return row.id;
}

export async function fetchComments(tripId: string, cursor: Cursor, limit: number) {
  return call(() =>
    supabase.rpc('get_comments', {
      p_trip_id: tripId,
      ...(cursor ? { p_before_created_at: cursor.createdAt, p_before_id: cursor.id } : {}),
      p_limit: limit,
    }),
  );
}

/** Forward cursor: pass the LAST reply already loaded. */
export async function fetchReplies(commentId: string, cursor: Cursor, limit: number) {
  return call(() =>
    supabase.rpc('get_replies', {
      p_comment_id: commentId,
      ...(cursor ? { p_after_created_at: cursor.createdAt, p_after_id: cursor.id } : {}),
      p_limit: limit,
    }),
  );
}

export async function fetchLikers(tripId: string, cursor: Cursor, limit: number) {
  return call(() =>
    supabase.rpc('get_trip_likers', {
      p_trip_id: tripId,
      ...(cursor ? { p_before_created_at: cursor.createdAt, p_before_id: cursor.id } : {}),
      p_limit: limit,
    }),
  );
}

export async function fetchSavedTrips(cursor: Cursor, limit: number) {
  return call(() =>
    supabase.rpc('get_saved_trips', {
      ...(cursor ? { p_before_created_at: cursor.createdAt, p_before_id: cursor.id } : {}),
      p_limit: limit,
    }),
  );
}
