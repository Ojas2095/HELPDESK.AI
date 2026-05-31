import { useLocation, useNavigate, Link } from "react-router-dom";
import { Card, Badge, Collapse, Timeline, Alert, Tag, Progress } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  PictureOutlined
} from "@ant-design/icons";

function Result() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state;

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12 min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <Card className="text-center bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 max-w-[400px] w-full mx-4 shadow-sm">
          <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">No Ticket Data Found</h2>
          <button
            onClick={() => navigate("/")}
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-500 transition-colors cursor-pointer"
          >
            Go Back
          </button>
        </Card>
      </div>
    );
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High":
      case "Critical":
        return "red";
      case "Medium":
        return "orange";
      case "Low":
        return "green";
      default:
        return "default";
    }
  };

  const solutionSteps = Array.isArray(data.solution_steps)
    ? data.solution_steps
    : typeof data.solution_steps === "string"
      ? data.solution_steps.split("\n").filter((s) => s.trim())
      : [data.solution_steps || "Consult internal knowledge base for specific troubleshooting steps."];

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header Card */}
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-syne">
                Ticket Analysis Result
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Ticket ID: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{data.ticket_id || "N/A"}</span>
              </p>
            </div>

            {data.auto_resolve !== undefined && (
              <Badge
                count={
                  data.auto_resolve ? (
                    <Tag icon={<ThunderboltOutlined />} color="success" className="m-0 font-bold px-2.5 py-0.5 rounded-full">
                      Auto-Resolved
                    </Tag>
                  ) : (
                    <Tag icon={<TeamOutlined />} color="processing" className="m-0 font-bold px-2.5 py-0.5 rounded-full">
                      Human Required
                    </Tag>
                  )
                }
              />
            )}
          </div>
        </Card>

        {/* Status Alerts */}
        {data.auto_resolve === false && (
          <Alert
            message={<span className="font-bold text-amber-900 dark:text-amber-200">Human Intervention Required</span>}
            description={<span className="text-amber-800 dark:text-amber-300/90 text-sm">This ticket requires manual review by a support team member. The AI has identified complexity that needs human expertise.</span>}
            type="warning"
            icon={<WarningOutlined />}
            showIcon
            className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-4 shadow-sm"
          />
        )}

        {data.auto_resolve === true && (
          <Alert
            message={<span className="font-bold text-emerald-900 dark:text-emerald-200">Ticket Auto-Resolved</span>}
            description={<span className="text-emerald-800 dark:text-emerald-300/90 text-sm">The AI has automatically resolved this ticket based on known solutions. The user has been notified with step-by-step instructions.</span>}
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 p-4 shadow-sm"
          />
        )}

        {/* Classification Card */}
        <Card 
          title={<span className="font-bold text-slate-800 dark:text-white font-syne text-lg">Classification & Routing</span>} 
          bordered={false}
          className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm transition-colors duration-300"
        >
          <div className="space-y-5 text-left">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-bold text-slate-500 dark:text-slate-400 text-sm min-w-[140px] uppercase tracking-wider">Category:</span>
              <div className="flex gap-2">
                <Tag color="blue" className="text-xs font-bold px-2.5 py-0.5 rounded-md">
                  {data.category}
                </Tag>
                {data.subcategory && (
                  <Tag color="cyan" className="text-xs font-bold px-2.5 py-0.5 rounded-md">
                    {data.subcategory}
                  </Tag>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-500 dark:text-slate-400 text-sm min-w-[140px] uppercase tracking-wider">Priority:</span>
              <Tag color={getPriorityColor(data.priority)} className="text-xs font-bold px-2.5 py-0.5 rounded-md">
                {data.priority}
              </Tag>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-500 dark:text-slate-400 text-sm min-w-[140px] uppercase tracking-wider">Assigned Team:</span>
              <Tag icon={<TeamOutlined />} color="purple" className="text-xs font-bold px-2.5 py-0.5 rounded-md">
                {data.assigned_team}
              </Tag>
            </div>

            {/* Routing Confidence */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Routing Confidence:</span>
                <span className="text-slate-900 dark:text-white font-black">{Math.round((data.routing_confidence || data.confidence || 0) * 100)}%</span>
              </div>
              <Progress
                percent={Math.round((data.routing_confidence || data.confidence || 0) * 100)}
                status={(data.routing_confidence || data.confidence || 0) > 0.8 ? "success" : "normal"}
                strokeColor={{ "0%": "#10b981", "100%": "#059669" }}
                className="m-0 dark:opacity-90"
              />
            </div>

            {/* Summary & Reasoning */}
            {(data.summary || data.reasoning) && (
              <div className="space-y-4 pt-5 border-t border-slate-100 dark:border-slate-700/60">
                {data.summary && (
                  <div>
                    <span className="font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-widest block mb-2">AI Summary:</span>
                    <p className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl text-slate-700 dark:text-slate-300 border-l-4 border-blue-500 shadow-inner text-sm leading-relaxed m-0">
                      {data.summary}
                    </p>
                  </div>
                )}
                {data.reasoning && (
                  <div>
                    <span className="font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-widest block mb-2">AI Reasoning:</span>
                    <p className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl text-emerald-800 dark:text-emerald-400 border-l-4 border-emerald-500 italic shadow-inner text-sm leading-relaxed m-0">
                      {data.reasoning}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Visual Analysis Card */}
        {(data.image_description || data.ocr_text) && (
          <Card 
            title={<span className="font-bold text-slate-800 dark:text-white font-syne text-lg flex items-center"><PictureOutlined className="mr-2 text-emerald-600 dark:text-emerald-400" />Visual Analysis</span>} 
            bordered={false}
            className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm transition-colors duration-300"
          >
            <div className="space-y-4 text-left">
              {data.image_description && (
                <div>
                  <span className="font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-widest block mb-2">Image Description:</span>
                  <p className="bg-blue-50/40 dark:bg-blue-950/20 p-4 rounded-xl text-blue-900 dark:text-blue-400 border-l-4 border-blue-500 italic shadow-inner text-sm m-0 leading-relaxed">
                    "{data.image_description}"
                  </p>
                </div>
              )}
              {data.ocr_text && (
                <div>
                  <span className="font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-widest block mb-2">Detected Text (OCR):</span>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap shadow-inner leading-relaxed">
                    {data.ocr_text}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Suggested Solution Card */}
        <Card 
          title={<span className="font-bold text-slate-800 dark:text-white font-syne text-lg">Suggested Solution</span>} 
          bordered={false}
          className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm transition-colors duration-300"
        >
          <div className="text-left py-2">
            <Timeline
              items={solutionSteps.map((step, index) => ({
                color: index === 0 ? "#10b981" : "#3b82f6",
                children: (
                  <div className="pb-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">Step {index + 1}</p>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed m-0">{step}</p>
                  </div>
                ),
              }))}
            />
          </div>
        </Card>

        {/* Explainable AI Section */}
        {((data.decision_factors && data.decision_factors.length > 0) || data.duplicate_probability !== undefined) && (
          <Card 
            title={<span className="font-bold text-slate-800 dark:text-white font-syne text-lg">Explainable AI - Decision Reasoning</span>} 
            bordered={false}
            className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden transition-colors duration-300"
          >
            <Collapse
              defaultActiveKey={["1"]}
              expandIconPosition="end"
              className="bg-slate-50/50 dark:bg-slate-900 border-none rounded-xl"
              items={[
                {
                  key: "1",
                  label: (
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center">
                      <InfoCircleOutlined className="mr-2 text-indigo-500" />
                      Why did the AI make these decisions?
                    </span>
                  ),
                  children: (
                    <div className="space-y-5 text-left p-1">
                      {/* Decision Factors */}
                      {data.decision_factors && data.decision_factors.length > 0 && (
                        <div>
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-2">Key Decision Factors:</h4>
                          <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-600 dark:text-slate-400 pl-1">
                            {data.decision_factors.map((factor, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <span className="text-slate-700 dark:text-slate-300">{factor}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Duplicate Detection */}
                      {data.duplicate_probability !== undefined && (
                        <div className="pt-5 border-t border-slate-200/60 dark:border-slate-800">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-4">Duplicate Detection:</h4>
                          <div className="flex flex-col sm:flex-row items-center gap-6 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                            <Progress
                              type="circle"
                              percent={Math.round(data.duplicate_probability * 100)}
                              width={70}
                              strokeWidth={8}
                              status={data.duplicate_probability > 0.7 ? "exception" : "normal"}
                              className="shrink-0"
                            />
                            <div className="text-center sm:text-left">
                              <p className="text-slate-800 dark:text-slate-200 font-semibold text-sm m-0">
                                {data.duplicate_probability > 0.7
                                  ? "High likelihood this is a duplicate ticket"
                                  : data.duplicate_probability > 0.4
                                    ? "Moderate similarity to existing tickets"
                                    : "Appears to be a unique issue"}
                              </p>
                              {data.duplicate_probability > 0.7 && (
                                <p className="text-xs text-rose-500 dark:text-rose-400 font-medium mt-1.5 flex items-center justify-center sm:justify-start gap-1 m-0">
                                  <ClockCircleOutlined /> Consider checking ticket history before proceeding
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 py-4">
          <button
            onClick={() => navigate("/")}
            className="w-full sm:w-auto bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-8 py-3.5 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-700 active:scale-[0.98] transition-all shadow-sm cursor-pointer border-none"
          >
            Submit Another
          </button>

          <button
            onClick={() => {
              const currentUser = JSON.parse(sessionStorage.getItem("currentUser") || "{}");
              if (currentUser.role === "admin") {
                navigate("/history");
              } else {
                navigate("/my-tickets");
              }
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-8 py-3.5 rounded-xl font-bold active:scale-[0.98] transition-all shadow-md shadow-emerald-500/10 cursor-pointer border-none"
          >
            View History
          </button>
        </div>
      </div>
    </div>
  );
}

export default Result;