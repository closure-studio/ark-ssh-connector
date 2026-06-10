class AgentContext {
  constructor() {
    throw new Error('SSH agent authentication is not supported in this Worker');
  }
}

function createAgent() {
  throw new Error('SSH agent authentication is not supported in this Worker');
}

function isAgent() {
  return false;
}

module.exports = {
  AgentContext,
  createAgent,
  isAgent,
};
