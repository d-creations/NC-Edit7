# ACE Editor Syntax Highlighting Guide for NC/G-Code

Based on the `nc_command_parser.py` file, the NC program dialect includes standard Fanuc/ISO g-code, macro variables, math functions, control flow statements, and Siemens-specific keywords and cycles.

Here is a comprehensive breakdown for creating an ACE editor custom mode (`TextHighlightRules`) to colorize the syntax appropriately.

## Token Categories and Rules

### 1. Siemens Keywords & Cycles (Keyword)
Siemens cycles and specific system keywords.
- **Regex:** `\b(?:CYCLE\d+|POCKET\d+|HOLES\d+|SLOT\d+|LONGHOLE|WORKPIECE|MCALL|REPEAT|MSG)\b`
- **ACE Token:** `keyword.control.siemens`

### 2. Control Flow & Logic (Keyword)
Standard Fanuc/Macro B control flow logic.
- **Regex:** `\b(?:GOTO|IF|WHILE|DO|END)\b`
- **ACE Token:** `keyword.control.statement`

### 3. Math Functions (Support Function)
Built-in mathematical functions used in variable calculations.
- **Regex:** `\b(?:SQRT|ASIN|ACOS|ATAN|SIN|COS|TAN|ABS|BIN|BCD|ROUND|FIX|FUP)\b`
- **ACE Token:** `support.function`

### 4. G-Codes and M-Codes (Keyword / Storage Type)
Preparatory (G) and Miscellaneous (M) codes.
- **Regex (G-codes):** `[Gg]\s*\d+(?:\.\d+)?`
- **Regex (M-codes):** `[Mm]\s*\d+(?:\.\d+)?`
- **ACE Token:** `keyword.other.gcode` / `keyword.other.mcode` OR `constant.language`

### 5. Variables & Macros (Variable)
Variables usually start with `#` or sometimes act like assignments (`R1=10`).
- **Regex (Hash Variables):** `#[0-9]+`
- **Regex (Letter/Number Variables):** `\b[A-Z][0-9]+(?=\s*=)`
- **ACE Token:** `variable.parameter` or `variable.other`

### 6. Axis & Command Parameters (Entity)
Standard NC parameters like `X`, `Y`, `Z`, `F`, `S`, `T`, `A`, `B`, `C`, etc., followed by values.
- **Regex:** `[A-Z]\s*[+-]?\d+(?:\.\d+)?` (excluding G, M, and O codes which might be highlighted differently).
- **ACE Token:** `entity.name.tag` OR split it into `entity.name.function` for the letter and `constant.numeric` for the number.

### 7. Strings
Double-quoted strings, especially used in Siemens (e.g., `T="TOOL"`).
- **Regex:** `"[^"]*"`
- **ACE Token:** `string.quoted.double`

### 8. Comments
Parentheses usually denote comments unless nested in specific Siemens calls. A block skip `/` is also a special line marker.
- **Regex (Parentheses):** `\(.*?\)`
- **Regex (Block Skip):** `^\s*\/`
- **ACE Token:** `comment.line` or `comment.block`

### 9. Numbers (Constant Numeric)
Standalone numbers (if you decide to separate parameter addresses from their numeric values).
- **Regex:** `[+-]?\d+(?:\.\d+)?`
- **ACE Token:** `constant.numeric`

---

## Example ACE TextHighlightRules Implementation

Here is a boilerplate JavaScript implementation for an ACE Editor custom mode based on the parser.

```javascript
define("ace/mode/nccode_highlight_rules", function(require, exports, module) {
    "use strict";

    var oop = require("ace/lib/oop");
    var TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;

    var NCCodeHighlightRules = function() {
        this.$rules = {
            "start" : [
                {
                    // Block skip
                    token : "comment.line.modifier",
                    regex : /^\s*\/.*/
                },
                {
                    // Parenthesis Comments
                    token : "comment",
                    regex : /\([^)]*\)/
                },
                {
                    // Strings (e.g., T="TOOL")
                    token : "string.quoted.double",
                    regex : /"[^"]*"/
                },
                {
                    // Siemens Keywords & Cycles
                    token : "keyword.control.siemens",
                    regex : /\b(?:CYCLE\d+|POCKET\d+|HOLES\d+|SLOT\d+|LONGHOLE|WORKPIECE|MCALL|REPEAT|MSG)\b/i
                },
                {
                    // Control flow statements
                    token : "keyword.control",
                    regex : /\b(?:GOTO|IF|WHILE|DO|END)\b/i
                },
                {
                    // Math Functions
                    token : "support.function",
                    regex : /\b(?:SQRT|ASIN|ACOS|ATAN|SIN|COS|TAN|ABS|BIN|BCD|ROUND|FIX|FUP)\b/i
                },
                {
                    // Operators
                    token : "keyword.operator",
                    regex : /[\+\-\*\/=]/
                },
                {
                    // Macro Variables (e.g. #100)
                    token : "variable.parameter",
                    regex : /#[0-9]+/
                },
                {
                    // Variable assignments (e.g. R1=)
                    token : "variable.other",
                    regex : /\b[A-Z][0-9]+(?=\s*=)/i
                },
                {
                    // G-Codes
                    token : "constant.language.gcode",
                    regex : /[Gg]\s*\d+(?:\.\d+)?/
                },
                {
                    // M-Codes
                    token : "constant.language.mcode",
                    regex : /[Mm]\s*\d+(?:\.\d+)?/
                },
                {
                    // Common Address letters with numbers (X, Y, Z, F, S, T, etc.)
                    token : ["entity.name.tag", "constant.numeric"],
                    regex : /([A-Z])(\s*[+-]?\d+(?:\.\d+)?)/i
                }
            ]
        };
    };

    oop.inherits(NCCodeHighlightRules, TextHighlightRules);
    exports.NCCodeHighlightRules = NCCodeHighlightRules;
});
```
