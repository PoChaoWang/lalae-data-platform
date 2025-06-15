"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Globe, User, Zap, Users, Search, ChevronDown, BarChart3, TrendingUp, Activity } from "lucide-react"

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  
  return (
    // 使用 <main> 標籤作為唯一的根元素，並將背景色等樣式移到這裡
    <>
      <div className="absolute inset-0 opacity-10">
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

      <section className="relative py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-orange-200 to-orange-400 bg-clip-text text-transparent leading-tight">
              Unlock Your Marketing Data's Full Potential
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed">
              Get a real-time command center for all your connected data.
            </p>
            <Button
              onClick={() => setIsLoggedIn(true)}
              className="bg-orange-500 hover:bg-orange-600 text-black font-bold px-8 py-4 text-lg rounded-lg shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105 relative overflow-hidden group"
            >
              <span className="relative z-10">Get Started Free</span>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Button>
          </div>
        </div>

        {/* Background Data Visualization */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 border border-orange-500/30 rounded-full animate-pulse" />
          <div className="absolute top-1/3 right-1/4 w-24 h-24 border border-orange-500/20 rounded-full animate-ping" />
          <div className="absolute bottom-1/4 left-1/3 w-16 h-16 bg-orange-500/10 rounded-full animate-bounce" />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 relative">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 bg-gradient-to-r from-white to-orange-300 bg-clip-text text-transparent">
            Platform Features
          </h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Connections Card */}
            <div className="bg-gray-800/50 backdrop-blur-sm border border-orange-500/20 rounded-xl p-8 hover:border-orange-500/40 transition-all duration-300 hover:scale-105 group">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center mb-6 group-hover:shadow-lg group-hover:shadow-orange-500/25 transition-all duration-300">
                <Zap className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-orange-400">Connections</h3>
              <p className="text-gray-300 leading-relaxed">
                Seamlessly connect to all your advertising platform APIs with our advanced integration system.
              </p>
            </div>

            {/* Clients Card */}
            <div className="bg-gray-800/50 backdrop-blur-sm border border-orange-500/20 rounded-xl p-8 hover:border-orange-500/40 transition-all duration-300 hover:scale-105 group">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center mb-6 group-hover:shadow-lg group-hover:shadow-orange-500/25 transition-all duration-300">
                <Users className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-orange-400">Clients</h3>
              <p className="text-gray-300 leading-relaxed">
                Effortlessly manage all your diverse client data in one centralized, intelligent platform.
              </p>
            </div>

            {/* Queries Card */}
            <div className="bg-gray-800/50 backdrop-blur-sm border border-orange-500/20 rounded-xl p-8 hover:border-orange-500/40 transition-all duration-300 hover:scale-105 group">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center mb-6 group-hover:shadow-lg group-hover:shadow-orange-500/25 transition-all duration-300">
                <Search className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-orange-400">Queries</h3>
              <p className="text-gray-300 leading-relaxed">
                Query ad data and set up automated, recurring data transfers to any destination you need.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Visualization Showcase */}
      <section className="py-20 px-4 relative">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 bg-gradient-to-r from-white to-orange-300 bg-clip-text text-transparent">
            Real-Time Dashboard
          </h2>

          <div className="max-w-6xl mx-auto">
            <div className="bg-gray-800/30 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-8 relative overflow-hidden">
              {/* Mock Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Metric Cards */}
                <div className="bg-gray-900/50 border border-orange-500/30 rounded-lg p-6 relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-orange-400 font-semibold">Total Revenue</h3>
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-2">$847,392</div>
                  <div className="text-green-400 text-sm">+12.5% from last month</div>
                </div>

                <div className="bg-gray-900/50 border border-orange-500/30 rounded-lg p-6 relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-orange-400 font-semibold">Active Campaigns</h3>
                    <Activity className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-2">1,247</div>
                  <div className="text-green-400 text-sm">+8.2% from last week</div>
                </div>

                <div className="bg-gray-900/50 border border-orange-500/30 rounded-lg p-6 relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-orange-400 font-semibold">Data Points</h3>
                    <BarChart3 className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-2">2.4M</div>
                  <div className="text-green-400 text-sm">+15.7% from yesterday</div>
                </div>
              </div>

              {/* Mock Chart Area */}
              <div className="bg-gray-900/30 border border-orange-500/20 rounded-lg p-6 h-64 flex items-center justify-center relative overflow-hidden">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-pulse" />
                  <p className="text-gray-400">Interactive Data Visualization</p>
                  <p className="text-sm text-gray-500 mt-2">Real-time charts and analytics</p>
                </div>

                {/* Animated Elements */}
                <div className="absolute top-4 left-4 w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                <div
                  className="absolute top-4 right-4 w-2 h-2 bg-orange-500 rounded-full animate-ping"
                  style={{ animationDelay: "1s" }}
                />
                <div
                  className="absolute bottom-4 left-4 w-2 h-2 bg-orange-500 rounded-full animate-ping"
                  style={{ animationDelay: "2s" }}
                />
                <div
                  className="absolute bottom-4 right-4 w-2 h-2 bg-orange-500 rounded-full animate-ping"
                  style={{ animationDelay: "3s" }}
                />
              </div>

              {/* Holographic Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/5 to-transparent animate-pulse" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}