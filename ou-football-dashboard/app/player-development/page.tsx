'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import NavigationBar from '@/components/NavigationBar'

type DevelopmentSubPage = 'Game Summary' | 'Practice Summary' | 'Training Summary'

export default function PlayerDevelopmentPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [selectedPage, setSelectedPage] = useState<DevelopmentSubPage>('Game Summary')

  // Determine current page from pathname
  useEffect(() => {
    if (pathname?.includes('practice-summary')) {
      setSelectedPage('Practice Summary')
    } else if (pathname?.includes('training-summary')) {
      setSelectedPage('Training Summary')
    } else if (pathname?.includes('game-summary')) {
      setSelectedPage('Game Summary')
    }
  }, [pathname])

  const handlePageChange = (page: DevelopmentSubPage) => {
    setSelectedPage(page)
    const pageRoutes: Record<DevelopmentSubPage, string> = {
      'Game Summary': '/player-development/game-summary',
      'Practice Summary': '/player-development/practice-summary',
      'Training Summary': '/player-development/training-summary'
    }
    router.push(pageRoutes[page])
  }

  // Redirect to game-summary by default
  useEffect(() => {
    if (pathname === '/player-development') {
      router.push('/player-development/game-summary')
    }
  }, [pathname, router])

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-ou-crimson">Player Development</h1>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Select Page:</label>
            <select
              value={selectedPage}
              onChange={(e) => handlePageChange(e.target.value as DevelopmentSubPage)}
              className="px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-900 hover:border-ou-crimson focus:outline-none focus:border-ou-crimson focus:ring-2 focus:ring-ou-crimson focus:ring-opacity-20"
            >
              <option value="Game Summary">Game Summary</option>
              <option value="Practice Summary">Practice Summary</option>
              <option value="Training Summary">Training Summary</option>
            </select>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-600">Select a page from the dropdown above to view development summaries.</p>
        </div>
      </div>
    </div>
  )
}
