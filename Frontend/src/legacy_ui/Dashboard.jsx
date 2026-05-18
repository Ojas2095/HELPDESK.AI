import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ExpandableTabs } from "../components/ui/expandable-tabs";
import { Bell, Home, Settings, HelpCircle, Shield, Activity, Zap, Users, AlertCircle } from "lucide-react";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

const Dashboard = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const tabs = [
    { title: "Dashboard", icon: Home },
    { title: "Notifications", icon: Bell },
    { title: "Settings", icon: Settings },
    { title: "Support", icon: HelpCircle },
    { title: "Security", icon: Shield },
  ];

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const data = await api.getTickets();
        setTickets(data);
      } catch (error) {
        console.error("Failed to fetch tickets", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  // Summary Counts
  const totalTickets = tickets.length;
  const openTickets = tickets.filter(
    (t) => t.status === "Open" || t.Resolution_Status === "Open"
  ).length;
// eslint-disable-next-line no-unused-vars
  const resolvedTickets = tickets.filter(
    (t) => t.status === "Resolved" || t.Resolution_Status === "Resolved" || t.Resolution_Status === "Auto-Resolved" || t.Auto_Resolve
  ).length;
  const autoResolvedTickets = tickets.filter(
    (t) => t.Auto_Resolve === true || t.Resolution_Status === "Auto-Resolved"
  ).length;

  // Automation Rate
  const automationRate =
    totalTickets > 0 ? (autoResolvedTickets / totalTickets) * 100 : 0;

  // Transform data for charts
  const categoryData = Object.entries(
    tickets.reduce((acc, ticket) => {
      const cat = ticket.category || "Unknown";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const statusData = Object.entries(
    tickets.reduce((acc, ticket) => {
      const status = ticket.Resolution_Status || ticket.status || "Unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="text-indigo-600" /> Executive Overview
          </h2>
          <p className="text-slate-500 font-medium mt-1">Global helpdesk status and AI performance across all channels</p>
        </div>
        <ExpandableTabs tabs={tabs} />
      </div>

      {tickets.length === 0 ? (
        <Card className="text-center p-12 border-dashed border-2">
          <p className="text-gray-500 text-lg">No ticket data available yet. Submit your first ticket to see analytics.</p>
        </Card>
      ) : (
        <>
          {/* Summary Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-none shadow-md shadow-slate-200/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                  Total Tickets
                  <Activity size={16} className="text-indigo-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black text-slate-900">{totalTickets}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md shadow-slate-200/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                  Auto-Resolved
                  <Zap size={16} className="text-emerald-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black text-emerald-600">{autoResolvedTickets}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md shadow-slate-200/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                  Open Tickets
                  <Users size={16} className="text-orange-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black text-orange-600">{openTickets}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md shadow-slate-200/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                  Automation Rate
                  <Shield size={16} className="text-purple-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black text-purple-600">{automationRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-none shadow-md shadow-slate-200/50">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity size={18} className="text-indigo-500" /> Tickets by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData}>
                      <XAxis dataKey="name" fontSize={12} axisLine={false} tickLine={false} />
                      <YAxis fontSize={12} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md shadow-slate-200/50">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity size={18} className="text-indigo-500" /> Resolution Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {statusData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-none shadow-md shadow-slate-200/50">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  Efficiency Highlights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-slate-600">Avg Resolution Time</span>
                  </div>
                  <span className="text-sm font-black text-slate-900">12 mins</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span className="text-sm font-medium text-slate-600">User Satisfaction</span>
                  </div>
                  <span className="text-sm font-black text-slate-900">4.8/5.0</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md shadow-slate-200/50">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  AI Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-50 rounded-2xl text-center border border-slate-100">
                    <div className="text-3xl font-black text-indigo-600">
                      {tickets.filter(t => t.confidence > 0.8).length}
                    </div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 text-center">High Confidence</div>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-2xl text-center border border-slate-100">
                    <div className="text-3xl font-black text-orange-600">
                      {tickets.filter(t => (t.Duplicate_Probability || t.duplicate_probability || 0) > 0.7).length}
                    </div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 text-center">Potential Dupes</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
