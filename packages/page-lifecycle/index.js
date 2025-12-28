class PageLifecycle extends Observable {
  state = this.#getState()

  constructor() {
    // Vi skickar in logiken direkt till Observables konstruktor via super
    super(subscriber => {
      const genericListener = evt => this.#emit(
        evt.type === 'pagehide' ? (evt.persisted ? 'frozen' : 'terminated') :
        evt.type === 'freeze' ? 'frozen' : 
        this.#getState()
      , subscriber)

      const opts = { signal: subscriber.signal, capture: true }
      
      ;['pageshow', 'focus', 'blur', 'visibilitychange', 'resume', 'freeze', 'pagehide'].forEach((type) => {
        globalThis.addEventListener(type, genericListener, opts)
      })
    })
  }

  #emit (state, subscriber) {
    const old = this.state
    if (old !== state) {
      this.state = state
      subscriber.next({ newState: state, oldState: old })
    }
  }

  #getState() {
    return document.visibilityState === 'hidden' 
      ? 'hidden' 
      : document.hasFocus() 
        ? 'active' 
        : 'passive'
  }
}

export {
  PageLifecycle
}
