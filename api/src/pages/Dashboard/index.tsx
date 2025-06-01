import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { Thermometer, Fan } from 'lucide-react'

interface TelemetryPoint { ts: number; value: string }
interface ChartPoint {
  ts: number
  time: string
  temperature?: number
  humidity?: number
  light?: number
  predicted_temp?: number
  predicted_humid?: number
}

export default function DashBoard() {
  // const [lightMode, setLightMode] = useState(false)
  const [fanMode, setFanMode] = useState(false)
  const [fanSpeed, setFanSpeed] = useState([0])
  const [temperature, setTemperature] = useState(0)
  const [humidity, setHumidity] = useState(0)
  const [light, setLight] = useState(0)
  const [actualData, setActualData] = useState<ChartPoint[]>([])
  const [predictedData, setPredictedData] = useState<ChartPoint[]>([])
  const [lastUpdate, setLastUpdate] = useState('...')


  const USER = import.meta.env.VITE_COREIOT_USER!
  const PASS = import.meta.env.VITE_COREIOT_PASS!
  const DEVICE_ID = import.meta.env.VITE_COREIOT_DEVICEID!

  interface AlarmData {
    id: string
    name: string
    status: string
    severity: string
  }
  const [alarm, setAlarm] = useState<AlarmData | null>(null)
  const [showAlarm, setShowAlarm] = useState(false)
  const [lastAlarmInfo, setLastAlarmInfo] = useState<{ id: string, status: string, severity: string } | null>(null)
  const alarmTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let token = ''
    let interval: NodeJS.Timeout

    const fetchHistory = async () => {
      // Log in
      const loginRes = await fetch('https://app.coreiot.io/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USER, password: PASS })
      })
      if (!loginRes.ok) throw new Error('Login failed')
      token = (await loginRes.json()).token

      // Get history for the last 1 hour
      const now = Date.now()
      const history_last_hour = now - 1 * 60 * 60 * 1000
      const histRes = await fetch(
        `https://app.coreiot.io/api/plugins/telemetry/DEVICE/${DEVICE_ID}` +
        `/values/timeseries?keys=temperature,humidity,light,predicted_temp,predicted_humid` +
        `&startTs=${history_last_hour}&endTs=${now}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (histRes.ok) {
        const j = await histRes.json()
        // Actual
        const temps: TelemetryPoint[] = j.temperature || []
        const hums: TelemetryPoint[] = j.humidity || []
        const lights: TelemetryPoint[] = j.light || []
        const actual: ChartPoint[] = temps.map((t, i) => ({
          ts: t.ts,
          time: new Date(t.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          temperature: Number(t.value) ? Number(temps[i].value) : 0,
          humidity: hums[i] ? Number(hums[i].value) : 0,
          light: Number(t.value) ? Number(lights[i].value) : 0
        })).sort((a, b) => a.ts - b.ts)
        setActualData(actual.slice(-30)) // Last 30 points

        // Predicted
        const ptemps: TelemetryPoint[] = j.predicted_temp || []
        const phumids: TelemetryPoint[] = j.predicted_humid || []
        const predicted: ChartPoint[] = ptemps.map((t, i) => ({
          ts: t.ts,
          time: new Date(t.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          predicted_temp: Number(t.value) ? Number(ptemps[i].value) : 0,
          predicted_humid: phumids[i] ? Number(phumids[i].value) : 0
        })).sort((a, b) => a.ts - b.ts)
        setPredictedData(predicted.slice(-30)) // Last 30 points

        if (temps.length > 0) setTemperature(Number(temps[temps.length - 1].value))
        if (hums.length > 0) setHumidity(Number(hums[hums.length - 1].value))
        if (lights.length > 0) setLight(Number(lights[lights.length - 1].value))
      }
      setLastUpdate(new Date().toLocaleTimeString())
    }

    // Fetch history Once when Mounting
    fetchHistory()

    // Poll new data each 5s
    interval = setInterval(async () => {
      // Get token if loss (time out => login again)
      if (!token) return

      const res = await fetch(
        `https://app.coreiot.io/api/plugins/telemetry/DEVICE/${DEVICE_ID}` +
        `/values/timeseries?keys=temperature,humidity,light,predicted_temp,predicted_humid&limit=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) return
      const j = await res.json()

      // Actual
      const t = j.temperature?.[0], h = j.humidity?.[0], l = j.light?.[0]
      if (t && h && l) {
        setActualData(prev => {
          if (prev.length > 0 && prev[prev.length - 1].ts === t.ts) return prev
          const next = [...prev, {
            ts: t.ts,
            time: new Date(t.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            temperature: Number(t.value),
            humidity: Number(h.value),
            light: Number(l.value)
          }]
          return next.length > 30 ? next.slice(next.length - 30) : next
        })
        setTemperature(Number(t.value))
        setHumidity(Number(h.value))
        setLight(Number(l.value))
      }

      // Predicted
      const pt = j.predicted_temp?.[0], ph = j.predicted_humid?.[0]
      if (pt && ph) {
        setPredictedData(prev => {
          if (prev.length > 0 && prev[prev.length - 1].ts === pt.ts) return prev
          const next = [...prev, {
            ts: pt.ts,
            time: new Date(pt.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            predicted_temp: Number(pt.value),
            predicted_humid: Number(ph.value)
          }]
          return next.length > 30 ? next.slice(next.length - 30) : next
        })
      }

      const alarmRes = await fetch(
        `https://app.coreiot.io/api/alarms?originator=${DEVICE_ID}&pageSize=10&page=0`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (alarmRes.ok) {
        const alarmData = await alarmRes.json()
        if (alarmData.data && alarmData.data.length > 0) {
          const newestAlarm = alarmData.data[0]
          if (
            !lastAlarmInfo ||
            newestAlarm.id.id !== lastAlarmInfo.id ||
            newestAlarm.status !== lastAlarmInfo.status ||
            newestAlarm.severity !== lastAlarmInfo.severity
          ) {
            setAlarm({
              id: newestAlarm.id.id,
              name: newestAlarm.name,
              status: newestAlarm.status,
              severity: newestAlarm.severity
            })
            setShowAlarm(true)
            setLastAlarmInfo({
              id: newestAlarm.id.id,
              status: newestAlarm.status,
              severity: newestAlarm.severity
            })
            // if (alarmTimeout.current) clearTimeout(alarmTimeout.current)
            // alarmTimeout.current = setTimeout(() => setShowAlarm(false), 5000)
          }
        }
      }
      setLastUpdate(new Date().toLocaleTimeString())
    }, 5000)

    return () => clearInterval(interval)
  }, [USER, PASS, DEVICE_ID])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-4xl font-bold text-white mb-2">IoT Dashboard - CoreIoT</h1>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-blue-200">System Online</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                <span className="text-blue-200">All Sensors Active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                <span className="text-blue-200">
                  Last Update:{" "}
                  {actualData.length > 0
                    ? new Date(actualData[actualData.length - 1].ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : "none"}
                </span>
              </div>
            </div>
        </div>

        {/* Control Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Fan Control */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center"><Fan className="w-4 h-4" /></div>
                Fan Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-200">{fanMode ? 'ON' : 'OFF'}</span>
                <Switch checked={fanMode} onCheckedChange={setFanMode} className="data-[state=checked]:bg-blue-500" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-200">Speed</span>
                  <span className="text-white font-semibold">{fanSpeed[0]}%</span>
                </div>
                <Slider value={fanSpeed} onValueChange={setFanSpeed} max={100} step={1} className="w-full" disabled={!fanMode} />
              </div>
            </CardContent>
          </Card>

          {/* Lighting */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">💡</div>
                Brightness
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* <div className="flex items-center justify-between"> */}
                {/* <span className="text-sm text-blue-200">{lightMode ? 'ON' : 'OFF'}</span>
                <Switch checked={lightMode} onCheckedChange={setLightMode} className="data-[state=checked]:bg-yellow-500" /> */}
              {/* </div> */}
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-300 mb-1">{light} lx</div>
                <div className="text-sm text-blue-200">{light <= 10 ? 'Dark' : light <= 100 ? 'Dim' : light <= 500 ? 'Moderate' : 'Bright'}</div>
              </div>
            </CardContent>
          </Card>

          {/* Temperature */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center"><Thermometer className="w-4 h-4" /></div>
                Temperature
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-400 mb-1">{temperature} °C</div>
                <div className="text-sm text-blue-200">{temperature > 30 ? 'Hot' : temperature > 25 ? 'Warm' : temperature > 20 ? 'Comfortable' : 'Cool'}</div>
              </div>
            </CardContent>
          </Card>

          {/* Humidity */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">💧</div>
                Humidity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-1">{humidity} %</div>
                <div className="text-sm text-blue-200">{humidity > 75 ? 'Wet' : humidity > 50 ? 'Humid' : humidity > 25 ? 'Comfortable' : 'Dry'}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Beautiful Time Series Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Actual data chart */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-5 h-5 text-red-400" />
                📑 Actual Temperature & Humidity Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={actualData}
                    margin={{ top: 24, right: 48, left: 8, bottom: 16 }}
                  >
                    <CartesianGrid strokeDasharray="4 3" stroke="rgba(255,255,255,0.10)" />
                    <XAxis
                      dataKey="ts"
                      tickFormatter={ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      tick={{ fill: "#fff", fontSize: 12 }}
                      interval="preserveEnd"
                      minTickGap={24}
                      axisLine={{ stroke: "rgba(255,255,255,0.32)" }}
                      tickLine={{ stroke: "rgba(255,255,255,0.18)" }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: "#FF5722", fontSize: 13, fontWeight: 700 }}
                      axisLine={{ stroke: "#FF5722" }}
                      tickLine={false}
                      domain={[20, 40]}
                      label={{
                        value: "Temperature (°C)",
                        angle: -90,
                        position: "insideLeft",
                        style: { fill: "#FF5722", fontSize: 14, fontWeight: 700 }
                      }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: "#048AD3", fontSize: 13, fontWeight: 700 }}
                      axisLine={{ stroke: "#048AD3" }}
                      tickLine={false}
                      domain={[35, 85]}
                      label={{
                        value: "Humidity (%)",
                        angle: 90,
                        position: "insideRight",
                        style: { fill: "#048AD3", fontSize: 14, fontWeight: 700 }
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(20,24,38,0.95)",
                        color: "#fff",
                        borderRadius: 8,
                        border: "1px solid #333"
                      }}
                      labelStyle={{ color: "#e0e0e0" }}
                      formatter={(value, name) => [`${value}`, name === "temperature" ? "Temperature" :
                        name === "humidity" ? "Humidity" : name]}
                    />
                    <Legend
                      verticalAlign="top"
                      iconType="circle"
                      height={36}
                      wrapperStyle={{ paddingLeft: 16, paddingTop: 10, color: '#fff' }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="temperature"
                      stroke="#FF5722"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={true}
                      name="Temperature"
                    />
                    <Line
                      yAxisId="right"
                      type="linear"
                      dataKey="humidity"
                      stroke="#048AD3"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={true}
                      name="Humidity"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          {/* Predicted data chart */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-5 h-5 text-pink-400" />
                🤖 Predicted Temp & Humid Data in next Time Stamp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={predictedData}
                    margin={{ top: 24, right: 48, left: 8, bottom: 16 }}
                  >
                    <CartesianGrid strokeDasharray="4 3" stroke="rgba(255,255,255,0.10)" />
                    <XAxis
                      dataKey="ts"
                      tickFormatter={ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      tick={{ fill: "#fff", fontSize: 12 }}
                      interval="preserveEnd"
                      minTickGap={24}
                      axisLine={{ stroke: "rgba(255,255,255,0.32)" }}
                      tickLine={{ stroke: "rgba(255,255,255,0.18)" }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: "#F9A19B", fontSize: 13, fontWeight: 700 }}
                      axisLine={{ stroke: "#F9A19B" }}
                      tickLine={false}
                      domain={[20, 40]}
                      label={{
                        value: "Predicted Temp (°C)",
                        angle: -90,
                        position: "insideLeft",
                        style: { fill: "#F9A19B", fontSize: 14, fontWeight: 700 }
                      }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: "#81C4E9", fontSize: 13, fontWeight: 700 }}
                      axisLine={{ stroke: "#81C4E9" }}
                      tickLine={false}
                      domain={[35, 85]}
                      label={{
                        value: "Predicted Humid (%)",
                        angle: 90,
                        position: "insideRight",
                        style: { fill: "#81C4E9", fontSize: 14, fontWeight: 700 }
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(20,24,38,0.95)",
                        color: "#fff",
                        borderRadius: 8,
                        border: "1px solid #333"
                      }}
                      labelStyle={{ color: "#e0e0e0" }}
                      formatter={(value, name) => [`${value}`, name === "predicted_temp" ? "Predicted Temp" :
                        name === "predicted_humid" ? "Predicted Humid" : name]}
                    />
                    <Legend
                      verticalAlign="top"
                      iconType="circle"
                      height={36}
                      wrapperStyle={{ paddingLeft: 16, paddingTop: 10, color: '#fff' }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="predicted_temp"
                      stroke="#F9A19B"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={true}
                      name="Predicted Temp"
                    />
                    <Line
                      yAxisId="right"
                      type="linear"
                      dataKey="predicted_humid"
                      stroke="#81C4E9"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={true}
                      name="Predicted Humid"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alarm Notification Popup */}
        {/* {showAlarm && alarm && (
          <div
            className="fixed top-8 right-8 z-[9999] bg-red-600/95 text-white px-6 py-4 rounded-xl shadow-xl transition-opacity duration-500 animate-fade-in-up"
            style={{ minWidth: 300 }}
          >
            <div className="font-bold text-lg mb-1">Alarm Triggered!</div>
            <div><b>Name:</b> {alarm.name || 'Unknown'}</div>
            <div><b>Status:</b> {alarm.status || 'Unknown'}</div>
            <div><b>Severity:</b> {alarm.severity || 'Unknown'}</div>
          </div>
        )} */}
      </div>
    </div>
  )
}
