'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NavigationBar from '@/components/NavigationBar'

type DevelopmentSubPage = 'Game Summary' | 'Practice Summary' | 'Training Summary'

export default function PracticeSummaryPage() {
  const router = useRouter()
  const [selectedPage, setSelectedPage] = useState<DevelopmentSubPage>('Practice Summary')

  const handlePageChange = (page: DevelopmentSubPage) => {
    setSelectedPage(page)
    const pageRoutes: Record<DevelopmentSubPage, string> = {
      'Game Summary': '/player-development/game-summary',
      'Practice Summary': '/player-development/practice-summary',
      'Training Summary': '/player-development/training-summary'
    }
    router.push(pageRoutes[page])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-ou-crimson">Practice Summary</h1>
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
          <p className="text-gray-600 mb-6">Practice summary data with catapult and statistical information summarized by date will appear here.</p>
          <div className="text-center py-12 text-gray-500">
            <p>Practice summary content coming soon</p>
            <p className="text-sm mt-2">This page will display practice-by-practice summaries with catapult and statistical data</p>
          </div>
        </div>
      </div>
    </div>
  )
}
