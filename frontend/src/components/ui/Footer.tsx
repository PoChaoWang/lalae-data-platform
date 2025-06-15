// components/ui/Navbar.tsx

'use client';

export default function Footer() {
    

    return (
        <footer className="py-12 px-4 border-t border-orange-500/20 bg-gray-900/50">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center mb-4 md:mb-0">
              <h3 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                LaLaE
              </h3>
              <div className="ml-2 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
            </div>

            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <span>&copy; 2025 LaLaE. All rights reserved.</span>
              <a href="#about" className="hover:text-orange-400 transition-colors duration-300">
                About
              </a>
              <a href="#social" className="hover:text-orange-400 transition-colors duration-300">
                Social
              </a>
            </div>
          </div>
        </div>
      </footer>
    );
}