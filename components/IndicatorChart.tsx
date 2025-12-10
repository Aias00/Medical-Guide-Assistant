

import React, { useState } from 'react';
import { Indicator, Language, HistoricalValue } from '../types';
import { TrendingUp, Activity, BarChart2 } from 'lucide-react';
import { translations } from '../locales';

interface Props {
  indicator: Indicator;
  globalHistory?: HistoricalValue[];
  lang: Language;
}

const IndicatorChart: React.FC<Props> = ({ indicator, globalHistory, lang }) => {
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const t = translations[lang];

  const { valueNumber, referenceRange, unit, status } = indicator;

  // Prefer global history (cross-report) if available and has sufficient data points (>1)
  // Otherwise fall back to local row history
  let chartData: HistoricalValue[] | null = null;
  let isGlobal = false;

  if (globalHistory && globalHistory.length > 1) {
    chartData = globalHistory;
    isGlobal = true;
  } else if (indicator.history && indicator.history.length > 0 && valueNumber !== undefined) {
     // Local history merge logic
     chartData = [...indicator.history.map(h => ({ ...h, isCurrent: false })), { date: t.current, value: valueNumber, isCurrent: true }];
  }

  // If we have history data, render Trend Chart
  if (chartData && chartData.length > 1) {
    const values = chartData.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const padding = (maxVal - minVal) * 0.2 || (maxVal * 0.1) || 1; 
    const yMin = Math.max(0, minVal - padding);
    const yMax = maxVal + padding;
    
    const width = 300;
    const height = 120;
    const chartPadding = 25;

    const getX = (index: number) => chartPadding + (index / (chartData!.length - 1)) * (width - 2 * chartPadding);
    const getY = (val: number) => height - chartPadding - ((val - yMin) / (yMax - yMin || 1)) * (height - 2 * chartPadding);

    const points = chartData.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');

    return (
      <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
            {isGlobal ? <BarChart2 className="w-3 h-3 text-teal-600" /> : <TrendingUp className="w-3 h-3" />}
            {isGlobal ? t.compareHistory : t.trend} ({unit})
          </div>
          {referenceRange && (
             <span className="text-[10px] text-gray-400">Ref: {referenceRange.min}-{referenceRange.max}</span>
          )}
        </div>
        
        <div className="relative w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-sm">
            {/* Reference Range Band (if available) */}
            {referenceRange && (
              <rect
                x={chartPadding}
                y={getY(referenceRange.max)}
                width={width - 2 * chartPadding}
                height={Math.max(0, getY(referenceRange.min) - getY(referenceRange.max))}
                fill="rgba(20, 184, 166, 0.08)" 
                rx="2"
              />
            )}
            
            {/* Grid Lines */}
            <line x1={chartPadding} y1={getY(minVal)} x2={width - chartPadding} y2={getY(minVal)} stroke="#e5e7eb" strokeDasharray="3 3" />
            <line x1={chartPadding} y1={getY(maxVal)} x2={width - chartPadding} y2={getY(maxVal)} stroke="#e5e7eb" strokeDasharray="3 3" />

            {/* Line */}
            <polyline
              points={points}
              fill="none"
              stroke={isGlobal ? "#0d9488" : "#0f766e"} 
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points */}
            {chartData.map((d, i) => (
              <g key={i} onClick={() => setActivePoint(i === activePoint ? null : i)}>
                <circle
                  cx={getX(i)}
                  cy={getY(d.value)}
                  r={d.isCurrent ? 5 : 3.5}
                  fill={d.isCurrent ? "#0f766e" : "#fff"}
                  stroke="#0f766e"
                  strokeWidth="2"
                  className="cursor-pointer hover:r-6 transition-all"
                />
                
                {/* Value Labels */}
                {(i === 0 || i === chartData!.length - 1 || i === activePoint) && (
                  <text
                    x={getX(i)}
                    y={getY(d.value) - 10}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#374151"
                    fontWeight="bold"
                  >
                    {d.value}
                  </text>
                )}
                
                {/* Date Labels (rotate if many points) */}
                <text
                  x={getX(i)}
                  y={height - 5}
                  textAnchor="middle"
                  fontSize={chartData!.length > 4 ? "8" : "9"}
                  fill="#6b7280"
                >
                  {d.date}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  }

  // Fallback: Range Gauge (if no history)
  if (valueNumber !== undefined && referenceRange) {
    const { min, max } = referenceRange;
    const padding = (max - min) * 0.5;
    const viewMin = Math.min(min - padding, valueNumber < min ? valueNumber - padding * 0.2 : min - padding);
    const viewMax = Math.max(max + padding, valueNumber > max ? valueNumber + padding * 0.2 : max + padding);
    
    if (viewMax <= viewMin) return null;

    const width = 300;
    const height = 50;
    const barHeight = 8;
    const chartY = height / 2;
    const getX = (val: number) => ((val - viewMin) / (viewMax - viewMin)) * width;
    const dotColor = (status === 'HIGH' || status === 'CRITICAL') ? '#ef4444' : (status === 'LOW') ? '#f59e0b' : '#0f766e';

    return (
      <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
         <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-500 uppercase">
          <Activity className="w-3 h-3" />
          {t.referenceRange} ({unit})
        </div>
        <div className="w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            <rect x="0" y={chartY - barHeight/2} width={width} height={barHeight} fill="#e5e7eb" rx={barHeight/2} />
            <rect x={getX(min)} y={chartY - barHeight/2} width={getX(max) - getX(min)} height={barHeight} fill="#ccfbf1" rx={barHeight/2} />
            <rect x={getX(min)} y={chartY - barHeight/2} width={Math.max(2, getX(max) - getX(min))} height={barHeight} fill="none" stroke="#99f6e4" strokeWidth="1" rx={barHeight/2} />
            <text x={getX(min)} y={chartY + 20} textAnchor="middle" fontSize="10" fill="#6b7280">{min}</text>
            <text x={getX(max)} y={chartY + 20} textAnchor="middle" fontSize="10" fill="#6b7280">{max}</text>
            <circle cx={getX(valueNumber)} cy={chartY} r="6" fill={dotColor} stroke="#fff" strokeWidth="2" />
            <text x={getX(valueNumber)} y={chartY - 12} textAnchor="middle" fontSize="11" fontWeight="bold" fill={dotColor}>{valueNumber}</text>
          </svg>
        </div>
      </div>
    );
  }

  return null;
};

export default IndicatorChart;
