const createSeatCache = (redis) => {
  const keyFor = (libraryId) => `library:seats:${libraryId}`;

  return {
    get: (libraryId) => redis.get(keyFor(libraryId)),
    set: (libraryId, value) => redis.set(keyFor(libraryId), value, 15),
    invalidate: (libraryId) => redis.del(keyFor(libraryId)),
  };
};

export default createSeatCache;
