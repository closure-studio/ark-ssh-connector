class Socket {
  constructor() {
    throw new Error('Default Node net.Socket is not supported in this Worker; pass cfg.sock');
  }
}

module.exports = { Socket };
