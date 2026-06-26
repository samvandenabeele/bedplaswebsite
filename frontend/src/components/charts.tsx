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
  Label,
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
  participantBirthDate: string;
  refreshKey?: number; // Optional prop to trigger re-render
}

import { getGraphData } from "../api";

export default function DiaryChart({
  participantId,
  participantBirthDate,
  refreshKey,
}: Props) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const participantAge = Math.floor(
    (new Date().getTime() - new Date(participantBirthDate).getTime()) /
      (1000 * 60 * 60 * 24 * 365.25),
  );

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
  }, [participantId, refreshKey]);

  if (error) return <p>{error}</p>;
  if (!data.length) return <p>Loading...</p>;

  return error ? (
    <div
      className={`mb-5 rounded-2xl border px-4 py-3 text-sm border-rose-400/30 bg-rose-500/10 text-rose-100`}
    >
      something went wrong, try again later: {error}
    </div>
  ) : (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" yAxisId="vv" stroke="#807c7c" />
        <XAxis dataKey="day" />
        <YAxis yAxisId="vv" unit=" ml" />
        <Label
          value="volume (ml)"
          angle={-90}
          position="insideLeft"
          textAnchor="middle"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#020618", // your desired background color
            border: "none",
            borderRadius: "8px",
            color: "#ffffff",
          }}
        />
        <Legend />
        {/* <ReferenceLine
          yAxisId="vv"
          y={(participantAge + 1) * 30}
          stroke="red"
          strokeDasharray="7 7"
        /> */}
        <Line
          yAxisId="vv"
          dataKey={() => (participantAge + 1) * 30}
          stroke="red"
          strokeDasharray="7 7"
          name="EBCage"
          dot={false}
        />
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
          yAxisId="vv"
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
