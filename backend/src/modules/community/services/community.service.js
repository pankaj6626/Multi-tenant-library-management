const HttpError = require('../../../common/exceptions/http-error');
const repository = require('../repositories/community.repository');

const findPosts = async (library, studentId) => {
  const posts = await repository.findPosts(library);
  return posts.map((post) => ({
    ...post.toObject(),
    likesCount: post.likes?.length || 0,
    likedByMe: post.likes?.some((id) => String(id) === String(studentId)) || false,
  }));
};

const createPost = (library, author, title, content) => repository.createPost({ library, author, title, content });

const addComment = async (library, postId, author, message) => {
  const post = await repository.findPost({ _id: postId, library });
  if (!post) throw new HttpError('Post not found', 404);
  post.comments.push({ author, message });
  return repository.savePost(post);
};

const toggleLike = async (library, postId, studentId) => {
  const post = await repository.findPost({ _id: postId, library });
  if (!post) throw new HttpError('Post not found', 404);
  const index = post.likes.findIndex((id) => String(id) === String(studentId));
  if (index === -1) post.likes.push(studentId);
  else post.likes.splice(index, 1);
  await repository.savePost(post);
  return { liked: index === -1, likesCount: post.likes.length };
};

const deletePost = async (library, postId) => {
  const post = await repository.deletePost({ _id: postId, library });
  if (!post) throw new HttpError('Post not found', 404);
};

const deleteComment = async (library, postId, commentId) => {
  const post = await repository.findPost({ _id: postId, library });
  if (!post) throw new HttpError('Post not found', 404);
  const commentExists = post.comments.some((item) => String(item._id) === String(commentId));
  if (!commentExists) throw new HttpError('Comment not found', 404);
  post.comments.pull(commentId);
  await repository.savePost(post);
};

const findNotices = (library) => repository.findNotices(library);
const createNotice = (library, author, title, content) => repository.createNotice({ library, author, title, content });
const deleteNotice = async (library, noticeId) => {
  const notice = await repository.deleteNotice({ _id: noticeId, library });
  if (!notice) throw new HttpError('Notice not found', 404);
};

module.exports = { findPosts, createPost, addComment, toggleLike, deletePost, deleteComment, findNotices, createNotice, deleteNotice };
