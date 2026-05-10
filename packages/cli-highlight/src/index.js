import hljs from 'https://cdn.jsdelivr.net/npm/highlight.js@10.7.1/+esm'
const DEFAULT_HLJS_EMITTER = hljs.highlightAuto('', []).emitter.constructor

/**
 * @typedef {object} JsonTokenStyle
 * @property {string=} color
 * @property {string=} backgroundColor
 * @property {string=} background
 * @property {string=} fontWeight
 * @property {string=} fontStyle
 * @property {string=} textDecorationLine
 */

/**
 * @typedef {Record<string, JsonTokenStyle | undefined>} JsonTheme
 */

/**
 * @typedef {object} HighlightOptions
 * @property {string=} language Can be a name, file extension, alias etc. If omitted, tries to auto-detect language.
 * @property {boolean=} ignoreIllegals Forces highlighting to finish even when the language detects illegal syntax.
 * @property {string[]=} languageSubset Restricts auto-detection to these languages.
 * @property {JsonTheme=} jsonTheme Theme data generated from highlight.js CSS.
 */

/**
 * @param {string | undefined} value
 * @returns {[number, number, number] | undefined}
 */
function parseColor(value) {
    if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') {
        return undefined
    }

    const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value)
    if (hex) {
        return hex[4].toLowerCase() === '00'
            ? undefined
            : [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)]
    }

    const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d?(?:\.\d+)?))?\)$/.exec(value)
    if (!rgb || rgb[4] === '0') {
        return undefined
    }

    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
}

/**
 * @param {string} text
 * @param {JsonTokenStyle | undefined} style
 * @returns {string}
 */
function applyStyle(text, style) {
    if (!text || !style) {
        return text
    }

    /** @type {string[]} */
    const open = []
    /** @type {string[]} */
    const close = []
    const color = parseColor(style.color)
    const backgroundColor = [0,0,0] // parseColor(style.backgroundColor ?? style.background)

    if (color) {
        open.push(`\u001B[38;2;${color[0]};${color[1]};${color[2]}m`)
        close.unshift('\u001B[39m')
    }

    if (backgroundColor) {
        open.push(`\u001B[48;2;${backgroundColor[0]};${backgroundColor[1]};${backgroundColor[2]}m`)
        close.unshift('\u001B[49m')
    }

    if (style.fontWeight === 'bold' || Number(style.fontWeight) >= 600) {
        open.push('\u001B[1m')
        close.unshift('\u001B[22m')
    }

    if (style.fontStyle === 'italic') {
        open.push('\u001B[3m')
        close.unshift('\u001B[23m')
    }

    if (style.textDecorationLine && style.textDecorationLine.includes('underline')) {
        open.push('\u001B[4m')
        close.unshift('\u001B[24m')
    }

    return open.length === 0 ? text : open.join('') + text + close.join('')
}

/**
 * @param {string} text
 * @param {JsonTheme} jsonTheme
 * @param {string | undefined} token
 * @returns {string}
 */
function applyTheme(text, jsonTheme, token) {
    return applyStyle(text, token ? jsonTheme[token] : jsonTheme.default)
}

class ConsoleEmitter {
    /**
     * @param {JsonTheme} jsonTheme
     */
    constructor(jsonTheme) {
        this.jsonTheme = jsonTheme
        this.buffer = ''
        /** @type {string[]} */
        this.tokenStack = []
    }

    /**
     * @param {string} text
     * @param {string} kind
     * @returns {void}
     */
    addKeyword(text, kind) {
        this.buffer += applyTheme(text, this.jsonTheme, kind)
    }

    /**
     * @param {string} text
     * @returns {void}
     */
    addText(text) {
        this.buffer += applyTheme(text, this.jsonTheme, this.tokenStack[this.tokenStack.length - 1])
    }

    /**
     * @param {string} kind
     * @returns {void}
     */
    openNode(kind) {
        this.tokenStack.push(kind)
    }

    /**
     * @returns {void}
     */
    closeNode() {
        this.tokenStack.pop()
    }

    /**
     * @returns {void}
     */
    closeAllNodes() {
        this.tokenStack.length = 0
    }

    /**
     * @param {{toHTML: () => string}} emitter
     * @returns {void}
     */
    addSublanguage(emitter) {
        this.buffer += emitter.toHTML()
    }

    /**
     * @returns {boolean}
     */
    finalize() {
        return true
    }

    /**
     * highlight.js expects this method name, but this emitter returns ANSI text.
     *
     * @returns {string}
     */
    toHTML() {
        return this.buffer
    }
}

/**
 * @param {JsonTheme} jsonTheme
 * @returns {new (options: unknown) => ConsoleEmitter}
 */
function createEmitter(jsonTheme) {
    return class ThemedConsoleEmitter extends ConsoleEmitter {
        /**
         * @param {unknown} _options
         */
        constructor(_options) {
            super(jsonTheme)
        }
    }
}

/**
 * Apply syntax highlighting to `code` with ANSI color codes. The language is automatically
 * detected if not set.
 *
 * @param {string} code The code to highlight.
 * @param {HighlightOptions=} options Optional options.
 * @returns {string}
 */
function highlight(code, options = {}) {
    // pad-end every line of code so that it have the same with as the longest
    // line, otherwise the background color won't be applied to the entire line
    // should only be applied in browser...
    // if (typeof window !== 'undefined') {
        const maxLength = Math.max(...code.split('\n').map(line => line.length))
        code = code.split('\n').map(line => line.padEnd(maxLength)).join('\n')
    // }

    hljs.configure({
        __emitter: createEmitter(options.jsonTheme || {}),
    })

    try {
        const result = options.language
            ? hljs.highlight(code, {
                  language: options.language,
                  ignoreIllegals: options.ignoreIllegals,
              })
            : hljs.highlightAuto(code, options.languageSubset)

        return typeof result.emitter?.toHTML === 'function' ? result.emitter.toHTML() : result.value
    } finally {
        hljs.configure({
            __emitter: DEFAULT_HLJS_EMITTER,
        })
    }
}

/**
 * Converts a CSS module, CSSStyleSheet, or CSS module specifier into a jsonTheme.
 *
 * @param {CSSStyleSheet | string | {default: CSSStyleSheet}} css
 * @returns {Promise<JsonTheme>}
 */
async function toJsonTheme(css) {
    const { toJsonTheme } = await import('./to-json-theme.js')
    return toJsonTheme(css)
}

export {
    highlight,
    toJsonTheme,
    hljs
}
