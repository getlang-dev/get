const id = /[a-zA-Z_]\w*/

export const patterns = {
  ws: /[ \t\r\f\v]+/,
  identifier: id,
  identifierExpr: new RegExp(`\\$(?:${id.source})?`),
  link: new RegExp(`\\@${id.source}\\)`),
  call: new RegExp(`\\@${id.source}`),
}
