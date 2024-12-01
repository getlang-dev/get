// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
// Bypasses TS6133. Allow declared but unused functions.
// @ts-ignore
function id(d: any[]): any { return d[0]; }
declare var identifier: any;
declare var request_verb: any;
declare var request_block_name: any;
declare var request_block_body: any;
declare var request_block_body_end: any;
declare var drill_arrow: any;
declare var literal: any;
declare var interpvar: any;
declare var slice: any;
declare var modifier: any;
declare var identifier_expr: any;
declare var ws: any;
declare var comment: any;
declare var nl: any;

import lexer from './grammar/lexer.js'
import * as p from './grammar/parse.js'

interface NearleyToken {
  value: any;
  [key: string]: any;
};

interface NearleyLexer {
  reset: (chunk: string, info: any) => void;
  next: () => NearleyToken | undefined;
  save: () => any;
  formatError: (token: never) => string;
  has: (tokenType: string) => boolean;
};

interface NearleyRule {
  name: string;
  symbols: NearleySymbol[];
  postprocess?: (d: any[], loc?: number, reject?: {}) => any;
};

type NearleySymbol = string | { literal: any } | { test: (token: any) => boolean };

interface Grammar {
  Lexer: NearleyLexer | undefined;
  ParserRules: NearleyRule[];
  ParserStart: string;
};

