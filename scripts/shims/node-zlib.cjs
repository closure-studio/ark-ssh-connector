class ZlibHandle {
  constructor() {
    this._owner = undefined;
    this.onerror = undefined;
  }

  init() {}

  writeSync() {
    throw new Error('SSH compression is not supported in this Worker');
  }

  close() {}
}

function createInflate() {
  return {
    _handle: new ZlibHandle(),
  };
}

module.exports = {
  createInflate,
  constants: {
    DEFLATE: 1,
    INFLATE: 2,
    Z_DEFAULT_CHUNK: 16 * 1024,
    Z_DEFAULT_COMPRESSION: -1,
    Z_DEFAULT_MEMLEVEL: 8,
    Z_DEFAULT_STRATEGY: 0,
    Z_DEFAULT_WINDOWBITS: 15,
    Z_PARTIAL_FLUSH: 1,
  },
};
