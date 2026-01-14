import fs from 'fs'
import path from 'path'
import { Player, PlayerNote } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')

/**
 * Get player development data file path
 */
function getPlayerDevelopmentPath(playerId: string): string {
  return path.join(DATA_DIR, 'player-development', `${playerId}.json`)
}

/**
 * Get player notes file path
 */
function getPlayerNotesPath(playerId: string): string {
  return path.join(DATA_DIR, 'player-notes', `${playerId}.json`)
}

/**
 * Read player development data
 */
export function readPlayerDevelopment(playerId: string): Player['playerDevelopment'] | null {
  try {
    const filePath = getPlayerDevelopmentPath(playerId)
    if (!fs.existsSync(filePath)) {
      return null
    }
    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`Error reading player development for ${playerId}:`, error)
    return null
  }
}

/**
 * Write player development data
 */
export function writePlayerDevelopment(playerId: string, development: Player['playerDevelopment']): boolean {
  try {
    const filePath = getPlayerDevelopmentPath(playerId)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(development, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error(`Error writing player development for ${playerId}:`, error)
    return false
  }
}

/**
 * Read player notes
 */
export function readPlayerNotes(playerId: string): PlayerNote[] {
  try {
    const filePath = getPlayerNotesPath(playerId)
    if (!fs.existsSync(filePath)) {
      return []
    }
    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`Error reading player notes for ${playerId}:`, error)
    return []
  }
}

/**
 * Write player notes
 */
export function writePlayerNotes(playerId: string, notes: PlayerNote[]): boolean {
  try {
    const filePath = getPlayerNotesPath(playerId)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(notes, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error(`Error writing player notes for ${playerId}:`, error)
    return false
  }
}

/**
 * Add a note to player
 */
export function addPlayerNote(playerId: string, note: Omit<PlayerNote, 'id'>): PlayerNote | null {
  try {
    const notes = readPlayerNotes(playerId)
    const newNote: PlayerNote = {
      ...note,
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
    notes.push(newNote)
    if (writePlayerNotes(playerId, notes)) {
      return newNote
    }
    return null
  } catch (error) {
    console.error(`Error adding note for ${playerId}:`, error)
    return null
  }
}
