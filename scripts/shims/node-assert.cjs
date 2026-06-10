function assert(value, message) {
  if (!value) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.ok = assert;
assert.equal = (actual, expected, message) => {
  if (actual != expected) {
    throw new Error(message || `Expected ${actual} to equal ${expected}`);
  }
};
assert.strictEqual = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(message || `Expected ${actual} to strictly equal ${expected}`);
  }
};

module.exports = assert;
module.exports.default = assert;
