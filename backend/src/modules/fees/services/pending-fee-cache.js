import redis from '../../../config/redis.js';

const CACHE_TTL_SECONDS = 24 * 60 * 60;
const cacheKey = (libraryId) => `library:fees:pending:${libraryId}`;

const get = (libraryId) => redis.get(cacheKey(libraryId));
const set = (libraryId, snapshot) => redis.set(cacheKey(libraryId), snapshot, CACHE_TTL_SECONDS);
const invalidate = (libraryId) => redis.del(cacheKey(libraryId));

export { get, set, invalidate };
