

import React, { useState } from 'react';
import { Indicator, Language } from '../types';
import { TrendingUp, Activity } from 'lucide-react';
import { translations } from '../locales';

interface Props {
  indicator: Indicator;
  lang: Language;
}

const IndicatorChart: React.FC<Props> = ({ indicator, lang }) => {
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const t = translations[lang];

  const { valueNumber, referenceRange, history, unit, status } = indicator;

  // Decide what to render:
  // 1. History Chart (Trend) if history exists and has at least 1 item
  // 2. Range Chart (Gauge) if referenceRange exists and valueNumber exists
  // 3. Null

  // Prepare History Data (merge current value into history for the plot)
  const historyData = history && history.length > 0 && valueNumber !== undefined
    ? [...history.map(h => ({ ...h, isCurrent: false })), { date: t.current, value: valueNumber, isCurrent: true }]
    : null;

  if (historyData) {
    // --- RENDER TREND CHART ---
    const values = historyData.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const padding = (maxVal - minVal) * 0.2 || (maxVal * 0.1); // Add breathing room
    const yMin = Math.max(0, minVal - padding);
    const yMax = maxVal + padding;
    
    const width = 300;
    const height = 100;
    const chartPadding = 20;

    const getX = (index: number) => chartPadding + (index / (historyData.length - 1)) * (width - 2 * chartPadding);
    const getY = (val: number) => height - chartPadding - ((val - yMin) / (yMax - yMin || 1)) * (height - 2 * chartPadding);

    const points = historyData.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');

    return (
      <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-500 uppercase">
          <TrendingUp className="w-3 h-3" />
          {t.trend} ({unit})
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
                fill="rgba(20, 184, 166, 0.1)" // Teal tint
                rx="4"
              />
            )}
            
            {/* Grid Lines */}
            <line x1={chartPadding} y1={getY(minVal)} x2={width - chartPadding} y2={getY(minVal)} stroke="#e5e7eb" strokeDasharray="3 3" />
            <line x1={chartPadding} y1={getY(maxVal)} x2={width - chartPadding} y2={getY(maxVal)} stroke="#e5e7eb" strokeDasharray="3 3" />

            {/* Line */}
            <polyline
              points={points}
              fill="none"
              stroke="#0f766e" // Teal-700
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points */}
            {historyData.map((d, i) => (
              <g key={i} onClick={() => setActivePoint(i === activePoint ? null : i)}>
                <circle
                  cx={getX(i)}
                  cy={getY(d.value)}
                  r={d.isCurrent ? 5 : 4}
                  fill={d.isCurrent ? "#0f766e" : "#fff"}
                  stroke="#0f766e"
                  strokeWidth="2"
                  className="cursor-pointer hover:r-6 transition-all"
                />
                {/* Labels (always show start, end, and active) */}
                {(i === 0 || i === historyData.length - 1 || i === activePoint) && (
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
                <text
                  x={getX(i)}
                  y={height - 2}
                  textAnchor="middle"
                  fontSize="9"
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

  if (valueNumber !== undefined && referenceRange) {
    // --- RENDER RANGE CHART (GAUGE) ---
    const { min, max } = referenceRange;
    
    // Define the view window. We want to show a bit outside the range if the value is abnormal.
    const padding = (max - min) * 0.5;
    const viewMin = Math.min(min - padding, valueNumber < min ? valueNumber - padding * 0.2 : min - padding);
    const viewMax = Math.max(max + padding, valueNumber > max ? valueNumber + padding * 0.2 : max + padding);
    
    // Safety check for invalid range
    if (viewMax <= viewMin) return null;

    const width = 300;
    const height = 50;
    const barHeight = 8;
    const chartY = height / 2;

    const getX = (val: number) => ((val - viewMin) / (viewMax - viewMin)) * width;

    // Determine status color for the dot
    const dotColor = (status === 'HIGH' || status === 'CRITICAL') ? '#ef4444' // Red
      : (status === 'LOW') ? '#f59e0b' // Amber/Orange for Low usually
      : '#0f766e'; // Teal for normal

    return (
      <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
         <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-500 uppercase">
          <Activity className="w-3 h-3" />
          {t.referenceRange} ({unit})
        </div>
        <div className="w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            {/* Background Track */}
            <rect x="0" y={chartY - barHeight/2} width={width} height={barHeight} fill="#e5e7eb" rx={barHeight/2} />
            
            {/* Reference Range Bar (Normal Zone) */}
            <rect 
              x={getX(min)} 
              y={chartY - barHeight/2} 
              width={getX(max) - getX(min)} 
              height={barHeight} 
              fill="#ccfbf1" // Teal-100
              rx={barHeight/2}
            />
            {/* Borders for reference range */}
             <rect 
              x={getX(min)} 
              y={chartY - barHeight/2} 
              width={Math.max(2, getX(max) - getX(min))} 
              height={barHeight} 
              fill="none"
              stroke="#99f6e4" // Teal-200
              strokeWidth="1"
              rx={barHeight/2}
            />

            {/* Min Label */}
            <text x={getX(min)} y={chartY + 20} textAnchor="middle" fontSize="10" fill="#6b7280">{min}</text>
             {/* Max Label */}
            <text x={getX(max)} y={chartY + 20} textAnchor="middle" fontSize="10" fill="#6b7280">{max}</text>

            {/* Current Value Marker */}
            <circle cx={getX(valueNumber)} cy={chartY} r="6" fill={dotColor} stroke="#fff" strokeWidth="2" />
            
            {/* Current Value Label */}
            <text 
              x={getX(valueNumber)} 
              y={chartY - 12} 
              textAnchor="middle" 
              fontSize="11" 
              fontWeight="bold" 
              fill={dotColor}
            >
              {valueNumber}
            </text>
          </svg>
        </div>
      </div>
    );
  }

  return null;
};

export default IndicatorChart;