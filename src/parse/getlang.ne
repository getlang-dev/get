@{%
import lexer from './parse/lexer'
import * as p from './parse/parse'
%}


@preprocessor typescript
@lexer lexer


### STRUCTURE
program -> _ header statements _ {% p.program %}
header -> ((import | inputs) line_sep):* {% p.header %}
statements -> statement (line_sep statement):* {% p.statements %}
statement -> (request | assignment | extract) {% p.idd %}


### KEYWORDS
import -> "import" __ %identifier {% p.declImport %}
inputs -> "inputs" __ "{" _ input_decl (_ "," _ input_decl):* _ "}" {% p.declInputs %}
assignment -> "set" __ %identifier "?":? _ "=" _ drill {% p.assignment %}
extract -> "extract" __ drill {% p.extract %}


### INPUTS
input_decl -> %identifier "?":? (_ "=" _ input_default):? {% p.inputDecl %}
input_default -> slice {% id %}


### REQUEST
request -> %request_verb template (line_sep request_block):? (line_sep request_block_named):* (line_sep request_block_body):? {% p.request %}
request_block_named -> %request_block_name line_sep request_block {% p.requestBlockNamed %}
request_block_body -> %request_block_body template {% p.requestBlockBody %}
request_block -> request_entry (line_sep request_entry):* {% p.requestBlock %}
request_entry -> template ":" (__ template):? {% p.requestEntry %}


### DRILL
###   (left-associative recursion)
drill -> drill _ %drill_arrow _ expression {% p.drill %}
drill -> (%drill_arrow _):? expression {% p.drillContext %}


### EXPR
expression -> (template | slice | modifier) {% p.idd %}
expression -> (object | function | module_call) {% p.idd %}
expression -> id_ref {% p.identifier %}


### FUNCTIONS
function -> "(" _ statements _ ")" {% p.fn %}
module_call -> id_ref "(" (object _):? ")" {% p.moduleCall %}


### OBJECT LITERALS
object -> "{" _ (object_entry (_ ","):? _):* "}" {% p.object %}
object_entry -> %identifier "?":? ":" _ drill {% p.objectEntry %}
object_entry -> %identifier "?":? {% p.objectEntryShorthandDrill %}
object_entry -> id_ref "?":? {% p.objectEntryShorthandIdent %}


### LITERALS
template -> (%literal | %interpvar | interp_expr):+ {% p.template %}
interp_expr -> "${" _ %identifier _ "}" {% p.interpExpr %}
slice -> %slice {% p.slice %}
modifier -> %modifier {% p.modifier %}
id_ref -> "$" %identifier {% p.idRef %}


### WHITESPACE
line_sep -> (%ws | %comment):* %nl _ {% p.ws %}
__ -> ws:+ {% p.ws %}
_ -> ws:* {% p.ws %}
ws -> (%ws | %comment | %nl) {% p.ws %}
