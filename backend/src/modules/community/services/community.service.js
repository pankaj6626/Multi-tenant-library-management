import HttpError from '../../../common/exceptions/http-error.js';
import redis from '../../../config/redis.js';
import * as repository from '../repositories/community.repository.js';

const findPosts = async (library, studentId) => {
  const key = `community:posts:${library}`;
  const cached = await redis.get(key);
  const posts = cached || await repository.findPosts(library);
  if (!cached) await redis.set(key, posts.map((post) => post.toObject()), 30);
  return posts.map((post) => ({
    ...(post.toObject ? post.toObject() : post),
    likesCount: post.likes?.length || 0,
    likedByMe: post.likes?.some((id) => String(id) === String(studentId)) || false,
  }));
};

const createPost = async (library, author, title, content) => {
  const post = await repository.createPost({ library, author, title, content });
  await redis.del(`community:posts:${library}`);
  return post;
};

const addComment = async (library, postId, author, message) => {
  const post = await repository.findPost({ _id: postId, library });
  if (!post) throw new HttpError('Post not found', 404);
  post.comments.push({ author, message });
  const result = await repository.savePost(post);
  await redis.del(`community:posts:${library}`);
  return result;
};

const toggleLike = async (library, postId, studentId) => {
  const post = await repository.findPost({ _id: postId, library });
  if (!post) throw new HttpError('Post not found', 404);
  const index = post.likes.findIndex((id) => String(id) === String(studentId));
  if (index === -1) post.likes.push(studentId);
  else post.likes.splice(index, 1);
  await repository.savePost(post);
  await redis.del(`community:posts:${library}`);
  return { liked: index === -1, likesCount: post.likes.length };
};

const deletePost = async (library, postId) => {
  const post = await repository.deletePost({ _id: postId, library });
  if (!post) throw new HttpError('Post not found', 404);
  await redis.del(`community:posts:${library}`);
};

const deleteComment = async (library, postId, commentId) => {
  const post = await repository.findPost({ _id: postId, library });
  if (!post) throw new HttpError('Post not found', 404);
  const commentExists = post.comments.some((item) => String(item._id) === String(commentId));
  if (!commentExists) throw new HttpError('Comment not found', 404);
  post.comments.pull(commentId);
  await repository.savePost(post);
  await redis.del(`community:posts:${library}`);
};

const findNotices = async (library) => {
  const key = `community:notices:${library}`;
  const cached = await redis.get(key);
  if (cached) return cached;
  const notices = await repository.findNotices(library);
  const result = notices.map((notice) => notice.toObject());
  await redis.set(key, result, 120);
  return result;
};
const createNotice = async (library, author, title, content) => {
  const notice = await repository.createNotice({ library, author, title, content });
  await redis.del(`community:notices:${library}`);
  return notice;
};
const deleteNotice = async (library, noticeId) => {
  const notice = await repository.deleteNotice({ _id: noticeId, library });
  if (!notice) throw new HttpError('Notice not found', 404);
  await redis.del(`community:notices:${library}`);
};

export { findPosts, createPost, addComment, toggleLike, deletePost, deleteComment, findNotices, createNotice, deleteNotice };
