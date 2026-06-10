class EventEmitter {
  constructor() {
    this.listenersByEvent = new Map();
  }

  on(event, listener) {
    const listeners = this.listenersByEvent.get(event) ?? [];
    listeners.push(listener);
    this.listenersByEvent.set(event, listeners);
    return this;
  }

  once(event, listener) {
    const wrapped = (...args) => {
      this.removeListener(event, wrapped);
      listener(...args);
    };

    return this.on(event, wrapped);
  }

  emit(event, ...args) {
    const listeners = this.listenersByEvent.get(event);

    if (!listeners) {
      return false;
    }

    for (const listener of [...listeners]) {
      listener(...args);
    }

    return true;
  }

  removeListener(event, listener) {
    const listeners = this.listenersByEvent.get(event);

    if (!listeners) {
      return this;
    }

    this.listenersByEvent.set(
      event,
      listeners.filter((current) => current !== listener),
    );

    return this;
  }

  removeAllListeners(event) {
    if (event === undefined) {
      this.listenersByEvent.clear();
      return this;
    }

    this.listenersByEvent.delete(event);
    return this;
  }
}

module.exports = EventEmitter;
module.exports.EventEmitter = EventEmitter;
