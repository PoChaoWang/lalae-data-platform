"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Share2, Plus, User, Users, Building2, ExternalLink, Settings, Shield } from "lucide-react"

// Mock user data
const mockUser = {
  id: 1,
  name: "Sarah Chen",
  email: "sarah.chen@lalae.com",
  avatar: null,
  joinedAt: "2023-06-15",
  lastActive: "2024-01-20T14:30:00Z",
  ownedClients: [
    { id: 1, name: "TechCorp Solutions", status: "Active", lastSync: "2024-01-20T14:00:00Z" },
    { id: 2, name: "Digital Marketing Pro", status: "Active", lastSync: "2024-01-20T13:45:00Z" },
    { id: 3, name: "E-commerce Giants", status: "Inactive", lastSync: "2024-01-18T10:22:00Z" },
    { id: 4, name: "StartupX Analytics", status: "Active", lastSync: "2024-01-20T12:30:00Z" },
    { id: 5, name: "Global Retail Chain", status: "Active", lastSync: "2024-01-20T11:15:00Z" },
  ],
  sharedClients: [
    { id: 1, name: "TechCorp Solutions", status: "Active", lastSync: "2024-01-20T14:00:00Z" },
    { id: 2, name: "Digital Marketing Pro", status: "Active", lastSync: "2024-01-20T13:45:00Z" },
    { id: 3, name: "E-commerce Giants", status: "Inactive", lastSync: "2024-01-18T10:22:00Z" },
    { id: 4, name: "StartupX Analytics", status: "Active", lastSync: "2024-01-20T12:30:00Z" },
    { id: 5, name: "Global Retail Chain", status: "Active", lastSync: "2024-01-20T11:15:00Z" },
  ],
}

