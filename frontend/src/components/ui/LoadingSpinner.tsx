// /components/ui/LoadingSpinner.tsx

export default function LoadingSpinner() {
    return (
      <div className="relative flex h-28 w-28 items-center justify-center">
        {/* 外部的虛線圓環，使用 CSS animation 來反向旋轉 */}
        <style jsx>{`
          @keyframes spin-reverse {
            from {
              transform: rotate(360deg);
            }
            to {
              transform: rotate(0deg);
            }
          }
          .animate-spin-reverse {
            animation: spin-reverse 2s linear infinite;
          }
        `}</style>
        
        <div className="absolute h-20 w-20 animate-spin rounded-full border-4 border-solid border-orange-500 border-t-transparent duration-700"></div>
        
        <div className="absolute h-28 w-28 rounded-full border-2 border-dashed border-orange-400/50 animate-spin-reverse"></div>
        
      </div>
    );
  }