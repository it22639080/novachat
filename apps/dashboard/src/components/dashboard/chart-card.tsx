"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";

type ChartPoint = {
  day: string;
  revenue: number;
  conversations: number;
  leads: number;
};

export function ChartCard({
  title,
  description,
  data
}: {
  title: string;
  description: string;
  data: ChartPoint[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="salesRevenue" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="salesLeads" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={42} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))"
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#salesRevenue)"
              />
              <Area
                type="monotone"
                dataKey="leads"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#salesLeads)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
