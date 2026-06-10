class SFTP {
  constructor() {
    throw new Error('SFTP is not supported in this Worker');
  }
}

module.exports = { SFTP };
