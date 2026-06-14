import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface GraphData {
  mvv: number[];
  gvv: number[];
  water: number[];
}

interface ChartPoint {
  day: string;
  mvv: number;
  gvv: number;
  water: number;
}

interface Props {
  participantId: number;
}

import { getGraphData } from "../api";

export default function DiaryChart({ participantId }: Props) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGraphData(participantId)
      .then((json: GraphData) => {
        const points: ChartPoint[] = json.mvv.map((mvv, i) => ({
          day: `Day ${i + 1}`,
          mvv,
          gvv: json.gvv[i],
          water: json.water[i],
        }));
        setData(points);
      })
      .catch((err) => {
        setError("Failed to load graph data, " + err.message);
      });
  }, [participantId]);

  if (error) return <p>{error}</p>;
  if (!data.length) return <p>Loading...</p>;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" yAxisId="vv" />
        <XAxis dataKey="day" />
        <YAxis yAxisId="vv" unit=" ml" />
        <YAxis yAxisId="water" orientation="right" unit=" ml" />
        <Tooltip />
        <Legend />
        <Line
          yAxisId="vv"
          type="monotone"
          dataKey="mvv"
          stroke="#2563eb"
          name="MVV"
          dot={false}
        />
        <Line
          yAxisId="vv"
          type="monotone"
          dataKey="gvv"
          stroke="#16a34a"
          name="GVV"
          dot={false}
        />
        <Line
          yAxisId="water"
          type="monotone"
          dataKey="water"
          stroke="#9333ea"
          name="Water intake"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
