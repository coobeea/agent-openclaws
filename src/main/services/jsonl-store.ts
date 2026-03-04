import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import { log } from '@main/utils/logger'

const DATA_DIR = () => join(app.getPath('userData'), 'data')

function ensureDataDir(): string {
  const dir = DATA_DIR()
  mkdirSync(dir, { recursive: true })
  return dir
}

function filePath(name: string): string {
  return join(ensureDataDir(), name)
}

function readLines<T>(file: string): T[] {
  const fp = filePath(file)
  if (!existsSync(fp)) return []
  const text = readFileSync(fp, 'utf-8').trim()
  if (!text) return []
  return text.split('\n').map((line) => JSON.parse(line))
}

function writeLines<T>(file: string, items: T[]): void {
  const fp = filePath(file)
  writeFileSync(fp, items.map((i) => JSON.stringify(i)).join('\n') + (items.length ? '\n' : ''), 'utf-8')
}

function appendLine<T>(file: string, item: T): void {
  const fp = filePath(file)
  mkdirSync(dirname(fp), { recursive: true })
  const text = JSON.stringify(item) + '\n'
  if (existsSync(fp)) {
    const { appendFileSync } = require('fs')
    appendFileSync(fp, text, 'utf-8')
  } else {
    writeFileSync(fp, text, 'utf-8')
  }
}

let nextIdCache: Record<string, number> = {}

function nextId(file: string, items: { id: number }[]): number {
  const max = items.reduce((m, i) => Math.max(m, i.id || 0), nextIdCache[file] || 0)
  nextIdCache[file] = max + 1
  return nextIdCache[file]
}

export class JsonlCollection<T extends { id: number }> {
  private file: string
  private items: T[] | null = null

  constructor(filename: string) {
    this.file = filename
  }

  private load(): T[] {
    if (this.items === null) {
      this.items = readLines<T>(this.file)
    }
    return this.items
  }

  private save(): void {
    writeLines(this.file, this.load())
  }

  all(): T[] {
    return [...this.load()]
  }

  find(predicate: (item: T) => boolean): T[] {
    return this.load().filter(predicate)
  }

  get(id: number): T | undefined {
    return this.load().find((i) => i.id === id)
  }

  insert(data: Omit<T, 'id'>): T {
    const items = this.load()
    const id = nextId(this.file, items)
    const now = new Date().toISOString()
    const item = { id, created_at: now, updated_at: now, ...data } as unknown as T
    items.push(item)
    this.save()
    return item
  }

  update(id: number, changes: Partial<T>): T | undefined {
    const items = this.load()
    const idx = items.findIndex((i) => i.id === id)
    if (idx === -1) return undefined
    items[idx] = { ...items[idx], ...changes, updated_at: new Date().toISOString() } as T
    this.save()
    return items[idx]
  }

  delete(id: number): boolean {
    const items = this.load()
    const idx = items.findIndex((i) => i.id === id)
    if (idx === -1) return false
    items.splice(idx, 1)
    this.save()
    return true
  }

  count(): number {
    return this.load().length
  }
}

export class JsonStore {
  private file: string
  private data: Record<string, unknown> | null = null

  constructor(filename: string) {
    this.file = filename
  }

  private load(): Record<string, unknown> {
    if (this.data === null) {
      const fp = filePath(this.file)
      if (existsSync(fp)) {
        try { this.data = JSON.parse(readFileSync(fp, 'utf-8')) } catch { this.data = {} }
      } else {
        this.data = {}
      }
    }
    return this.data!
  }

  private save(): void {
    const fp = filePath(this.file)
    mkdirSync(dirname(fp), { recursive: true })
    writeFileSync(fp, JSON.stringify(this.load(), null, 2), 'utf-8')
  }

  get(key: string): unknown {
    return this.load()[key]
  }

  set(key: string, value: unknown): void {
    this.load()[key] = value
    this.save()
  }

  getAll(): Record<string, unknown> {
    return { ...this.load() }
  }

  setAll(data: Record<string, unknown>): void {
    Object.assign(this.load(), data)
    this.save()
  }

  delete(key: string): void {
    delete this.load()[key]
    this.save()
  }
}

export function initDataDir(): void {
  const dir = ensureDataDir()
  log.info(`Data directory: ${dir}`)
}
