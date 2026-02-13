export type ActivityDescriptor = {
  id: string;
  label: string;
  category: string;
  status: "available" | "planned";
  description: string;
  aliases?: string[];
};

const activities: ActivityDescriptor[] = [
  { id: "http_request", label: "HTTP Request", category: "Core", status: "available", description: "Call REST endpoints." },
  { id: "set_variable", label: "Set Variable", category: "Core", status: "available", description: "Set workflow context values." },
  { id: "transform_llm", label: "LLM Transform", category: "AI", status: "available", description: "Use local LLM to transform content." },
  { id: "validate_record", label: "Validate Record", category: "Core", status: "available", description: "Validate data against schema rules." },
  { id: "submit_guard", label: "Submit Guard", category: "Core", status: "available", description: "Gate outputs through validation." },
  { id: "manual_approval", label: "Manual Approval", category: "Control", status: "available", description: "Pause run for human approval." },
  { id: "conditional_branch", label: "Conditional Branch", category: "Control", status: "available", description: "Route based on conditions." },
  { id: "loop_iterate", label: "Loop Iterate", category: "Control", status: "available", description: "Iterate over array values." },
  { id: "parallel_execute", label: "Parallel Execute", category: "Control", status: "available", description: "Execute sub-tasks concurrently." },
  { id: "data_import_csv", label: "CSV Import", category: "Data", status: "available", description: "Import CSV rows into context." },
  { id: "integration_request", label: "Integration Request", category: "Data", status: "available", description: "Call configured integration connectors." },
  { id: "playwright_navigate", label: "Web Navigate", category: "Web", status: "available", description: "Navigate browser to URL." },
  { id: "playwright_click", label: "Web Click", category: "Web", status: "available", description: "Click web elements via selector." },
  { id: "playwright_fill", label: "Web Fill", category: "Web", status: "available", description: "Fill web form fields." },
  { id: "playwright_extract", label: "Web Extract", category: "Web", status: "available", description: "Extract text/data from web pages." },
  { id: "playwright_visual_assert", label: "Web Visual Assert", category: "Web", status: "available", description: "Run visual regression assertions." },
  { id: "desktop_click", label: "Desktop Click", category: "Desktop", status: "available", description: "Click desktop coordinates." },
  { id: "desktop_click_image", label: "Desktop Click Image", category: "Desktop", status: "available", description: "Image-based desktop click." },
  { id: "desktop_type", label: "Desktop Type", category: "Desktop", status: "available", description: "Type text into desktop apps." },
  { id: "desktop_wait_for_image", label: "Desktop Wait Image", category: "Desktop", status: "available", description: "Wait for image on screen." },

  { id: "excel_read_range", label: "Excel Read Range", category: "Office", status: "planned", description: "Read tabular ranges from Excel." },
  { id: "excel_write_range", label: "Excel Write Range", category: "Office", status: "planned", description: "Write data to Excel sheets." },
  { id: "excel_filter_table", label: "Excel Filter Table", category: "Office", status: "planned", description: "Filter workbook data tables." },
  { id: "pdf_extract_text", label: "PDF Extract Text", category: "Documents", status: "planned", description: "Extract text from PDFs." },
  { id: "pdf_split_merge", label: "PDF Split Merge", category: "Documents", status: "planned", description: "Split and merge PDF files." },
  { id: "email_send", label: "Email Send", category: "Communication", status: "planned", description: "Send emails with attachments." },
  { id: "email_read_inbox", label: "Email Read Inbox", category: "Communication", status: "planned", description: "Read and parse inbox messages." },
  { id: "clipboard_ai_transfer", label: "Clipboard AI Transfer", category: "AI", status: "planned", description: "Context-aware copy/paste automation." },
  { id: "document_understanding", label: "Document Understanding", category: "AI", status: "planned", description: "AI extraction from documents." },
  { id: "sap_table_extract", label: "SAP Table Extract", category: "Enterprise Apps", status: "planned", description: "Extract structured SAP data." },
  { id: "java_ui_extract", label: "Java UI Extract", category: "Enterprise Apps", status: "planned", description: "Extract data from Java applications." },
  { id: "dotnet_ui_extract", label: ".NET UI Extract", category: "Enterprise Apps", status: "planned", description: "Extract data from .NET applications." },
  { id: "task_capture_record", label: "Task Capture", category: "Discovery", status: "planned", description: "Document process maps from actions." },
  { id: "task_mining", label: "Task Mining", category: "Discovery", status: "planned", description: "Mine repetitive UI activity patterns." },
  { id: "process_mining", label: "Process Mining", category: "Discovery", status: "planned", description: "Analyze bottlenecks from event logs." },
  { id: "robot_attended_trigger", label: "Attended Robot Trigger", category: "Execution", status: "planned", description: "Human-triggered robot actions." },
  { id: "robot_unattended_queue", label: "Unattended Robot Queue", category: "Execution", status: "planned", description: "Queue autonomous robot jobs." },
  { id: "ai_center_model_infer", label: "AI Center Model Infer", category: "AI", status: "planned", description: "Use hosted ML model inference." },
  { id: "orchestrator_queue", label: "Orchestrator Queue", category: "Management", status: "planned", description: "Manage queue-based workloads." },
  { id: "orchestrator_asset", label: "Orchestrator Asset", category: "Management", status: "planned", description: "Manage centralized automation assets." },
  { id: "app_builder_form", label: "Apps Form", category: "Apps", status: "planned", description: "Low-code business app form component." },
  { id: "app_builder_dashboard", label: "Apps Dashboard", category: "Apps", status: "planned", description: "Low-code KPI dashboard component." }
];

export function listActivities() {
  const available = activities.filter((item) => item.status === "available");
  const planned = activities.filter((item) => item.status === "planned");
  const byCategory = activities.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  return {
    targetLibrarySize: 300,
    currentTotal: activities.length,
    availableCount: available.length,
    plannedCount: planned.length,
    byCategory,
    items: activities
  };
}
