import Post from '../entities/post.entity.js';
import Notice from '../entities/notice.entity.js';

const populatePost = (query) => query
  .populate('author', 'name')
  .populate('comments.author', 'name')
  .sort('-createdAt');

const findPosts = (library) => populatePost(Post.find({ library }));
const createPost = (data) => Post.create(data);
const findPost = (query) => Post.findOne(query);
const savePost = (post) => post.save();
const deletePost = (query) => Post.findOneAndDelete(query);
const findNotices = (library) => Notice.find({ library }).populate('author', 'name').sort('-createdAt');
const createNotice = (data) => Notice.create(data);
const deleteNotice = (query) => Notice.findOneAndDelete(query);

export { findPosts, createPost, findPost, savePost, deletePost, findNotices, createNotice, deleteNotice };
