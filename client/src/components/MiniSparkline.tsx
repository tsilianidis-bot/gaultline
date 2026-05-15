/* FAULTLINE — MiniSparkline using recharts */
import { ResponsiveContainer, LineChart, Line, Tooltip, ReferenceLine } from "recharts";
import { RiskLevel } from "@/lib/data";

const riskColors: Record<RiskLevel, string> = {
  critical: '#FF2D55',
  high: '#FF9500',
  elevated: '#FFD700',
  moderate: '#00D4FF',
  low: '#00FF88',
};

interface MiniSparklineProps {
  data: { date: string; value: number }[];
  riskLevel: RiskLevel;
  height?: number;
  showTooltip?: boolean;
}

export default function MiniSparkline({ data, riskLevel, height = 40, showTooltip = false }: MiniSparklineProps) {
  const color = riskColors[riskLevel];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          activeDot={showTooltip ? { r: 3, fill: color, strokeWidth: 0 } : false}
          style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
        />
        {showTooltip && (
          <Tooltip
            contentStyle={{
              background: '#0A0C10',
              border: `1px solid ${color}30`,
              borderRadius: '4px',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10px',
              color: '#F0F4FF',
              padding: '4px 8px',
            }}
            labelStyle={{ color: '#6B7280', fontSize: '9px' }}
            itemStyle={{ color }}
            formatter={(v: number) => [v.toFixed(3), '']}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
