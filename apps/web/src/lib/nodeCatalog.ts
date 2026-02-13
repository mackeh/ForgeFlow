export type NodeOption = {
  label: string;
  type: string;
  category: "Core" | "Control" | "Data" | "Web" | "Desktop";
  aliases?: string[];
};

export const NODE_OPTIONS: NodeOption[] = [
  { label: "HTTP Request", type: "http_request", category: "Core", aliases: ["api", "rest"] },
  { label: "Set Variable", type: "set_variable", category: "Core", aliases: ["context"] },
  { label: "LLM Clean", type: "transform_llm", category: "Core", aliases: ["ai", "transform"] },
  { label: "Validate Record", type: "validate_record", category: "Core", aliases: ["schema"] },
  { label: "Submit Guard", type: "submit_guard", category: "Core", aliases: ["gate", "submit"] },
  { label: "Manual Approval", type: "manual_approval", category: "Control", aliases: ["review"] },
  { label: "Conditional Branch", type: "conditional_branch", category: "Control", aliases: ["if", "else"] },
  { label: "Loop Iterate", type: "loop_iterate", category: "Control", aliases: ["for", "each"] },
  { label: "Parallel Execute", type: "parallel_execute", category: "Control", aliases: ["concurrent"] },
  { label: "CSV Import", type: "data_import_csv", category: "Data", aliases: ["spreadsheet"] },
  { label: "Integration Request", type: "integration_request", category: "Data", aliases: ["connector"] },
  { label: "Web Navigate", type: "playwright_navigate", category: "Web", aliases: ["browser", "open"] },
  { label: "Web Click", type: "playwright_click", category: "Web", aliases: ["selector"] },
  { label: "Web Fill", type: "playwright_fill", category: "Web", aliases: ["form", "input"] },
  { label: "Web Extract", type: "playwright_extract", category: "Web", aliases: ["scrape"] },
  { label: "Web Visual Assert", type: "playwright_visual_assert", category: "Web", aliases: ["snapshot", "diff"] },
  { label: "Desktop Click", type: "desktop_click", category: "Desktop", aliases: ["mouse"] },
  { label: "Desktop Click Image", type: "desktop_click_image", category: "Desktop", aliases: ["opencv", "image"] },
  { label: "Desktop Type", type: "desktop_type", category: "Desktop", aliases: ["keyboard"] },
  { label: "Desktop Wait Image", type: "desktop_wait_for_image", category: "Desktop", aliases: ["wait"] }
];

export function filterNodeOptions(options: NodeOption[], rawSearch: string) {
  const search = rawSearch.trim().toLowerCase();
  if (!search) {
    return options;
  }

  return options
    .filter((option) =>
      [option.label, option.type, option.category, ...(option.aliases || [])].join(" ").toLowerCase().includes(search)
    )
    .sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(search) || a.type.toLowerCase().startsWith(search);
      const bStarts = b.label.toLowerCase().startsWith(search) || b.type.toLowerCase().startsWith(search);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
}
