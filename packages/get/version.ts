import fs from 'node:fs'
import path from 'node:path'

const path1 = path.join(__dirname, 'package.json')
const path2 = path.join(__dirname, '..', 'package.json')
let json: string

try {
  json = fs.readFileSync(path1, 'utf8')
} catch (_: unknown) {
  json = fs.readFileSync(path2, 'utf8')
}

export const version = JSON.parse(json).version
