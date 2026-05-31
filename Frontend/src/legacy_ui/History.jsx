import React, { useEffect, useState } from "react";
import { Table, Card, Button, Tag, Space, Input } from "antd";
import { DeleteOutlined, SearchOutlined } from "@ant-design/icons";

function History() {
  const [tickets, setTickets] = useState([]);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    const storedTickets = JSON.parse(localStorage.getItem("tickets")) || [];
    setTickets(storedTickets);
  }, []);

  const clearAllTickets = () => {
    localStorage.removeItem("tickets");
    setTickets([]);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "Low":
        return "green";
      case "Medium":
        return "orange";
      case "High":
      case "Critical":
        return "red";
      default:
        return "default";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Resolved":
      case "Auto-Resolved":
        return "success";
      case "Open":
        return "processing";
      default:
        return "default";
    }
  };

  const columns = [
    {
      title: "Ticket ID",
      dataIndex: "Ticket_ID",
      key: "Ticket_ID",
      fixed: "left",
      width: 150,
      render: (text) => <span className="font-mono font-semibold text-slate-900 dark:text-white transition-colors duration-300">{text}</span>,
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) =>
        record.Ticket_ID.toLowerCase().includes(value.toLowerCase()) ||
        record.Category.toLowerCase().includes(value.toLowerCase()) ||
        (record.Summary || "").toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: "Category",
      dataIndex: "Category",
      key: "Category",
      width: 150,
      filters: [...new Set(tickets.map((t) => t.Category))].map((cat) => ({
        text: cat,
        value: cat,
      })),
      onFilter: (value, record) => record.Category === value,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: "Sub-Category",
      dataIndex: "Sub_Category",
      key: "Sub_Category",
      width: 150,
      render: (text) => text && text !== "N/A" ? <Tag color="cyan">{text}</Tag> : <span className="text-slate-400 dark:text-slate-500 transition-colors duration-300">-</span>,
    },
    {
      title: "Priority",
      dataIndex: "Priority",
      key: "Priority",
      width: 120,
      filters: [
        { text: "Low", value: "Low" },
        { text: "Medium", value: "Medium" },
        { text: "High", value: "High" },
        { text: "Critical", value: "Critical" },
      ],
      onFilter: (value, record) => record.Priority === value,
      sorter: (a, b) => {
        const priorityOrder = { Low: 1, Medium: 2, High: 3, Critical: 4 };
        return priorityOrder[a.Priority] - priorityOrder[b.Priority];
      },
      render: (text) => (
        <Tag color={getPriorityColor(text)} className="font-medium">
          {text}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "Resolution_Status",
      key: "Resolution_Status",
      width: 140,
      filters: [
        { text: "Open", value: "Open" },
        { text: "Resolved", value: "Resolved" },
        { text: "Auto-Resolved", value: "Auto-Resolved" },
      ],
      onFilter: (value, record) => record.Resolution_Status === value,
      render: (text) => <Tag color={getStatusColor(text)}>{text}</Tag>,
    },
    {
      title: "Assigned Team",
      dataIndex: "Assigned_Team",
      key: "Assigned_Team",
      width: 150,
      filters: [...new Set(tickets.map((t) => t.Assigned_Team).filter(Boolean))].map((team) => ({
        text: team,
        value: team,
      })),
      onFilter: (value, record) => record.Assigned_Team === value,
      render: (text) => text || <span className="text-slate-400 dark:text-slate-500 transition-colors duration-300">-</span>,
    },
    {
      title: "Channel",
      dataIndex: "Channel",
      key: "Channel",
      width: 120,
      render: (text) => <span className="text-slate-700 dark:text-slate-300 transition-colors duration-300">{text}</span>,
    },
    {
      title: "Routing Confidence",
      dataIndex: "Routing_Confidence",
      key: "Routing_Confidence",
      width: 160,
      sorter: (a, b) => (a.Routing_Confidence || 0) - (b.Routing_Confidence || 0),
      render: (value) => {
        if (!value) return <span className="text-slate-400 dark:text-slate-500 transition-colors duration-300">-</span>;
        const percentage = Math.round(value * 100);
        const color = percentage > 80 ? "green" : percentage > 50 ? "orange" : "red";
        return <Tag color={color}>{percentage}%</Tag>;
      },
    },
    {
      title: "Timestamp",
      dataIndex: "Timestamp",
      key: "Timestamp",
      width: 180,
      sorter: (a, b) => new Date(a.Timestamp || 0) - new Date(b.Timestamp || 0),
      defaultSortOrder: "descend",
      render: (text) => {
        if (!text) return <span className="text-slate-400 dark:text-slate-500 transition-colors duration-300">-</span>;
        return <span className="text-slate-700 dark:text-slate-300 transition-colors duration-300">{new Date(text).toLocaleString()}</span>;
      },
    },
  ];

  return (
    <div className="p-4 md:p-8 bg-white dark:bg-slate-900 min-h-screen transition-colors duration-300">
      <Card
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm rounded-2xl transition-colors duration-300"
        title={
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-2">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white m-0 font-syne transition-colors duration-300">
              Ticket History
            </h2>
            <Space className="w-full sm:w-auto justify-end flex-wrap gap-2">
              <Input
                placeholder="Search tickets..."
                prefix={<SearchOutlined className="text-slate-400 dark:text-slate-500" />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full sm:w-[250px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200"
                allowClear
              />
              {tickets.length > 0 && (
                <Button
                  danger
                  type="primary"
                  icon={<DeleteOutlined />}
                  onClick={clearAllTickets}
                  className="rounded-xl font-semibold px-4 cursor-pointer"
                >
                  Clear All
                </Button>
              )}
            </Space>
          </div>
        }
        bordered={false}
      >
        <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-700/40">
          <Table
            columns={columns}
            dataSource={tickets}
            rowKey="Ticket_ID"
            className="dark-table-override"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">Total {total} tickets</span>,
            }}
            scroll={{ x: 1400 }}
            locale={{
              emptyText: (
                <div className="py-12 text-slate-400 dark:text-slate-500 font-medium">
                  No tickets submitted yet. Submit your first ticket to see it here.
                </div>
              ),
            }}
          />
        </div>
      </Card>
    </div>
  );
}

export default History;