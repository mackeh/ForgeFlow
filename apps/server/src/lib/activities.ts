export type ActivityPhase = "phase-1" | "phase-2" | "phase-3";

export type ActivityDescriptor = {
  id: string;
  label: string;
  category: string;
  pack: string;
  phase: ActivityPhase;
  status: "available" | "planned";
  description: string;
  aliases?: string[];
};

const activities: ActivityDescriptor[] = [
  { id: "http_request", label: "HTTP Request", category: "Core", pack: "system-core", phase: "phase-1", status: "available", description: "Call REST endpoints." },
  { id: "set_variable", label: "Assign", category: "Core", pack: "system-core", phase: "phase-1", status: "available", description: "Set workflow context values.", aliases: ["workflow_assign"] },
  { id: "workflow_delay", label: "Delay", category: "Core", pack: "system-core", phase: "phase-1", status: "planned", description: "Pause execution for a duration." },
  { id: "do_while", label: "Do While", category: "Core", pack: "system-core", phase: "phase-1", status: "planned", description: "Loop while condition is true." },
  { id: "conditional_branch", label: "If", category: "Control", pack: "system-core", phase: "phase-1", status: "available", description: "Route execution based on a condition.", aliases: ["workflow_if"] },
  { id: "workflow_switch", label: "Switch", category: "Control", pack: "system-core", phase: "phase-1", status: "planned", description: "Route to one of many branches." },
  { id: "parallel_execute", label: "Parallel", category: "Control", pack: "system-core", phase: "phase-1", status: "available", description: "Execute sub-tasks concurrently.", aliases: ["workflow_parallel"] },
  { id: "loop_iterate", label: "For Each", category: "Control", pack: "system-core", phase: "phase-1", status: "available", description: "Iterate over collection values.", aliases: ["workflow_for_each"] },
  { id: "retry_scope", label: "Retry Scope", category: "Control", pack: "system-core", phase: "phase-1", status: "planned", description: "Retry enclosed steps with policy controls." },
  { id: "trigger_scope", label: "Trigger Scope", category: "Control", pack: "system-core", phase: "phase-1", status: "planned", description: "Execute workflow branch from trigger context." },
  { id: "manual_approval", label: "Manual Approval", category: "Control", pack: "system-core", phase: "phase-1", status: "available", description: "Pause run for human approval." },
  { id: "submit_guard", label: "Submit Guard", category: "Core", pack: "system-core", phase: "phase-1", status: "available", description: "Gate outputs through validation." },
  { id: "validate_record", label: "Validate Record", category: "Core", pack: "system-core", phase: "phase-1", status: "available", description: "Validate data against schema rules." },

  { id: "build_data_table", label: "Build Data Table", category: "Data Table", pack: "data-table", phase: "phase-1", status: "planned", description: "Create a structured in-memory table." },
  { id: "filter_data_table", label: "Filter Data Table", category: "Data Table", pack: "data-table", phase: "phase-1", status: "planned", description: "Filter rows from a data table." },
  { id: "sort_data_table", label: "Sort Data Table", category: "Data Table", pack: "data-table", phase: "phase-1", status: "planned", description: "Sort rows by selected columns." },
  { id: "add_data_row", label: "Add Data Row", category: "Data Table", pack: "data-table", phase: "phase-1", status: "planned", description: "Append row values to a data table." },
  { id: "add_data_column", label: "Add Data Column", category: "Data Table", pack: "data-table", phase: "phase-1", status: "planned", description: "Append new column definitions." },
  { id: "output_data_table", label: "Output Data Table", category: "Data Table", pack: "data-table", phase: "phase-1", status: "planned", description: "Export table to downstream steps." },
  { id: "lookup_data_table", label: "Lookup Data Table", category: "Data Table", pack: "data-table", phase: "phase-1", status: "planned", description: "Lookup row values by key." },
  { id: "data_import_csv", label: "CSV Import", category: "Data", pack: "data-table", phase: "phase-1", status: "available", description: "Import CSV rows into context." },

  { id: "copy_file", label: "Copy File", category: "File & Folder", pack: "file-folder", phase: "phase-1", status: "planned", description: "Copy files between locations." },
  { id: "copy_folder", label: "Copy Folder", category: "File & Folder", pack: "file-folder", phase: "phase-1", status: "planned", description: "Copy folder trees." },
  { id: "create_file", label: "Create File", category: "File & Folder", pack: "file-folder", phase: "phase-1", status: "planned", description: "Create new file resources." },
  { id: "create_folder", label: "Create Folder", category: "File & Folder", pack: "file-folder", phase: "phase-1", status: "planned", description: "Create new directories." },
  { id: "file_delete", label: "Delete File/Folder", category: "File & Folder", pack: "file-folder", phase: "phase-1", status: "planned", description: "Delete files or folders." },
  { id: "move_file", label: "Move", category: "File & Folder", pack: "file-folder", phase: "phase-1", status: "planned", description: "Move files/folders to new paths." },
  { id: "rename_file", label: "Rename", category: "File & Folder", pack: "file-folder", phase: "phase-1", status: "planned", description: "Rename file or folder targets." },
  { id: "append_line", label: "Append Line", category: "File & Folder", pack: "file-folder", phase: "phase-1", status: "planned", description: "Append text lines to file." },
  { id: "path_exists", label: "Path Exists", category: "File & Folder", pack: "file-folder", phase: "phase-1", status: "planned", description: "Check path existence." },

  { id: "use_application_browser", label: "Use Application/Browser", category: "Interaction", pack: "interaction", phase: "phase-1", status: "planned", description: "Scope UI automation context." },
  { id: "playwright_click", label: "Click", category: "Interaction", pack: "interaction", phase: "phase-1", status: "available", description: "Click web elements via selector." },
  { id: "playwright_fill", label: "Type Into", category: "Interaction", pack: "interaction", phase: "phase-1", status: "available", description: "Fill web form fields." },
  { id: "hover", label: "Hover", category: "Interaction", pack: "interaction", phase: "phase-1", status: "planned", description: "Hover over UI targets." },
  { id: "check_app_state", label: "Check App State", category: "Interaction", pack: "interaction", phase: "phase-1", status: "planned", description: "Assert application state." },
  { id: "playwright_extract", label: "Get Text", category: "Interaction", pack: "interaction", phase: "phase-1", status: "available", description: "Extract text/data from app surfaces." },
  { id: "extract_table_data", label: "Extract Table Data", category: "Interaction", pack: "interaction", phase: "phase-1", status: "planned", description: "Extract tabular UI data." },
  { id: "playwright_navigate", label: "Navigate", category: "Web", pack: "interaction", phase: "phase-1", status: "available", description: "Navigate browser to URL." },

  { id: "get_clipboard", label: "Get Clipboard", category: "Input/Output", pack: "io", phase: "phase-1", status: "planned", description: "Read current clipboard value." },
  { id: "set_clipboard", label: "Set Clipboard", category: "Input/Output", pack: "io", phase: "phase-1", status: "planned", description: "Write value into clipboard." },
  { id: "keyboard_shortcuts", label: "Keyboard Shortcuts", category: "Input/Output", pack: "io", phase: "phase-1", status: "planned", description: "Send shortcut key combinations." },
  { id: "take_screenshot", label: "Take Screenshot", category: "Input/Output", pack: "io", phase: "phase-1", status: "planned", description: "Capture screenshot artifacts." },

  { id: "tap", label: "Tap", category: "Mobile", pack: "mobile", phase: "phase-2", status: "planned", description: "Tap mobile UI target." },
  { id: "swipe", label: "Swipe", category: "Mobile", pack: "mobile", phase: "phase-2", status: "planned", description: "Swipe mobile screen gesture." },
  { id: "mobile_type_text", label: "Type Text", category: "Mobile", pack: "mobile", phase: "phase-2", status: "planned", description: "Type text on mobile device." },
  { id: "set_device_orientation", label: "Set Device Orientation", category: "Mobile", pack: "mobile", phase: "phase-2", status: "planned", description: "Rotate mobile device orientation." },

  { id: "get_asset", label: "Get Asset", category: "Orchestrator", pack: "orchestrator", phase: "phase-1", status: "planned", description: "Read orchestrator asset value." },
  { id: "set_asset", label: "Set Asset", category: "Orchestrator", pack: "orchestrator", phase: "phase-1", status: "planned", description: "Write orchestrator asset value." },
  { id: "add_queue_item", label: "Add Queue Item", category: "Orchestrator", pack: "orchestrator", phase: "phase-1", status: "planned", description: "Queue transactional work item." },
  { id: "get_transaction_item", label: "Get Transaction Item", category: "Orchestrator", pack: "orchestrator", phase: "phase-1", status: "planned", description: "Pull next transaction item." },
  { id: "set_transaction_status", label: "Set Transaction Status", category: "Orchestrator", pack: "orchestrator", phase: "phase-1", status: "planned", description: "Complete/fail a transaction item." },
  { id: "orchestrator_queue", label: "Orchestrator Queue", category: "Management", pack: "orchestrator", phase: "phase-1", status: "available", description: "Manage queue-based workloads." },
  { id: "robot_attended_trigger", label: "Attended Robot Trigger", category: "Execution", pack: "orchestrator", phase: "phase-2", status: "planned", description: "Human-triggered robot actions." },
  { id: "robot_unattended_queue", label: "Unattended Robot Queue", category: "Execution", pack: "orchestrator", phase: "phase-2", status: "planned", description: "Queue autonomous robot jobs." },

  { id: "excel_process_scope", label: "Excel Process Scope", category: "Excel", pack: "office", phase: "phase-2", status: "planned", description: "Open and manage Excel process context." },
  { id: "use_excel_file", label: "Use Excel File", category: "Excel", pack: "office", phase: "phase-2", status: "planned", description: "Select workbook file scope." },
  { id: "excel_read_range", label: "Read Range", category: "Excel", pack: "office", phase: "phase-2", status: "planned", description: "Read tabular ranges from Excel." },
  { id: "excel_write_range", label: "Write Range", category: "Excel", pack: "office", phase: "phase-2", status: "planned", description: "Write data to Excel sheets." },
  { id: "excel_append_range", label: "Append Range", category: "Excel", pack: "office", phase: "phase-2", status: "planned", description: "Append rows to existing sheets." },
  { id: "excel_pivot_table", label: "Pivot Table", category: "Excel", pack: "office", phase: "phase-2", status: "planned", description: "Create pivot tables from source data." },
  { id: "excel_vlookup", label: "VLookup", category: "Excel", pack: "office", phase: "phase-2", status: "planned", description: "Execute spreadsheet lookup operations." },

  { id: "send_smtp_mail", label: "Send SMTP Mail Message", category: "Mail", pack: "communications", phase: "phase-2", status: "planned", description: "Send outbound SMTP emails." },
  { id: "get_imap_messages", label: "Get IMAP Mail Messages", category: "Mail", pack: "communications", phase: "phase-2", status: "planned", description: "Fetch inbound IMAP email messages." },
  { id: "forward_reply_email", label: "Forward/Reply Email", category: "Mail", pack: "communications", phase: "phase-2", status: "planned", description: "Forward or reply to messages." },
  { id: "save_attachments", label: "Save Attachments", category: "Mail", pack: "communications", phase: "phase-2", status: "planned", description: "Save attachments to local storage." },

  { id: "read_pdf_text", label: "Read PDF Text", category: "PDF", pack: "documents", phase: "phase-2", status: "planned", description: "Extract text from PDF files." },
  { id: "read_pdf_ocr", label: "Read PDF with OCR", category: "PDF", pack: "documents", phase: "phase-2", status: "planned", description: "Use OCR for scanned PDFs." },
  { id: "extract_pdf_range", label: "Extract PDF Page Range", category: "PDF", pack: "documents", phase: "phase-2", status: "planned", description: "Split pages from PDF files." },
  { id: "join_pdf_files", label: "Join PDF Files", category: "PDF", pack: "documents", phase: "phase-2", status: "planned", description: "Merge multiple PDFs." },

  { id: "word_application_scope", label: "Word Application Scope", category: "Word", pack: "documents", phase: "phase-2", status: "planned", description: "Open Word document automation context." },
  { id: "replace_picture", label: "Replace Picture", category: "Word", pack: "documents", phase: "phase-2", status: "planned", description: "Replace embedded images in Word docs." },
  { id: "add_hyperlink", label: "Add Hyperlink", category: "Word", pack: "documents", phase: "phase-2", status: "planned", description: "Insert hyperlinks in documents." },
  { id: "save_as_pdf", label: "Save Document as PDF", category: "Word", pack: "documents", phase: "phase-2", status: "planned", description: "Export Word docs to PDF." },

  { id: "integration_servicenow", label: "ServiceNow Connector", category: "Integration Service", pack: "integration-service", phase: "phase-2", status: "planned", description: "Connect to ServiceNow APIs/workflows." },
  { id: "integration_jira", label: "Jira Connector", category: "Integration Service", pack: "integration-service", phase: "phase-2", status: "planned", description: "Connect to Jira projects/issues." },
  { id: "integration_salesforce", label: "Salesforce Connector", category: "Integration Service", pack: "integration-service", phase: "phase-2", status: "planned", description: "Connect to Salesforce objects/data." },
  { id: "integration_slack", label: "Slack Connector", category: "Integration Service", pack: "integration-service", phase: "phase-2", status: "planned", description: "Connect to Slack channels/actions." },
  { id: "integration_microsoft_365", label: "Microsoft 365 Connector", category: "Integration Service", pack: "integration-service", phase: "phase-2", status: "planned", description: "Connect to Microsoft 365 services." },
  { id: "integration_google_workspace", label: "Google Workspace Connector", category: "Integration Service", pack: "integration-service", phase: "phase-2", status: "planned", description: "Connect to Google Workspace APIs." },
  { id: "integration_request", label: "Integration Request", category: "Data", pack: "integration-service", phase: "phase-1", status: "available", description: "Call configured integration connectors." },

  { id: "load_taxonomy", label: "Load Taxonomy", category: "Document Understanding", pack: "document-intelligence", phase: "phase-2", status: "planned", description: "Load document taxonomy models." },
  { id: "digitize_document", label: "Digitize Document", category: "Document Understanding", pack: "document-intelligence", phase: "phase-2", status: "planned", description: "Digitize scanned documents." },
  { id: "classify_document_scope", label: "Classify Document Scope", category: "Document Understanding", pack: "document-intelligence", phase: "phase-2", status: "planned", description: "Classify incoming document types." },
  { id: "data_extraction_scope", label: "Data Extraction Scope", category: "Document Understanding", pack: "document-intelligence", phase: "phase-2", status: "planned", description: "Extract structured document fields." },
  { id: "present_validation_station", label: "Present Validation Station", category: "Document Understanding", pack: "document-intelligence", phase: "phase-2", status: "planned", description: "Route extracted data for human validation." },
  { id: "document_understanding", label: "Document Understanding", category: "AI", pack: "document-intelligence", phase: "phase-1", status: "available", description: "Extract structured fields from raw document text." },

  { id: "summarize_text", label: "Summarize Text", category: "AI Center/GenAI", pack: "ai-center", phase: "phase-2", status: "planned", description: "Summarize long-form text." },
  { id: "translate_text", label: "Translate", category: "AI Center/GenAI", pack: "ai-center", phase: "phase-2", status: "planned", description: "Translate text between languages." },
  { id: "pii_filtering", label: "PII Filtering", category: "AI Center/GenAI", pack: "ai-center", phase: "phase-2", status: "planned", description: "Detect and redact sensitive PII." },
  { id: "categorize_text", label: "Categorize", category: "AI Center/GenAI", pack: "ai-center", phase: "phase-2", status: "planned", description: "Categorize content using AI." },
  { id: "sentiment_analysis", label: "Sentiment Analysis", category: "AI Center/GenAI", pack: "ai-center", phase: "phase-2", status: "planned", description: "Detect sentiment polarity." },
  { id: "image_analysis", label: "Image Analysis", category: "AI Center/GenAI", pack: "ai-center", phase: "phase-3", status: "planned", description: "Analyze images and visual content." },
  { id: "ai_center_model_infer", label: "AI Center Model Infer", category: "AI", pack: "ai-center", phase: "phase-2", status: "planned", description: "Use hosted ML model inference." },
  { id: "transform_llm", label: "LLM Transform", category: "AI", pack: "ai-center", phase: "phase-1", status: "available", description: "Use local LLM to transform content." },
  { id: "clipboard_ai_transfer", label: "Clipboard AI Transfer", category: "AI", pack: "ai-center", phase: "phase-1", status: "available", description: "Context-aware copy/paste normalization between workflow contexts." },

  { id: "cv_click", label: "CV Click", category: "Computer Vision", pack: "computer-vision", phase: "phase-2", status: "planned", description: "Image-based click interaction." },
  { id: "cv_type_into", label: "CV Type Into", category: "Computer Vision", pack: "computer-vision", phase: "phase-2", status: "planned", description: "Image-anchored typing interaction." },
  { id: "cv_get_text", label: "CV Get Text", category: "Computer Vision", pack: "computer-vision", phase: "phase-2", status: "planned", description: "OCR text extraction from screen regions." },
  { id: "desktop_click", label: "Desktop Click", category: "Desktop", pack: "computer-vision", phase: "phase-1", status: "available", description: "Click desktop coordinates." },
  { id: "desktop_click_image", label: "Desktop Click Image", category: "Desktop", pack: "computer-vision", phase: "phase-1", status: "available", description: "Image-based desktop click." },
  { id: "desktop_type", label: "Desktop Type", category: "Desktop", pack: "computer-vision", phase: "phase-1", status: "available", description: "Type text into desktop apps." },
  { id: "desktop_wait_for_image", label: "Desktop Wait Image", category: "Desktop", pack: "computer-vision", phase: "phase-1", status: "available", description: "Wait for image on screen." },

  { id: "db_connect", label: "Connect", category: "Database", pack: "database", phase: "phase-2", status: "planned", description: "Open database connection." },
  { id: "db_disconnect", label: "Disconnect", category: "Database", pack: "database", phase: "phase-2", status: "planned", description: "Close database connection." },
  { id: "db_run_query", label: "Run Query", category: "Database", pack: "database", phase: "phase-2", status: "planned", description: "Execute SELECT-style query." },
  { id: "db_run_command", label: "Run Command", category: "Database", pack: "database", phase: "phase-2", status: "planned", description: "Execute non-query command." },

  { id: "ftp_scope", label: "FTP Scope", category: "FTP", pack: "ftp", phase: "phase-2", status: "planned", description: "Open FTP/SFTP session context." },
  { id: "ftp_download", label: "Download Files", category: "FTP", pack: "ftp", phase: "phase-2", status: "planned", description: "Download files from FTP server." },
  { id: "ftp_upload", label: "Upload Files", category: "FTP", pack: "ftp", phase: "phase-2", status: "planned", description: "Upload files to FTP server." },
  { id: "ftp_delete", label: "Delete", category: "FTP", pack: "ftp", phase: "phase-2", status: "planned", description: "Delete files on FTP server." },
  { id: "ftp_file_exists", label: "File Exists", category: "FTP", pack: "ftp", phase: "phase-2", status: "planned", description: "Check remote file existence." },

  { id: "terminal_session", label: "Terminal Session", category: "Terminal/Mainframe", pack: "terminal-mainframe", phase: "phase-3", status: "planned", description: "Open terminal or mainframe session." },
  { id: "terminal_get_field", label: "Get Field", category: "Terminal/Mainframe", pack: "terminal-mainframe", phase: "phase-3", status: "planned", description: "Read field value from terminal screen." },
  { id: "terminal_send_keys", label: "Send Keys", category: "Terminal/Mainframe", pack: "terminal-mainframe", phase: "phase-3", status: "planned", description: "Send key sequences to terminal." },

  { id: "encrypt_file", label: "Encrypt File", category: "Cryptography", pack: "cryptography", phase: "phase-3", status: "planned", description: "Encrypt files using managed keys." },
  { id: "decrypt_file", label: "Decrypt File", category: "Cryptography", pack: "cryptography", phase: "phase-3", status: "planned", description: "Decrypt files using managed keys." },

  { id: "task_capture_record", label: "Task Capture", category: "Discovery", pack: "discovery", phase: "phase-2", status: "planned", description: "Document process maps from actions." },
  { id: "task_mining", label: "Task Mining", category: "Discovery", pack: "discovery", phase: "phase-2", status: "planned", description: "Mine repetitive UI activity patterns." },
  { id: "process_mining", label: "Process Mining", category: "Discovery", pack: "discovery", phase: "phase-2", status: "planned", description: "Analyze bottlenecks from event logs." },

  { id: "orchestrator_asset", label: "Orchestrator Asset", category: "Management", pack: "orchestrator", phase: "phase-2", status: "planned", description: "Manage centralized automation assets." },
  { id: "app_builder_form", label: "Apps Form", category: "Apps", pack: "apps", phase: "phase-3", status: "planned", description: "Low-code business app form component." },
  { id: "app_builder_dashboard", label: "Apps Dashboard", category: "Apps", pack: "apps", phase: "phase-3", status: "planned", description: "Low-code KPI dashboard component." }
];

