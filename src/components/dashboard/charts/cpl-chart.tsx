"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CplDataPoint {
  date: string;
  [campaignName: string]: string | number;
}

interface CplChartProps {
  data: CplDataPoint[];
  campaignNames: string[];
  threshold: number;
}

const COLORS = ["#cda64e", "#22c55e", "#3b82f6", "#f97316", "#a855f7"];

export function CplChart({ data, campaignNames, threshold }: CplChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CPL por Campaña</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            No hay datos de CPL disponibles.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">CPL por Campaña (30 días)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 15% 18%)" />
            <XAxis
              dataKey="date"
              stroke="hsl(220 10% 55%)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(220 10% 55%)"
              fontSize={12}
              tickLine={false}
              tickFormatter={(v: number) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(229 23% 9.2%)",
                border: "1px solid hsl(228 15% 18%)",
                borderRadius: "8px",
                color: "hsl(210 20% 95%)",
              }}
              formatter={(value: number) => [
                `$${value.toFixed(2)}`,
                "CPL",
              ]}
            />
            <Legend />
            <ReferenceLine
              y={threshold}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{
                value: `Threshold $${threshold}`,
                position: "right",
                fill: "#ef4444",
                fontSize: 11,
              }}
            />
            {campaignNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
