'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getRosterPlayers } from '@/lib/data'
import { Player } from '@/lib/types'

const NavigationBar = () => {
  const pathname = usePathname()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Player[]>([])
  const [showResults, setShowResults] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const navItems = [
    { href: '/team', label: '🏠', icon: true },
  ]

  // Load players for search
  useEffect(() => {
    async function loadPlayers() {
      setLoadingPlayers(true)
      try {
        const result = await getRosterPlayers()
        if (result.data) {
          setPlayers(result.data)
        }
      } catch (error) {
        console.error('Error loading players for search:', error)
      } finally {
        setLoadingPlayers(false)
      }
    }
    loadPlayers()
  }, [])

  // Handle search input
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = players.filter(player =>
      player.name.toLowerCase().includes(query) ||
      (player.number && player.number.toString().includes(query)) ||
      (player.position && player.position.toLowerCase().includes(query))
    ).slice(0, 5) // Limit to 5 results

    setSearchResults(filtered)
    setShowResults(filtered.length > 0)
  }, [searchQuery, players])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handlePlayerSelect = (player: Player) => {
    setSearchQuery('')
    setShowResults(false)
    router.push(`/player-profile?player=${encodeURIComponent(player.name)}`)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchResults.length > 0) {
      handlePlayerSelect(searchResults[0])
    }
  }

  return (
    <nav className="bg-ou-crimson text-white shadow-lg">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-4">
          <div className="flex items-center flex-shrink-0">
            <Link href="/" className="text-xl font-bold whitespace-nowrap">
              OU Football Dashboard
            </Link>
          </div>
          
          {/* Search Bar */}
          <div ref={searchRef} className="flex-1 max-w-md mx-auto relative">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery && searchResults.length > 0 && setShowResults(true)}
                  placeholder="Search players..."
                  className="w-full px-4 py-2 pl-10 pr-4 text-gray-900 bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
            </form>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-auto">
                {searchResults.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handlePlayerSelect(player)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-200 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      {player.headshot ? (
                        <img
                          src={player.headshot}
                          alt={player.name}
                          className="w-10 h-10 rounded-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-ou-crimson text-white flex items-center justify-center font-bold text-sm">
                          {player.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">
                          {player.name}
                          {player.number && (
                            <span className="ml-2 text-sm text-gray-600">#{player.number}</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {player.position}
                          {player.class && ` • ${player.class}`}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center flex-shrink-0">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-lg transition-colors ${
                    isActive
                      ? 'bg-white text-ou-crimson'
                      : 'text-white hover:bg-white hover:bg-opacity-10'
                  }`}
                  style={isActive ? { backgroundColor: '#ffffff', color: '#841617' } : undefined}
                  title="Team Overview"
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default NavigationBar
