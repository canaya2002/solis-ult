"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LeadsChartProps {
  data: Array<{
    date: string;
    meta?: number;
    organic?: number;
    tiktok?: number;
    youtube?: number;
    dms?: number;
    other?: number;
  }>;
  period: string;
}

const SOURCES = [
  { key: "meta", label: "Meta Ads", color: "#3b82f6" },
  { key: "organic", label: "Orgánico", color: "#22c55e" },
  { key: "tiktok", label: "TikTok", color: "#06b6d4" },
  { key: "youtube", label: "YouTube", color: "#ef4444" },
  { key: "dms", label: "DMs", color: "#a855f7" },
  { key: "other", label: "Otro", color: "#6b7280" },
];

export function LeadsChart({ data, period }: LeadsChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads por Fuente</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            No hay datos de leads en este período.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Leads por Fuente ({period})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
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
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(229 23% 9.2%)",
                border: "1px solid hsl(228 15% 18%)",
                borderRadius: "8px",
                color: "hsl(210 20% 95%)",
              }}
            />
            <Legend />
            {SOURCES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="leads"
                fill={s.color}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
