function unsupported() {
  throw new Error('Node child_process is not supported in this Worker');
}

module.exports = {
  execFile: unsupported,
  spawn: unsupported,
};
