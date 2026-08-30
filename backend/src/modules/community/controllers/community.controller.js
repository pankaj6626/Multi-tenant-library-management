const express = require('express');

const { allow, protect } = require('../../../common/guards/auth.guard');
const asyncHandler = require('../../../common/utils/async-handler');
const service = require('../services/community.service');

const router = express.Router();
router.use(protect);

router.get('/posts', allow('STUDENT', 'LIBRARIAN'), asyncHandler(async (req, res) => {
  res.json(await service.findPosts(req.user.libraryId, req.user.id));
}));
router.post('/posts', allow('STUDENT'), asyncHandler(async (req, res) => {
  res.status(201).json(await service.createPost(req.user.libraryId, req.user.id, req.body.title, req.body.content));
}));
router.post('/posts/:id/comments', allow('STUDENT'), asyncHandler(async (req, res) => {
  res.status(201).json(await service.addComment(req.user.libraryId, req.params.id, req.user.id, req.body.message));
}));
router.patch('/posts/:id/like', allow('STUDENT'), asyncHandler(async (req, res) => {
  res.json(await service.toggleLike(req.user.libraryId, req.params.id, req.user.id));
}));
router.delete('/posts/:id', allow('LIBRARIAN'), asyncHandler(async (req, res) => {
  await service.deletePost(req.user.libraryId, req.params.id);
  res.status(204).send();
}));
router.delete('/posts/:postId/comments/:commentId', allow('LIBRARIAN'), asyncHandler(async (req, res) => {
  await service.deleteComment(req.user.libraryId, req.params.postId, req.params.commentId);
  res.status(204).send();
}));

router.get('/notices', allow('STUDENT', 'LIBRARIAN'), asyncHandler(async (req, res) => {
  res.json(await service.findNotices(req.user.libraryId));
}));
router.post('/notices', allow('LIBRARIAN'), asyncHandler(async (req, res) => {
  res.status(201).json(await service.createNotice(req.user.libraryId, req.user.id, req.body.title, req.body.content));
}));
router.delete('/notices/:id', allow('LIBRARIAN'), asyncHandler(async (req, res) => {
  await service.deleteNotice(req.user.libraryId, req.params.id);
  res.status(204).send();
}));

module.exports = router;