const packOrder = [
  "system-core",
  "data-table",
  "file-folder",
  "interaction",
  "io",
  "orchestrator",
  "office",
  "communications",
  "documents",
  "integration-service",
  "document-intelligence",
  "ai-center",
  "computer-vision",
  "database",
  "ftp",
  "mobile",
  "terminal-mainframe",
  "cryptography",
  "discovery",
  "apps"
] as const;

const packLabels: Record<string, string> = {
  "system-core": "System & Core",
  "data-table": "Data Table",
  "file-folder": "File & Folder",
  interaction: "Interaction",
  io: "Input/Output",
  orchestrator: "Orchestrator",
  office: "Excel",
  communications: "Mail",
  documents: "PDF/Word",
  "integration-service": "Integration Service",
  "document-intelligence": "Document Understanding",
  "ai-center": "AI Center / GenAI",
  "computer-vision": "Computer Vision",
  database: "Database",
  ftp: "FTP",
  mobile: "Mobile",
  "terminal-mainframe": "Terminal/Mainframe",
  cryptography: "Cryptography",
  discovery: "Discovery",
  apps: "Apps"
};

export function listActivities() {
  const available = activities.filter((item) => item.status === "available");
  const planned = activities.filter((item) => item.status === "planned");
  const byCategory = activities.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  const byPhase = activities.reduce<Record<ActivityPhase, number>>(
    (acc, item) => {
      acc[item.phase] += 1;
      return acc;
    },
    { "phase-1": 0, "phase-2": 0, "phase-3": 0 }
  );
  const byPack = activities.reduce<Record<string, number>>((acc, item) => {
    acc[item.pack] = (acc[item.pack] || 0) + 1;
    return acc;
  }, {});

  const roadmap = packOrder
    .filter((packId) => byPack[packId] > 0)
    .map((packId) => {
      const packItems = activities.filter((item) => item.pack === packId);
      const availableCount = packItems.filter((item) => item.status === "available").length;
      const plannedCount = packItems.length - availableCount;
      const phaseRank = Math.min(
        ...packItems.map((item) => {
          if (item.phase === "phase-1") return 1;
          if (item.phase === "phase-2") return 2;
          return 3;
        })
      );
      const phase: ActivityPhase = phaseRank === 1 ? "phase-1" : phaseRank === 2 ? "phase-2" : "phase-3";
      return {
        id: packId,
        label: packLabels[packId] || packId,
        phase,
        total: packItems.length,
        available: availableCount,
        planned: plannedCount,
        activityIds: packItems.map((item) => item.id)
      };
    });

  return {
    targetLibrarySize: 300,
    currentTotal: activities.length,
    availableCount: available.length,
    plannedCount: planned.length,
    byCategory,
    byPhase,
    byPack,
    roadmap,
    phaseFocus: {
      now: "phase-1" as ActivityPhase,
      next: "phase-2" as ActivityPhase,
      later: "phase-3" as ActivityPhase
    },
    items: activities
  };
}
