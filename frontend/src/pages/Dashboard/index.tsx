import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Thermometer, Fan } from 'lucide-react';

// Sample data for charts
const generateSampleData = () => {
  const data = [];
  const now = new Date();
  
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    data.push({
      time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temperature: Math.round((22 + Math.sin(i * 0.3) * 3 + Math.random() * 2) * 10) / 10,
      humidity: Math.round((45 + Math.cos(i * 0.4) * 10 + Math.random() * 5) * 10) / 10,
    });
  }
  return data;
};

const DashBoard = () => {
  const [lightMode, setLightMode] = useState(false);
  const [fanMode, setFanMode] = useState(false);
  const [fanSpeed, setFanSpeed] = useState([0]);
  const [temperature, setTemperature] = useState(24.5);
  const [humidity, setHumidity] = useState(52);
  const [chartData, setChartData] = useState(generateSampleData());

  // Simulate real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTemperature(prev => Math.round((prev + (Math.random() - 0.5) * 0.5) * 10) / 10);
      setHumidity(prev => Math.round((prev + (Math.random() - 0.5) * 2) * 10) / 10);
      
      // Update chart data every 5 minutes (simulated)
      if (Math.random() > 0.95) {
        setChartData(prev => {
          const newData = [...prev.slice(1)];
          const now = new Date();
          newData.push({
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            temperature: Math.round((22 + Math.sin(Date.now() * 0.001) * 3 + Math.random() * 2) * 10) / 10,
            humidity: Math.round((45 + Math.cos(Date.now() * 0.001) * 10 + Math.random() * 5) * 10) / 10,
          });
          return newData;
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">IoT Dashboard</h1>
          <p className="text-blue-200">Smart Home Control Center</p>
        </div>

        {/* Control Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Light Control */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  💡
                </div>
                Lighting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-200">
                  {lightMode ? 'ON' : 'OFF'}
                </span>
                <Switch
                  checked={lightMode}
                  onCheckedChange={setLightMode}
                  className="data-[state=checked]:bg-yellow-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Fan Control */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Fan className="w-4 h-4" />
                </div>
                Fan Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-200">
                  {fanMode ? 'ON' : 'OFF'}
                </span>
                <Switch
                  checked={fanMode}
                  onCheckedChange={setFanMode}
                  className="data-[state=checked]:bg-blue-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-200">Speed</span>
                  <span className="text-white font-semibold">{fanSpeed[0]}%</span>
                </div>
                <Slider
                  value={fanSpeed}
                  onValueChange={setFanSpeed}
                  max={100}
                  step={1}
                  className="w-full"
                  disabled={!fanMode}
                />
              </div>
            </CardContent>
          </Card>

          {/* Temperature Display */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Thermometer className="w-4 h-4" />
                </div>
                Temperature
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-400 mb-1">
                  {temperature}°C
                </div>
                <div className="text-sm text-blue-200">
                  {temperature > 25 ? 'Warm' : temperature > 20 ? 'Comfortable' : 'Cool'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Humidity Display */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  💧
                </div>
                Humidity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-1">
                  {humidity}%
                </div>
                <div className="text-sm text-blue-200">
                  {humidity > 60 ? 'High' : humidity > 40 ? 'Optimal' : 'Low'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Temperature Chart */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-red-400" />
                Temperature Trend (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="time" 
                      stroke="rgba(255,255,255,0.6)"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.6)"
                      fontSize={12}
                      domain={['dataMin - 2', 'dataMax + 2']}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'white'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="temperature" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4, fill: '#ef4444' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Humidity Chart */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-5 h-5 text-blue-400">💧</div>
                Humidity Trend (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="time" 
                      stroke="rgba(255,255,255,0.6)"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.6)"
                      fontSize={12}
                      domain={['dataMin - 5', 'dataMax + 5']}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'white'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="humidity" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4, fill: '#3b82f6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Bar */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
          <CardContent className="pt-6">
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
                <span className="text-blue-200">Last Update: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashBoard;