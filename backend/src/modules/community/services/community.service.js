import HttpError from '../../../common/exceptions/http-error.js';
import redis from '../../../config/redis.js';
import * as repository from '../repositories/community.repository.js';
import studentRepository from '../../students/repositories/student.repository.js';
import * as notificationService from '../../notifications/services/notification.service.js';
import { emitToLibrary } from '../../../config/socket.js';

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
  const postView = await repository.findPostView({ _id: post._id, library });
  emitToLibrary(library, 'post:created', postView.toObject());
  return post;
};

const addComment = async (library, postId, author, message) => {
  const post = await repository.findPost({ _id: postId, library });
  if (!post) throw new HttpError('Post not found', 404);
  post.comments.push({ author, message });
  const result = await repository.savePost(post);
  await redis.del(`community:posts:${library}`);
  const postView = await repository.findPostView({ _id: post._id, library });
  emitToLibrary(library, 'post:updated', { post: postView.toObject(), change: 'comment:created' });
  if (String(post.author) !== String(author)) {
    const commenter = await studentRepository.findById(author);
    const comment = post.comments[post.comments.length - 1];
    await notificationService.notify({
      recipient: post.author,
      recipientRole: 'STUDENT',
      library,
      type: 'POST_COMMENTED',
      title: 'New comment on your post',
      message: `${commenter?.name || 'A student'} commented on your post.`,
      eventKey: `post-commented:${comment._id}`,
    });
  }
  return result;
};

const toggleLike = async (library, postId, studentId) => {
  const post = await repository.findPost({ _id: postId, library });
  if (!post) throw new HttpError('Post not found', 404);
  const index = post.likes.findIndex((id) => String(id) === String(studentId));
  const liked = index === -1;
  if (liked) post.likes.push(studentId);
  else post.likes.splice(index, 1);
  await repository.savePost(post);
  await redis.del(`community:posts:${library}`);
  const postView = await repository.findPostView({ _id: post._id, library });
  emitToLibrary(library, 'post:updated', {
    post: postView.toObject(),
    change: 'like:updated',
    actorId: studentId,
    liked,
  });
  if (liked && String(post.author) !== String(studentId)) {
    const liker = await studentRepository.findById(studentId);
    await notificationService.notify({
      recipient: post.author,
      recipientRole: 'STUDENT',
      library,
      type: 'POST_LIKED',
      title: 'Someone liked your post',
      message: `${liker?.name || 'A student'} liked your post.`,
      eventKey: `post-liked:${postId}:${studentId}:${post.updatedAt?.getTime() || Date.now()}`,
    });
  }
  return { liked, likesCount: post.likes.length };
};

const deletePost = async (library, postId) => {
  const post = await repository.deletePost({ _id: postId, library });
  if (!post) throw new HttpError('Post not found', 404);
  await redis.del(`community:posts:${library}`);
  emitToLibrary(library, 'post:deleted', { postId });
};

const deleteComment = async (library, postId, commentId) => {
  const post = await repository.findPost({ _id: postId, library });
  if (!post) throw new HttpError('Post not found', 404);
  const commentExists = post.comments.some((item) => String(item._id) === String(commentId));
  if (!commentExists) throw new HttpError('Comment not found', 404);
  post.comments.pull(commentId);
  await repository.savePost(post);
  await redis.del(`community:posts:${library}`);
  const postView = await repository.findPostView({ _id: post._id, library });
  emitToLibrary(library, 'post:updated', { post: postView.toObject(), change: 'comment:deleted' });
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
  const noticeView = await repository.findNotice({ _id: notice._id, library });
  emitToLibrary(library, 'notice:created', noticeView.toObject());
  const students = await studentRepository.findIdsByLibrary(library);
  await notificationService.notifyMany(students.map(({ _id: recipient }) => recipient), {
    recipientRole: 'STUDENT',
    library,
    type: 'NOTICE_POSTED',
    title: 'New library notice',
    message: title,
    eventKey: `notice-posted:${notice._id}:student`,
  });
  return notice;
};
const deleteNotice = async (library, noticeId) => {
  const notice = await repository.deleteNotice({ _id: noticeId, library });
  if (!notice) throw new HttpError('Notice not found', 404);
  await redis.del(`community:notices:${library}`);
  emitToLibrary(library, 'notice:deleted', { noticeId });
};

export { findPosts, createPost, addComment, toggleLike, deletePost, deleteComment, findNotices, createNotice, deleteNotice };