const grammar: Grammar = {
  Lexer: lexer,
  ParserRules: [
    {"name": "program", "symbols": ["_", "header", "statements", "_"], "postprocess": p.program},
    {"name": "header$ebnf$1", "symbols": []},
    {"name": "header$ebnf$1$subexpression$1$subexpression$1", "symbols": ["import"]},
    {"name": "header$ebnf$1$subexpression$1$subexpression$1", "symbols": ["inputs"]},
    {"name": "header$ebnf$1$subexpression$1", "symbols": ["header$ebnf$1$subexpression$1$subexpression$1", "line_sep"]},
    {"name": "header$ebnf$1", "symbols": ["header$ebnf$1", "header$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "header", "symbols": ["header$ebnf$1"], "postprocess": p.header},
    {"name": "statements$ebnf$1", "symbols": []},
    {"name": "statements$ebnf$1$subexpression$1", "symbols": ["line_sep", "statement"]},
    {"name": "statements$ebnf$1", "symbols": ["statements$ebnf$1", "statements$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "statements", "symbols": ["statement", "statements$ebnf$1"], "postprocess": p.statements},
    {"name": "statement$subexpression$1", "symbols": ["request"]},
    {"name": "statement$subexpression$1", "symbols": ["assignment"]},
    {"name": "statement$subexpression$1", "symbols": ["extract"]},
    {"name": "statement", "symbols": ["statement$subexpression$1"], "postprocess": p.idd},
    {"name": "import", "symbols": [{"literal":"import"}, "__", (lexer.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": p.declImport},
    {"name": "inputs$ebnf$1", "symbols": []},
    {"name": "inputs$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "input_decl"]},
    {"name": "inputs$ebnf$1", "symbols": ["inputs$ebnf$1", "inputs$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "inputs", "symbols": [{"literal":"inputs"}, "__", {"literal":"{"}, "_", "input_decl", "inputs$ebnf$1", "_", {"literal":"}"}], "postprocess": p.declInputs},
    {"name": "assignment$ebnf$1", "symbols": [{"literal":"?"}], "postprocess": id},
    {"name": "assignment$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "assignment", "symbols": [{"literal":"set"}, "__", (lexer.has("identifier") ? {type: "identifier"} : identifier), "assignment$ebnf$1", "_", {"literal":"="}, "_", "drill"], "postprocess": p.assignment},
    {"name": "extract", "symbols": [{"literal":"extract"}, "__", "drill"], "postprocess": p.extract},
    {"name": "input_decl$ebnf$1", "symbols": [{"literal":"?"}], "postprocess": id},
    {"name": "input_decl$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "input_decl$ebnf$2$subexpression$1", "symbols": ["_", {"literal":"="}, "_", "input_default"]},
    {"name": "input_decl$ebnf$2", "symbols": ["input_decl$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "input_decl$ebnf$2", "symbols": [], "postprocess": () => null},
    {"name": "input_decl", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier), "input_decl$ebnf$1", "input_decl$ebnf$2"], "postprocess": p.inputDecl},
    {"name": "input_default", "symbols": ["slice"], "postprocess": id},
    {"name": "request$ebnf$1$subexpression$1", "symbols": ["line_sep", "request_block"]},
    {"name": "request$ebnf$1", "symbols": ["request$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "request$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "request$ebnf$2", "symbols": []},
    {"name": "request$ebnf$2$subexpression$1", "symbols": ["line_sep", "request_block_named"]},
    {"name": "request$ebnf$2", "symbols": ["request$ebnf$2", "request$ebnf$2$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "request$ebnf$3$subexpression$1", "symbols": ["line_sep", "request_block_body"]},
    {"name": "request$ebnf$3", "symbols": ["request$ebnf$3$subexpression$1"], "postprocess": id},
    {"name": "request$ebnf$3", "symbols": [], "postprocess": () => null},
    {"name": "request", "symbols": [(lexer.has("request_verb") ? {type: "request_verb"} : request_verb), "template", "request$ebnf$1", "request$ebnf$2", "request$ebnf$3"], "postprocess": p.request},
    {"name": "request_block_named", "symbols": [(lexer.has("request_block_name") ? {type: "request_block_name"} : request_block_name), "line_sep", "request_block"], "postprocess": p.requestBlockNamed},
    {"name": "request_block_body", "symbols": [(lexer.has("request_block_body") ? {type: "request_block_body"} : request_block_body), "template", (lexer.has("request_block_body_end") ? {type: "request_block_body_end"} : request_block_body_end)], "postprocess": p.requestBlockBody},
    {"name": "request_block$ebnf$1", "symbols": []},
    {"name": "request_block$ebnf$1$subexpression$1", "symbols": ["line_sep", "request_entry"]},
    {"name": "request_block$ebnf$1", "symbols": ["request_block$ebnf$1", "request_block$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "request_block", "symbols": ["request_entry", "request_block$ebnf$1"], "postprocess": p.requestBlock},
    {"name": "request_entry$ebnf$1$subexpression$1", "symbols": ["__", "template"]},
    {"name": "request_entry$ebnf$1", "symbols": ["request_entry$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "request_entry$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "request_entry", "symbols": ["template", {"literal":":"}, "request_entry$ebnf$1"], "postprocess": p.requestEntry},
    {"name": "drill", "symbols": ["drill", "_", (lexer.has("drill_arrow") ? {type: "drill_arrow"} : drill_arrow), "_", "expression"], "postprocess": p.drill},
    {"name": "drill$ebnf$1$subexpression$1", "symbols": [(lexer.has("drill_arrow") ? {type: "drill_arrow"} : drill_arrow), "_"]},
    {"name": "drill$ebnf$1", "symbols": ["drill$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "drill$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "drill", "symbols": ["drill$ebnf$1", "expression"], "postprocess": p.drillContext},
    {"name": "expression$subexpression$1", "symbols": ["template"]},
    {"name": "expression$subexpression$1", "symbols": ["slice"]},
    {"name": "expression$subexpression$1", "symbols": ["modifier"]},
    {"name": "expression", "symbols": ["expression$subexpression$1"], "postprocess": p.idd},
    {"name": "expression$subexpression$2", "symbols": ["object"]},
    {"name": "expression$subexpression$2", "symbols": ["subquery"]},
    {"name": "expression$subexpression$2", "symbols": ["module_call"]},
    {"name": "expression", "symbols": ["expression$subexpression$2"], "postprocess": p.idd},
    {"name": "expression", "symbols": ["id_expr"], "postprocess": p.identifier},
    {"name": "subquery", "symbols": [{"literal":"("}, "_", "statements", "_", {"literal":")"}], "postprocess": p.subquery},
    {"name": "module_call$ebnf$1", "symbols": ["object"], "postprocess": id},
    {"name": "module_call$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "module_call", "symbols": ["id_expr", {"literal":"("}, "module_call$ebnf$1", {"literal":")"}], "postprocess": p.moduleCall},
    {"name": "object$ebnf$1", "symbols": []},
    {"name": "object$ebnf$1$subexpression$1$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}]},
    {"name": "object$ebnf$1$subexpression$1$ebnf$1", "symbols": ["object$ebnf$1$subexpression$1$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "object$ebnf$1$subexpression$1$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "object$ebnf$1$subexpression$1", "symbols": ["object_entry", "object$ebnf$1$subexpression$1$ebnf$1", "_"]},
    {"name": "object$ebnf$1", "symbols": ["object$ebnf$1", "object$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "object", "symbols": [{"literal":"{"}, "_", "object$ebnf$1", {"literal":"}"}], "postprocess": p.object},
    {"name": "object_entry$ebnf$1", "symbols": [{"literal":"?"}], "postprocess": id},
    {"name": "object_entry$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "object_entry", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier), "object_entry$ebnf$1", {"literal":":"}, "_", "drill"], "postprocess": p.objectEntry},
    {"name": "object_entry$ebnf$2", "symbols": [{"literal":"?"}], "postprocess": id},
    {"name": "object_entry$ebnf$2", "symbols": [], "postprocess": () => null},
    {"name": "object_entry", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier), "object_entry$ebnf$2"], "postprocess": p.objectEntryShorthandSelect},
    {"name": "object_entry$ebnf$3", "symbols": [{"literal":"?"}], "postprocess": id},
    {"name": "object_entry$ebnf$3", "symbols": [], "postprocess": () => null},
    {"name": "object_entry", "symbols": ["id_expr", "object_entry$ebnf$3"], "postprocess": p.objectEntryShorthandIdent},
    {"name": "template$ebnf$1$subexpression$1", "symbols": [(lexer.has("literal") ? {type: "literal"} : literal)]},
    {"name": "template$ebnf$1$subexpression$1", "symbols": [(lexer.has("interpvar") ? {type: "interpvar"} : interpvar)]},
    {"name": "template$ebnf$1$subexpression$1", "symbols": ["interp_expr"]},
    {"name": "template$ebnf$1", "symbols": ["template$ebnf$1$subexpression$1"]},
    {"name": "template$ebnf$1$subexpression$2", "symbols": [(lexer.has("literal") ? {type: "literal"} : literal)]},
    {"name": "template$ebnf$1$subexpression$2", "symbols": [(lexer.has("interpvar") ? {type: "interpvar"} : interpvar)]},
    {"name": "template$ebnf$1$subexpression$2", "symbols": ["interp_expr"]},
    {"name": "template$ebnf$1", "symbols": ["template$ebnf$1", "template$ebnf$1$subexpression$2"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "template", "symbols": ["template$ebnf$1"], "postprocess": p.template},
    {"name": "interp_expr", "symbols": [{"literal":"${"}, "_", (lexer.has("identifier") ? {type: "identifier"} : identifier), "_", {"literal":"}"}], "postprocess": p.interpExpr},
    {"name": "slice", "symbols": [(lexer.has("slice") ? {type: "slice"} : slice)], "postprocess": p.slice},
    {"name": "modifier$ebnf$1$subexpression$1", "symbols": [{"literal":"("}, "object", {"literal":")"}]},
    {"name": "modifier$ebnf$1", "symbols": ["modifier$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "modifier$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "modifier", "symbols": [(lexer.has("modifier") ? {type: "modifier"} : modifier), "modifier$ebnf$1"], "postprocess": p.modifier},
    {"name": "id_expr", "symbols": [(lexer.has("identifier_expr") ? {type: "identifier_expr"} : identifier_expr)], "postprocess": id},
    {"name": "line_sep$ebnf$1", "symbols": []},
    {"name": "line_sep$ebnf$1$subexpression$1", "symbols": [(lexer.has("ws") ? {type: "ws"} : ws)]},
    {"name": "line_sep$ebnf$1$subexpression$1", "symbols": [(lexer.has("comment") ? {type: "comment"} : comment)]},
    {"name": "line_sep$ebnf$1", "symbols": ["line_sep$ebnf$1", "line_sep$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "line_sep", "symbols": ["line_sep$ebnf$1", (lexer.has("nl") ? {type: "nl"} : nl), "_"], "postprocess": p.ws},
    {"name": "__$ebnf$1", "symbols": ["ws"]},
    {"name": "__$ebnf$1", "symbols": ["__$ebnf$1", "ws"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "__", "symbols": ["__$ebnf$1"], "postprocess": p.ws},
    {"name": "_$ebnf$1", "symbols": []},
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", "ws"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "_", "symbols": ["_$ebnf$1"], "postprocess": p.ws},
    {"name": "ws$subexpression$1", "symbols": [(lexer.has("ws") ? {type: "ws"} : ws)]},
    {"name": "ws$subexpression$1", "symbols": [(lexer.has("comment") ? {type: "comment"} : comment)]},
    {"name": "ws$subexpression$1", "symbols": [(lexer.has("nl") ? {type: "nl"} : nl)]},
    {"name": "ws", "symbols": ["ws$subexpression$1"], "postprocess": p.ws}
  ],
  ParserStart: "program",
};

export default grammar;
