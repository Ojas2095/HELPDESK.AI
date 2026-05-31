import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from "recharts";
import { useEffect, useState, useRef } from "react";
import { api } from "../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ExpandableTabs } from "../components/ui/expandable-tabs";
import { Bell, Home, Settings, HelpCircle, Shield, Activity, Zap, Users } from "lucide-react";
import useTicketStore from "../store/ticketStore";
import useTicketsRealtime from "../hooks/useTicketsRealtime";

const COLORS = ["#10b981", "#6366f1", "#f97316", "#a855f7", "#ec4899"];

const useRecentlyUpdated = () => {
  const [recentIds, setRecentIds] = useState(new Set());

  const markUpdated = (id) => {
    setRecentIds((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setRecentIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  };

  return { recentIds, markUpdated };
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const { recentIds, markUpdated } = useRecentlyUpdated();

  const tickets = useTicketStore((state) => state.tickets);
  const addTicket = useTicketStore((state) => state.addTicket);
  const prevTicketsRef = useRef([]);

  useTicketsRealtime();

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
        data.forEach((t) => addTicket(t));
      } catch (error) {
        console.error("Failed to fetch tickets", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  useEffect(() => {
    const prevIds = new Set(prevTicketsRef.current.map((t) => t.ticket_id));

    tickets.forEach((t) => {
      if (!prevIds.has(t.ticket_id)) {
        markUpdated(t.ticket_id);
      } else {
        const prev = prevTicketsRef.current.find((p) => p.ticket_id === t.ticket_id);
        if (prev && JSON.stringify(prev) !== JSON.stringify(t)) {
          markUpdated(t.ticket_id);
        }
      }
    });

    prevTicketsRef.current = tickets;
  }, [tickets]);

  const totalTickets = tickets.length;
  const openTickets = tickets.filter(
    (t) => t.status === "Open" || t.Resolution_Status === "Open"
  ).length;
  const autoResolvedTickets = tickets.filter(
    (t) => t.Auto_Resolve === true || t.Resolution_Status === "Auto-Resolved"
  ).length;
  const automationRate =
    totalTickets > 0 ? (autoResolvedTickets / totalTickets) * 100 : 0;

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
      <div className="flex items-center justify-center p-12 min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 dark:border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <style>{`
        @keyframes flash-highlight {
          0%   { background-color: rgba(16, 185, 129, 0.15); }
          50%  { background-color: rgba(16, 185, 129, 0.25); }
          100% { background-color: transparent; }
        }
        .ticket-highlight {
          animation: flash-highlight 2s ease-out forwards;
        }
      `}</style>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-left w-full md:w-auto">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Activity className="text-emerald-600 dark:text-emerald-400" /> Executive Overview
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            Global helpdesk status and AI performance across all channels
          </p>
        </div>
        <ExpandableTabs tabs={tabs} />
      </div>

      {tickets.length === 0 ? (
        <Card className="text-center p-12 border-dashed border-2 border-slate-200 dark:border-slate-800 bg-transparent">
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            No ticket data available yet. Submit your first ticket to see analytics.
          </p>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-none shadow-md shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-800 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-between">
                  Total Tickets <Activity size={16} className="text-emerald-600 dark:text-emerald-400" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{totalTickets}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-800 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-between">
                  Auto-Resolved <Zap size={16} className="text-emerald-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{autoResolvedTickets}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-800 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-between">
                  Open Tickets <Users size={16} className="text-orange-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black text-orange-600 dark:text-orange-400">{openTickets}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-800 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-between">
                  Automation Rate <Shield size={16} className="text-purple-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black text-purple-600 dark:text-purple-400">{automationRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Live Ticket Queue */}
          <Card className="border-none shadow-md shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-800 transition-colors">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Activity size={18} className="text-emerald-600 dark:text-emerald-400" />
                Live Ticket Queue
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  LIVE
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">
                      <th className="pb-3 pr-4">ID</th>
                      <th className="pb-3 pr-4">Category</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.slice(0, 10).map((ticket) => (
                      <tr
                        key={ticket.ticket_id}
                        className={`border-b border-slate-50 dark:border-slate-700/40 transition-colors duration-200 ${
                          recentIds.has(ticket.ticket_id) ? "ticket-highlight" : ""
                        }`}
                      >
                        <td className="py-3 pr-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                          #{String(ticket.ticket_id).slice(0, 8)}
                        </td>
                        <td className="py-3 pr-4 font-medium text-slate-700 dark:text-slate-300">
                          {ticket.category || "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            ticket.status === "Open"
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                              : ticket.status === "Resolved"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400"
                          }`}>
                            {ticket.status || ticket.Resolution_Status || "—"}
                          </span>
                        </td>
                        <td className="py-3 text-slate-600 dark:text-slate-400">
                          {ticket.assigned_team || "Unassigned"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-none shadow-md shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-800 transition-colors">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Activity size={18} className="text-emerald-600 dark:text-emerald-400" /> Tickets by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData}>
                      <XAxis dataKey="name" fontSize={12} axisLine={false} tickLine={false} stroke="#94a3b8" />
                      <YAxis fontSize={12} axisLine={false} tickLine={false} stroke="#94a3b8" />
                      <Tooltip 
                        cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                        contentStyle={{ backgroundColor: 'var(--fallback-b1, #ffffff)', borderRadius: '8px', border: 'none', shadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                      />
                      <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-800 transition-colors">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Activity size={18} className="text-emerald-600 dark:text-emerald-400" /> Resolution Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" outerRadius={100} innerRadius={60}
                        paddingAngle={5} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

          {/* Efficiency + AI */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-none shadow-md shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-800 transition-colors">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-white">Efficiency Highlights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg Resolution Time</span>
                  </div>
                  <span className="text-sm font-black text-slate-900 dark:text-white">12 mins</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">User Satisfaction</span>
                  </div>
                  <span className="text-sm font-black text-slate-900 dark:text-white">4.8/5.0</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-800 transition-colors">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-white">AI Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                      {tickets.filter((t) => t.confidence > 0.8).length}
                    </div>
                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-2">High Confidence</div>
                  </div>
                  <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                    <div className="text-3xl font-black text-orange-600 dark:text-orange-400">
                      {tickets.filter((t) => (t.Duplicate_Probability || t.duplicate_probability || 0) > 0.7).length}
                    </div>
                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-widest mt-2">Potential Dupes</div>
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