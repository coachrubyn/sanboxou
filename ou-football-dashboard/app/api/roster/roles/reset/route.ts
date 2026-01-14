import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Use the same storage file as roles route
const ROLES_FILE = path.join(process.cwd(), 'data', 'roster-roles.json')

function loadPlayerRoles(): Record<string, { role: string; depthChartOrder?: number }> {
  try {
    if (fs.existsSync(ROLES_FILE)) {
      const content = fs.readFileSync(ROLES_FILE, 'utf-8')
      return JSON.parse(content)
    }
  } catch (error) {
    console.error('Error loading player roles:', error)
  }
  return {}
}

function savePlayerRoles(roles: Record<string, { role: string; depthChartOrder?: number }>) {
  try {
    const dir = path.dirname(ROLES_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(ROLES_FILE, JSON.stringify(roles, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error saving player roles:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { all } = body

    // Clear all saved roles
    const roles = loadPlayerRoles()
    const count = Object.keys(roles).length
    
    savePlayerRoles({})
    
    return NextResponse.json({
      success: true,
      message: `Cleared ${count} saved role(s). Players will use depth chart roles.`,
      cleared: count
    })
  } catch (error) {
    console.error('Error resetting roles:', error)
    return NextResponse.json(
      { 
        error: 'Failed to reset roles',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