export default function UserProfilePage() {
  const [user] = useState(mockUser)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatLastActive = (dateString: string) => {
    const now = new Date()
    const lastActive = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60))

    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hours ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)} days ago`
    }
  }

  const getGroupColor = (color: string) => {
    const colors = {
      orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      green: "bg-green-500/20 text-green-400 border-green-500/30",
      purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    }
    return colors[color as keyof typeof colors] || colors.orange
  }

  const getStatusColor = (status: string) => {
    return status === "Active" ? "text-green-400" : "text-gray-400"
  }

  const handleShareProfile = () => {
    console.log("Sharing profile...")
  }

  const handleCreateGroup = () => {
    console.log("Creating new group...")
  }

  const handleClientClick = (clientId: number) => {
    console.log("Navigating to client:", clientId)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,165,0,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,165,0,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 border border-orange-500/10 rounded-full animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-24 h-24 border border-orange-500/5 rounded-full animate-ping" />
        <div className="absolute bottom-1/4 left-1/3 w-16 h-16 bg-orange-500/5 rounded-full animate-bounce" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-orange-200 to-orange-400 bg-clip-text text-transparent mb-2">
            User Profile
          </h1>
          <p className="text-gray-400">Manage your account settings and information</p>
        </div>

        {/* Main Profile Card */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-8 mb-8 shadow-2xl shadow-orange-500/10 relative overflow-hidden">
          {/* Holographic Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/5 to-transparent animate-pulse pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-start space-x-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-2xl shadow-orange-500/25 relative overflow-hidden">
                  {user.avatar ? (
                    <img
                      src={user.avatar || "/placeholder.svg"}
                      alt={user.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <User className="w-12 h-12 text-black" />
                  )}
                  {/* Glowing border effect */}
                  <div className="absolute inset-0 rounded-full border-2 border-orange-400/50 animate-pulse" />
                </div>
                {/* Online indicator */}
                <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-gray-900 flex items-center justify-center">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-orange-300 bg-clip-text text-transparent">
                      {user.name}
                    </h2>
                    <p className="text-gray-400 mt-1">{user.email}</p>
                  </div>

                  <Button
                    onClick={handleShareProfile}
                    variant="outline"
                    className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/50 transition-all duration-300"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Profile
                  </Button>
                </div>

                {/* User Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  <div className="bg-gray-900/30 border border-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <User className="w-4 h-4 text-orange-400" />
                      <span className="text-gray-400 text-sm">Joined</span>
                    </div>
                    <span className="text-white font-medium">{formatDate(user.joinedAt)}</span>
                  </div>

                  <div className="bg-gray-900/30 border border-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-gray-400 text-sm">Last Active</span>
                    </div>
                    <span className="text-white font-medium">{formatLastActive(user.lastActive)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
       
        {/* Owned Clients Section */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-8 shadow-2xl shadow-orange-500/10 relative overflow-hidden">
          {/* Holographic Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/5 to-transparent animate-pulse pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-orange-400 flex items-center space-x-2">
                <Building2 className="w-6 h-6" />
                <span>Owned Clients</span>
              </h3>

              <div className="text-sm text-gray-400">
                {user.ownedClients.length} client{user.ownedClients.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div className="space-y-1">
              {user.ownedClients.map((client, index) => (
                <div
                  key={client.id}
                  onClick={() => handleClientClick(client.id)}
                  className="group flex items-center justify-between p-4 rounded-lg border border-gray-700/30 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all duration-300 cursor-pointer"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center group-hover:bg-orange-500/30 transition-all duration-300">
                      <Building2 className="w-5 h-5 text-orange-400" />
                    </div>

                    <div>
                      <div className="flex items-center space-x-3">
                        <span className="text-white font-medium group-hover:text-orange-200 transition-colors duration-300">
                          {client.name}
                        </span>
                        <span className={`text-sm ${getStatusColor(client.status)}`}>
                          <div className="flex items-center space-x-1">
                            <div
                              className={`w-2 h-2 rounded-full ${client.status === "Active" ? "bg-green-400 animate-pulse" : "bg-gray-500"}`}
                            />
                            <span>{client.status}</span>
                          </div>
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">Last sync: {formatLastActive(client.lastSync)}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ExternalLink className="w-4 h-4 text-orange-400" />
                  </div>
                </div>
              ))}
            </div>

            {user.ownedClients.length === 0 && (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No clients owned</p>
              </div>
            )}
          </div>
        </div>

        {/* Shared Clients Section */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-8 shadow-2xl shadow-orange-500/10 relative overflow-hidden">
          {/* Holographic Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/5 to-transparent animate-pulse pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-orange-400 flex items-center space-x-2">
                <Building2 className="w-6 h-6" />
                <span>Shared Clients</span>
              </h3>

              <div className="text-sm text-gray-400">
                {user.sharedClients.length} client{user.sharedClients.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div className="space-y-1">
              {user.sharedClients.map((client, index) => (
                <div
                  key={client.id}
                  onClick={() => handleClientClick(client.id)}
                  className="group flex items-center justify-between p-4 rounded-lg border border-gray-700/30 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all duration-300 cursor-pointer"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center group-hover:bg-orange-500/30 transition-all duration-300">
                      <Building2 className="w-5 h-5 text-orange-400" />
                    </div>

                    <div>
                      <div className="flex items-center space-x-3">
                        <span className="text-white font-medium group-hover:text-orange-200 transition-colors duration-300">
                          {client.name}
                        </span>
                        <span className={`text-sm ${getStatusColor(client.status)}`}>
                          <div className="flex items-center space-x-1">
                            <div
                              className={`w-2 h-2 rounded-full ${client.status === "Active" ? "bg-green-400 animate-pulse" : "bg-gray-500"}`}
                            />
                            <span>{client.status}</span>
                          </div>
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">Last sync: {formatLastActive(client.lastSync)}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ExternalLink className="w-4 h-4 text-orange-400" />
                  </div>
                </div>
              ))}
            </div>

            {user.ownedClients.length === 0 && (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No clients owned</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/50 transition-all duration-300"
          >
            <Settings className="w-4 h-4 mr-2" />
            Account Settings
          </Button>
        </div>
      </div>
    </div>
  )
}
