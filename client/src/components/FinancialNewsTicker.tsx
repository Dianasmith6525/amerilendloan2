import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Newspaper, ExternalLink } from "lucide-react";

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  category: "market" | "economy" | "finance" | "crypto" | "policy";
  sentiment: "positive" | "negative" | "neutral";
  timestamp: Date;
  url?: string;
}

interface MarketData {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePercent: string;
  isPositive: boolean;
}

// Simulated live financial news headlines that rotate
const newsPool: Omit<NewsItem, "id" | "timestamp">[] = [
  { headline: "Federal Reserve Holds Interest Rates Steady at 4.25%-4.50%", source: "Reuters", category: "policy", sentiment: "neutral" },
  { headline: "S&P 500 Reaches New All-Time High Amid Strong Earnings Season", source: "Bloomberg", category: "market", sentiment: "positive" },
  { headline: "Consumer Confidence Index Rises to 14-Month High", source: "CNBC", category: "economy", sentiment: "positive" },
  { headline: "Average 30-Year Mortgage Rate Falls Below 6.5%", source: "Bankrate", category: "finance", sentiment: "positive" },
  { headline: "U.S. Personal Savings Rate Climbs to 5.1% in Latest Report", source: "Bureau of Economic Analysis", category: "economy", sentiment: "positive" },
  { headline: "New Home Sales Surge 8% as Builders Offer Incentives", source: "NAR", category: "finance", sentiment: "positive" },
  { headline: "Credit Card Delinquencies Edge Higher Among Young Borrowers", source: "Federal Reserve Bank of NY", category: "finance", sentiment: "negative" },
  { headline: "Small Business Optimism Index Hits Highest Level Since 2020", source: "NFIB", category: "economy", sentiment: "positive" },
  { headline: "Treasury Yields Dip as Inflation Data Comes in Below Forecast", source: "MarketWatch", category: "market", sentiment: "positive" },
  { headline: "Student Loan Repayment Restart Impacts 28 Million Borrowers", source: "Department of Education", category: "policy", sentiment: "negative" },
  { headline: "Tech Sector Leads Market Gains with AI Investment Surge", source: "WSJ", category: "market", sentiment: "positive" },
  { headline: "Consumer Spending Rises 0.4% in January, Exceeding Forecasts", source: "Commerce Department", category: "economy", sentiment: "positive" },
  { headline: "FDIC Reports Bank Profits Remained Stable in Q4 2025", source: "FDIC", category: "finance", sentiment: "neutral" },
  { headline: "Auto Loan Rates Drop to 18-Month Low at Major Lenders", source: "Bankrate", category: "finance", sentiment: "positive" },
  { headline: "Unemployment Claims Fall to 210,000, Near Historic Lows", source: "DOL", category: "economy", sentiment: "positive" },
  { headline: "Personal Loan Demand Up 12% as Consumers Seek Debt Consolidation", source: "TransUnion", category: "finance", sentiment: "neutral" },
  { headline: "Inflation Cools to 2.4% Year-Over-Year in Latest CPI Report", source: "BLS", category: "economy", sentiment: "positive" },
  { headline: "Housing Market Shows Signs of Recovery with 5% Price Growth", source: "CoreLogic", category: "finance", sentiment: "positive" },
  { headline: "Wage Growth Outpaces Inflation for Fifth Consecutive Month", source: "BLS", category: "economy", sentiment: "positive" },
  { headline: "CFPB Issues New Rules on Late Fees, Capping Charges at $8", source: "CFPB", category: "policy", sentiment: "positive" },
  { headline: "Bitcoin Surpasses $95,000 as Institutional Adoption Accelerates", source: "CoinDesk", category: "crypto", sentiment: "positive" },
  { headline: "Commercial Real Estate Vacancy Rates Stabilize in Major Cities", source: "CBRE", category: "finance", sentiment: "neutral" },
  { headline: "Average Credit Score in U.S. Reaches Record 718", source: "Experian", category: "finance", sentiment: "positive" },
  { headline: "GDP Growth Revised Up to 3.1% for Q4 2025", source: "BEA", category: "economy", sentiment: "positive" },
];

// Simulated market data
const marketDataPool: MarketData[] = [
  { symbol: "DJI", name: "Dow Jones", price: "44,253.48", change: "+198.73", changePercent: "+0.45%", isPositive: true },
  { symbol: "SPX", name: "S&P 500", price: "6,078.32", change: "+24.56", changePercent: "+0.41%", isPositive: true },
  { symbol: "IXIC", name: "Nasdaq", price: "19,847.56", change: "+112.34", changePercent: "+0.57%", isPositive: true },
  { symbol: "TNX", name: "10Y Treasury", price: "4.28%", change: "-0.03", changePercent: "-0.70%", isPositive: false },
  { symbol: "BTC", name: "Bitcoin", price: "$95,432", change: "+1,247", changePercent: "+1.32%", isPositive: true },
  { symbol: "GOLD", name: "Gold", price: "$2,934.20", change: "+18.50", changePercent: "+0.63%", isPositive: true },
];

