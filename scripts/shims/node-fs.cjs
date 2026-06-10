module.exports = {
  constants: {},
  readFile() {
    throw new Error('Node fs is not supported in this Worker');
  },
  readFileSync() {
    throw new Error('Node fs is not supported in this Worker');
  },
};
