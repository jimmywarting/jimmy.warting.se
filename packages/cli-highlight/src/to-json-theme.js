/// <reference lib="dom" />
// @ts-check

if (typeof CSSStyleSheet === 'undefined' || typeof CSSStyleRule === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    console.warn('cli-highlight: toJsonTheme() requires a web runtime with CSSStyleSheet, CSSStyleRule, and OffscreenCanvas.')
}

const canvas = typeof OffscreenCanvas === 'undefined' ? undefined : new OffscreenCanvas(1, 1)
const context = canvas && canvas.getContext('2d', { willReadFrequently: true })

/**
 * @typedef {import('./index.js').JsonTheme} JsonTheme
 */

/**
 * @param {CSSStyleSheet | string | {default: CSSStyleSheet}} css
 * @returns {Promise<JsonTheme>}
 */
export default async function toJsonTheme(css) {
    const sheet = typeof css === 'string'
        ? await sheetFromSpecifier(css)
        : 'default' in css
            ? css.default
            : css

    return readTheme(sheet)
}

/**
 * @param {string} specifier
 * @returns {Promise<CSSStyleSheet>}
 */
async function sheetFromSpecifier(specifier) {
    const module = await import(specifier, { with: { type: 'css' } })
    return module.default
}

/**
 * @param {CSSStyleSheet} sheet
 * @returns {JsonTheme}
 */
export function readTheme(sheet) {
    /** @type {JsonTheme} */
    const theme = {}

    for (const rule of flattenRules(sheet.cssRules)) {
        if (!(rule instanceof CSSStyleRule)) {
            continue
        }

        const style = readStyle(rule.style)
        if (Object.keys(style).length === 0) {
            continue
        }

        for (const token of tokensFromSelector(rule.selectorText)) {
            theme[token] = {
                ...theme[token],
                ...style,
            }
        }
    }

    return theme
}

/**
 * @param {CSSStyleDeclaration} style
 * @returns {Record<string, string>}
 */
function readStyle(style) {
    /** @type {Record<string, string>} */
    const result = {}
    assign(result, 'color', normalizeColorToHexAlpha(style.getPropertyValue('color')))
    assign(result, 'backgroundColor', normalizeColorToHexAlpha(style.getPropertyValue('background-color') || style.getPropertyValue('background')))
    assign(result, 'fontWeight', style.getPropertyValue('font-weight'))
    assign(result, 'fontStyle', style.getPropertyValue('font-style'))
    assign(result, 'textDecorationLine', style.getPropertyValue('text-decoration-line') || style.getPropertyValue('text-decoration'))
    return result
}

/**
 * @param {CSSRuleList} rules
 * @returns {CSSRule[]}
 */
function flattenRules(rules) {
    /** @type {CSSRule[]} */
    const flat = []

    for (const rule of rules) {
        if ('cssRules' in rule) {
            flat.push(...flattenRules(rule.cssRules))
        } else {
            flat.push(rule)
        }
    }

    return flat
}

/**
 * @param {string} selectorText
 * @returns {string[]}
 */
function tokensFromSelector(selectorText) {
    const tokens = new Set()

    for (const selector of selectorText.split(',')) {
        const classNames = [...selector.matchAll(/\.hljs(?:-([\w-]+))?/g)]
        const last = classNames[classNames.length - 1]

        if (!last) {
            continue
        }

        tokens.add(last[1] || 'default')
    }

    return [...tokens]
}

/**
 * @param {string} colorString
 * @returns {string}
 */
function normalizeColorToHexAlpha(colorString) {
    if (!colorString || !context) {
        return ''
    }

    context.clearRect(0, 0, 1, 1)
    context.fillStyle = '#00000000'
    context.fillStyle = colorString
    context.fillRect(0, 0, 1, 1)

    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
    return `#${toHex(red)}${toHex(green)}${toHex(blue)}${toHex(alpha)}`.toUpperCase()
}

/**
 * @param {Record<string, string>} target
 * @param {string} key
 * @param {string} value
 * @returns {void}
 */
function assign(target, key, value) {
    if (value && value !== 'none' && value !== 'normal') {
        target[key] = value
    }
}

/**
 * @param {number} value
 * @returns {string}
 */
function toHex(value) {
    return value.toString(16).padStart(2, '0')
}
