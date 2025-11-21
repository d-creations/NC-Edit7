import ace from 'ace-builds';

export function registerNcMode() {
  (ace as any).define('ace/mode/nc_highlight_rules', ['require', 'exports', 'module', 'ace/lib/oop', 'ace/mode/text_highlight_rules'], (require: any, exports: any, _module: any) => {
    const oop = require('../lib/oop');
    const TextHighlightRules = require('./text_highlight_rules').TextHighlightRules;

    const NCHighlightRules = function(this: any) {
      this.$rules = {
        start: [
          {
            token: 'comment',
            regex: '\\(.*\\)',
            comment: 'Comment'
          },
          {
            token: 'string', // Program number
            regex: 'O[0-9]+',
            comment: 'Program Number'
          },
          {
            token: 'keyword', // Tool number
            regex: 'T[0-9]+',
            comment: 'ToolNumber'
          },
          {
            token: 'keyword.control', // G-codes
            regex: 'G[0-9]+(\\.[0-9]+)?',
            comment: 'G Codes'
          },
          {
            token: 'keyword.control', // M-codes
            regex: 'M[0-9]+',
            comment: 'M Codes'
          },
          {
            token: 'variable.parameter', // Axes
            regex: '[XYZABCUVWxyzabcuvw]',
            comment: 'Axis'
          },
          {
            token: 'constant.numeric', // Numbers
            regex: '[-+]?[0-9]*\\.?[0-9]+',
            comment: 'Number'
          },
          {
            token: 'support.function', // F, S, P, Q, R
            regex: '[FSPQRfspqr]',
            comment: 'Parameters'
          }
        ]
      };
      this.normalizeRules();
    };

    oop.inherits(NCHighlightRules, TextHighlightRules);
    exports.NCHighlightRules = NCHighlightRules;
  });

  (ace as any).define('ace/mode/nc', ['require', 'exports', 'module', 'ace/lib/oop', 'ace/mode/text', 'ace/mode/nc_highlight_rules'], (require: any, exports: any, _module: any) => {
    const oop = require('../lib/oop');
    const TextMode = require('./text').Mode;
    const NCHighlightRules = require('./nc_highlight_rules').NCHighlightRules;

    const Mode = function(this: any) {
      this.HighlightRules = NCHighlightRules;
      this.$behaviour = this.$defaultBehaviour;
    };
    oop.inherits(Mode, TextMode);

    (function(this: any) {
      this.lineCommentStart = ";"; 
      this.blockComment = {start: "(", end: ")"};
      this.$id = "ace/mode/nc";
    }).call(Mode.prototype);

    exports.Mode = Mode;
  });
}
