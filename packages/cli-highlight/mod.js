import { highlight } from './src/index.js'

/**
 * Logs highlighted code to the console using CSS styles.
 *
 * @param {string} language - The programming language of the code (e.g., 'javascript', 'python').
 * @param {string} code - The code to be highlighted and logged.
 */
function logCode(code, language = 'javascript') {
  console.log('%c' + highlight(code, {
    language,
    backgroundColor: 'rgb(0, 0, 0)',
    jsonTheme: {
      "default": {
        "background": "rgb(0,0,0)",
        "color": "rgb(171, 178, 191)",
      },
      "keyword": {
        "color": "rgb(198, 120, 221)"
      },
      "built_in": {
        "color": "rgb(230, 192, 123)"
      },
      "type": {
        "color": "rgb(209, 154, 102)"
      },
      "literal": {
        "color": "rgb(86, 182, 194)"
      },
      "number": {
        "color": "rgb(209, 154, 102)"
      },
      "regexp": {
        "color": "rgb(152, 195, 121)"
      },
      "string": {
        "color": "rgb(152, 195, 121)"
      },
      "subst": {
        "color": "rgb(224, 108, 117)"
      },
      "symbol": {
        "color": "rgb(97, 174, 238)"
      },
      "title": {
        "color": "rgb(97, 174, 238)"
      },
      "comment": {
        "color": "rgb(92, 99, 112)",
        "fontStyle": "italic"
      },
      "doctag": {
        "color": "rgb(198, 120, 221)"
      },
      "meta": {
        "color": "rgb(97, 174, 238)"
      },
      "section": {
        "color": "rgb(224, 108, 117)"
      },
      "name": {
        "color": "rgb(224, 108, 117)"
      },
      "attr": {
        "color": "rgb(209, 154, 102)"
      },
      "attribute": {
        "color": "rgb(152, 195, 121)"
      },
      "variable": {
        "color": "rgb(209, 154, 102)"
      },
      "bullet": {
        "color": "rgb(97, 174, 238)"
      },
      "quote": {
        "color": "rgb(92, 99, 112)",
        "fontStyle": "italic"
      },
      "selector-tag": {
        "color": "rgb(224, 108, 117)"
      },
      "selector-id": {
        "color": "rgb(97, 174, 238)"
      },
      "selector-class": {
        "color": "rgb(209, 154, 102)"
      },
      "selector-attr": {
        "color": "rgb(209, 154, 102)"
      },
      "selector-pseudo": {
        "color": "rgb(209, 154, 102)"
      },
      "template-variable": {
        "color": "rgb(209, 154, 102)"
      },
      "addition": {
        "color": "rgb(152, 195, 121)"
      },
      "deletion": {
        "color": "rgb(224, 108, 117)"
      }
    }
  }), 'background: #fff; color: #bada55')
}

export {
  logCode
}