function generateNews(count: number): NewsItem[] {
  const shuffled = [...newsPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((item, i) => ({
    ...item,
    id: `news-${Date.now()}-${i}`,
    timestamp: new Date(Date.now() - Math.random() * 3600000), // Random time within last hour
  }));
}

function randomizeMarketData(): MarketData[] {
  return marketDataPool.map((stock) => {
    // Slightly randomize the change values
    const variance = (Math.random() - 0.5) * 0.2;
    const baseChange = parseFloat(stock.change.replace(/[+$,]/g, ""));
    const newChange = baseChange + baseChange * variance;
    const isPositive = newChange >= 0;
    const prefix = isPositive ? "+" : "";

    return {
      ...stock,
      change: stock.symbol === "BTC" || stock.symbol === "GOLD"
        ? `${prefix}${Math.abs(newChange).toFixed(0)}`
        : stock.symbol === "TNX"
          ? `${prefix}${newChange.toFixed(2)}`
          : `${prefix}${Math.abs(newChange).toFixed(2)}`,
      isPositive,
    };
  });
}

export default function FinancialNewsTicker() {
  const [news, setNews] = useState<NewsItem[]>(() => generateNews(6));
  const [marketData, setMarketData] = useState<MarketData[]>(randomizeMarketData);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = useCallback(() => {
    setIsRefreshing(true);
    // Simulate a brief loading state
    setTimeout(() => {
      setNews(generateNews(6));
      setMarketData(randomizeMarketData());
      setLastUpdated(new Date());
      setIsRefreshing(false);
    }, 300);
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const getTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes === 1) return "1 min ago";
    return `${minutes} min ago`;
  };

  const getCategoryColor = (category: NewsItem["category"]) => {
    switch (category) {
      case "market": return "bg-blue-100 text-blue-700";
      case "economy": return "bg-green-100 text-green-700";
      case "finance": return "bg-purple-100 text-purple-700";
      case "crypto": return "bg-orange-100 text-orange-700";
      case "policy": return "bg-red-100 text-red-700";
    }
  };

  const getSentimentIcon = (sentiment: NewsItem["sentiment"]) => {
    switch (sentiment) {
      case "positive": return <TrendingUp className="w-4 h-4 text-green-500" />;
      case "negative": return <TrendingDown className="w-4 h-4 text-red-500" />;
      case "neutral": return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Market Ticker Bar */}
      <div className="bg-[#0A2540] rounded-2xl p-4 overflow-hidden">
        <div className="flex items-center gap-3 mb-3">
          <TrendingUp className="w-4 h-4 text-[#C9A227]" />
          <span className="text-xs font-bold text-[#C9A227] uppercase tracking-wider">Live Market Data</span>
          <span className="text-xs text-gray-400 ml-auto">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
          {marketData.map((stock) => (
            <div
              key={stock.symbol}
              className="flex-shrink-0 bg-white/5 rounded-xl px-4 py-2.5 min-w-[140px]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white">{stock.symbol}</span>
                <span className="text-xs text-gray-400">{stock.name}</span>
              </div>
              <div className="text-sm font-bold text-white mt-1">{stock.price}</div>
              <div
                className={`text-xs font-medium mt-0.5 ${
                  stock.isPositive ? "text-green-400" : "text-red-400"
                }`}
              >
                {stock.change} ({stock.changePercent})
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* News Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Newspaper className="w-5 h-5 text-[#0A2540]" />
          <h3 className="text-xl font-bold text-[#0A2540]">Latest Financial News</h3>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
        </div>
        <button
          onClick={refreshData}
          disabled={isRefreshing}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0A2540] transition-colors disabled:opacity-50"
          aria-label="Refresh news"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* News Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {news.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getCategoryColor(item.category)}`}
                  >
                    {item.category}
                  </span>
                  {getSentimentIcon(item.sentiment)}
                </div>
                <h4 className="text-sm font-semibold text-[#0A2540] leading-snug group-hover:text-[#C9A227] transition-colors">
                  {item.headline}
                </h4>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>{item.source}</span>
                  <span>•</span>
                  <span>{getTimeAgo(item.timestamp)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 text-center">
        Market data and news are simulated for educational purposes. Not financial advice.
        Auto-refreshes every 30 seconds.
      </p>
    </div>
  );
}
