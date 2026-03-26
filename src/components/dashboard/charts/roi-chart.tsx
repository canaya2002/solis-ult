"use client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RoiChartProps {
  data: Array<{ name: string; value: number; color: string }>;
  centerLabel?: string;
}

export function RoiChart({ data, centerLabel }: RoiChartProps) {
  if (!data.length || data.every(d => d.value === 0)) {
    return (
      <Card><CardHeader><CardTitle className="text-base">Revenue por Canal</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center py-12"><p className="text-sm text-muted-foreground">No hay datos de revenue.</p></CardContent></Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Revenue por Canal</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" paddingAngle={2}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: "hsl(229 23% 9.2%)", border: "1px solid hsl(228 15% 18%)", borderRadius: "8px", color: "hsl(210 20% 95%)" }} formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} />
            <Legend />
            {centerLabel && (
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="hsl(210 20% 95%)" fontSize={18} fontWeight="bold">{centerLabel}</text>
            )}
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
