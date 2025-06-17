// components/CyberpunkBackground.tsx

"use client"

import { useState, useEffect } from "react"

// 定義一個介面來描述建築物的屬性
interface Building {
  id: number;
  width: number;
  height: number;
  windows: {
    id: number;
    left: number;
    top: number;
    color: string;
  }[];
}

// 產生隨機顏色的輔助函式
const getRandomWindowColor = () => {
  const rand = Math.random();
  if (rand > 0.7) return "bg-orange-400";
  if (rand > 0.5) return "bg-blue-400";
  return "bg-gray-600";
};

export default function CyberpunkBackground() {
  const [isMounted, setIsMounted] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);

  useEffect(() => {
    setIsMounted(true);
  
    const generateBuildings = () => {
      return Array.from({ length: 20 }).map((_, i) => ({
        id: i,
        width: Math.random() * 40 + 20,
        height: Math.random() * 120 + 60,
        windows: Array.from({ length: Math.floor(Math.random() * 8) + 2 }).map((_, j) => ({
          id: j,
          left: Math.random() * 60 + 10,
          top: Math.random() * 80 + 10,
          color: getRandomWindowColor(),
        })),
      }));
    };
  
    const updateWindowColors = () => {
      setBuildings((current) =>
        current.map((building) => ({
          ...building,
          windows: building.windows.map((window) => ({
            ...window,
            color: getRandomWindowColor(),
          })),
        }))
      );
    };
  
    // 初始化建築
    setBuildings(generateBuildings());
  
    // 設定每 2 秒自動更新
    const intervalId = setInterval(updateWindowColors, 2000);
  
    // 加入鍵盤事件
    const handleKeyDown = () => {
      updateWindowColors(); // 每次按鍵都重新設定顏色
    };
    window.addEventListener("keydown", handleKeyDown);
  
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);


  // 如果元件還沒在客戶端掛載，就不要渲染任何東西，避免不匹配
  if (!isMounted) {
    return null;
  }

  return (
    <div className="absolute inset-0">
      {/* Digital Grid Pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,165,0,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,165,0,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "100px 100px",
        }}
      />

      {/* Animated Cityscape Silhouette */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-gray-900 via-gray-800 to-transparent">
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/50 to-transparent" />
        {/* Building Silhouettes */}
        <div className="absolute bottom-0 left-0 w-full h-full flex items-end justify-center space-x-2 opacity-60">
          {buildings.map((building) => (
            <div
              key={building.id}
              className="bg-gray-800 relative"
              style={{
                width: `${building.width}px`,
                height: `${building.height}px`,
              }}
            >
              {/* Random windows */}
              {building.windows.map((window) => (
                <div
                  key={window.id}
                  className={`absolute w-2 h-2 ${window.color}`}
                  style={{
                    left: `${window.left}%`,
                    top: `${window.top}%`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Floating Neon Elements */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 border border-orange-500/30 rounded-full animate-pulse" />
          <div className="absolute top-1/3 right-1/4 w-24 h-24 border border-blue-500/20 rounded-full animate-ping" />
          <div className="absolute bottom-1/3 left-1/3 w-16 h-16 bg-orange-500/10 rounded-full animate-bounce" />
          <div className="absolute top-1/2 right-1/3 w-20 h-20 border border-purple-500/20 rounded-full animate-pulse" />
      </div>

      {/* Scanning Lines Effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent animate-pulse" />
        <div
          className="absolute top-0 left-0 right-0 h-0.5 bg-orange-500/30 animate-pulse"
          style={{
            animation: "scan 4s linear infinite",
          }}
        />
      </div>
    </div>
  );
}