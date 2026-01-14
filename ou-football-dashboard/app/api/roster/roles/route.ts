import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Persistent storage for player roles and depth chart order
// Format: { playerId: { role: string, depthChartOrder?: number } }
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

export async function GET() {
  try {
    const roles = loadPlayerRoles()
    return NextResponse.json({
      success: true,
      data: roles
    })
  } catch (error) {
    console.error('Error loading player roles:', error)
    return NextResponse.json(
      { error: 'Failed to load player roles' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { playerId, role, depthChartOrder } = body

    if (!playerId || !role) {
      return NextResponse.json(
        { error: 'playerId and role are required' },
        { status: 400 }
      )
    }

    // Load existing roles
    const roles = loadPlayerRoles()
    
    // Update the specific player's role and depth chart order
    roles[playerId] = {
      role,
      depthChartOrder: depthChartOrder !== undefined ? depthChartOrder : roles[playerId]?.depthChartOrder
    }
    
    // Save roles
    savePlayerRoles(roles)

    return NextResponse.json({
      success: true,
      message: 'Player role updated successfully'
    })
  } catch (error) {
    console.error('Error saving player role:', error)
    return NextResponse.json(
      { error: 'Failed to save player role' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { roles, depthChartOrders } = body

    // Handle both old format (just roles) and new format (roles with depthChartOrder)
    const rolesToSave: Record<string, { role: string; depthChartOrder?: number }> = {}
    
    if (roles && typeof roles === 'object') {
      // Old format: { playerId: role }
      Object.entries(roles).forEach(([playerId, role]) => {
        rolesToSave[playerId] = {
          role: role as string,
          depthChartOrder: depthChartOrders?.[playerId]
        }
      })
    }

    // Save all roles and depth chart orders
    savePlayerRoles(rolesToSave)

    return NextResponse.json({
      success: true,
      message: 'Player roles and depth chart order updated successfully',
      count: Object.keys(rolesToSave).length
    })
  } catch (error) {
    console.error('Error saving player roles:', error)
    return NextResponse.json(
      { error: 'Failed to save player roles' },
      { status: 500 }
    )
  }
}
