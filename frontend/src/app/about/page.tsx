// frontend/src/app/(auth)/about/page.tsx

"use client"

import type React from "react"
import Link from "next/link"
import CyberpunkBackground from "@/components/CyberpunkBackground";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden flex pt-12 justify-center">
      <CyberpunkBackground />

      {/* About Content Card */}
      <div className="relative z-10 w-full max-w-2xl mx-4">
        <div className="bg-gray-800/20 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-8 shadow-2xl shadow-orange-500/20 relative overflow-hidden">
          {/* Holographic Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/10 to-transparent animate-pulse pointer-events-none" />

          {/* Glowing Border Animation */}
          <div className="absolute inset-0 rounded-2xl border border-orange-500/50 animate-pulse" />

          <div className="relative z-10">
            {/* Logo and Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                  LaLaE
                </h1>
                <div className="ml-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-orange-300 bg-clip-text text-transparent mb-2">
                Our Story
              </h2>
              <p className="text-gray-400">The journey behind LaLaE</p>
            </div>

            {/* About Content */}
            <div className="space-y-6 text-gray-300 leading-relaxed text-lg">
              <p>
                My first job was at a digital marketing agency, where I spent countless hours each week creating reports—downloading data, cleaning it up, copying, and pasting. It was repetitive, mechanical work that made me constantly wonder: is there a way to automate this?
              </p>
              <p>
                I’ve always wanted to build a tool that could free people from the burden of these routine tasks. But back then, I had no technical background beyond marketing. I had heard of APIs, but they felt abstract and out of reach.
              </p>
              <p>
                That changed when I joined another agency that had its own data management platform. It was a turning point—it helped me see what I was missing and where I needed to grow. Around the same time, the rise of AI became a powerful learning companion, helping me grasp new technologies faster than I ever thought possible.
              </p>
              <p>
                I can’t say I’m an expert, but I finally found a direction. And that’s when I started building my own data management platform: <span className="font-bold text-orange-400">LaLaE</span>.
              </p>
              <p>
                In Taiwanese, <span className="font-bold text-orange-400">LaLaE</span> means “to stir” or “to mix.” In today’s world, surrounded by numbers and data, we’re constantly stirring information to reach our goals. Whenever I analyze data, I always visualize myself stirring numbers in my mind—and that image inspired the name.
              </p>
              <p>
                <span className="font-bold text-orange-400">LaLaE</span> is far from perfect, but it’s something I’ve always dreamed of creating. There are plenty of powerful data tools out there, but nothing compares to the excitement and joy of building something of your own. I hope <span className="font-bold text-orange-400">LaLaE</span> continues to grow, and maybe one day, it can help more people stir their data with ease—and uncover the insights hidden within.
              </p>
            </div>

            {/* Back to Home Link */}
            <div className="text-center mt-12 pt-6 border-t border-gray-700/50">
              <p className="text-gray-400">
                Ready to stir your data?{" "}
                <Link href="/" className="text-orange-400 hover:text-orange-300 transition-colors duration-300 font-semibold relative group">
                  Go to Homepage
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300" />
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Additional Floating Elements */}
        <div className="absolute -top-4 -right-4 w-8 h-8 border border-orange-500/30 rounded-full animate-pulse" />
        <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-orange-500/20 rounded-full animate-bounce" />
      </div>
    </div>
  )
}