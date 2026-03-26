"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TrafficChartProps {
  data: Array<{ date: string; sessions: number; users?: number }>;
  period: string;
}

export function TrafficChart({ data, period }: TrafficChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tráfico Web</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            Conecta Google Analytics para ver tráfico web.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Tráfico Web ({period})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="sessionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#cda64e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#cda64e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 15% 18%)" />
            <XAxis
              dataKey="date"
              stroke="hsl(220 10% 55%)"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(220 10% 55%)"
              fontSize={11}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(229 23% 9.2%)",
                border: "1px solid hsl(228 15% 18%)",
                borderRadius: "8px",
                color: "hsl(210 20% 95%)",
              }}
            />
            <Area
              type="monotone"
              dataKey="sessions"
              name="Sesiones"
              stroke="#cda64e"
              strokeWidth={2}
              fill="url(#sessionGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
