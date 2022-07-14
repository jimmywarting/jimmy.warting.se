class UndoManager {
  constructor() {
    this.commands = []
    this.index = -1
    this.limit = 100
  }

  add (command) {
    const { commands, limit, index } = this
    commands.splice(index + 1, commands.length - index)
    commands.push(command)
    while (commands.length > limit) commands.shift()
    this.index = commands.length - 1
  }

  undo () {
    const mutation = this.commands[this.index]
    if (mutation) {
      mutation.undo()
      this.index -= 1
    }
  }

  redo () {
    const mutation = this.commands[this.index + 1]
    if (mutation) {
      mutation.redo()
      this.index += 1
    }
  }
}

export default UndoManager
export { UndoManager }
