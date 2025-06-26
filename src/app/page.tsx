import Link from "next/link";

export default function Home() {
  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-8 py-6 sm:py-8 md:py-12">
      <div className="flex flex-col items-center justify-center min-h-[50vh] sm:min-h-[60vh] md:min-h-[50vh] text-center">
        <div className="text-4xl sm:text-6xl md:text-7xl mb-4 sm:mb-6 md:mb-8">🍳</div>
        
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 md:mb-6">Recipe Assistant</h1>
        <p className="text-base sm:text-xl md:text-2xl text-muted-foreground mb-6 sm:mb-8 md:mb-10 max-w-sm sm:max-w-md md:max-w-2xl px-2">
          Your AI-powered meal planning companion. Plan meals, get suggestions, and organize your cooking.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 w-full max-w-xs sm:max-w-md md:max-w-4xl">
          <Link
            href="/recipes"
            className="flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 rounded-lg border border-border hover:bg-muted/50 transition-colors min-h-[80px] sm:min-h-[100px] md:min-h-[120px]"
          >
            <span className="text-xl sm:text-2xl md:text-3xl mb-1 sm:mb-2 md:mb-3">📖</span>
            <span className="font-medium text-sm sm:text-base md:text-lg">Recipes</span>
          </Link>
          
          <Link
            href="/assistant"
            className="flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 rounded-lg border border-border hover:bg-muted/50 transition-colors min-h-[80px] sm:min-h-[100px] md:min-h-[120px]"
          >
            <span className="text-xl sm:text-2xl md:text-3xl mb-1 sm:mb-2 md:mb-3">💬</span>
            <span className="font-medium text-sm sm:text-base md:text-lg">Assistant</span>
          </Link>
          
          <Link
            href="/planner"
            className="flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 rounded-lg border border-border hover:bg-muted/50 transition-colors min-h-[80px] sm:min-h-[100px] md:min-h-[120px]"
          >
            <span className="text-xl sm:text-2xl md:text-3xl mb-1 sm:mb-2 md:mb-3">📋</span>
            <span className="font-medium text-sm sm:text-base md:text-lg">Planner</span>
          </Link>
          
          <Link
            href="/groceries"
            className="flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 rounded-lg border border-border hover:bg-muted/50 transition-colors min-h-[80px] sm:min-h-[100px] md:min-h-[120px]"
          >
            <span className="text-xl sm:text-2xl md:text-3xl mb-1 sm:mb-2 md:mb-3">🛒</span>
            <span className="font-medium text-sm sm:text-base md:text-lg">Groceries</span>
          </Link>
        </div>

        <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-6 sm:mt-8 md:mt-10 px-4">
          Start by exploring your recipes or chatting with the AI assistant
        </p>
      </div>
    </div>
  );
}
