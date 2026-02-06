const agentBaseUrl = process.env.AGENT_BASE_URL || "http://agent:7001";

export async function startDesktopRecording(label?: string) {
  const res = await fetch(`${agentBaseUrl}/record/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label })
  });
  if (!res.ok) {
    throw new Error("Failed to start desktop recording");
  }
  return res.json();
}

export async function stopDesktopRecording() {
  const res = await fetch(`${agentBaseUrl}/record/stop`, {
    method: "POST"
  });
  if (!res.ok) {
    throw new Error("Failed to stop desktop recording");
  }
  return res.json();
}
